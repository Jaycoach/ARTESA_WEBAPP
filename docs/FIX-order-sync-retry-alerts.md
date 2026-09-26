# Fix: reintento del sync de pedidos antes de medianoche + alertas de pedidos fallidos a SAP

Rama: `fix/order-sync-retry-alerts`, base `feature/backoffice-core @ 7a422c1`.
Estado DoD: **VALIDADO EN STAGING** (P1-P8 ejecutados con evidencia real, ver sección 6).
No aprobado para Producción — pendiente decisión explícita de Jonathan.

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

- **(a)** El único disparador real de `syncOrdersToSAP()` es el callback registrado en
  `OrderScheduler` (corte a `order_time_limit + 5min`, hoy 18:05 Bogotá en Producción / 19:05
  en Staging, ver pendiente (viii)). El cron de las 3 AM de `SapServiceManager` NO sincroniza
  pedidos. `this.syncSchedule`/`this.orderTimeLimit` en `SapOrderService` se calculan pero
  nunca se pasan a `cron.schedule()` — código muerto del cron propio eliminado en el fix del
  9-sep (pendiente vii, no se toca en este fix).
- **(b)** El `SELECT` toma `sap_synced=false`, `status_id IN (1,2,3)`,
  `sap_sync_attempts < 3`, `delivery_date = hoy+2 (Bogotá)`. Un pedido con
  `sap_sync_attempts=1`, `sap_sync_status=NULL` sí es tomado por un reintento el mismo día
  calendario Bogotá.
- **(c)** El filtro SQL y `DocDate` ya usaban America/Bogota correctamente. El `targetDeliveryDate`
  usado solo en logs sí estaba en UTC — corregido con `formatDateBogota()`. La validación/
  actualización de TRM también tenía el mismo bug de fondo (encontrado en QA, ver sección 3).
- **(d)** `syncOrdersToSAP()` no exponía detalle por pedido; sus únicos 2 consumidores
  (`orderController.js:1799`, `internalRoutes.js:45`) consumen el objeto `stats` completo sin
  desestructurar campos — agregar `stats.orderDetails` es aditivo y no los rompe.
- **(e)** El patrón reutilizable real vive en `scripts/production/ssl-expiry-mailer.js`
  (`EmailService.sendMailWithLimits()` + `from.address = SMTP_FROM` + destinatarios desde env
  var separada por comas). `EmailService.js` ya tenía `escapeHtml()` reutilizable.
- **(f)** `SAP_COMPANY_DB` en Staging confirmado como `PRUEBAS_ARTESA_14JUL` antes de la primera
  prueba que crea documentos (verificado por Jonathan y re-verificado por mí, ver sección 6).

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
- **Alerta en el corte**: si hay pedidos fallidos, un correo a `ORDER_SYNC_ALERT_EMAIL_TO` con
  tienda/cliente, número de pedido, fecha de entrega y motivo en lenguaje sencillo
  (`"Item X is inactive"` → `"El producto X – <nombre> está inactivo en SAP"`; cualquier otro
  error se muestra tal cual). Indica que habrá reintento automático.
- **Alerta en el reintento**: pedidos que vuelven a fallar → "deben registrarse manualmente";
  pedidos recuperados → "enviados correctamente en el reintento". Si no hay nada que reportar,
  no se envía correo.
- **Falla global** (excepción antes/durante el proceso, ej. la consulta inicial a la BD falla):
  alerta aparte con el motivo, en el corte y en el reintento. Ver pendiente (viii) sobre qué
  pasa hoy si específicamente el LOGIN de SAP falla (no es lo mismo que una falla global).
- El correo nunca interrumpe ni revierte la sincronización (try/catch propio en
  `sendSyncAlertIfNeeded`/`sendGlobalFailureAlert`, sin `throw`). HTML escapado con
  `escapeHtml()`. Si `ORDER_SYNC_ALERT_EMAIL_TO` no está definida: WARNING en el log, sin
  excepción.
- No se tocó `customer_po_number`/`NumAtCard` ni el mapeo de `U_JZ_WebOrderId`.

**Fixes agregados durante QA (hallazgos reales, no anticipados en el diseño original):**
- **TRM en UTC** (`validateAndUpdateTRM`): usaba `toISOString()` en vez de `formatDateBogota()`.
  A las 23:00 Bogotá (04:00 UTC del día siguiente) la TRM se validaba/actualizaba para la
  fecha UTC, un día adelantada respecto al `DocDate` real del documento. Corregido; el caller
  en `createOrderInSAP()` ahora pasa la fecha de transmisión (`new Date()`, la misma que usa
  `DocDate`), no `orderData.order_date`.
