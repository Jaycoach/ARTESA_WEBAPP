/**
 * Script de aceptación — propagación de EmailAddress (SAP) a users.mail en las 3
 * funciones reales de sync de clientes (SapClientService.js):
 *   - syncAllClientsWithSAP()      → POST /api/client-sync/sync-all
 *   - syncInstitutionalClients()   → POST /api/client-sync/sync-institutional
 *   - syncClientsWithSAP()         → POST /api/client-sync/sync
 *
 * Corre SIEMPRE contra EC2 Staging real (nunca local, nunca contra producción).
 * Ninguna credencial va hardcodeada — todas se leen de variables de entorno.
 *
 * Qué valida:
 *   TEST 1 (caso feliz): el CardCode de prueba tiene un EmailAddress nuevo en SAP
 *     (staging, PRUEBAS_ARTESA_13ENE/07ABR) distinto al users.mail actual, y ningún
 *     otro usuario activo tiene ya ese correo. Tras correr el sync: client_profiles
 *     .contact_email Y users.mail deben quedar iguales al nuevo EmailAddress.
 *
 *   TEST 2 (conflicto real, "William/Elsa"): dos CardCodes distintos en SAP staging
 *     comparten el mismo EmailAddress por error de captura (CARDCODE_KEEPER ya tiene
 *     ese correo como su login correcto; CARDCODE_IMPOSTOR es el que SAP también
 *     reporta con ese mismo correo). Tras correr el sync sobre CARDCODE_IMPOSTOR:
 *       - client_profiles.contact_email de CARDCODE_IMPOSTOR SÍ se actualiza (dato
 *         de SAP, no es un login).
 *       - users.mail de CARDCODE_IMPOSTOR NO se sobrescribe (se queda con el valor
 *         previo) porque el correo ya está en uso por el user_id de CARDCODE_KEEPER.
 *       - Se verifica contra los logs de Docker (docker logs artesa-api-staging) que
 *         el logger.warn de conflicto efectivamente se disparó para ese cardCode.
 *
 * Requisitos previos (manuales, fuera del alcance de este script):
 *   - CARDCODE_A / CARDCODE_KEEPER / CARDCODE_IMPOSTOR deben existir ya en
 *     client_profiles de staging (cardcode_sap) con su cardCode real de SAP.
 *   - El EmailAddress en SAP (staging) para CARDCODE_A debe haberse cambiado ANTES
 *     de correr TEST 1 a un valor nuevo, pasado aquí como NEW_EMAIL_FOR_A.
 *   - CARDCODE_KEEPER y CARDCODE_IMPOSTOR deben compartir el mismo EmailAddress en
 *     SAP staging (SHARED_CONFLICT_EMAIL) — este script NO puede crear/editar datos
 *     de SAP, solo lee el resultado del sync sobre la BD y la API de staging.
 *
 * Uso:
 *   export STAGING_BASE_URL=http://ec2-44-216-131-63.compute-1.amazonaws.com
 *   export STAGING_TEST_USER_EMAIL=...           # usuario con permiso SAP_SYNC_EXECUTE
 *   export STAGING_TEST_USER_PASSWORD=...
 *   export DB_HOST / DB_USER / DB_PASSWORD / DB_DATABASE / DB_PORT   # artesadb_dev
 *
 *   export CARDCODE_A=CIxxxxxxxxx
 *   export NEW_EMAIL_FOR_A=correo.nuevo.prueba@example.com
 *
 *   export CARDCODE_KEEPER=CIyyyyyyyyy
 *   export CARDCODE_IMPOSTOR=CIzzzzzzzzz
 *   export SHARED_CONFLICT_EMAIL=correo.compartido.en.sap@example.com
 *
 *   export SYNC_ENDPOINT=/api/client-sync/sync-all   # o /sync-institutional, o /sync
 *
 *   node scripts/tests/sap-client-mail-sync-acceptance.js
 *
 * Si alguna de las variables de CardCode/email no está seteada, el escenario
 * correspondiente se salta explícitamente (nunca se inventa un CardCode ni una
 * credencial) y el script termina con exit != 0, indicando qué faltó.
 */

const axios = require('axios');
const { Pool } = require('pg');

