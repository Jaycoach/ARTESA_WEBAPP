# Flete calculado en backend (gasto adicional SAP) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (native execution, per-file approval — ver restricciones abajo). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El flete ($10.000 total, sin IVA) se decide en el momento de transmitir cada pedido a SAP, y se envía como **gasto adicional de la OV** (`DocumentAdditionalExpenses`, `ExpenseCode` = artículo contable FLETE), no como línea de producto. El frontend (`CreateOrderForm.jsx` y `Products.jsx`) comparte un único cálculo para mostrar el mismo valor y la misma regla de umbrales que usará el backend.

**Architecture:** Este es un **rediseño completo** que reemplaza el plan anterior (que asumía flete transmitido como línea de producto `PASPT12` con IVA incluido, decidido en `Order.createOrder()`). Nada de ese diseño se implementó — solo existía en el documento de plan y en la rama `feature/shipping-backend` (sin commits de código). El nuevo diseño:
- **No toca `Order.createOrder()`, `orders.total_amount`, ni los controllers de creación.** El backend no rechaza pedidos por monto mínimo — esa validación queda solo en frontend, igual que hoy.
- Un módulo nuevo `src/utils/shippingCalculator.js` (backend) calcula si un pedido lleva flete **a partir de los datos ya persistidos en `order_details`** (`quantity`, `unit_price`, `tax_amount` por línea — impuesto real, no recalculado), sin ninguna consulta adicional a `tax_codes` ni a `products`. Es una función síncrona y pura.
- `SapOrderService.js` invoca ese cálculo en el momento de armar el payload de la OV (mismo lugar donde ya arma `DocumentLines`), y si corresponde flete agrega `DocumentAdditionalExpenses` con el `ExpenseCode` configurado por ambiente (`SAP_SHIPPING_EXPENSE_CODE`) y el `TaxCode` de tasa 0% que el código ya resuelve dinámicamente para otros casos (`zeroRateTaxCode`, `valid_for_ar = true`). `DocumentLines` no cambia en absoluto.
- Columnas nuevas de **trazabilidad** en `orders` (`sap_shipping_amount`, `sap_shipping_expense_code`) se llenan **solo tras sincronización exitosa**, en el mismo UPDATE que ya persiste `sap_doc_entry`/`sap_synced` — no en la creación del pedido.
- Frontend: un único módulo de cálculo compartido entre `CreateOrderForm.jsx` y `Products.jsx`, mismo valor ($10.000 sin IVA) y misma regla de umbrales (mínimo contra subtotal sin impuestos, tramo de flete contra subtotal con impuestos).

**Tech Stack:** Node.js/Express, `pg` (PostgreSQL), SAP Service Layer REST, React/Vite (frontend).

**Spec:** Instrucciones del usuario en esta conversación — diseño de negocio confirmado por el cliente y validado por el usuario directamente en SAP Service Layer (`PRUEBAS_ARTESA_14JUL`, OV de prueba `DocEntry 1451`, ya cancelada). Rama de Producción confirmada: `master`. Rama de trabajo: `feature/shipping-backend` (desde `origin/master` @ `f9ef58c`, sin commits de código todavía).

## Evidencia SAP ya validada por el usuario (no repetir esta prueba)

- Gasto adicional creado en `PRUEBAS_ARTESA_14JUL`: `ExpenseCode 7`, `Name "FLETE"`, `RevenuesAccount`/`ExpenseAccount 41200918` ("COSTO DE ENVIO"), `TaxLiable tNO`, `DistributionMethod aed_None`.
- `IVAG03` ("IVA EXCLUIDO", tasa 0%) activo en `PRUEBAS_ARTESA_14JUL` y en `HBT_ARTESA`.
- Payload real probado:
  ```json
  "DocumentAdditionalExpenses": [{ "ExpenseCode": 7, "LineTotal": 10000, "TaxCode": "IVAG03" }]
  ```
  Resultado real (OV `DocEntry 1451`, ya cancelada): gasto `LineTotal 10000`, `TaxSum 0`, `LineGross 10000`; producto `GTAPT04` $10.000 con IMSB+IVA → impuesto $3.900; `VatSum 3900`; `DocTotal 23900`. **El flete no altera el impuesto de los productos.**
- **`TotalExpenses` no vino en la respuesta de `/b1s/v2`** — la validación en Staging debe leer `DocumentAdditionalExpenses` y `DocTotal`, nunca ese campo.
- En `HBT_ARTESA` (Producción) el gasto FLETE **aún no existe** — lo crea el usuario antes del despliegue a Producción, con la misma configuración. Es condición de salida (Task 6).

## Hallazgos de riesgo heredados del plan anterior (siguen vigentes, investigación de solo lectura, sin cambios de código)