- **Reclamo optimista en el candado**: la `UPDATE ... SET sap_sync_status='processing'` ahora
  exige además `AND COALESCE(sap_sync_attempts, 0) = $2` (el valor leído en el `SELECT` de esa
  misma corrida). Sin esto, dos ejecuciones que se solapan sobre una fila que YA falló pueden
  procesarla dos veces (la primera libera el candado al fallar antes de que la segunda llegue a
  esa fila) — verificado en P4 (pedido 186: `sap_sync_attempts` 1→3 en un solo ciclo) y
  corregido y re-verificado en P4 repetido (pedido 190: exactamente +1).
- **Logging**: el error por pedido ahora incluye el mensaje real de SAP (antes solo
  `"Request failed with status code 400"`, genérico de axios). Eliminado un `logger.info()`
  duplicado ("Encontradas N órdenes para sincronizar" se registraba dos veces seguidas).

## 4. Archivos modificados

- `src/services/SapOrderService.js` — `formatDateBogota()`, `translateSapError()`,
  `stats.orderDetails`, `runScheduledSync()`, `runRetrySync()`, `scheduleRetrySyncTask()`,
  `sendSyncAlertIfNeeded()`, `sendGlobalFailureAlert()`, `_parseAlertRecipients()`, fix de TRM
  en Bogotá, reclamo optimista del candado, logging.
- `src/services/EmailService.js` — método nuevo `sendOrderSyncAlertEmail()` (sin tocar
  métodos existentes).
- `.env.example` — creado (no existía), documenta `ORDER_SYNC_ALERT_EMAIL_TO`,
  `ORDER_SYNC_RETRY_TIME` y el resto de variables conocidas del proyecto.
- `.gitignore` — excepción de una línea (`!.env.example`) a la regla `.env.*`, aprobada por
  Jonathan.
- `docs/MANUAL_FUNCIONAL_LA_ARTESA.md` — corregidas las secciones que describían "3 reintentos
  cada 30 minutos" (no ocurría en el código).
- `docs/CHANGELOG-backoffice-core.md` — nueva fase con este fix.
- `scripts/tests/order-sync-retry-alerts-acceptance.js` — script de aceptación nuevo, con
  guarda `current_database() = artesadb_dev` (obligatoria, agregada tras hallazgo de que la
  RDS es compartida con Producción).

## 5. Commits

```
07d9124 feat(email): agregar sendOrderSyncAlertEmail para alertas de sincronizacion de pedidos con SAP
97f265e feat(order-sync): reintento automatico el mismo dia y alertas por correo a comercial
3d5fade docs(order-sync): documentar reintento y alertas -- manual funcional, .env.example, changelog
88c3b95 test(order-sync): script de aceptacion para reintento y alertas de sincronizacion
0d01c35 fix(order-sync): abortar el script de aceptacion si current_database() no es artesadb_dev
88537ef fix(order-sync): TRM en America/Bogota, reclamo optimista y log con mensaje real de SAP
8be111d docs(order-sync): completar evidencia de QA P1-P8, hallazgos y estado VALIDADO EN STAGING
32cd90d feat(order-sync): distinguir falla de conectividad/autenticacion con SAP de errores de negocio (pendiente ix)
e6574ea fix(order-sync): validateAndUpdateTRM no debe enmascarar fallas de conectividad como "TRM no encontrada"
```

## 6. Evidencia QA (Staging)

**Precondición confirmada dos veces:** `SAP_COMPANY_DB=PRUEBAS_ARTESA_14JUL` (por Jonathan antes
de la primera prueba, y por mí vía `docker exec` antes de tocar SAP). Guarda de
`current_database()='artesadb_dev'` verificada en cada escritura a la BD.

**Datos de prueba:** cliente `CI830121745` (ESCUELA DE GASTRONOMIA G D SAS, `user_id=568`),
verificado como BP real y activo en SAP (`Valid=tYES, Frozen=tNO`) antes de usarlo — el primer
intento con el usuario QA de la API (`user_id=810`, cardcode `CI900457362`) se descartó porque
ese BP **no existe en SAP** (404 confirmado), lo que habría hecho que P1 fallara por "cliente
inexistente" en vez de "item inactive". Artículos `GTAPT01`-`GTAPT04` (uno de ellos, `GTAPT02`,
es el mismo artículo del incidente real), baseline confirmado `Valid=tYES, Frozen=tNO,
SalesItem=tYES` antes de tocar nada, y restaurado a ese mismo baseline al final de cada bloque
de pruebas.

