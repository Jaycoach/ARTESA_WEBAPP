/**
 * Script de aceptación — reintento del sync de pedidos + alertas por correo.
 * Corre contra la BD real de EC2 Staging (artesadb_dev), nunca contra local.
 * Ninguna credencial va hardcodeada — todas se leen de variables de entorno.
 *
 * No crea documentos en SAP ni pedidos de prueba: valida las precondiciones de esquema y
 * la lógica de fecha/traducción de error que el fix asume, sin efectos secundarios.
 * Las pruebas 1-4, 6 y 7 de la sección 7 (crean pedidos reales, disparan el reintento real,
 * envían correo real) requieren SSH a Staging y se documentan al final como instrucciones,
 * no se ejecutan desde aquí.
 *
 * Uso:
 *   export DB_HOST / DB_USER / DB_PASSWORD / DB_DATABASE / DB_PORT   # BD de STAGING (artesadb_dev)
 *   node scripts/tests/order-sync-retry-alerts-acceptance.js
 */

'use strict';

const { Pool } = require('pg');

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Falta variable de entorno requerida: ${name}`);
    process.exit(1);
  }
  return v;
}

// Guarda obligatoria: esta instancia RDS es compartida entre Staging (artesadb_dev) y
// Producción (laartesa), con el mismo usuario — un DB_DATABASE mal configurado en el
// entorno de quien corre el script apuntaría este script de solo lectura a Producción sin
// avisar. Aborta antes de correr cualquier query si la BD conectada no es la esperada.
const EXPECTED_DATABASE = process.env.EXPECTED_DB_DATABASE || 'artesadb_dev';

const pool = new Pool({
  host: requireEnv('DB_HOST'),
  user: requireEnv('DB_USER'),
  password: requireEnv('DB_PASSWORD'),
  database: requireEnv('DB_DATABASE'),
  port: parseInt(process.env.DB_PORT || '5432', 10),
  ssl: { rejectUnauthorized: false }
});

// Misma lógica que SapOrderService.formatDateBogota() — reimplementada aquí a propósito
// (el script no debe importar código de src/ para no arrastrar dependencias de SAP/SMTP
// que no aplican a una validación de solo lectura contra la BD).
function formatDateBogota(date) {
  const d = date ? new Date(date) : new Date();
  const bogota = new Date(d.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  const y = bogota.getFullYear();
  const m = String(bogota.getMonth() + 1).padStart(2, '0');
  const day = String(bogota.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Misma regex que SapOrderService.translateSapError()
function translateSapErrorSync(errorMessage, productName) {
  const match = errorMessage.match(/Item\s+(\S+)\s+is inactive/i);
  if (!match) return errorMessage;
  const sapCode = match[1];
  return productName
    ? `El producto ${sapCode} – ${productName} está inactivo en SAP`
    : `El producto ${sapCode} está inactivo en SAP`;
}

// ── Guarda: aborta si la BD conectada no es la esperada (protección contra apuntar a Producción) ──
async function assertExpectedDatabase() {
  const { rows } = await pool.query('SELECT current_database() as db');
  const actual = rows[0].db;
  if (actual !== EXPECTED_DATABASE) {
    console.error(`ABORTADO: current_database()='${actual}', se esperaba '${EXPECTED_DATABASE}'.`);
    console.error('Este script es de solo lectura, pero se niega a correr contra una BD inesperada.');
    await pool.end();
    process.exit(1);
  }
  console.log(`Guarda de BD: current_database()='${actual}' === esperado. Continuando.`);
}

// ── Test 1: columnas/tablas que el fix asume existen realmente en Staging ─────────────────
async function testSchemaAssumptions() {
  console.log('\nTEST 1: columnas asumidas por el SELECT nuevo de syncOrdersToSAP()');
  const checks = [
    ['orders', 'sap_synced'],
    ['orders', 'sap_sync_attempts'],
    ['orders', 'sap_sync_status'],
    ['orders', 'sap_sync_error'],
    ['orders', 'delivery_date'],
    ['orders', 'status_id'],
    ['orders', 'branch_id'],
    ['client_profiles', 'company_name'],
    ['client_profiles', 'cardcode_sap'],
    ['client_branches', 'branch_name'],
    ['products', 'sap_code'],
    ['products', 'name']
  ];

  let allOk = true;
  for (const [table, column] of checks) {
    const { rows } = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
      [table, column]
    );
    const ok = rows.length > 0;
    if (!ok) allOk = false;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}: ${table}.${column}`);
  }
  return allOk;
}