1. Ninguna lógica existente compara `orders.total_amount` local contra un total de SAP — `checkInvoicedOrdersFromSAP()` (`SapOrderService.js:1150-1330`) compara `Orders.DocTotal` de SAP contra `Invoices.DocTotal` de SAP, ambos ya calculados por SAP (incluyendo cualquier gasto adicional que la OV tenga) — no hay riesgo de que `DocumentAdditionalExpenses` rompa esta comparación, porque ambos lados del `Math.abs(invoice.DocTotal - sapOrderInfo.docTotal)` (`:1278`) siguen siendo totales *de SAP*, ya inclusivos de gastos adicionales por definición de la Service Layer.
2. Las entregas parciales (`checkPartialDeliveredOrdersFromSAP`/`checkFullyDeliveredOrdersFromSAP`, `SapOrderService.js:850-1148`) son solo de cantidades (`delivered_quantity`/`total_quantity`) por línea de `DocumentLines` — `DocumentAdditionalExpenses` no es una línea de documento y no tiene cantidad entregable, así que esta lógica no lo toca en absoluto. Sin riesgo.
3. El sync/reintento/alertas no dependen de montos — la query de selección (`SapOrderService.js:570-584`) y las funciones de alerta (`:1394-1455`) no filtran ni calculan por monto. Cero riesgo de que agregar un gasto adicional dispare o rompa alertas — **salvo el caso nuevo que este plan introduce a propósito**: si falta `SAP_SHIPPING_EXPENSE_CODE` o no se resuelve `zeroRateTaxCode` para un pedido que sí lleva flete, la Tarea 3 hace fallar ese intento de sync deliberadamente, y ese fallo sí entra al flujo de reintento/alerta existente (comportamiento pedido explícitamente, no un efecto secundario no buscado).
4. `updateOrder()` (`Order.js:582-758`) permite editar productos/cantidades de un pedido ya creado (borra y reinserta `order_details`) sin recalcular `orders.total_amount` — **bug preexistente, ya en producción hoy, ajeno a este trabajo, no corregido en este alcance**. Con el nuevo diseño el flete queda relativamente protegido de este bug: como se decide en el momento de transmitir a SAP (Tarea 3) leyendo `order_details` **vigentes** en ese instante, un pedido editado antes de sincronizar lleva el flete correcto para sus productos finales — es `total_amount` (no el flete) el que queda obsoleto, y eso ya era cierto antes de este trabajo.
5. `taxCalculator._setCacheForTesting` existe (`src/utils/taxCalculator.js:61-64`) pero **ya no se necesita** en este diseño — `shippingCalculator.js` no consulta el catálogo de impuestos, solo suma `order_details.tax_amount` ya persistido. Se mantiene la nota por si el test de otro caso lo requiere indirectamente (no debería).

## Pendientes registrados, explícitamente NO resueltos en este alcance

- **Facturación electrónica / DIAN**: no se puede probar en Staging. La primera factura real con flete en Producción debe revisarse para confirmar que el XML reportado a la DIAN refleja el cargo de $10.000 sin IVA correctamente. El gasto tiene `U_HBT_TipoImpuesto = 0` y `U_HBT_Tarifa = 0` (campos de la localización de Heinsohn) — configurado por el usuario en SAP, fuera del alcance de este plan de código.
- **Bug preexistente de `updateOrder()`** (`total_amount` obsoleto al editar productos) — documentado arriba (Hallazgos, punto 4), no se corrige aquí.
- **(a) El detalle del pedido en el portal muestra `total_amount` sin el flete, aunque en SAP el `DocTotal` sí lo incluye.** Confirmado en Staging (Tarea 6, S1/S2): `orders.total_amount` de los pedidos #194/#195 quedó en $69.555,60/$60.920 (solo productos), mientras que la OV real en SAP (`DocEntry 1453`/`1455`) tiene `DocTotal` $79.555,60/$70.920 (productos + flete). El cliente ve un total distinto al que SAP factura. No se corrige en este alcance — depende de dónde se decida mostrar el flete en el detalle del pedido (columnas de trazabilidad `sap_shipping_amount`/`sap_shipping_expense_code` ya existen y podrían usarse para esto en un plan de frontend/detalle separado).
- **(b) La sincronización de sucursales (`syncClientBranches`) no actualiza una sucursal ya existente salvo que se pase `forceUpdate: true`.** Confirmado en Staging: la primera corrida sobre `client_id 591` con `forceUpdate: false` devolvió `updated: 0` pese a que `municipality_code` había cambiado en SAP; con `forceUpdate: true` sí aplicó el cambio (`updated: 1`). Esto significa que cualquier corrección posterior a un dato ya sincronizado de una sucursal (dirección, código de municipio, etc.) requiere que quien dispare el sync sepa marcar `forceUpdate`, algo que no es obvio desde la UI de BackOffice si esa opción no está expuesta ahí. No se corrige en este alcance — es un comportamiento preexistente de `clientSyncController.syncClientBranches`, ajeno al flete.
- **(c) `Products.jsx` crea el pedido sin cuadro de confirmación, a diferencia de `CreateOrderForm.jsx`.** Confirmado por el usuario al ejecutar P1-P4: ambos formularios calculan y muestran el mismo flete, pero `Products.jsx` envía el pedido directo al confirmar la acción, mientras que `CreateOrderForm.jsx` sí interpone un paso de confirmación antes de crear el pedido. Es una diferencia de UX preexistente entre los dos flujos, no introducida por este trabajo — no se corrige en este alcance.

## Evidencia real de Staging — S1 y S2 (Tarea 6), completadas

Pedidos creados por el usuario desde el flujo real de la app (`CreateOrderForm.jsx`/`Products.jsx`), sincronizados manualmente vía `sapServiceManager.orderService.createOrderInSAP` (misma función que respalda `POST /orders/:orderId/send-to-sap`, invocada por `docker exec` dentro del contenedor porque la fecha de entrega de prueba caía fuera de la ventana automática de 2 días):

| Pedido | Productos | `total_amount` local | `DocEntry` SAP | `DocTotal` SAP | `DocumentAdditionalExpenses` | `sap_shipping_amount`/`expense_code` |
|---|---|---|---|---|---|---|
| #194 | 4×GTAPT03 (IMSB+IVA) | $69.555,60 | 1453 | $79.555,60 | `ExpenseCode 7, LineTotal 10000, TaxCode IVAG03, TaxSum 0` | `10000` / `7` |
| #195 | 4×PANPAQ01 (exento) | $60.920 | 1455 | $70.920 | `ExpenseCode 7, LineTotal 10000, TaxCode IVAG03, TaxSum 0` | `10000` / `7` |
| #196 | 6×PANPAQ01 (exento) | $91.380 | 1457 | $91.380 | `[]` (vacío) | `NULL` / `NULL` |
| #197 | 5×GTAPT03 (IMSB+IVA) | $86.944,50 | 1459 | $86.944,50 | `[]` (vacío) | `NULL` / `NULL` |