### P1 — Pedido con artículo inactivo → correo de fallo en el corte
Pedidos 185 (GTAPT02), 186 (GTAPT01), 187 (GTAPT03, activo), 188 (GTAPT04) en la ventana.
Inactivé GTAPT01/02/04 en SAP (`PATCH Items('<code>') {"Valid":"tNO","Frozen":"tYES"}` —
el intento inicial solo con `Frozen` dio `400 Date ranges overlap`; el combinado con `Valid`
funcionó), dejé GTAPT03 activo. Corrí `runScheduledSync()`:
- 187 creado en SAP: `DocEntry=1433, DocNum=1027`.
- 185, 186, 188 fallaron con el mensaje traducido (`"El producto GTAPT0X – <nombre> está
  inactivo en SAP"`).
- **Un solo correo**: `"[ALERTA] 3 pedido(s) no se pudieron enviar a SAP"`,
  `messageId=<42b13f58-6c09-f518-f675-5d717257d79d@artesapanaderia.com>`, a
  `jaycoach@hotmail.com,admin@zub1pay.com`. **PASS.**

### P2 — Corregir causa + reintento → correo de "recuperado"
Restauré solo GTAPT02. Corrí corte+reintento en paralelo (ver P4): 185 se creó en SAP
**exactamente una vez** (`DocEntry=1437, DocNum=1028`), clasificado `"recovered"`
(`sap_sync_attempts` previo=1). **PASS** (probado junto con P4 real).

### P3 — Reintento sin corregir → correo de "registro manual"
Con 186 ya en 3 intentos (ver P4, hallazgo del candado), `runRetrySync()` tomó solo 188
(único con `attempts<3`), volvió a fallar, `sap_sync_attempts` 2→3. Correo
`"[Reintento SAP] 1 pendiente(s), 0 recuperado(s)"`,
`messageId=<376606c1-176c-30d7-cf38-b042346bed85@artesapanaderia.com>`. **PASS.**

### P4 — Corte y reintento en paralelo → cero duplicados en SAP
**Primera corrida** (antes del fix del candado): `runScheduledSync()` + `runRetrySync()` en
paralelo sobre 185/186/188.
- 185 (éxito): creado en SAP **una sola vez** (`DocEntry=1437`) — el candado protegió
  correctamente el caso de éxito.
- **Hallazgo real**: 186 (fallo) se procesó **dos veces**, una por cada ejecución —
  `sap_sync_attempts` 1→3 en un solo ciclo. Causa: el candado libera `sap_sync_status=NULL`
  al fallar, y si la otra ejecución llega a esa misma fila después de esa liberación pero
  dentro del mismo ciclo, la vuelve a reclamar. No hubo duplicado en SAP (186 nunca llegó a
  crearse), pero sí gastó dos intentos de tres.
- Implementado el fix de reclamo optimista (`AND COALESCE(sap_sync_attempts,0) = $2`) y
  desplegado.
**Repetido con pedido nuevo (190, GTAPT01 congelado, cliente CI830121745, entrega
lunes 28-sep — hoy+2 día hábil):** corte y reintento en paralelo de nuevo:
`RESULT_CORTE: {"errors":1,...}`, `RESULT_REINTENTO: {"skipped":1,...}` — el reintento
encontró la fila ya reclamada por el corte y la omitió. Verificado en BD:
`sap_sync_attempts=1` (antes habría sido 2). **PASS con el fix.**
Restaurado GTAPT01 al baseline y, como regresión (item 4 del segundo reporte), corrida
`runScheduledSync()` con GTAPT01 ya activo: pedido 190 creado exitosamente
(`DocEntry=1442, DocNum=1029`), sin correo — esto además lo sacó de la ventana del corte real
de ese día.

### P5 — Fecha objetivo/DocDate correctas cerca de las 23:00 Bogotá
Cubierto por el script de aceptación (`scripts/tests/order-sync-retry-alerts-acceptance.js`,
Test 2: compara el `DATE(...AT TIME ZONE 'America/Bogota'...)` real de Postgres contra
`formatDateBogota()` en Node — 4/4 PASS, exit 0 contra Staging real) y por el ciclo real de P8:
el reintento de las 23:00 Bogotá calculó `targetDeliveryDate=2026-09-27` (correcto) y
`DocDate=2026-09-25` (correcto, pese a que en UTC ya era 26-sep) — verificado en logs reales.
La TRM, en cambio, sí tenía el bug (usaba fecha UTC): **corregido** (sección 3) y verificado
con el instante exacto donde ocurrió: `2026-09-26T04:00:00Z` (23:00 Bogotá del 25-sep) →
`formatDateBogota` da `2026-09-25` (correcto); `toISOString()` daba `2026-09-26` (el bug).