// ── Test 2: fecha Bogotá del filtro SQL coincide con formatDateBogota() en Node ───────────
async function testBogotaDateAgreement() {
  console.log('\nTEST 2: fecha "hoy+2" calculada por Postgres (Bogotá) coincide con formatDateBogota()');
  const { rows } = await pool.query(
    `SELECT DATE((CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota') + INTERVAL '2 days') as target`
  );
  const sqlDate = rows[0].target.toISOString().split('T')[0];
  const nodeDate = formatDateBogota(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000));

  if (sqlDate === nodeDate) {
    console.log(`  PASS: SQL=${sqlDate} === Node=${nodeDate}`);
    return true;
  }
  console.log(`  FAIL: SQL=${sqlDate} !== Node=${nodeDate}`);
  return false;
}

// ── Test 3: traducción de "Item X is inactive" contra un producto real de Staging ─────────
async function testTranslateSapError() {
  console.log('\nTEST 3: traducción de error SAP con producto real de Staging');
  const { rows } = await pool.query(
    `SELECT sap_code, name FROM products WHERE sap_code IS NOT NULL AND name IS NOT NULL LIMIT 1`
  );
  if (rows.length === 0) {
    console.log('  SKIP: no hay productos con sap_code y name en Staging para probar la traducción');
    return null;
  }
  const { sap_code: sapCode, name } = rows[0];
  const rawError = `10001069 - Item ${sapCode} is inactive`;
  const translated = translateSapErrorSync(rawError, name);
  const expected = `El producto ${sapCode} – ${name} está inactivo en SAP`;

  if (translated === expected) {
    console.log(`  PASS: "${rawError}" -> "${translated}"`);
    return true;
  }
  console.log(`  FAIL: esperado "${expected}", obtuvo "${translated}"`);
  return false;
}

// ── Test 4: un error no reconocido se deja intacto ─────────────────────────────────────────
function testUntranslatedErrorPassesThrough() {
  console.log('\nTEST 4: error SAP no reconocido se deja igual (sin traducir)');
  const rawError = 'Cliente no tiene lista de precios asignada';
  const translated = translateSapErrorSync(rawError, null);
  if (translated === rawError) {
    console.log('  PASS: mensaje no reconocido pasó sin cambios');
    return true;
  }
  console.log(`  FAIL: se alteró un mensaje que no debía traducirse: "${translated}"`);
  return false;
}

function printManualQaInstructions() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('PRUEBAS 1-4, 6 y 7 de la sección 7 — requieren SSH a Staging (no automatizables');
  console.log('desde este script sin crear documentos reales en SAP). Comandos de referencia:');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`
  # Reintento manual (Prueba 2/3), sin esperar ORDER_SYNC_RETRY_TIME:
  ssh -i "artesa-key.pem" ec2-user@44.216.131.63 \\
    "docker exec artesa-api-staging node -e \\"
      const svc = require('./src/services/SapOrderService');
      (async () => {
        if (!svc.sessionId) { await svc.login(); }
        const stats = await svc.runRetrySync();
        console.log(JSON.stringify(stats, null, 2));
        process.exit(0);
      })().catch(e => { console.error(e); process.exit(1); });
    \\""

  # Confirmar SAP_COMPANY_DB antes de cualquier prueba que cree documentos (Prueba previa a 1):
  ssh -i "artesa-key.pem" ec2-user@44.216.131.63 \\
    "docker exec artesa-api-staging env | grep -E '^SAP_COMPANY_DB='"

  # Ver logs relevantes tras el corte o el reintento:
  ssh -i "artesa-key.pem" ec2-user@44.216.131.63 \\
    "docker logs artesa-api-staging --tail 200 | grep -iE 'reintento|sincroniz|alerta'"
  `);
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('VALIDACIÓN EN STAGING — Reintento de sync de pedidos + alertas SAP');
  console.log('═══════════════════════════════════════════════════════');

  await assertExpectedDatabase();

  const results = {};
  results['Esquema asumido por el fix'] = await testSchemaAssumptions();
  results['Fecha Bogotá SQL === Node'] = await testBogotaDateAgreement();
  results['Traducción de error SAP'] = await testTranslateSapError();
  results['Error no reconocido intacto'] = testUntranslatedErrorPassesThrough();

  console.log('\n═══════════════════════════════════════════════════════');
  const applicable = Object.entries(results).filter(([, v]) => v !== null);
  const passed = applicable.filter(([, v]) => v).length;
  console.log(`RESULTADO: ${passed}/${applicable.length} pruebas aplicables pasaron`);

  printManualQaInstructions();

  await pool.end();

  if (passed === applicable.length) {
    console.log('\nVALIDACIÓN AUTOMATIZABLE EXITOSA. Faltan las pruebas manuales de la sección 7');
    console.log('(requieren SSH a Staging, .env configurado y correo real) — ver instrucciones arriba.');
    process.exit(0);
  } else {
    console.log('\nFALLOS DETECTADOS — no reportar VALIDADO EN STAGING hasta corregir.');
    process.exit(1);
  }
}

main().catch(async (error) => {
  console.error('ERROR EN RUNNER:', error.message);
  try { await pool.end(); } catch (_) {}
  process.exit(1);
});