En los 4 casos `DocTotal` de SAP coincide exactamente con lo esperado (`total_amount + 10000` cuando hay flete, `= total_amount` cuando es gratis), confirmando que el diseño de gasto adicional funciona end-to-end con productos reales, exentos y con impuesto compuesto (`IMSB+IVA`). Pendiente: cancelar las 4 OV de prueba al cerrar la validación completa (S1-S7).

## Global Constraints

- **Valor y regla de umbrales — lógica de `CreateOrderForm.jsx`, aplicada igual en frontend y backend:**
  - Mínimo del pedido, **$50.000 contra el subtotal SIN impuestos**: por debajo no se permite crear el pedido. Esta validación **sigue siendo solo de frontend** — el backend no la implementa ni rechaza pedidos por esto en este diseño.
  - Flete, **contra el subtotal CON impuestos** (impuestos reales por línea, ya persistidos): de $50.000 a $79.999 → flete $10.000; desde $80.000 → envío gratis. Comparaciones con `>=`.
- **El flete es $10.000 total, SIN IVA** — no hay desglose base/impuesto como en el diseño anterior. `TaxCode` se envía siempre explícito con la tasa 0% (`IVAG03` en Staging, resuelta dinámicamente vía `valid_for_ar = true`, no hardcodeada).
- **Transmisión a SAP como gasto adicional**, no como línea de producto: `DocumentAdditionalExpenses: [{ ExpenseCode, LineTotal: 10000, TaxCode }]`. `DocumentLines` no cambia. No existe ya ningún artículo `PASPT12` en este diseño — se descarta esa parte del plan anterior.
- `SAP_SHIPPING_EXPENSE_CODE` es una **variable de entorno sin default**, configurada por ambiente (SAP asigna el código de gasto de forma consecutiva por compañía — Staging = 7, Producción = a definir cuando el usuario cree el gasto ahí). Documentada en `.env.example` sin valor real.
- Si falta `SAP_SHIPPING_EXPENSE_CODE` o no se resuelve `zeroRateTaxCode` para un pedido que corresponde que lleve flete: **no se transmite ni sin flete ni con otro impuesto** — se registra error y ese intento de sync entra al flujo de reintento/alerta existente, igual que cualquier otro error de negocio.
- **Sin flete, el payload a SAP queda exactamente igual que hoy** — no se agrega `DocumentAdditionalExpenses` en absoluto (ni vacío).
- No se toca `Order.createOrder()`, `orders.total_amount`, ni la idempotencia `U_JZ_WebOrderId`, ni el reintento/alertas existentes — el flete se decide y transmite en el mismo punto donde ya se arma `DocumentLines`.
- **Migración aditiva** en `orders`: columnas de **trazabilidad únicamente** (`sap_shipping_amount`, `sap_shipping_expense_code`), llenadas solo tras sincronización exitosa — nunca en la creación del pedido, nunca recalculadas para pedidos ya sincronizados.
- **Pedidos ya creados y pendientes de sincronizar al momento del despliegue**: llevan flete si corresponde, sin caso especial — porque el cálculo lee `order_details` ya persistidos en el momento del primer intento de sync después del despliegue, sin importar cuándo se creó el pedido.
- Frontend: **un único cálculo compartido** entre `CreateOrderForm.jsx` y `Products.jsx` (módulo nuevo en `src/utils/` del frontend) — mismo valor, mismos umbrales, mismas comparaciones. Nada más cambia en pantallas, textos ni resumen.
- **Despliegue conjunto a Producción**: backend y frontend salen juntos. Condiciones explícitas para APROBADO PARA PRODUCCIÓN: (a) el gasto FLETE debe existir ya en `HBT_ARTESA` (lo crea el usuario), (b) `SAP_SHIPPING_EXPENSE_CODE` debe estar configurada en el `.env` de Producción con el código real que resulte ahí.
- Antes de desplegar a EC2 Staging: **esperar confirmación explícita**, porque Staging corre hoy `feature/backoffice-core` y este deploy lo saca temporalmente de ese ambiente.
- **Restricción de proceso del usuario (aplica a todas las tareas):** ningún archivo se edita sin su aprobación explícita, archivo por archivo. En archivos de más de 50 líneas, mostrar el diff referenciando línea anterior/posterior, nunca el archivo completo. Sin scripts auxiliares/temporales — comandos bash directos. El pull y deploy a EC2 Staging los hace el propio asistente tras cada cambio aprobado y tras la confirmación explícita del punto anterior. Nada a Producción sin confirmación explícita.

## Review Focus

- **Pedido exactamente en el umbral** (subtotal sin impuestos = 50.000 para el mínimo frontend; subtotal con impuestos = 50.000 u 80.000 para el flete): comparaciones `>=` consistentes en frontend y backend. Cubierto con tests en 49.999/50.000 y 79.999/80.000, en ambos lados (Task 1 backend, Task 4 frontend).
- **Producto exento y producto con IMSB+IVA en el mismo cálculo de flete**: el backend usa `order_details.tax_amount` ya persistido (impuesto real por línea), nunca una tasa plana — cubierto con test explícito donde el impuesto real empuja un pedido a envío gratis aunque el subtotal sin impuestos esté muy por debajo de $80.000.
- **Falta `SAP_SHIPPING_EXPENSE_CODE` o no se resuelve `zeroRateTaxCode`, en un pedido que sí lleva flete**: no se transmite el pedido en absoluto (ni sin flete ni con impuesto equivocado) — se registra error, entra a reintento/alerta. Cubierto en Task 3 con test explícito de ambos casos.
- **Pedido sin flete**: el payload a SAP no debe llevar `DocumentAdditionalExpenses` en ningún caso (ni un array vacío) — cubierto en Task 3.
- **Reintento de sync de un pedido que ya falló por flete no transmisible**: como el cálculo se repite en cada intento leyendo `order_details` vigentes y las variables de configuración vigentes, un reintento después de que el usuario corrija `SAP_SHIPPING_EXPENSE_CODE` transmite correctamente sin intervención adicional — no hay estado a limpiar entre intentos.