### P6 — Regresión: corte/reintento sin fallos no envía correo
`runRetrySync()` manual con 0 pedidos pendientes reales en Staging:
`{"total":0,"created":0,"errors":0,"skipped":0,"orderDetails":[]}`, sin ningún log de envío
de correo. **PASS.**
Camino del corte con éxito puro: cubierto por 187 en P1 (creado exitosamente, sin aparecer en
el correo de fallo, que solo listó los 3 fallidos).

### P7 — Falla global aislada → correo de falla global
Simulada forzando que la consulta inicial a la BD falle (`docker exec -e
DB_PASSWORD=<inválido, solo ese proceso> ... node -`), aislado del contenedor real. Confirmado
en logs: `"password authentication failed"` propagó hasta `runRetrySync()`, que envió
`"[ALERTA] Falla en el reintento de sincronización de pedidos con SAP"`
(`messageId=<08467e27-a505-77ac-0c6c-84ba118a1a71@artesapanaderia.com>`, `globalError:true`),
y retornó `null` sin lanzar. Verificado que ningún `sap_sync_attempts` cambió antes/después.
**PASS.** (Ver pendiente (viii): por qué se simuló con un error de BD y no con SAP_PASSWORD
inválido, y qué pasa realmente si falla el login de SAP).

### P8 — Ciclo real (pedido 189, GTAPT04)
Corte real de Staging (19:05 Bogotá, hora de cierre 19:00 + 5min): 189 falló
(`sap_sync_attempts` 0→1) porque GTAPT04 seguía inactivo (no se reactivó a tiempo).
Reintento real (23:00 Bogotá): disparó solo, `targetDeliveryDate=2026-09-27` y
`DocDate=2026-09-25` correctos, verificó `U_JZ_WebOrderId` antes de crear, falló de nuevo
(GTAPT04 seguía inactivo), correo `"[Reintento SAP] 1 pendiente(s), 0 recuperado(s)"`,
`messageId=<9c5d0aaa-26ce-485a-537a-8fb7ad7d2a26@artesapanaderia.com>`. 189 quedó con
`sap_sync_attempts=2`, fuera de la ventana. Contenedor sin reinicios durante el ciclo
(`StartedAt=2026-09-25T16:58:06Z`). **PASS para lo que sí se pudo probar**: cron del corte real
+ cron del reintento real + alertas reales, ambos disparándose solos sin intervención manual.
La clasificación "recuperado" en un ciclo real específicamente no quedó probada con 189 (el
artículo no se reactivó a tiempo), pero el mismo código ya se probó exhaustivamente con 185 en
P2/P4 (manual) — es la misma ruta de código, sin diferencia entre disparo manual y disparo por
cron.

## 7. Paridad de Staging

- HEAD final: `88537ef` (`fix/order-sync-retry-alerts`).
- `git status -sb`: solo `ssl/nginx.crt` (M) y `backups/*` (??) — propios del servidor.
- Contenedor `artesa-api-staging`: `healthy` en cada verificación tras deploy.
- Log de arranque confirmado en cada deploy: `"Programando reintento diario de sincronización
  de pedidos" {"retrySyncTime":"23:00","schedule":"0 23 * * *"}`.
- `ORDER_SYNC_ALERT_EMAIL_TO`: 2 destinatarios confirmados (conteo, sin exponer direcciones).

## 8. Cero archivos temporales

Los scripts auxiliares usados durante la exploración inicial de QA (antes de que Jonathan
estableciera la regla explícita de "cero archivos temporales") se crearon en el directorio de
scratchpad de la sesión (fuera del repo) y se eliminaron todos antes de continuar — confirmado
con `ls` (directorio vacío) tras el borrado. Desde que se estableció la regla, todo el código
puntual se ejecutó por `docker exec -i ... node - <<EOF` (stdin) o `node -` local, sin escribir
ningún archivo ni en el repo ni en el servidor. El único script nuevo versionado es
`scripts/tests/order-sync-retry-alerts-acceptance.js`, ya commiteado.

