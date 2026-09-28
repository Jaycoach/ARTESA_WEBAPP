/**
 * Test unitario de los 2 casos de fallo explicito del flete al transmitir a SAP:
 * (1) falta SAP_SHIPPING_EXPENSE_CODE, (2) no se resuelve un tax_code de tasa 0%.
 * No pega a SAP real: mockea pool.query y sapOrderService.request/validateAndUpdateTRM.
 */
const assert = require('assert');
const path = require('path');

const dbPath = require.resolve('../../src/config/db');

// Cola de respuestas por texto de query -- el mock intercepta antes de que
// src/config/db.js abra una conexion real a Postgres.
let queryHandler = null;
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    query: async (text, params) => queryHandler(text, params)
  }
};

const sapOrderService = require('../../src/services/SapOrderService');

// order_details con subtotal+impuestos en el tramo de flete (50.000-79.999)
const SHIPPING_TIER_ORDER_DETAILS = [
  { quantity: 1, unit_price: 60000, tax_amount: 0, tax_code_ar: 'IVAG03', sap_code: 'PROD1' }
];

function baseQueryHandler({ zeroRateRows }) {
  return async (text) => {
    if (text.includes('FROM orders o')) {
      return { rows: [{ order_id: 1, cardcode_sap: 'C001', user_name: 'Test', comments: null, notes: null, delivery_date: new Date() }] };
    }
    if (text.includes('FROM order_details od')) {
      return { rows: SHIPPING_TIER_ORDER_DETAILS };
    }
    if (text.includes('FROM tax_codes')) {
      return { rows: zeroRateRows };
    }
    if (text.includes('FROM client_branches')) {
      return { rows: [] };
    }
    if (text.startsWith('UPDATE orders')) {
      return { rows: [] };
    }
    throw new Error(`Query no mockeada en el test: ${text}`);
  };
}

async function run() {
  sapOrderService.validateAndUpdateTRM = async () => ({ success: true, rate: 1, date: new Date(), wasUpdated: false });
  sapOrderService.request = async () => { throw new Error('No deberia llamarse a SAP en estos casos de fallo'); };

  // --- Caso 1: falta SAP_SHIPPING_EXPENSE_CODE ---
  delete process.env.SAP_SHIPPING_EXPENSE_CODE;
  queryHandler = baseQueryHandler({ zeroRateRows: [{ code: 'IVAG03' }] });

  await assert.rejects(
    () => sapOrderService.createOrderInSAP({ order_id: 1 }),
    (err) => {
      assert.ok(err.message.includes('SAP_SHIPPING_EXPENSE_CODE'), `mensaje inesperado: ${err.message}`);
      return true;
    },
    'debe fallar explicitamente si falta SAP_SHIPPING_EXPENSE_CODE en un pedido con flete'
  );

  // --- Caso 2: SAP_SHIPPING_EXPENSE_CODE presente, pero no hay tax_code de tasa 0% ---
  process.env.SAP_SHIPPING_EXPENSE_CODE = '7';
  queryHandler = baseQueryHandler({ zeroRateRows: [] });

  await assert.rejects(
    () => sapOrderService.createOrderInSAP({ order_id: 1 }),
    (err) => {
      assert.ok(err.message.includes('tasa 0%'), `mensaje inesperado: ${err.message}`);
      return true;
    },
    'debe fallar explicitamente si no se resuelve un tax_code de tasa 0% para el flete'
  );

  delete process.env.SAP_SHIPPING_EXPENSE_CODE;
  console.log('sap-shipping-expense.test.js: OK');
}

run().catch(e => { console.error(e); process.exit(1); });