---

## File Structure

- **Create** `src/config/shippingConfig.js` (backend) — `SHIPPING_LIMIT`, `SHIPPING_FREE_LIMIT`, `SHIPPING_AMOUNT`.
- **Create** `src/utils/shippingCalculator.js` (backend) — función síncrona y pura, calcula si un pedido lleva flete a partir de `order_details` ya persistidos.
- **Create** `db/migrations/2026-09-28_add-sap-shipping-trace-columns.sql` — columnas de trazabilidad en `orders` (nombres/tipos a confirmar contigo en Task 2 antes de escribir el archivo).
- **Modify** `src/services/SapOrderService.js` — invocar `calculateOrderShipping`, agregar `DocumentAdditionalExpenses` condicionalmente, persistir columnas de trazabilidad tras éxito.
- **Modify** `.env.example` — documentar `SAP_SHIPPING_EXPENSE_CODE` sin valor real.
- **Create** `src/views/frontend/LoginArtesa/src/utils/shippingCalculator.js` (frontend) — cálculo compartido, importado por ambos formularios.
- **Modify** `src/views/frontend/LoginArtesa/src/Components/Dashboard/Pages/Orders/CreateOrderForm.jsx` — usar el cálculo compartido, dejar de sumar IVA al flete (elimina el `$11.900`).
- **Modify** `src/views/frontend/LoginArtesa/src/Components/Dashboard/Pages/Products/Products.jsx` — usar el cálculo compartido, comparar el mínimo contra subtotal sin impuestos, corregir el comentario "impuestos incluidos".

No se toca `Order.js`, `orderController.js`, `branchOrderController.js`, ni ningún archivo de catálogo/precios (`Product.js`, `PriceList.js`) — quedan fuera de este diseño porque el flete ya no es un artículo del catálogo.

---

### Task 1: Config y calculadora de flete (backend)

**Files:**
- Create: `src/config/shippingConfig.js`
- Create: `src/utils/shippingCalculator.js`
- Test: `scripts/tests/shippingCalculator.test.js`

**Interfaces:**
- Produces: `shippingConfig.SHIPPING_LIMIT` (50000), `.SHIPPING_FREE_LIMIT` (80000), `.SHIPPING_AMOUNT` (10000).
- Produces: `function calculateOrderShipping(orderDetails)` → `number` (`0` o `SHIPPING_AMOUNT`). **Síncrona, sin I/O.** `orderDetails` es un array de `{ quantity, unit_price, tax_amount }` (la forma exacta de las filas que `SapOrderService.js` ya consulta de `order_details` para armar `DocumentLines` — se confirma el nombre exacto de esas propiedades al escribir el diff de Task 3, ya que la investigación previa no confirmó si esa query ya trae `tax_amount` o hay que agregarlo al `SELECT`). Suma `quantity * unit_price` (subtotal) + suma de `tax_amount` (impuesto real ya persistido, sin recalcular) = subtotal con impuestos. Devuelve `0` si `< SHIPPING_LIMIT` o `>= SHIPPING_FREE_LIMIT`; devuelve `SHIPPING_AMOUNT` en el tramo intermedio.

- [ ] **Step 1: Escribir `shippingConfig.js`**

```js
// src/config/shippingConfig.js
module.exports = {
  SHIPPING_LIMIT: 50000,
  SHIPPING_FREE_LIMIT: 80000,
  SHIPPING_AMOUNT: 10000
};
```

- [ ] **Step 2: Escribir el test con los casos de borde pedidos**

```js
// scripts/tests/shippingCalculator.test.js
const assert = require('assert');
const { calculateOrderShipping } = require('../../src/utils/shippingCalculator');

function run() {
  // Cada caso usa una sola línea de order_details con tax_amount YA PERSISTIDO
  // (no se recalcula ningún impuesto en este módulo).

  // 49.999 con impuestos (producto exento, tax_amount=0) -> sin flete
  assert.strictEqual(
    calculateOrderShipping([{ quantity: 1, unit_price: 49999, tax_amount: 0 }]),
    0, '49.999 con impuestos debe ser sin flete'
  );

  // 50.000 con impuestos (producto exento) -> flete $10.000
  assert.strictEqual(
    calculateOrderShipping([{ quantity: 1, unit_price: 50000, tax_amount: 0 }]),
    10000, '50.000 con impuestos debe cobrar flete'
  );

  // 79.999 con impuestos (producto exento) -> todavía cobra flete
  assert.strictEqual(
    calculateOrderShipping([{ quantity: 1, unit_price: 79999, tax_amount: 0 }]),
    10000, '79.999 con impuestos debe cobrar flete'
  );

  // 80.000 con impuestos (producto exento) -> envío gratis
  assert.strictEqual(
    calculateOrderShipping([{ quantity: 1, unit_price: 80000, tax_amount: 0 }]),
    0, '80.000 con impuestos debe ser gratis'
  );

  // Producto con IMSB+IVA (39% real, ya persistido en tax_amount): subtotal sin impuestos 60.000,
  // con impuestos 60.000 + 23.400 = 83.400 -> GRATIS, aunque 60.000 esté muy por debajo de 80.000.
  // Confirma que se usa el impuesto REAL persistido, no el subtotal desnudo ni una tasa plana.
  assert.strictEqual(
    calculateOrderShipping([{ quantity: 1, unit_price: 60000, tax_amount: 23400 }]),
    0, 'con impuesto real IMSB+IVA debe quedar en tramo gratis'
  );

  // Pedido con varias líneas mixtas (exento + gravado) que suman al tramo de flete
  assert.strictEqual(
    calculateOrderShipping([
      { quantity: 2, unit_price: 20000, tax_amount: 0 },      // 40.000, exento
      { quantity: 1, unit_price: 8000, tax_amount: 1520 }     // 8.000 + 19% = 9.520
    ]),
    10000, 'multi-linea: 49.520 con impuestos, debe estar SIN flete'
    // (nota: este caso da 49.520 < 50.000 -> el assert de arriba está mal a propósito,
    //  se corrige a 0 al escribir el archivo real -- dejado así para que lo revises
    //  en el diff antes de aplicarlo, ver Step 6)
  );

  console.log('shippingCalculator.test.js: OK');
}

run();
```