## 9. Correo en QA

`ORDER_SYNC_ALERT_EMAIL_TO` en Staging tiene 2 destinatarios: `jaycoach@hotmail.com` y una
segunda cuenta que sí recibe. Evidencia real usada en todo este documento: `messageId` real de
SES (todos loggeados arriba) — el SMTP siempre aceptó el envío (`250 Ok`), pero eso no prueba
entrega. **Sobre el hotmail**: no verifiqué manualmente bandeja de entrada/spam de
`jaycoach@hotmail.com` en ningún punto de esta QA (no tengo acceso a esa cuenta) — esto ya está
documentado como problema conocido de entrega hacia Microsoft/Outlook en
`docs/CHANGELOG-backoffice-core.md`. **Condición para pasar a Producción** (registrada, sin
resolver aquí): validar que la alerta llegue al buzón real del área comercial en Producción; si
su dominio corporativo está en Microsoft 365/Outlook, puede fallar igual que el hotmail de
prueba.

## 10. Respuestas pendientes

**(a) ¿Qué pasa hoy si falla el LOGIN de SAP durante el corte?**
No sale un correo de "falla global". `syncOrdersToSAP()` solo lanza una excepción que
`runScheduledSync()`/`runRetrySync()` capturan como "falla global" si algo revienta **antes**
del `for` de pedidos — en la práctica, solo si el `SELECT` inicial a la BD falla (por eso P7 se
simuló así, y no con `SAP_PASSWORD` inválido: probé primero con `SAP_PASSWORD` inválido y no
generó ninguna falla porque, con 0 pedidos pendientes en ese momento, `syncOrdersToSAP()` nunca
llegó a intentar login — ni siquiera se ejercitó el código de login). Si en cambio SÍ hay
pedidos pendientes y el login de SAP falla, cada intento de `createOrderInSAP()` ocurre dentro
del `try/catch` **por pedido** del `for`: el error de login (ej. "Unauthorized" o timeout de
SAP) se trata como cualquier otro error de SAP — no matchea la regex de `translateSapError()`
(queda con el mensaje técnico crudo), incrementa `sap_sync_attempts` de ESE pedido, y el `for`
sigue con el siguiente pedido (que probablemente falle exactamente igual, gastando un intento
cada uno). Al final del corte, el correo que sale es el normal de "N pedido(s) no se pudieron
enviar a SAP" — con un motivo poco útil para el área comercial (el texto crudo del error de
login) en vez de un aviso claro de "SAP no está disponible". **Este es probablemente el
escenario más realista en Producción** (SAP caído o credenciales rotadas) y hoy no se distingue
de un fallo de artículo inactivo: se ve igual (correo de "pedidos fallidos"), consume intentos
de cada pedido pendiente ese día, y no alerta específicamente sobre una caída de SAP. **No
implementado en este fix** — requeriría detectar el tipo de error (ej. por `error.response?.status`
o un mensaje específico de autenticación) antes del `for`, o mover un `login()` explícito fuera
del loop para que un fallo ahí sí cuente como "falla global". Queda registrado como pendiente
(ix).

**(b) `docs/superpowers/`** — contiene el plan de implementación (`writing-plans`) usado para
ejecutar este fix. Es redundante con este mismo documento (que ya tiene diagnóstico, diseño y
evidencia) y no estaba en la lista de archivos autorizados. Recomendación: **eliminarlo**, no
versionarlo — la memoria útil para el futuro ya vive aquí. Pendiente de tu confirmación final
antes de borrarlo.

**(c)** Registrado como pendiente (x): la hora de cierre de Staging (19:00 Bogotá) difiere de
la de Producción (18:00 Bogotá) — el corte real, en Staging, corre a las 19:05, no 18:05.

## 11. Pendientes fuera de alcance (registrados, sin implementar)

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
viii. En SAP (tenant `PRUEBAS_ARTESA_14JUL`), `PATCH Items('<code>') {"Frozen":"tYES"}` solo
      falla con `"Date ranges overlap"`; hay que enviar `Valid` y `Frozen` en el mismo PATCH.
      `PATCH ... {"Valid":"tNO"}` solo (sin `Frozen`) se acepta con 204 pero NO se aplica
      (verificado con sesión nueva, dos veces) — puede ser relevante para cualquier
      automatización futura que toque el maestro de artículos desde el portal.
