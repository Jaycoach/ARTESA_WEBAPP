# Fix: reintento del sync de pedidos antes de medianoche + alertas de pedidos fallidos a SAP

Rama: `fix/order-sync-retry-alerts`, base `feature/backoffice-core @ 7a422c1`.
Estado DoD: **IMPLEMENTADO** — pendiente de completar QA en Staging (sección "Evidencia QA" abajo).

## 1. Incidente que origina el fix

23-sep-2026, corte de las 18:05 (hora Bogotá): SAP rechazó los pedidos de los portales 70
(Tienda Santa Paula), 75 (Tienda Cedritos) y 76 (Tienda Punto de Fábrica), todos con entrega
25-sep, con el error `10001069 - Item GTAPT02 is inactive`. El artículo se congeló en SAP ese
mismo día; el portal solo se entera en el sync de productos de la madrugada siguiente.

Quedaron con `sap_synced=false`, `sap_sync_attempts=1`, `sap_sync_status=NULL`, y **nunca se
reintentaron**: el `SELECT` de `syncOrdersToSAP()` solo toma pedidos con
`delivery_date = hoy + 2 días` (America/Bogota); al día siguiente esa ventana ya no los
incluía. Nadie fue notificado; el área comercial los creó a mano en SAP.

El manual funcional decía "3 reintentos cada 30 minutos" — eso no ocurría en el código
(corregido en este fix, ver sección 4).

## 2. Diagnóstico (a-f)

Ver el mensaje de diagnóstico entregado en esta conversación antes de la implementación
(aprobado sin cambios salvo el ajuste al punto (c)). Resumen:

- **(a)** El único disparador real de `syncOrdersToSAP()` es el callback registrado en
  `OrderScheduler` (corte a `order_time_limit + 5min`, hoy 18:05 Bogotá). El cron de las 3 AM
  de `SapServiceManager` NO sincroniza pedidos. `this.syncSchedule`/`this.orderTimeLimit` en
  `SapOrderService` se calculan pero nunca se pasan a `cron.schedule()` — es código muerto del
  cron propio eliminado en el fix del 9-sep (pendiente vii, no se toca en este fix).
- **(b)** El `SELECT` toma `sap_synced=false`, `status_id IN (1,2,3)`,
  `sap_sync_attempts < 3`, `delivery_date = hoy+2 (Bogotá)`. Un pedido con
  `sap_sync_attempts=1`, `sap_sync_status=NULL` sí es tomado por un reintento el mismo día
  calendario Bogotá.
- **(c)** El filtro SQL y `DocDate` ya usaban America/Bogota correctamente. El único cálculo en
  UTC era el `targetDeliveryDate` usado solo en logs — **corregido en este fix** con
  `formatDateBogota()`.
- **(d)** `syncOrdersToSAP()` no exponía detalle por pedido; sus únicos 2 consumidores
  (`orderController.js:1799`, `internalRoutes.js:45`) consumen el objeto `stats` completo sin
  desestructurar campos — agregar `stats.orderDetails` es aditivo y no los rompe.
- **(e)** El patrón reutilizable real vive en `scripts/production/ssl-expiry-mailer.js`
  (`EmailService.sendMailWithLimits()` + `from.address = SMTP_FROM` + destinatarios desde env
  var separada por comas). `EmailService.js` ya tenía `escapeHtml()` reutilizable.
- **(f)** `SAP_COMPANY_DB` en Staging confirmado por Jonathan como `PRUEBAS_ARTESA_14JUL` antes
  de la primera prueba que crea documentos (ver evidencia QA).

## 3. Diseño implementado

- **Reintento**: cron nuevo (`scheduleRetrySyncTask()`) a `ORDER_SYNC_RETRY_TIME`
  (America/Bogota, default `23:00`, WARNING + fallback si el formato HH:MM es inválido) que
  llama **directamente** a `syncOrdersToSAP()` vía `runRetrySync()` — no pasa por
  `OrderScheduler`, no repite la actualización de estados. Reutiliza el candado
  `sap_sync_status` y la verificación `U_JZ_WebOrderId` de `createOrderInSAP()` sin tocarlos.
  Registro idempotente (no se duplica si `initialize()` corre más de una vez).
- **Clasificación "recuperado"**: un pedido que se crea exitosamente y traía
  `sap_sync_attempts > 0` se marca `result: 'recovered'` en `stats.orderDetails`; si traía 0,
  se marca `'created'`. Sin columnas ni tablas nuevas.
- **Alerta en el corte (18:05)**: si hay pedidos fallidos, un correo a
  `ORDER_SYNC_ALERT_EMAIL_TO` con tienda/cliente, número de pedido, fecha de entrega y motivo
  en lenguaje sencillo (`"Item X is inactive"` → `"El producto X – <nombre> está inactivo en
  SAP"`; cualquier otro error se muestra tal cual). Indica que habrá reintento automático.
