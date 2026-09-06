const pool = require('../config/db');
const { createContextLogger } = require('../config/logger');

const logger = createContextLogger('TaxCalculator');

// Cache en memoria del catálogo tax_codes/tax_code_components (sincronizado desde SAP
// por SapTaxCodeService, la fuente de verdad vive en Postgres). TTL corto para no pegarle
// a la BD en cada línea de cada orden, sin quedar desactualizado por mucho tiempo entre
// sincronizaciones diarias.
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos
let cache = null; // Map<code, { name, totalRate, isComposite, components: [{code, name, category, rate}] }>
let cacheLoadedAt = 0;

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

async function loadTaxCodesCache() {
  const result = await pool.query(
    `SELECT tc.code, tc.name, tc.total_rate, tc.is_composite,
            tcc.component_code, tcc.component_name, tcc.category, tcc.rate
     FROM tax_codes tc
     LEFT JOIN tax_code_components tcc ON tcc.tax_code = tc.code
     WHERE tc.active = true
     ORDER BY tc.code, tcc.row_number`
  );

  const map = new Map();
  for (const row of result.rows) {
    if (!map.has(row.code)) {
      map.set(row.code, {
        name: row.name,
        totalRate: parseFloat(row.total_rate),
        isComposite: row.is_composite,
        components: []
      });
    }
    if (row.component_code) {
      map.get(row.code).components.push({
        code: row.component_code,
        name: row.component_name,
        category: row.category,
        rate: parseFloat(row.rate)
      });
    }
  }
  return map;
}

async function getTaxCodesCache() {
  const isExpired = !cache || (Date.now() - cacheLoadedAt) > CACHE_TTL_MS;
  if (isExpired) {
    cache = await loadTaxCodesCache();
    cacheLoadedAt = Date.now();
  }
  return cache;
}

/**
 * Únicamente para pruebas: permite inyectar un catálogo sin tocar la base de datos real.
 * No usar fuera de scripts/tests.
 */
function _setCacheForTesting(entries) {
  cache = new Map(entries);
  cacheLoadedAt = Date.now();
}

/**
 * Calcula el desglose de impuestos de una línea de producto a partir del
 * tax_code_ar sincronizado desde el maestro de artículos de SAP (ArTaxCode),
 * usando el catálogo tax_codes/tax_code_components (sincronizado desde
 * SalesTaxCodes/SalesTaxAuthorities de SAP por SapTaxCodeService).
 *
 * Principio rector: la app nunca inventa una tasa. Si tax_code_ar es NULL/vacío,
 * o si el código no está (todavía) en el catálogo local sincronizado, el resultado
 * es 0% en todos los componentes — nunca un default de 19% — con un log de
 * advertencia trazable (product_id/sap_code) para que Artesa corrija el dato
 * maestro en SAP o se dispare una sincronización.
 *
 * @param {Object} params
 * @param {string|null|undefined} params.taxCodeAr
 * @param {number} params.subtotal
 * @param {number|string} [params.productId]
 * @param {string} [params.sapCode]
 * @returns {Promise<{taxCodeAr: (string|null), totalTaxAmount: number, taxBreakdown: Array<{code: string, name: string, category: string, rate: number, amount: number}>}>}
 */
async function calculateProductTax({ taxCodeAr, subtotal, productId = null, sapCode = null }) {
  const base = parseFloat(subtotal) || 0;

  if (!taxCodeAr) {
    logger.warn('Producto sin tax_code_ar sincronizado desde SAP: se calcula 0% (no se asume una tasa por defecto)', {
      productId,
      sapCode
    });
    return { taxCodeAr: null, totalTaxAmount: 0, taxBreakdown: [] };
  }

  const catalog = await getTaxCodesCache();
  const entry = catalog.get(taxCodeAr);

  if (!entry) {
    logger.warn('tax_code_ar no encontrado en el catálogo local tax_codes (pendiente de sincronización desde SAP): se calcula 0% (no se asume una tasa por defecto)', {
      productId,
      sapCode,
      taxCodeAr
    });
    return { taxCodeAr, totalTaxAmount: 0, taxBreakdown: [] };
  }

  const taxBreakdown = entry.components.map(component => ({
    code: component.code,
    name: component.name,
    category: component.category,
    rate: component.rate,
    amount: round2(base * component.rate)
  }));

  const totalTaxAmount = round2(taxBreakdown.reduce((sum, t) => sum + t.amount, 0));

  return { taxCodeAr, totalTaxAmount, taxBreakdown };
}

/**
 * Calcula el desglose de impuestos de una orden completa.
 *
 * @param {Array<{product_id: (number|string), sap_code?: string, tax_code_ar: (string|null), unit_price: (number|string), quantity: (number|string)}>} itemsWithTaxCode
 * @returns {Promise<{items: Array<Object>, subtotal: number, totalTaxAmount: number, taxBreakdownTotals: Array<{category: string, amount: number}>, total: number}>}
 */
async function calculateOrderTaxes(itemsWithTaxCode) {
  let subtotal = 0;
  let totalTaxAmount = 0;
  const categoryTotals = new Map(); // category -> amount

  const items = [];
  for (const item of itemsWithTaxCode) {
    const itemSubtotal = (parseFloat(item.unit_price) || 0) * (parseInt(item.quantity, 10) || 0);
    const tax = await calculateProductTax({
      taxCodeAr: item.tax_code_ar,
      subtotal: itemSubtotal,
      productId: item.product_id,
      sapCode: item.sap_code
    });

    subtotal += itemSubtotal;
    totalTaxAmount += tax.totalTaxAmount;

    for (const component of tax.taxBreakdown) {
      categoryTotals.set(component.category, round2((categoryTotals.get(component.category) || 0) + component.amount));
    }

    items.push({
      product_id: item.product_id,
      subtotal: round2(itemSubtotal),
      ...tax
    });
  }

  subtotal = round2(subtotal);
  totalTaxAmount = round2(totalTaxAmount);

  return {
    items,
    subtotal,
    totalTaxAmount,
    taxBreakdownTotals: Array.from(categoryTotals.entries()).map(([category, amount]) => ({ category, amount })),
    total: round2(subtotal + totalTaxAmount)
  };
}

module.exports = {
  calculateProductTax,
  calculateOrderTaxes,
  _setCacheForTesting
};