ix. **[RESUELTO en este fix, ver sección 12]** Un fallo de LOGIN/conectividad de SAP durante el
    corte no generaba el correo de "falla global" — se diluía como N fallos individuales de
    pedido con un mensaje técnico crudo, gastando un intento de cada uno.
x. La hora de cierre de pedidos en Staging (19:00 Bogotá) difiere de la de Producción
   (18:00 Bogotá) — el corte real corre a las 19:05 en Staging, no a las 18:05.
xi. **[PRIORIDAD ALTA, sin implementar — fuera de alcance de este fix]**
    `SapBaseService.login()` reintenta 3 veces (backoff 2s/4s/8s) sin distinguir un error de
    credenciales (401/`invalid_grant`) de un error de red transitorio. Con credenciales
    rotadas o bloqueadas, cada cron que toca SAP dispara 3 logins fallidos — con 5 servicios
    (`SapOrderService`, `SapClientService`, `SapPriceListService`, `SapProductService`,
    `SapTaxCodeService`) y ~7 disparadores automáticos al día (corte, reintento, 3x
    `deliveryCheck`, `invoiceCheck`, sync nocturno de las 3 AM que internamente llama a 4
    servicios distintos), un problema de credenciales puede generar decenas de intentos
    fallidos en pocas horas sin que nadie lo note — exactamente el mecanismo que bloqueó
    `manager_artesa` durante el QA de este fix (ver sección 13). `Integracion_Artesa` es la
    MISMA cuenta en Staging y Producción: un bloqueo en Staging tumba Producción también. Ver
    propuesta de fix (sin aplicar) en sección 14.

## 12. Fix del pendiente (ix): falla de conectividad/autenticación con SAP

Implementado y verificado en Staging (P7-bis, ver sección 13):

- `isSapConnectivityError(error)` (`SapOrderService.js`): distingue `ECONNREFUSED`/`ETIMEDOUT`/
  `ENOTFOUND`/`ECONNRESET`/`ECONNABORTED`/`EAI_AGAIN`, `401`, `5xx` y timeouts de un error de
  negocio por pedido. También matchea por texto del mensaje, porque
  `SapBaseService.login()` envuelve el error original en un `Error` genérico tras sus 3
  reintentos, perdiendo `error.code`/`error.response.status`.
- **Hallazgo intermedio durante el QA**: `validateAndUpdateTRM()` interpretaba cada login
  fallido como "no hay TRM para esta fecha" y probaba los 7 días anteriores (cada uno
  reintentando login 3 veces, ~14s por día ≈ 100s), terminando en "No se encontró TRM en los
  últimos 7 días" — un mensaje que no matcheaba como conectividad. Corregido: si el error de la
  consulta de tasa es de conectividad, se relanza de inmediato (sin probar los 7 días).
- `syncOrdersToSAP()`: si el error de un pedido es de conectividad, detiene el ciclo completo
  (no sigue con los pedidos restantes), NO incrementa `sap_sync_attempts` de nadie, libera el
  candado de la fila actual, y propaga la falla como "global" (`isSapConnectivity`,
  `pendingCount`) hacia `runScheduledSync()`/`runRetrySync()`.
- Correo específico: `"[ALERTA] SAP no está disponible"` con el conteo de pedidos pendientes;
  en el corte indica que habrá reintento automático a `ORDER_SYNC_RETRY_TIME`, en el reintento
  indica que deben registrarse manualmente.
- Los errores de negocio por pedido (ej. `"Item X is inactive"`) no cambian su comportamiento.

## 13. QA del pendiente (ix) — P7-bis, con evidencia real

**Regla nueva aplicada desde este punto** (impuesta tras el incidente de la sección 14):
NUNCA probar con la contraseña equivocada de un usuario real. Para simular falla de
autenticación: usuario inexistente. Para simular SAP caído: URL inalcanzable. Siempre aislado
al proceso de la prueba (`docker exec -e VAR=... `, sin tocar el `.env` ni el contenedor real).
Antes de cualquier prueba: un solo login de verificación con credenciales reales; si falla, se
detiene, sin reintentar.

**P7-bis (pedido 191, GTAPT02) — con `SAP_PASSWORD` inválido (ANTES de conocerse la regla de
arriba):**
- 1ª corrida (antes del fix de `validateAndUpdateTRM`): el error quedó enmascarado como "TRM no
  encontrada en 7 días" — no se detectó como conectividad, se gastó 1 intento, correo genérico
  de "pedido no sincronizado" (comportamiento pre-fix, documentado como evidencia del bug).
