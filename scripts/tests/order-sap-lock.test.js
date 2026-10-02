// Prueba unitaria: guarda de pedidos ya transmitidos a SAP (Order.isSapLocked / sapLockedError).
// Uso: node scripts/tests/order-sap-lock.test.js
//   o en el contenedor: docker exec -i artesa-api-staging node - < scripts/tests/order-sap-lock.test.js
// La verificación HTTP (409 en PUT /api/orders/:id, PUT /api/orders/:id/cancel y rutas de sucursal)
// se hace en Staging con un pedido real sincronizado; ver el reporte de validación.
let Order;
try { Order = require('/app/src/models/Order'); }
catch (e) { Order = require(require('path').join(process.cwd(), 'src/models/Order')); }

let failed = 0;
const eq = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label} -> ${actual}${ok ? '' : ' (esperado ' + expected + ')'}`);
};

eq('no sincronizado (sap_synced=false)', Order.isSapLocked({ sap_synced: false, sap_doc_entry: null, sap_sync_status: null }), false);
eq('no sincronizado (campos NULL)', Order.isSapLocked({ sap_synced: null, sap_doc_entry: null, sap_sync_status: null }), false);
eq('no sincronizado con error previo', Order.isSapLocked({ sap_synced: false, sap_doc_entry: null, sap_sync_status: 'error' }), false);
eq('sincronizado (sap_synced=true)', Order.isSapLocked({ sap_synced: true, sap_doc_entry: 123, sap_sync_status: null }), true);
eq('con DocEntry aunque sap_synced=false', Order.isSapLocked({ sap_synced: false, sap_doc_entry: 123, sap_sync_status: null }), true);
eq('en transmisión (processing)', Order.isSapLocked({ sap_synced: false, sap_doc_entry: null, sap_sync_status: 'processing' }), true);
eq('fila inexistente', Order.isSapLocked(undefined), false);

const err = Order.sapLockedError();
eq('error.statusCode', err.statusCode, 409);
eq('error.code', err.code, 'ORDER_SAP_LOCKED');
eq('mensaje', err.message, 'Este pedido ya fue transmitido a SAP y no puede modificarse ni cancelarse desde el portal. Comuníquese con el área comercial.');

console.log(failed === 0 ? '\nRESULTADO: TODAS LAS PRUEBAS PASARON' : `\nRESULTADO: ${failed} PRUEBA(S) FALLARON`);
process.exit(failed === 0 ? 0 : 1);