- [ ] **Step 3: Correr el test para confirmar que falla (módulo no existe todavía)**

Run: `node scripts/tests/shippingCalculator.test.js`
Expected: `Error: Cannot find module '../../src/utils/shippingCalculator'`

- [ ] **Step 4: Implementar `shippingCalculator.js`**

```js
// src/utils/shippingCalculator.js
const { SHIPPING_LIMIT, SHIPPING_FREE_LIMIT, SHIPPING_AMOUNT } = require('../config/shippingConfig');

function calculateOrderShipping(orderDetails) {
  const subtotal = orderDetails.reduce(
    (sum, d) => sum + (parseFloat(d.unit_price) || 0) * (parseInt(d.quantity, 10) || 0),
    0
  );
  const totalTaxes = orderDetails.reduce(
    (sum, d) => sum + (parseFloat(d.tax_amount) || 0),
    0
  );
  const subtotalWithTaxes = subtotal + totalTaxes;

  if (subtotalWithTaxes < SHIPPING_LIMIT || subtotalWithTaxes >= SHIPPING_FREE_LIMIT) {
    return 0;
  }
  return SHIPPING_AMOUNT;
}

module.exports = { calculateOrderShipping };
```

- [ ] **Step 5: Correr el test, confirmar que pasa** (corrigiendo primero el caso multi-línea marcado arriba, con el valor real `0`, no `10000`)

Run: `node scripts/tests/shippingCalculator.test.js`
Expected: `shippingCalculator.test.js: OK`

- [ ] **Step 6: Mostrarte el diff/contenido completo de los 2 archivos nuevos y del test (ya corregido el caso multi-línea) y esperar tu aprobación antes de escribirlos con Write.**

- [ ] **Step 7: Commit**

```bash
git add src/config/shippingConfig.js src/utils/shippingCalculator.js scripts/tests/shippingCalculator.test.js
git commit -m "feat(shipping): calculadora de flete backend a partir de order_details persistidos"
```

---

### Task 2: Migración de columnas de trazabilidad en `orders`

**Files:**
- Create: `db/migrations/2026-09-28_add-sap-shipping-trace-columns.sql`
- Modify: `db/migrations/001_initial-schema.md`

**Propuesta de nombres/tipos (a confirmar contigo antes de escribir el archivo, como pediste explícitamente):**
- `orders.sap_shipping_amount NUMERIC(10,2)` — **sin default, nullable.** Se llena solo con el valor realmente transmitido a SAP (`10000` o no se toca) tras una sincronización exitosa. `NULL` significa "no sincronizado todavía" o "no llevaba flete" (mismo significado que hoy tiene `sap_doc_entry IS NULL`).
- `orders.sap_shipping_expense_code INTEGER` — **sin default, nullable.** El `ExpenseCode` numérico real usado en esa transmisión (para trazabilidad si el valor de la variable de entorno cambia entre ambientes o en el tiempo — ej. si Producción usa un código distinto a Staging). Tipo `INTEGER` porque `ExpenseCode` en el payload de SAP es numérico (`"ExpenseCode": 7`), no texto.

¿Apruebas estos 2 nombres/tipos, o prefieres otros?

- [ ] **Step 1: (tras tu aprobación de nombres/tipos) Escribir la migración**

```sql
-- db/migrations/2026-09-28_add-sap-shipping-trace-columns.sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sap_shipping_amount NUMERIC(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sap_shipping_expense_code INTEGER;
```

- [ ] **Step 2: Mostrarte el SQL completo y esperar tu aprobación explícita antes de aplicarlo en cualquier ambiente.**

- [ ] **Step 3: Aplicar en Staging (`artesadb_dev`) tras tu aprobación**

```bash
ssh -i "artesa-key.pem" ec2-user@<staging-host> "psql <conexion_staging> -f -" < db/migrations/2026-09-28_add-sap-shipping-trace-columns.sql
```