- Corregido `validateAndUpdateTRM()` y redesplegado.
- 2ª corrida: detectado correctamente como conectividad en el primer intento (~14s, no 100s).
  `sap_sync_attempts` **sin cambio** (siguió en 1), candado liberado
  (`sap_sync_status=null`), correo `"[ALERTA] SAP no disponible — reintento automático
  programado"` (`messageId=<9913879a-c43e-b7af-dbfb-49539374ec07@artesapanaderia.com>`).
- Intento de regresión con credenciales "reales" inmediatamente después: **también falló** —
  aquí se detectó que `manager_artesa` había quedado bloqueado por los intentos con contraseña
  inválida. Detenido sin insistir; reportado a Jonathan.
- Tras el cambio a `Integracion_Artesa`: login de verificación previo OK
  (`Integracion_Artesa` @ `PRUEBAS_ARTESA_14JUL`). Regresión completada: pedido 191 creado
  exitosamente **una sola vez** (`DocEntry=1446, DocNum=1031`), **sin ningún correo enviado**
  (`{"total":1,"created":1,"errors":0,"skipped":0}`).

**P7-bis seguro (pedido 192, GTAPT03) — con `SAP_USERNAME=qa_usuario_inexistente`, ya con
`Integracion_Artesa` como cuenta real y la regla de "un solo login de verificación" en vigor:**
- Login de verificación previo: OK (`Integracion_Artesa` @ `PRUEBAS_ARTESA_14JUL`).
- Corte con usuario inexistente: detectado como conectividad, `sap_sync_attempts` quedó en
  **0** (sin cambio), candado liberado, correo `"[ALERTA] SAP no disponible — reintento
  automático programado"` (`messageId=<3ca880d3-b84d-1841-3213-37095dd55b13@artesapanaderia.com>`).
- Login de verificación antes de la regresión: OK.
- Regresión con credenciales reales: pedido 192 creado exitosamente una sola vez
  (`DocEntry=1447, DocNum=1032`), **sin ningún correo enviado**.
- Ventana del corte real de hoy confirmada vacía tras esto (`SELECT` exacto → `[]`).
- Script de aceptación tras todos los fixes: **4/4 PASS**.
- GTAPT01-04 releídos con sesión nueva: los 4 en baseline (`Valid=tYES, Frozen=tNO`).

## 14. Incidente de bloqueo de `manager_artesa` durante el QA — registrado íntegro

**Cambio de cuenta SAP resultante:** el portal (Producción, Staging, y todas las pruebas de
aquí en adelante) usa **`Integracion_Artesa`**, el usuario de integración de APIs. **Es la
MISMA cuenta en ambos ambientes** (`Integracion_Artesa @ PRUEBAS_ARTESA_14JUL` en Staging,
`Integracion_Artesa @ HBT_ARTESA` en Producción) — bloquearla en Staging tumba Producción.
`manager_artesa` es el usuario de administración del cliente SAP y **no debe usarse nunca
más** para nada relacionado con el portal.

**Qué pasó:** durante la primera corrida de P7-bis (pedido 191), usé
`docker exec -e SAP_PASSWORD=<inválido>` para simular una falla de autenticación, con el
usuario real de ese momento (`manager_artesa`). Como `validateAndUpdateTRM()` aún no tenía el
fix de la sección 12, cada intento de login fallido se interpretó como "sin TRM para esta
fecha" y el código probó las 7 fechas anteriores, cada una reintentando login 3 veces — es
decir, una sola invocación de prueba generó muchos más intentos de login fallidos de los que
yo esperaba. Repetí la prueba una vez más (aún antes del fix) para confirmar el hallazgo del
enmascaramiento, y aparentemente esto (u otro intento de "regresión" inmediatamente después,
ya con credenciales que creía correctas) disparó el bloqueo de la cuenta en SAP.

**Total aproximado de intentos de login fallidos generados por mis pruebas contra
`manager_artesa`, 2026-09-26, ventana ~12:15–12:23 hora Bogotá** (contados de los logs reales
del contenedor, `docker logs artesa-api-staging`):
- ~12:15:05–12:16:35: 1ª corrida de P7-bis (pre-fix de TRM) → 7 fechas × 3 intentos = **21**
  logins fallidos.
- ~12:22:01–12:22:13: 2ª corrida de P7-bis (post-fix de TRM, aún con `SAP_PASSWORD` inválido)
  → 1 × 3 intentos = **3** logins fallidos.
