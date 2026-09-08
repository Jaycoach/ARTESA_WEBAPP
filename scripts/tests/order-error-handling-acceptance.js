/**
 * Script de aceptación — error handling de creación de órdenes (SQLSTATE-based).
 * Corre contra EC2 Staging real (nunca local), a través de nginx.
 * Ninguna credencial va hardcodeada — todas se leen de variables de entorno.
 *
 * Uso:
 *   export STAGING_BASE_URL=http://ec2-44-216-131-63.compute-1.amazonaws.com
 *   export STAGING_TEST_USER_EMAIL=...
 *   export STAGING_TEST_USER_PASSWORD=...
 *   export STAGING_TEST_BRANCH_ID=...      # sucursal real del usuario de prueba en staging
 *   export STAGING_TEST_PRODUCT_ID=...     # producto activo con stock y precio > 0 en staging
 *   export DB_HOST / DB_USER / DB_PASSWORD / DB_DATABASE / DB_PORT   # BD de STAGING (artesadb_dev), no producción
 *   node scripts/tests/order-error-handling-acceptance.js
 */

const axios = require('axios');
const { Pool } = require('pg');

const BASE_URL = process.env.STAGING_BASE_URL || 'http://ec2-44-216-131-63.compute-1.amazonaws.com';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Falta variable de entorno requerida: ${name}`);
    process.exit(1);
  }
  return v;
}

const TEST_USER_EMAIL = requireEnv('STAGING_TEST_USER_EMAIL');
const TEST_USER_PASSWORD = requireEnv('STAGING_TEST_USER_PASSWORD');
const TEST_BRANCH_ID = parseInt(requireEnv('STAGING_TEST_BRANCH_ID'), 10);
const TEST_PRODUCT_ID = parseInt(requireEnv('STAGING_TEST_PRODUCT_ID'), 10);

const pool = new Pool({
  host: requireEnv('DB_HOST'),
  user: requireEnv('DB_USER'),
  password: requireEnv('DB_PASSWORD'),
  database: requireEnv('DB_DATABASE'),
  port: parseInt(process.env.DB_PORT || '5432', 10),
  ssl: { rejectUnauthorized: false }
});

function futureBusinessDate(daysAhead = 5) {
  // Evita fines de semana (no conocemos festivos colombianos desde aquí sin duplicar
  // colombianHolidays.js, pero al menos garantiza lunes-viernes con margen amplio).
  let d = new Date(Date.now() + daysAhead * 24 * 3600 * 1000);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d = new Date(d.getTime() + 24 * 3600 * 1000);
  }
  return d.toISOString().split('T')[0];
}

async function login() {
  const res = await axios.post(`${BASE_URL}/api/auth/login`, {
    mail: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD
  });
  if (!res.data?.token && !res.data?.data?.token) {
    throw new Error('Login no devolvió token: ' + JSON.stringify(res.data));
  }
  return res.data.token || res.data.data.token;
}

function orderPayload(token, overrides = {}) {
  return {
    user_id: overrides.user_id,
    total_amount: 100,
    delivery_date: futureBusinessDate(),
    branch_id: overrides.branch_id !== undefined ? overrides.branch_id : TEST_BRANCH_ID,
    details: overrides.details || [
      { product_id: TEST_PRODUCT_ID, quantity: 1, unit_price: 100 }
    ]
  };
}

async function postOrder(token, payload) {
  try {
    const res = await axios.post(`${BASE_URL}/api/orders`, payload, {
      headers: { Authorization: `Bearer ${token}` },
      validateStatus: () => true // no lanzar excepción por status >= 400, queremos inspeccionarlo
    });
    return { status: res.status, body: res.data };
  } catch (error) {
    return { status: null, body: null, networkError: error.message };
  }
}

// ── Escenario 1: 503 SCHEMA_ERROR ──────────────────────────────────────────
async function testSchemaError(token, userId) {
  console.log('\nTEST 1: Error 503 — columna faltante en BD (staging: artesadb_dev)');
  let dropped = false;
  try {
    await pool.query('ALTER TABLE orders DROP COLUMN IF EXISTS iva_amount');
    dropped = true;

    const { status, body } = await postOrder(token, orderPayload(token, { user_id: userId }));

    if (status === 503 && typeof body?.message === 'string' && body.message.toLowerCase().includes('mantenimiento')) {
      console.log('  PASS: status 503, mensaje:', body.message);
      return true;
    }
    console.log('  FAIL: status', status, 'body:', JSON.stringify(body));
    return false;
  } finally {
    if (dropped) {
      await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS iva_amount NUMERIC DEFAULT 0');
      const check = await pool.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name='orders' AND column_name='iva_amount'"
      );
      if (check.rows.length === 0) {
        console.error('  ALERTA: no se pudo restaurar iva_amount en staging — intervenir manualmente');
      } else {
        console.log('  Columna iva_amount restaurada en staging.');
      }
    }
  }
}

// ── Escenario 2: 400 branch inválida (documenta en qué capa se atrapa) ────
async function testInvalidBranch(token, userId) {
  console.log('\nTEST 2: Error 400 — branch_id inexistente');
  const { status, body } = await postOrder(token, orderPayload(token, { user_id: userId, branch_id: 999999 }));

  if (status === 400) {
    console.log('  PASS: status 400, mensaje:', body?.message);
    console.log('  NOTA: este 400 lo produce la validación de orderController.js (ownership de sucursal),');
    console.log('  no la rama 23503 del catch de Order.js — esa rama queda sin ejercitar por esta vía.');
    return true;
  }
  console.log('  FAIL: status', status, 'body:', JSON.stringify(body));
  return false;
}

// ── Escenario 3: 409 duplicado — NO EJECUTABLE, documentado ───────────────
function testDuplicateNotReachable() {
  console.log('\nTEST 3: Error 409 — duplicado');
  console.log('  SKIP: no existe ningún UNIQUE constraint en la tabla orders (verificado vía pg_constraint');
  console.log('  contra staging). No hay forma de que Postgres devuelva 23505 desde este INSERT.');
  console.log('  La rama 23505 en Order.js es código defensivo sin caso de uso real hoy — no es un fallo,');
  console.log('  pero tampoco se puede marcar como VALIDADO EN STAGING sin agregar el constraint primero.');
  return null; // ni pass ni fail — no aplica
}

// ── Escenario 4: payload inválido ──────────────────────────────────────────
async function testInvalidPayload(token) {
  console.log('\nTEST 4: payload inválido (sin user_id/total_amount/details)');
  const { status, body } = await postOrder(token, {});

  if (status >= 400 && status < 500) {
    console.log('  PASS: status', status, '(validación temprana del controller, no llega a Order.js), mensaje:', body?.message);
    return true;
  }
  console.log('  FAIL: status', status, 'body:', JSON.stringify(body));
  return false;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('VALIDACIÓN EN STAGING — Error Handling creación de órdenes');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('═══════════════════════════════════════════════════════');

  const token = await login();

  // decodificar user_id del JWT sin librería extra
  const payloadB64 = token.split('.')[1];
  const jwtPayload = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));
  const userId = jwtPayload.userId || jwtPayload.id || jwtPayload.sub;
  console.log('Autenticado como user_id:', userId);

  const results = {};
  results['503 Schema Error'] = await testSchemaError(token, userId);
  results['400 Branch inválida'] = await testInvalidBranch(token, userId);
  results['409 Duplicado'] = testDuplicateNotReachable();
  results['400/generic Payload inválido'] = await testInvalidPayload(token);

  console.log('\n═══════════════════════════════════════════════════════');
  const applicable = Object.entries(results).filter(([, v]) => v !== null);
  const passed = applicable.filter(([, v]) => v).length;
  console.log(`RESULTADO: ${passed}/${applicable.length} pruebas aplicables pasaron`);
  console.log('(409 excluido del conteo: no aplica, no hay constraint que lo dispare)');

  await pool.end();

  if (passed === applicable.length) {
    console.log('\nVALIDACIÓN EXITOSA de lo que es alcanzable hoy vía la API pública.');
    console.log('NO cubierto: rama 23503 (FK) y 23505 (unique) del catch de Order.js — no alcanzables');
    console.log('desde la API pública porque el controller y el esquema ya previenen esas condiciones antes.');
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