- [ ] **Step 4: Verificar contra el esquema real**

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'orders' AND column_name IN ('sap_shipping_amount', 'sap_shipping_expense_code');
```
Expected: 2 filas, `numeric`/`integer`, `is_nullable = YES`, sin default.

- [ ] **Step 5: Registrar en `001_initial-schema.md` y commitear**

```bash
git add db/migrations/2026-09-28_add-sap-shipping-trace-columns.sql db/migrations/001_initial-schema.md
git commit -m "feat(shipping): migracion aditiva columnas de trazabilidad sap_shipping_amount/sap_shipping_expense_code"
```

---

### Task 3: `SapOrderService.js` transmite el flete como gasto adicional

**Files:**
- Modify: `src/services/SapOrderService.js` (construcción del payload de la OV, ~líneas 310-341, y el UPDATE post-éxito, ~líneas 417-437)
- Modify: `.env.example`
- Test: `scripts/tests/sap-shipping-expense.test.js` (unitario, con un cliente HTTP simulado — no pega a SAP real) + cobertura end-to-end en Task 6 contra Staging real

**Interfaces:**
- Consumes: `calculateOrderShipping(orderItemsResult.rows)` de Task 1 (reutiliza las filas ya consultadas para `DocumentLines`, agregando `tax_amount` al `SELECT` si no está ya — a confirmar en el diff). `process.env.SAP_SHIPPING_EXPENSE_CODE`. `zeroRateTaxCode` (variable ya resuelta en el método, reutilizada, no una consulta nueva).
- Produces: `DocumentAdditionalExpenses` en el payload de la OV cuando corresponde. Columnas `orders.sap_shipping_amount`/`sap_shipping_expense_code` persistidas tras éxito (Task 2).

- [ ] **Step 1: Mostrarte el diff exacto propuesto (archivo de 1731 líneas — solo fragmentos con contexto, en al menos 2 puntos: construcción del payload y UPDATE post-éxito), antes de tocar nada.**

Cambio conceptual — construcción del payload (cerca de línea 310-341, después de armar `DocumentLines`, sin tocarlo):
```js
const shippingAmount = calculateOrderShipping(orderItemsResult.rows);

let documentAdditionalExpenses;
if (shippingAmount > 0) {
  const expenseCodeRaw = process.env.SAP_SHIPPING_EXPENSE_CODE;
  if (!expenseCodeRaw) {
    throw new Error('SAP_SHIPPING_EXPENSE_CODE no configurado: no se puede transmitir el flete de este pedido');
  }
  if (!zeroRateTaxCode) {
    throw new Error('No se pudo resolver el codigo de impuesto de tasa 0% (valid_for_ar) para el flete');
  }
  documentAdditionalExpenses = [{
    ExpenseCode: parseInt(expenseCodeRaw, 10),
    LineTotal: shippingAmount,
    TaxCode: zeroRateTaxCode
  }];
}

const sapOrder = {
  // ...campos existentes sin cambios...
  DocumentLines: [ /* ...sin cambios... */ ],
  ...(documentAdditionalExpenses ? { DocumentAdditionalExpenses: documentAdditionalExpenses } : {})
};
```
Ambos `throw` interrumpen el intento de sync de **este pedido específico** antes de llamar a la Service Layer — se confirma en el diff real que esto cae naturalmente en la clasificación de "error de negocio" existente (gasta un intento, no aborta el lote completo, dispara alerta si corresponde) y no en la de "error de conectividad" (que sí aborta el lote) — verificar contra `isSapConnectivityError` al aplicar el paso.

Cambio conceptual — UPDATE post-éxito (cerca de línea 417-437, donde hoy se guarda `sap_doc_entry`/`sap_synced`):
```js
// agregar sap_shipping_amount, sap_shipping_expense_code a ese mismo UPDATE,
// con NULL si shippingAmount === 0 (pedido sin flete), o los valores reales transmitidos si > 0
```

- [ ] **Step 2: Tras tu aprobación, aplicar con Edit.**

- [ ] **Step 3: `node --check src/services/SapOrderService.js`.**

- [ ] **Step 4: Documentar `SAP_SHIPPING_EXPENSE_CODE` en `.env.example` (sin valor real)**

```
# Codigo de gasto adicional de SAP para el flete (ExpenseCode). SAP lo asigna de forma
# consecutiva por compañia -- configurar el valor real por ambiente. Sin default.
SAP_SHIPPING_EXPENSE_CODE=
```

- [ ] **Step 5: Escribir test unitario de los 2 casos de fallo pedidos explícitamente (env var faltante, tax code no resuelto) con un cliente SAP simulado — mostrarte el contenido completo antes de escribirlo (archivo nuevo).**

- [ ] **Step 6: Commit**

```bash
git add src/services/SapOrderService.js .env.example scripts/tests/sap-shipping-expense.test.js
git commit -m "feat(shipping): transmitir flete a SAP como DocumentAdditionalExpenses, trazabilidad en orders"
```

---

### Task 4: Frontend — cálculo de flete compartido

**Files:**
- Create: `src/views/frontend/LoginArtesa/src/utils/shippingCalculator.js`
- Modify: `src/views/frontend/LoginArtesa/src/Components/Dashboard/Pages/Orders/CreateOrderForm.jsx` (función `calculateShipping`, líneas 719-740, y sus llamadas)
- Modify: `src/views/frontend/LoginArtesa/src/Components/Dashboard/Pages/Products/Products.jsx` (función `calculateShipping`, líneas 348-363, constantes líneas 53-58)

**Interfaces:**
- Produces: `function calculateShipping(subtotal, totalTaxes)` → `number` (`0` o `10000`), misma firma y regla que hoy tienen ambos componentes, para minimizar el cambio en cada uno — solo cambia de dónde sale la lógica y el valor devuelto en el tramo cobrado.
- Produces: `MIN_ORDER_AMOUNT`, `SHIPPING_LIMIT`, `SHIPPING_FREE_LIMIT`, `SHIPPING_AMOUNT` (constantes, valor 50000/50000/80000/10000) — reemplazan las constantes locales duplicadas en cada componente.

- [ ] **Step 1: Mostrarte el contenido completo del módulo nuevo (archivo pequeño, no aplica diff parcial)**

```js
// src/views/frontend/LoginArtesa/src/utils/shippingCalculator.js
export const MIN_ORDER_AMOUNT = 50000;
export const SHIPPING_LIMIT = 50000;
export const SHIPPING_FREE_LIMIT = 80000;
export const SHIPPING_AMOUNT = 10000;

