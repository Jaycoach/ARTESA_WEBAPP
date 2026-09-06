const assert = require('assert');
const {
  calculateProductTax,
  calculateOrderTaxes,
  _setCacheForTesting
} = require('../../src/utils/taxCalculator');

// Catálogo de prueba que replica la evidencia real confirmada contra PRUEBAS_ARTESA_14JUL
// (SalesTaxCodes / SalesTaxAuthorities), sin tocar la base de datos.
_setCacheForTesting([
  ['IVAG03', { name: 'IVA EXCLUIDO', totalRate: 0, isComposite: false, components: [] }],
  ['IVAG01', { name: 'IVA GENERADO VENTAS 19%', totalRate: 0.19, isComposite: false, components: [
    { code: 'IVAG01', name: 'IVA GENERADO VENTAS 19%', category: 'IVA', rate: 0.19 }
  ] }],
  ['IMSB+IVA', { name: 'IMPUESTO SALUDABLE + IVA', totalRate: 0.39, isComposite: true, components: [
    { code: 'IMSB', name: 'IMPUESTO SALUDABLE', category: 'IMPUESTO_SALUDABLE', rate: 0.20 },
    { code: 'IVAG01', name: 'IVA GENERADO VENTAS 19%', category: 'IVA', rate: 0.19 }
  ] }],
  ['IMCS', { name: 'IMPUESTO AL CONSUMO 8%', totalRate: 0.08, isComposite: false, components: [
    { code: 'IMCS', name: 'IMPUESTO AL CONSUMO 8%', category: 'OTRO', rate: 0.08 }
  ] }]
]);

let passed = 0;
const check = (label, actual, expected) => {
  assert.deepStrictEqual(actual, expected, `${label}\nEsperado: ${JSON.stringify(expected)}\nObtenido: ${JSON.stringify(actual)}`);
  passed += 1;
  console.log(`OK  ${label}`);
};

(async () => {
  // Caso 1: IVAG03 -> exento
  check(
    'IVAG03 exento de impuestos',
    await calculateProductTax({ taxCodeAr: 'IVAG03', subtotal: 1000, productId: 1 }),
    { taxCodeAr: 'IVAG03', totalTaxAmount: 0, taxBreakdown: [] }
  );

  // Caso 2: IMSB+IVA -> compuesto real confirmado contra SAP (IMSB 20% + IVAG01 19%, independientes)
  check(
    'IMSB+IVA aplica IVA 19% + Impuesto Saludable 20% como componentes independientes',
    await calculateProductTax({ taxCodeAr: 'IMSB+IVA', subtotal: 1000, productId: 2 }),
    {
      taxCodeAr: 'IMSB+IVA',
      totalTaxAmount: 390,
      taxBreakdown: [
        { code: 'IMSB', name: 'IMPUESTO SALUDABLE', category: 'IMPUESTO_SALUDABLE', rate: 0.20, amount: 200 },
        { code: 'IVAG01', name: 'IVA GENERADO VENTAS 19%', category: 'IVA', rate: 0.19, amount: 190 }
      ]
    }
  );

  // Caso 3: IVAG01 -> IVA estándar 19% (código real confirmado en SAP, no un "default" adivinado)
  check(
    'IVAG01 aplica IVA estándar 19%',
    await calculateProductTax({ taxCodeAr: 'IVAG01', subtotal: 1000, productId: 3 }),
    {
      taxCodeAr: 'IVAG01',
      totalTaxAmount: 190,
      taxBreakdown: [{ code: 'IVAG01', name: 'IVA GENERADO VENTAS 19%', category: 'IVA', rate: 0.19, amount: 190 }]
    }
  );

  // Caso 4: IMCS -> impuesto al consumo real de 8%, NUNCA 19% (confirma que no se puede asumir un default)
  check(
    'IMCS aplica su tasa real de 8% (impuesto al consumo, no IVA)',
    await calculateProductTax({ taxCodeAr: 'IMCS', subtotal: 1000, productId: 6 }),
    {
      taxCodeAr: 'IMCS',
      totalTaxAmount: 80,
      taxBreakdown: [{ code: 'IMCS', name: 'IMPUESTO AL CONSUMO 8%', category: 'OTRO', rate: 0.08, amount: 80 }]
    }
  );

  // Caso 5: tax_code_ar NULL -> 0%, nunca 19% por defecto
  check(
    'tax_code_ar NULL se trata como 0% (nunca asume 19% por defecto)',
    await calculateProductTax({ taxCodeAr: null, subtotal: 1000, productId: 4, sapCode: 'SAP-004' }),
    { taxCodeAr: null, totalTaxAmount: 0, taxBreakdown: [] }
  );

  // Caso 6: tax_code_ar con un código real de SAP que aún no está en el catálogo local -> mismo tratamiento que NULL
  check(
    'tax_code_ar no encontrado en el catálogo local se trata igual que NULL (nunca 19% por defecto)',
    await calculateProductTax({ taxCodeAr: 'CODIGO_NUEVO_SIN_SINCRONIZAR', subtotal: 1000, productId: 5, sapCode: 'SAP-005' }),
    { taxCodeAr: 'CODIGO_NUEVO_SIN_SINCRONIZAR', totalTaxAmount: 0, taxBreakdown: [] }
  );

  // Caso 7: desglose de una orden mixta con los 5 casos anteriores
  const orderResult = await calculateOrderTaxes([
    { product_id: 1, tax_code_ar: 'IVAG03', unit_price: 1000, quantity: 1 },
    { product_id: 2, tax_code_ar: 'IMSB+IVA', unit_price: 1000, quantity: 1 },
    { product_id: 3, tax_code_ar: 'IVAG01', unit_price: 1000, quantity: 1 },
    { product_id: 4, tax_code_ar: null, unit_price: 1000, quantity: 1, sap_code: 'SAP-004' },
    { product_id: 6, tax_code_ar: 'IMCS', unit_price: 1000, quantity: 1 }
  ]);
  assert.strictEqual(orderResult.subtotal, 5000, 'Subtotal de orden mixta debe ser 5000');
  assert.strictEqual(orderResult.totalTaxAmount, 660, 'Impuesto total de orden mixta debe ser 660 (390 + 190 + 80)');
  assert.strictEqual(orderResult.total, 5660, 'Total de orden mixta debe ser 5660');
  const ivaTotal = orderResult.taxBreakdownTotals.find(t => t.category === 'IVA')?.amount;
  const impSaludableTotal = orderResult.taxBreakdownTotals.find(t => t.category === 'IMPUESTO_SALUDABLE')?.amount;
  const otroTotal = orderResult.taxBreakdownTotals.find(t => t.category === 'OTRO')?.amount;
  assert.strictEqual(ivaTotal, 380, 'IVA total agrupado por categoría debe ser 380 (190 de IMSB+IVA + 190 de IVAG01)');
  assert.strictEqual(impSaludableTotal, 200, 'Impuesto Saludable total agrupado debe ser 200');
  assert.strictEqual(otroTotal, 80, 'Impuesto OTRO (consumo) total agrupado debe ser 80');
  passed += 1;
  console.log('OK  Orden mixta calcula subtotal/total y agrupa por categoría (IVA/IMPUESTO_SALUDABLE/OTRO) correctamente');

  console.log(`\n${passed} casos de prueba OK.`);
  process.exit(0);
})().catch(err => {
  console.error('FALLÓ:', err.message);
  process.exit(1);
});