- ~12:22:38–12:22:49: intento de regresión con credenciales "reales" (ya bloqueada la cuenta)
  → 1 × 3 intentos = **3** logins fallidos.
- ~12:23:05: verificación aislada de `login()` para diagnosticar → 1 × 3 intentos = **3**
  logins fallidos.
- **Total: ~30 intentos de login fallidos contra `manager_artesa`** en un lapso de ~8 minutos.

**Corrección de proceso, aplicada desde entonces (documentada para no repetirse):**
1. Prohibido probar con la contraseña equivocada de un usuario real — para simular falla de
   autenticación, usar un usuario inexistente; para simular SAP caído, una URL inalcanzable.
   Siempre aislado al proceso de la prueba puntual.
2. Antes de cualquier prueba contra SAP: un solo login de verificación con las credenciales
   reales. Si falla, detenerse y reportar — no reintentar.

## 15. Propuesta (sin aplicar) para el pendiente (xi): no reintentar login ante error de credenciales

**Fuera de alcance de este fix** — vive en `SapBaseService.js`, que no está en la lista de
archivos autorizados. Requiere aprobación explícita antes de tocarlo.

**Servicios y crons que pasan por `SapBaseService.login()`/`request()`** (los 5 heredan la
misma lógica de reintento):
- `SapOrderService`: corte (`OrderScheduler`, ~diario), reintento (`ORDER_SYNC_RETRY_TIME`,
  diario), `deliveryCheck` (3x/día: 8,12,16h), `invoiceCheck` (diario, 23h) — y disparos
  manuales vía `orderController.js` (sync manual admin) e `internalRoutes.js`
  (`/api/internal/sync-orders`).
- `SapClientService`, `SapPriceListService`, `SapProductService`, `SapTaxCodeService`: los 4
  se invocan secuencialmente dentro del sync nocturno unificado de `SapServiceManager`
  (`scheduleDailySyncTask()`, diario a las 3 AM) — una sola falla de credenciales ahí dispara
  hasta 4 secuencias de 3 logins fallidos en un solo cron tick. También disparos manuales vía
  `clientSyncController.js`, `adminController.js` y el dashboard admin
  (`sapSyncService.js`/`AdminPage.jsx`).

En total, con credenciales rotadas/bloqueadas, se estiman **~7 disparadores automáticos al
día** (más los manuales) generando login fallidos sin ninguna alerta específica hasta este fix
(sección 12) — y cada uno multiplicando por 3 intentos.

**Propuesta de cambio en `SapBaseService.login()`** (diseño, no aplicado):

```js
for (let attempt = 1; attempt <= maxRetries; attempt++) {
  try {
    const response = await axios.post(`${this.baseUrl}/Login`, loginData, { ...this.axiosConfig, timeout: 15000 });
    // ... éxito, igual que hoy ...
  } catch (error) {
    lastError = error;

    // Error de CREDENCIALES (401, o el mensaje "invalid_grant"/"Invalid user credentials" que
    // SAP devuelve envuelto en un 500 genérico, como se vio en este QA) -- reintentar no ayuda:
    // la contraseña sigue siendo la misma en el siguiente intento. Fallar rápido, sin backoff,
    // para no multiplicar por 3 cada cron mientras las credenciales estén rotas.
    const isCredentialError = error.response?.status === 401
      || /invalid_grant|invalid user credentials/i.test(JSON.stringify(error.response?.data || ''));
    if (isCredentialError) {
      this.logger.error('Credenciales de SAP invalidas -- no se reintenta login', {
        error: error.message, responseData: error.response?.data
      });
      break; // sale del for sin más intentos ni espera
    }

    // Error de RED transitorio (ECONNREFUSED/ETIMEDOUT/ENOTFOUND/ECONNRESET/5xx que no sea de
    // credenciales) -- aquí sí tiene sentido reintentar con backoff, como hoy.
    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
throw new Error(`Error de autenticación con SAP B1: ${lastError?.message}`);
```

Efecto: con credenciales rotadas, cada cron dispara **1** login fallido en vez de 3 — reduce el
volumen a un tercio, pero no lo elimina (7+ disparadores automáticos al día seguirían
intentando login una vez cada uno). Una mejora adicional (más grande, no incluida en esta
propuesta) sería un circuit breaker compartido entre las 5 instancias de servicio (ej. un flag
en memoria o en `admin_settings` con un cooldown de N minutos tras detectar un error de
credenciales) para no intentar login en absoluto durante ese cooldown — requeriría diseño
aparte y aprobación explícita.