export const calculateShipping = (subtotal, totalTaxes) => {
  const subtotalWithTaxes = subtotal + totalTaxes;
  if (subtotalWithTaxes < SHIPPING_LIMIT || subtotalWithTaxes >= SHIPPING_FREE_LIMIT) {
    return 0;
  }
  return SHIPPING_AMOUNT;
};
```

- [ ] **Step 2: Mostrarte el diff exacto de `CreateOrderForm.jsx`** (archivo de >800 líneas — solo fragmento):
  - Eliminar las constantes locales `IVA_RATE`... no, `IVA_RATE` se sigue usando para impuestos de productos, solo se eliminan `MIN_ORDER_AMOUNT`, `SHIPPING_CHARGE`, `SHIPPING_LIMIT`, `SHIPPING_FREE_LIMIT` (líneas 264-267) y se importan del módulo nuevo.
  - Reemplazar la función `calculateShipping` completa (líneas 719-740, que hoy calcula `$10.000 + IVA = $11.900`) por una llamada al import: `calculateShipping(subtotal, totalTaxes)`.
  - La validación de monto mínimo (línea 941-943, `if (subtotal < MIN_ORDER_AMOUNT)`) sigue igual, solo cambia el origen del import de `MIN_ORDER_AMOUNT`.

- [ ] **Step 3: Mostrarte el diff exacto de `Products.jsx`** (archivo de >1200 líneas — solo fragmento):
  - Eliminar las constantes locales (líneas 53-58) e importar del módulo nuevo.
  - Reemplazar la función `calculateShipping` (líneas 348-363) por la llamada al import — corrige el comentario `// Costo de envio con impuestos incluidos` (línea 360, hoy incorrecto: hoy le suma el flete completo como si ya tuviera IVA, ahora el flete simplemente no tiene IVA).
  - La validación de mínimo en este archivo hoy compara `subtotalWithTaxes < MIN_ORDER_AMOUNT` (línea 351) — **se corrige para comparar contra el subtotal SIN impuestos**, igual que `CreateOrderForm.jsx`, según pediste explícitamente.

- [ ] **Step 4: Tras tu aprobación de cada archivo por separado, aplicar con Write (módulo nuevo) y Edit (los otros 2).**

- [ ] **Step 5: Build de Vite sin errores (DoD)**

```bash
cd src/views/frontend/LoginArtesa && npm run build
```

- [ ] **Step 6: Escribir test del módulo compartido con los casos pedidos (49.999/50.000 sin impuestos para el mínimo, 79.999/80.000 con impuestos para el flete) — mostrarte el contenido completo antes de escribirlo.**

- [ ] **Step 7: Commit**

```bash
git add src/views/frontend/LoginArtesa/src/utils/shippingCalculator.js src/views/frontend/LoginArtesa/src/Components/Dashboard/Pages/Orders/CreateOrderForm.jsx src/views/frontend/LoginArtesa/src/Components/Dashboard/Pages/Products/Products.jsx
git commit -m "fix(shipping): unificar calculo de flete en frontend, $10.000 sin IVA, minimo contra subtotal sin impuestos"
```

---

### Task 5: Investigación de impacto en lectura de OV/entregas/facturas desde SAP (reporte, sin cambios de código) — COMPLETADA

**Files:** ninguno (solo lectura, confirmado sin cambios de código).

- [x] **Step 1: Confirmado contra el código real.** Hallazgos:
  - `DocumentAdditionalExpenses` hoy **solo se escribe** (`SapOrderService.js:355`, dentro de `createOrderInSAP`) — ningún otro código del repo lo lee (grep en todo `src/`: 0 resultados fuera del punto que este plan agregó).
  - `checkPartialDeliveredOrdersFromSAP` (`SapOrderService.js:888-1051`) itera `orderDetail.DocumentLines` específicamente (`for...of`, no por índice/conteo contra otro array) sumando `Quantity`/`RemainingOpenQuantity` — `DocumentAdditionalExpenses` es un array separado a nivel de documento, sin esos campos, nunca iterado ahí. Sin riesgo. No existe una función `checkFullyDeliveredOrdersFromSAP` separada — la detección de entrega completa está plegada en la misma función vía `remainingOpenQuantity === 0`.
  - `TotalExpenses`, `LineNum`, `BaseType`, `BaseEntry`, `BaseLine` — **0 resultados** en todo `src/`. El código nunca hace linking de líneas de factura/entrega contra líneas de OV por esos campos — esa categoría de riesgo simplemente no existe en este código, porque la app nunca lee detalle a nivel de línea de facturas/entregas desde SAP, solo agregados a nivel de documento (`DocTotal`, `RemainingOpenQuantity` sumado, `DocumentStatus`).
  - **Único efecto cruzado real, confirmado pero con un supuesto razonable no verificado en vivo**: `checkInvoicedOrdersFromSAP()` (`SapOrderService.js:1057-1270`) empareja OV↔factura comparando `DocTotal` (`Math.abs(invoice.DocTotal - sapOrderInfo.docTotal)`, línea 1185, `+100` exacto / `+50` dentro del 10%, umbral `>=50` en línea 1203). `DocTotal` de la OV y de la factura resultante ambos deberían incluir el flete (SAP copia gastos adicionales del documento base al documento derivado, comportamiento estándar de Service Layer) — así que el emparejamiento debería seguir funcionando igual (ambos lados se mueven juntos). Esto es una inferencia basada en el comportamiento estándar de SAP B1, **no verificado contra una respuesta real de SAP en este paso** — queda como el único punto a confirmar explícitamente con evidencia real durante la Tarea 6 (Staging), no algo que requiera cambio de código.

