// Prueba unitaria: transmisión a SAP de pedidos con entrega en lunes no festivo el viernes anterior.
// Uso: TZ=UTC node scripts/tests/monday-friday-sync.test.js
//   o dentro del contenedor: docker exec -i artesa-api-staging node - < scripts/tests/monday-friday-sync.test.js
// (el require usa ruta relativa al repo; dentro del contenedor se resuelve contra /app)
const path = require('path');
let mod;
try { mod = require('/app/src/utils/colombianHolidays'); }
catch (e) { mod = require(path.join(process.cwd(), 'src/utils/colombianHolidays')); }
const { getDeliveryDatesToSyncOn, getTodayBogota } = mod;

let failed = 0;
const eq = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label} -> ${JSON.stringify(actual)}${ok ? '' : ' (esperado ' + JSON.stringify(expected) + ')'}`);
};

console.log(`TZ del proceso: ${process.env.TZ || 'UTC(default)'} offset=${new Date().getTimezoneOffset()}`);

// Fechas de entrega a transmitir por fecha de sincronización
eq('jue 01-oct-2026', getDeliveryDatesToSyncOn('2026-10-01'), ['2026-10-03']);
eq('vie 02-oct-2026', getDeliveryDatesToSyncOn('2026-10-02'), ['2026-10-04', '2026-10-05']);
eq('sáb 03-oct-2026 (respaldo lunes)', getDeliveryDatesToSyncOn('2026-10-03'), ['2026-10-05']);
eq('vie 09-oct-2026 (lunes 12 festivo)', getDeliveryDatesToSyncOn('2026-10-09'), ['2026-10-11']);
eq('vie 16-oct-2026', getDeliveryDatesToSyncOn('2026-10-16'), ['2026-10-18', '2026-10-19']);
eq('vie 30-oct-2026 (lunes 02-nov festivo)', getDeliveryDatesToSyncOn('2026-10-30'), ['2026-11-01']);
eq('dom 04-oct-2026', getDeliveryDatesToSyncOn('2026-10-04'), ['2026-10-06']);
eq('vie 13-nov-2026 (lunes 16-nov festivo)', getDeliveryDatesToSyncOn('2026-11-13'), ['2026-11-15']);

// "Hoy" en America/Bogota (el contenedor corre en UTC)
eq('20:05 Col (01:05Z sábado) -> hoy', getTodayBogota(new Date('2026-10-03T01:05:00Z')), '2026-10-02');
eq('20:05 Col -> lista', getDeliveryDatesToSyncOn(getTodayBogota(new Date('2026-10-03T01:05:00Z'))), ['2026-10-04', '2026-10-05']);
eq('23:00 Col (04:00Z) -> hoy', getTodayBogota(new Date('2026-10-03T04:00:00Z')), '2026-10-02');
eq('23:00 Col -> lista', getDeliveryDatesToSyncOn(getTodayBogota(new Date('2026-10-03T04:00:00Z'))), ['2026-10-04', '2026-10-05']);
eq('18:30 Col (23:30Z viernes) -> hoy', getTodayBogota(new Date('2026-10-02T23:30:00Z')), '2026-10-02');
eq('00:00 Col sábado (05:00Z) -> hoy', getTodayBogota(new Date('2026-10-03T05:00:00Z')), '2026-10-03');
eq('23:59 Col viernes (04:59Z) -> hoy', getTodayBogota(new Date('2026-10-03T04:59:00Z')), '2026-10-02');

console.log(failed === 0 ? '\nRESULTADO: TODAS LAS PRUEBAS PASARON' : `\nRESULTADO: ${failed} PRUEBA(S) FALLARON`);
process.exit(failed === 0 ? 0 : 1);