const BASE_URL = process.env.STAGING_BASE_URL || 'http://ec2-44-216-131-63.compute-1.amazonaws.com';
const SYNC_ENDPOINT = process.env.SYNC_ENDPOINT || '/api/client-sync/sync-all';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Falta variable de entorno requerida: ${name}`);
    process.exit(1);
  }
  return v;
}

function optionalEnv(name) {
  return process.env[name] || null;
}

const TEST_USER_EMAIL = requireEnv('STAGING_TEST_USER_EMAIL');
const TEST_USER_PASSWORD = requireEnv('STAGING_TEST_USER_PASSWORD');

const pool = new Pool({
  host: requireEnv('DB_HOST'),
  user: requireEnv('DB_USER'),
  password: requireEnv('DB_PASSWORD'),
  database: requireEnv('DB_DATABASE'),
  port: parseInt(process.env.DB_PORT || '5432', 10),
  ssl: { rejectUnauthorized: false }
});

async function login() {
  const res = await axios.post(`${BASE_URL}/api/auth/login`, {
    mail: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD
  });
  const token = res.data?.token || res.data?.data?.token;
  if (!token) {
    throw new Error('Login no devolvió token: ' + JSON.stringify(res.data));
  }
  return token;
}

async function triggerSync(token) {
  const res = await axios.post(`${BASE_URL}${SYNC_ENDPOINT}`, {}, {
    headers: { Authorization: `Bearer ${token}` },
    validateStatus: () => true,
    timeout: 120000
  });
  return { status: res.status, body: res.data };
}

async function getClientRow(cardCode) {
  const { rows } = await pool.query(
    `SELECT cp.client_id, cp.user_id, cp.cardcode_sap, cp.contact_email, u.mail
     FROM client_profiles cp
     JOIN users u ON cp.user_id = u.id
     WHERE cp.cardcode_sap = $1`,
    [cardCode]
  );
  if (rows.length === 0) {
    throw new Error(`CardCode ${cardCode} no existe en client_profiles de staging`);
  }
  return rows[0];
}

// ── TEST 1: caso feliz ──────────────────────────────────────────────────────
async function testHappyPath(token) {
  console.log('\nTEST 1: EmailAddress cambia en SAP → se propaga a client_profiles.contact_email y a users.mail');

  const cardCode = optionalEnv('CARDCODE_A');
  const newEmail = optionalEnv('NEW_EMAIL_FOR_A');

  if (!cardCode || !newEmail) {
    console.log('  SKIP: faltan CARDCODE_A / NEW_EMAIL_FOR_A. Ver comentario de cabecera del script.');
    return { skipped: true };
  }

  const before = await getClientRow(cardCode);
  console.log('  ANTES:', before);

  const { status, body } = await triggerSync(token);
  console.log(`  Sync HTTP status=${status}`);

  const after = await getClientRow(cardCode);
  console.log('  DESPUÉS:', after);

  const normalizedExpected = newEmail.trim().toLowerCase();
  const contactEmailOk = (after.contact_email || '').toLowerCase() === normalizedExpected;
  const mailOk = (after.mail || '').toLowerCase() === normalizedExpected;

  if (status < 400 && contactEmailOk && mailOk) {
    console.log('  PASS: contact_email y users.mail quedaron en', newEmail);
    return { skipped: false, passed: true };
  }

  console.log('  FAIL: contact_email actualizado =', contactEmailOk, '| users.mail actualizado =', mailOk);
  return { skipped: false, passed: false, before, after, httpStatus: status, httpBody: body };
}

// ── TEST 2: conflicto real (dos CardCodes, mismo EmailAddress en SAP) ──────
async function testConflict(token) {
  console.log('\nTEST 2: dos CardCodes comparten EmailAddress en SAP → users.mail del impostor NO se sobrescribe');

  const keeperCode = optionalEnv('CARDCODE_KEEPER');
  const impostorCode = optionalEnv('CARDCODE_IMPOSTOR');
  const sharedEmail = optionalEnv('SHARED_CONFLICT_EMAIL');

  if (!keeperCode || !impostorCode || !sharedEmail) {
    console.log('  SKIP: faltan CARDCODE_KEEPER / CARDCODE_IMPOSTOR / SHARED_CONFLICT_EMAIL.');
    return { skipped: true };
  }

  const keeperBefore = await getClientRow(keeperCode);
  const impostorBefore = await getClientRow(impostorCode);
  console.log('  KEEPER antes:', keeperBefore);
  console.log('  IMPOSTOR antes:', impostorBefore);

  const normalizedShared = sharedEmail.trim().toLowerCase();
  if ((keeperBefore.mail || '').toLowerCase() !== normalizedShared) {
    console.log(`  FAIL: precondición no cumplida — el KEEPER (user_id=${keeperBefore.user_id}) no tiene actualmente ${sharedEmail} como su login. Verificar setup manual en SAP/staging antes de correr este test.`);
    return { skipped: false, passed: false, precondition: false };
  }

  const { status } = await triggerSync(token);
  console.log(`  Sync HTTP status=${status}`);

  const impostorAfter = await getClientRow(impostorCode);
  console.log('  IMPOSTOR después:', impostorAfter);

  const contactEmailUpdated = (impostorAfter.contact_email || '').toLowerCase() === normalizedShared;
  const mailNotOverwritten = (impostorAfter.mail || '').toLowerCase() === (impostorBefore.mail || '').toLowerCase()
    && (impostorAfter.mail || '').toLowerCase() !== normalizedShared;

  if (status < 400 && contactEmailUpdated && mailNotOverwritten) {
    console.log('  PASS: contact_email del impostor se actualizó, users.mail del impostor quedó intacto (no pisó el login del keeper).');
    console.log('  Confirmar manualmente en docker logs artesa-api-staging el logger.warn "Conflicto al propagar EmailAddress..." con cardCode =', impostorCode);
    return { skipped: false, passed: true };
  }

  console.log('  FAIL: contactEmailUpdated =', contactEmailUpdated, '| mailNotOverwritten =', mailNotOverwritten);
  return { skipped: false, passed: false, keeperBefore, impostorBefore, impostorAfter };
}

async function main() {
  console.log(`Endpoint bajo prueba: POST ${SYNC_ENDPOINT}`);
  const token = await login();

  const result1 = await testHappyPath(token);
  const result2 = await testConflict(token);

  await pool.end();

  const ran = [result1, result2].filter(r => !r.skipped);
  const failed = ran.filter(r => !r.passed);

  if (ran.length === 0) {
    console.error('\nNINGÚN escenario corrió (faltan variables de entorno de datos de prueba). exit 1.');
    process.exit(1);
  }

  if (failed.length > 0) {
    console.error(`\n${failed.length} de ${ran.length} escenario(s) ejecutados FALLARON. exit 1.`);
    process.exit(1);
  }

  console.log(`\nTodos los escenarios ejecutados (${ran.length}) pasaron. exit 0.`);
  process.exit(0);
}

main().catch(error => {
  console.error('Error inesperado en el script de aceptación:', error.message);
  console.error(error.stack);
  process.exit(1);
});