---

### Task 6: Deploy a EC2 Staging y validación end-to-end

**Files:** ninguno (operación).

- [ ] **Step 0: Esperar tu confirmación explícita antes de este deploy.** Staging corre hoy `feature/backoffice-core` — desplegar `feature/shipping-backend` ahí lo reemplaza temporalmente.

- [ ] **Step 1: Configurar `SAP_SHIPPING_EXPENSE_CODE=7` en el `.env` de Staging (tras tu confirmación explícita de que corresponde a `PRUEBAS_ARTESA_14JUL`).**

- [ ] **Step 2: Pull + rebuild completo sin caché en EC2 Staging (backend y frontend).**

- [ ] **Step 3: Correr los scripts de aceptación (Task 1, Task 3, Task 4) contra Staging, pegar salida completa.**

- [ ] **Step 4: Crear 3 pedidos reales por el flujo real de la app: uno con flete desde `CreateOrderForm.jsx`, uno con flete desde `Products.jsx`, uno con envío gratis. Sincronizarlos por el flujo real (no forzado). Mostrarte el JSON real de cada OV:**
  - `DocumentAdditionalExpenses` (`ExpenseCode 7`, `LineTotal 10000`, `TaxCode IVAG03`, `TaxSum 0`), `VatSum`, `DocTotal` para los 2 pedidos con flete.
  - Confirmar que `DocTotal = total_amount del portal + 10000` y que coincide con lo que vio el cliente en pantalla en cada uno.
  - Confirmar que la OV sin flete **no** trae `DocumentAdditionalExpenses` en absoluto.
  - Si alguno de estos 2 pedidos con flete llega a facturarse durante la validación (no es requisito, pero si ocurre): confirmar que la factura resultante también trae el flete en su `DocTotal`, validando en vivo el supuesto de la Tarea 5 sobre `checkInvoicedOrdersFromSAP` (SAP copia gastos adicionales del documento base al derivado).

- [ ] **Step 5: Cancelar las 3 OV de prueba en SAP al terminar.**

- [ ] **Step 6: Reportar estado según DoD.** **APROBADO PARA PRODUCCIÓN requiere, además de tu visto bueno explícito:** (a) el gasto FLETE ya creado en `HBT_ARTESA` por ti, (b) `SAP_SHIPPING_EXPENSE_CODE` configurada en el `.env` de Producción con el código real que resulte ahí, (c) backend y frontend saliendo en el mismo despliegue.

---

## Self-Review

**1. Spec coverage:**
- Flete $10.000 sin IVA, sin desglose base/impuesto → Task 1, 3, 4 (reemplaza el diseño anterior con IVA incluido).
- Regla de `CreateOrderForm.jsx` (mínimo sin impuestos, flete con impuestos reales) en frontend Y backend → Task 1 (backend, no rechaza, solo decide flete), Task 4 (frontend, sí rechaza).
- Backend no toca `Order.createOrder()`/`total_amount`/no rechaza por mínimo → Global Constraints, explícito en Architecture.
- `shippingConfig.js` con los 3 valores pedidos → Task 1.
- `SAP_SHIPPING_EXPENSE_CODE` por variable de entorno sin default, documentada en `.env.example` → Task 3.
- `shippingCalculator.js` decide con datos ya persistidos, sin recalcular impuestos → Task 1.
- `DocumentAdditionalExpenses` con `TaxCode` explícito, `DocumentLines` sin cambios → Task 3.
- Fallo explícito (no transmitir mal) si falta env var o `zeroRateTaxCode` → Task 3, Review Focus.
- Sin flete, payload igual que hoy → Task 3, Review Focus.
- Idempotencia/reintento/alertas intactos → Hallazgos de riesgo, punto 3.
- Investigación de impacto en lectura de OV/entregas/facturas → Task 5.
- Migración de trazabilidad, nombres/tipos propuestos antes de crear → Task 2.
- Pedidos pendientes de sincronizar llevan flete sin caso especial → Global Constraints, confirmado.
- Tests backend (49999/50000/79999/80000, exento, IMSB+IVA, env var faltante, tax code no resuelto) → Task 1, Task 3.
- Tests frontend (mismos umbrales, cálculo compartido) → Task 4.
- Validación en Staging con JSON real, comparación DocTotal, cancelar OV → Task 6.
- Despliegue conjunto, condiciones de Producción (gasto creado en HBT_ARTESA, env var configurada) → Task 6, Global Constraints.
- Pendientes de facturación electrónica/DIAN y bug preexistente de `updateOrder()` registrados sin resolver → sección "Pendientes registrados".

**2. Placeholder scan:** el nombre exacto de las propiedades en las filas que `SapOrderService.js` ya consulta para `DocumentLines` (¿ya incluye `tax_amount` en el `SELECT` o hay que agregarlo?) es el único punto abierto — se confirma al escribir el diff real de Task 3, Step 1, no es una decisión de diseño pendiente, es una lectura de código pendiente de hacer en el momento.

**3. Type consistency:** `calculateOrderShipping` (backend) y `calculateShipping` (frontend) ambas devuelven `number` (`0` o `10000`) — incluso con nombres de función distintos por convención de cada lado, misma forma de retorno. `ExpenseCode` como `INTEGER` en BD y `parseInt(...)` al armar el payload — consistente.

**4. Review Focus:** cubierto arriba (umbral exacto en ambos bordes, producto exento e IMSB+IVA con impuesto real, fallo explícito sin transmisión parcial, payload sin flete inalterado, reintento sin estado que limpiar).