- **Alerta en el reintento**: pedidos que vuelven a fallar → "deben registrarse manualmente";
  pedidos recuperados → "enviados correctamente en el reintento". Si no hay nada que reportar,
  no se envía correo.
- **Falla global** (excepción antes/durante el proceso, ej. login SAP fallido): alerta aparte
  con el motivo, en el corte y en el reintento.
- El correo nunca interrumpe ni revierte la sincronización (try/catch propio en
  `sendSyncAlertIfNeeded`/`sendGlobalFailureAlert`, sin `throw`). HTML escapado con
  `escapeHtml()`. Si `ORDER_SYNC_ALERT_EMAIL_TO` no está definida: WARNING en el log, sin
  excepción.
- No se tocó `customer_po_number`/`NumAtCard` ni el mapeo de `U_JZ_WebOrderId`.

## 4. Archivos modificados

- `src/services/SapOrderService.js` — `formatDateBogota()`, `translateSapError()`,
  `stats.orderDetails`, `runScheduledSync()`, `runRetrySync()`, `scheduleRetrySyncTask()`,
  `sendSyncAlertIfNeeded()`, `sendGlobalFailureAlert()`, `_parseAlertRecipients()`.
- `src/services/EmailService.js` — método nuevo `sendOrderSyncAlertEmail()` (sin tocar
  métodos existentes).
- `.env.example` — creado (no existía), documenta `ORDER_SYNC_ALERT_EMAIL_TO`,
  `ORDER_SYNC_RETRY_TIME` y el resto de variables conocidas del proyecto.
- `docs/MANUAL_FUNCIONAL_LA_ARTESA.md` — corregidas las secciones 8.5 (~línea 1287) y ~2016
  que describían "3 reintentos cada 30 minutos" (no ocurría en el código).
- `docs/CHANGELOG-backoffice-core.md` — nueva fase con este fix.
- `scripts/tests/order-sync-retry-alerts-acceptance.js` — script de aceptación nuevo.

## 5. Commits

(completar con `git log --oneline fix/order-sync-retry-alerts` antes del reporte final)

## 6. Evidencia QA (Staging)

**Precondición confirmada:** `docker exec artesa-api-staging env | grep -E "^SAP_COMPANY_DB="`
→ `SAP_COMPANY_DB=PRUEBAS_ARTESA_14JUL` (confirmado por Jonathan antes de esta prueba).

### Prueba 1 — Pedido con artículo inactivo → correo de fallo en el corte
_(pendiente de ejecutar — requiere `ORDER_SYNC_ALERT_EMAIL_TO`/`ORDER_SYNC_RETRY_TIME`
configuradas por Jonathan en el `.env` de Staging)_

### Prueba 2 — Corregir causa + reintento manual → correo de "recuperado"
_(pendiente)_

### Prueba 3 — Reintento sin corregir → correo de "registro manual"
_(pendiente)_

### Prueba 4 — Corte y reintento en paralelo sobre el mismo pedido → cero duplicados
_(pendiente)_

### Prueba 5 — Fecha objetivo/DocDate correctas cerca de las 23:00 Bogotá (04:00 UTC)
_(pendiente — ver `scripts/tests/order-sync-retry-alerts-acceptance.js`, verificación
comparando el cálculo SQL en Bogotá contra `formatDateBogota()` en Node)_

### Prueba 6 — Regresión: corte normal sin fallos no envía correo
_(pendiente)_

### Prueba 7 — Falla global simulada → correo de falla global
_(pendiente)_

## 7. Paridad de Staging

_(completar: HEAD del commit desplegado, `git status -sb`, estado del contenedor
`artesa-api-staging`)_

## 8. Pendientes fuera de alcance (registrados, sin implementar)

i. Validar contra SAP que los artículos del pedido sigan activos antes de transmitir (hoy solo
   se descubre al fallar el POST).
ii. El sync de productos evalúa `Frozen` pero no `Valid` ni los rangos
    `FrozenFrom`/`FrozenTo`.
iii. `EMP007` y `EMP0029` siguen activos en el portal aunque SAP tiene `SalesItem=tNO`
     (posible grupo no cubierto por el sync de productos).
iv. `status_id=3` ("Sincronizado") se asigna antes de la transmisión real a SAP y confunde a
    las tiendas.
v. `ssl/nginx.crt` está versionado en Git aunque es propio de cada servidor (sacarlo del
   índice + `.gitignore`); el repo no tiene `.gitattributes` y archivos copiados desde Windows
   ensucian el `git status` con CRLF.
vi. Agregar `backups/` al `.gitignore`.
vii. `SapOrderService.configureScheduleFromSettings()`/`reconfigureSchedule()`:
     `this.syncSchedule` es código muerto del cron propio eliminado el 9-sep — no programa
     nada, pero aparece en logs y en `SapServiceManager.getSyncStatus()` como si lo hiciera.
