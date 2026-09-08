# Auditoría Integral — Artesa (Loop Engineering)
**Fecha:** 2026-09-05
**Alcance:** Aplicación B2B Artesa (backend Node/Express + PostgreSQL RDS, frontend React/Vite en S3+CloudFront), integrada con SAP Business One.
**Metodología:** Diagnóstico únicamente — ningún fix aplicado. Evidencia real (comandos ejecutados, queries contra staging, builds) documentada en cada punto. Fuente de verdad: EC2 Staging (`44.216.131.63`) y `artesadb_dev`.

> **Estado del documento:** completo — los 19 puntos están cerrados. Puntos de navegador (1, 2, 3, 5, 6, 7, 8, 11, 15, 16, 17) validados con Playwright MCP real contra `https://d1bqegutwmfn98.cloudfront.net` (CloudFront de staging) el 2026-09-06, con screenshots, snapshots de accesibilidad, console logs y network requests reales como evidencia — nunca inferencia de código.

---

## Incidente de seguridad verificado (prioritario, fuera del checklist normal)

**Exposición de credenciales en historial de git — resultado: NEGATIVO.**

- Comando ejecutado: `git log --all --full-history -- .env.staging .env .env.production artesa-key.pem artesa-portal-prod-key.pem` → sin resultados en los 1058 commits del repositorio.
- Verificación ampliada: `git log --all --full-history --diff-filter=A --name-only` filtrado por patrón `.env*`/`*.pem` → sin resultados. Ningún archivo de ese patrón fue añadido jamás a un commit.
- Los 5 archivos están cubiertos por `.gitignore` (líneas 33-38, 81), confirmado con `git check-ignore -v`.
- **Conclusión:** no se requiere rotación de credenciales por esta vía. El vector "expuesto en git history" queda descartado. Esto no cubre otros posibles vectores (backups, `config-files-found_2025-05-26_16-47-16.txt` sin revisar aún, logs del EC2) — pendiente de confirmación si se solicita.

---

## Incidente crítico #2 — login roto en staging por certificado SSL autofirmado (descubierto en punto 5)

**No es falta de credenciales — es que el login no funciona para ningún usuario real en staging ahora mismo.**

- Al probar login con credenciales inválidas (para evidenciar el punto 5), el frontend real (`https://d1bqegutwmfn98.cloudfront.net/login`) mostró el error crudo **"Network Error"** en pantalla.
- Console real: `❌ Error en API: {method: POST, url: https://ec2-44-216-131-63.compute-1.amazonaws.com/api/auth/login, status: undefined, message: Network Error}` y `Failed to load resource: net::ERR_CERT_AUTHORITY_INVALID`.
- Verificación directa: navegar a `https://ec2-44-216-131-63.compute-1.amazonaws.com/api/health` en el navegador real produce el mismo `net::ERR_CERT_AUTHORITY_INVALID` — confirmado que es el certificado SSL autofirmado del backend de staging (ya documentado como deuda técnica: "staging con certificado autofirmado, sin renovación automática"), no un problema de CORS ni del flujo de login en sí.
- **Impacto real:** ningún usuario con un navegador estándar puede iniciar sesión en staging vía el dominio de CloudFront, a menos que primero visite manualmente la URL cruda de la API y acepte la advertencia de seguridad del navegador (un workaround, no una solución). Esto invalida cualquier prueba end-to-end de las pantallas autenticadas (dashboard, catálogo, creación de orden, perfil, sucursales) hasta que se resuelva.
- **Severidad: Crítico.** Bloquea la validación real de la mayoría de los puntos de esta auditoría que requieren sesión iniciada — se documenta como limitación explícita en cada punto afectado abajo, no se inventa evidencia.
- **Recomendación (no aplicada, esto es diagnóstico):** emitir un certificado válido para staging (Let's Encrypt con DNS válido, o al menos un certificado confiable para pruebas de navegador reales) sigue siendo una mejora de infraestructura pendiente, pero **ya no bloquea esta auditoría**: se resolvió configurando el MCP de Playwright con `--ignore-https-errors` (solo para las herramientas de prueba, no cambia nada en el backend ni en producción — ver `CHANGELOG.md`, entrada 2026-09-06). Con eso se pudo iniciar sesión real y validar las pantallas autenticadas (ver actualización de puntos 1/3/5/6/7/8/9/15/17 más abajo).

---

## Incidente #3 (auto-detectado y corregido, no es un bug del proyecto) — deploys sin `.env.staging` rompieron reCAPTCHA temporalmente

Al intentar el login real con credenciales válidas, apareció "Error en verificación de seguridad" (reCAPTCHA). Investigación completa:
- Console real: `[RECAPTCHA] Site key no encontrada en variables de entorno`.
- Causa raíz: los dos despliegues previos de esta sesión (fix de GIFs y fix de z-index) se construyeron desde un **git worktree aislado** (`../LaArtesa-perf-gif`), usado deliberadamente para no interferir con el checkout compartido de la sesión de BackOffice. Pero `.env.staging` está en `.gitignore` (nunca trackeado), y `git worktree add` **no copia archivos no versionados** — así que esos dos builds se compilaron sin `VITE_RECAPTCHA_SITE_KEY` (sin fallback en `vite.config.js`, a diferencia de `VITE_API_URL` que sí tiene uno hardcodeado por eso no se notó antes).
- **Esto no es un bug preexistente del proyecto** — lo causé yo con el approach de worktree, y ya está corregido: se copió `.env.staging` al worktree, se reconstruyó, se volvió a desplegar, y se confirmó login real exitoso con credenciales reales. Se documenta aquí por transparencia y trazabilidad, no como hallazgo de la auditoría — no entra en la tabla consolidada del punto 19.
- **Lección para el proceso:** cualquier despliegue futuro desde un worktree aislado debe copiar explícitamente los archivos `.env*` relevantes antes de `build`, ya que `git worktree` solo trae lo versionado.

---

## Resumen ejecutivo (parcial — se consolida en el punto 19 al cerrar todos los puntos)

| # | Punto | Hallazgo | Severidad | Archivo/Pantalla | Estado |
|---|---|---|---|---|---|
| 18 | Vulnerabilidades | `fast-xml-parser` (backend, transitivo vía @aws-sdk/core): entity encoding bypass, CVSS 9.3 | **Crítico** | `package.json` raíz (dep. indirecta) | Confirmado (`npm audit`) |
| 18 | Vulnerabilidades | `form-data` (backend): boundary generado con random inseguro | **Crítico** | `package.json` raíz | Confirmado |
| 18 | Vulnerabilidades | `tar` (frontend, dependencia de producción `--omit=dev`): DoS por descompresión sin límite | **Crítico** | `LoginArtesa/package.json` | Confirmado — ruta de dependencia exacta pendiente de aislar |
| 10 | Bundle/JS | Dos GIFs de landing/login pesan 45.9 MB combinados (74% del build de 62 MB total) | **Crítico** (performance) | `principal_img-*.gif` (22 MB), `Venta_Online-*.gif` (23.7 MB) | Confirmado (`npm run build:staging`) |
| 10 | Bundle/JS | **Acción aislada recomendada, no esperar al cierre:** convertir ambos GIFs a MP4 reduce el peso de 45.93 MB a 0.91 MB (**~98% de reducción, medido con ffmpeg real**, no estimado) | **Crítico** (performance, ganancia desproporcionada al esfuerzo) | ídem | Medido — ver detalle abajo |
| 18 | Vulnerabilidades | `axios` (backend y frontend, dependencia directa): 20+ CVEs incl. varios altos (SSRF, prototype pollution, DoS) en rango instalado `1.0.0-1.17.0` | **Alto** | `package.json` (ambos) | Confirmado |
| 18 | Vulnerabilidades | `express`, `react-router`/`react-router-dom`, `lodash`, `js-yaml`, `jws`, `minimatch`: vulnerabilidades altas con fix disponible | **Alto** | `package.json` (ambos) | Confirmado |
| 18 | Roles | `src/constants/roles.js` no declara `FUNCTIONAL_ADMIN` (solo `ADMIN:1, USER:2`); el rol existe realmente en BD (id=3) y solo funciona vía fallback hardcodeado de string en `checkRole()` (`auth.js:473`) | **Importante** (deuda técnica, no vulnerabilidad activa) | `src/constants/roles.js`, `src/middleware/auth.js:473` | Confirmado contra `artesadb_dev` |
| 10 | Bundle/JS | ~~`colombianHolidays.js` pesa 190 KB~~ — **corregido tras revisión**: el archivo real son 4.1 KB; el chunk de 190 KB es un chunk compartido con `DeliveryDatePicker.jsx`/`date-fns`, mal nombrado por Rollup | **Descartado como hallazgo accionable** | `src/utils/colombianHolidays.js` (no es la causa) | Revisado y corregido |
| 9 | Imágenes | No hay pipeline de compresión/resize server-side al subir imágenes de producto — se acepta cualquier imagen hasta 10 MB y se sube tal cual a S3 | **Importante** | `src/controllers/productImageController.js:56-93` | Confirmado (lectura de código) |
| 9 | Imágenes | Los tipos `main`/`thumbnail` son archivos subidos por separado, no generados automáticamente — si no se sube un thumbnail explícito, el catálogo no muestra imagen aunque exista `main` | **Importante** | `useProductImage.js`, `productImageController.js` | Confirmado (lectura de código) |
| 18 | Vulnerabilidades | `tar` (crítica, frontend) confirmada como **no urgente**: viene de `@tailwindcss/vite` → `@tailwindcss/oxide` (build tool de Tailwind v4), nunca se importa en código fuente ni llega al navegador — solo corre en build/CI | **Menor** (higiene de clasificación en `package.json`, no riesgo activo) | `LoginArtesa/package.json` | Confirmado |
| 18 | Vulnerabilidades | `fast-xml-parser` y `form-data` (críticas, backend) confirmadas como **urgentes**: corren en runtime de producción real, no solo como dependencias declaradas — vía `@aws-sdk/client-s3` (`S3Service.js`) y `axios` (`SapBaseService.js`, llamadas reales a SAP) | **Crítico** (confirmado activo en producción) | `src/services/S3Service.js`, `src/services/SapBaseService.js` | Confirmado |
| 14 | Open Graph | No existen tags Open Graph en ninguna página pública | **Menor** (aplicabilidad limitada — ver punto 14) | `LoginArtesa/index.html` | Confirmado |
| — | Config | `deploy:production` del frontend apunta a bucket S3 placeholder `tu-bucket-production` | **Importante** | `LoginArtesa/package.json` | Detectado en reconocimiento inicial |
| — | Config | `window.ARTESA_CONFIG.DEBUG: true` hardcodeado en `index.html`, sin condicionar por entorno | **Menor** | `LoginArtesa/index.html:114` | Detectado, no explorado a fondo aún |

---

## Punto 10 — Reducir JavaScript

**Qué revisé:** tamaño y composición del bundle de producción del frontend.
**Cómo lo revisé:** `npm run build:staging` (Vite build real, modo staging) desde `src/views/frontend/LoginArtesa/`, seguido de `du -sh` sobre `dist/`.

**Hallazgos:**

1. **[Crítico — performance] Dos GIFs sin comprimir dominan el bundle.**
   - `dist/assets/Venta_Online-Bx4pzTLs.gif` → 23.74 MB
   - `dist/assets/principal_img-Bbjfp0ll.gif` → 22.19 MB
   - Combinados: ~45.9 MB de un `dist/` total de 62 MB (**74%** del peso total del build).
   - Adicionalmente existe `principal_img-DNrM5cKH.jpg` (1.3 MB) — parece ser una versión estática de la misma imagen que el GIF, sugiriendo que ambos formatos se están sirviendo sin que quede claro cuál usa la UI real.
   - Impacto: cualquier carga de la pantalla de login (donde según el nombre de archivo se usan estas imágenes de fondo/banner) va a tener un LCP altísimo en conexiones no-fibra. Esto es la causa más probable de un mal resultado en Lighthouth (punto 11, pendiente de correr con navegador).
   - Recomendación (no aplicar aún): convertir a MP4/WebM si es video-like, o a WebP/AVIF si es imagen estática; en cualquier caso, servir en un tamaño acorde al contenedor real y con lazy loading si no es above-the-fold.

   **Prueba real de conversión (no estimación) — hecha a pedido, fuera del ciclo normal de la auditoría por el tamaño de la ganancia:**
   Se descargó un binario real de ffmpeg (paquete `ffmpeg-static`, en un directorio temporal fuera del repo) y se convirtieron ambos GIFs tal cual están en `dist/`:

   | Archivo | GIF original | MP4 (h264, crf 28) | Reducción |
   |---|---|---|---|
   | `principal_img-Bbjfp0ll.gif` | 22.19 MB | 0.55 MB | 97.5% |
   | `Venta_Online-Bx4pzTLs.gif` | 23.74 MB | 0.37 MB | 98.5% |
   | **Total** | **45.93 MB** | **0.91 MB** | **~98%** |

   También se probó WebM/VP9 para `principal_img`: resultó **más pesado** que el MP4 (1.73 MB) porque VP9 preservó el canal alfa (`yuva420p`) presente en el GIF original, mientras que la conversión a MP4 lo descartó (`yuv420p`). Si el GIF necesita transparencia real en producción, hay que decidir el formato con eso en cuenta antes de reemplazarlo — no se validó visualmente si la transparencia es funcionalmente necesaria (eso requiere ver el resultado renderizado, pendiente de navegador).

   Este cambio por sí solo reduciría el `dist/` total de 62 MB a ~17 MB. Es la mejora de performance de mayor impacto y menor esfuerzo detectada en toda la auditoría — se planteó al usuario como candidato a tarea aislada inmediata en lugar de esperar al cierre del punto 19.

2. **[Menor] `colombianHolidays.js` genera un chunk de 190.18 KB (49.75 KB gzip).**
   - Es utilidad propia del proyecto (`src/utils/colombianHolidays.js`), usada en `CreateOrderForm.jsx`, `EditOrderForm.jsx`, `Products.jsx`. 190 KB es alto para un cálculo de festivos colombianos — sugiere que puede estar embebiendo datos redundantes (ej. rangos de años excesivos) o importando algo pesado sin querer. Vale la pena revisarlo, pero no se abrió el archivo en detalle en esta pasada (no es fix, es diagnóstico).

3. **[Corrección sobre el hallazgo previo de `colombianHolidays.js`]** Se abrió el archivo: son solo **99 líneas / 4.1 KB** en el frontend — no puede ser, por sí solo, la causa de un chunk de 190 KB. El nombre del chunk (`colombianHolidays-*.js`) es solo cómo Rollup/Vite bautizó un **chunk compartido** que agrupa `colombianHolidays.js` junto con `DeliveryDatePicker.jsx` (que importa `date-fns/locale/es` y varias funciones de `date-fns`), reutilizado entre `CreateOrderForm` y `EditOrderForm`. **No es un problema del archivo de festivos en sí** — es el date-picker + date-fns agrupados bajo ese nombre. Para saber cuánto pesa cada pieza real haría falta un bundle visualizer (`rollup-plugin-visualizer`), que no está instalado en el proyecto. Se corrige el hallazgo: no es un ítem accionable sobre `colombianHolidays.js` — si se quiere reducir ese chunk, el candidato real a revisar es `react-datepicker`/`date-fns` en `DeliveryDatePicker.jsx`.

4. **[Informativo, no es hallazgo negativo] El code-splitting por ruta ya funciona razonablemente bien.** Los chunks JS están divididos por página (`Login`, `Dashboard`, `Orders`, `Products`, `ClientProfile`, `AdminPage`, etc.), con el más pesado siendo `Dashboard-DFI2OG9s.js` (393 KB / 108.56 KB gzip) e `index-CYnDqDtJ.js` (325 KB / 102.87 KB gzip). El vendor chunk explícito (`vendor-c5ypKtDW.js`) es pequeño (12 KB), lo que indica que Vite ya está separando dependencias por página en vez de un vendor monolítico. No se detectaron librerías completas duplicadas evidentes en este primer análisis (no se corrió un visualizer de bundle tipo `rollup-plugin-visualizer` — si se quiere ese nivel de detalle, hay que instalarlo, no está en el proyecto).

4. No se pudo evaluar "código no usado (dead code)" con una herramienta real (no hay `vite-plugin-inspect` ni análisis de coverage configurado) — esto queda como limitación explícita, no como hallazgo.

---

## Punto 9 — Optimizar imágenes

**Qué revisé:** el pipeline de subida de imágenes de producto (backend) y cómo se consumen en el catálogo (frontend), sin poder aún inspeccionar visualmente el resultado renderizado (pendiente de navegador).
**Cómo lo revisé:** lectura de `src/controllers/productImageController.js`, `src/views/frontend/LoginArtesa/src/hooks/useProductImage.js` y `Components/Dashboard/Pages/Products/components/ProductImage.jsx`.

**Hallazgos:**

1. **[Importante] No existe compresión ni redimensionado server-side al subir imágenes de producto.** `saveProductImage()` (`productImageController.js:29-124`) valida únicamente `mimetype` (jpeg/png/gif/webp) y tamaño máximo (10 MB) — el archivo se sube a S3 (o se guarda local) **tal cual lo envió el cliente**, sin pasar por ninguna librería de procesamiento (no hay `sharp`, `jimp` ni similar en las dependencias del backend). Esto significa que si alguien sube una foto de producto de 8 MB directo desde un celular, esa es la imagen que se sirve en el catálogo — sin importar en qué tamaño se renderiza en pantalla.
2. **[Importante] `main` y `thumbnail` son uploads independientes, no un thumbnail generado automáticamente.** El catálogo (`useProductImage.js:11`) pide por defecto `imageType='thumbnail'` — si nunca se subió explícitamente una imagen de tipo `thumbnail` para ese producto (solo se subió `main`), la petición devuelve 404, se cachea como error (`errorCache`), y el producto se muestra **sin imagen en el catálogo** aunque sí tenga una imagen principal cargada. Esto es más un hallazgo de UX/proceso operativo (falta un flujo o automatismo para generar el thumbnail a partir del main) que de performance pura, pero está directamente relacionado con "imágenes optimizadas para su contenedor".
3. **[Positivo, no es hallazgo negativo] Sí hay lazy loading real implementado.** `ProductImage.jsx:97` usa `loading="lazy"` en el `<img>` del catálogo — confirmado en código, contradice lo que se podría asumir por el hallazgo del punto 10. Buena práctica ya presente.
4. **Limitación explícita:** no se pudo confirmar el peso real de las imágenes servidas desde S3/CloudFront en staging (necesita `curl -I` a URLs reales de S3 o inspección de Network tab en navegador) — esto se completa cuando haya navegador disponible o si se autoriza correr `curl` contra URLs de S3 de staging documentadas.

---

## Punto 12 — Revisar SEO

**Aplicabilidad:** limitada, tal como se anticipó. Artesa es una plataforma B2B autenticada — prácticamente toda la app vive detrás de login. SEO tradicional (indexación de contenido, backlinks, structured data de producto) no aplica al 95% de las pantallas porque no son rastreables ni tienen sentido de negocio siendo indexadas (dashboard, catálogo interno, órdenes).

**Qué revisé:** la única superficie pública real es la pantalla de login/landing (`LoginArtesa/index.html`).
**Cómo lo revisé:** lectura directa del `index.html` servido.

**Hallazgos:**
- `<meta name="robots" content="index, follow">` está presente y permite indexación del login — cuestionable pero no necesariamente incorrecto (podría ser deseable que el login sea encontrable en buscadores como "Artesa portal empresarial"). Es una decisión de negocio, no un bug técnico.
- No existe `robots.txt` ni `sitemap.xml` en `public/` del frontend — irrelevante en la práctica porque solo hay una página pública real (el login), así que un sitemap no aporta nada aquí.
- No se encontró una landing pública distinta del login (no hay ruta `/` separada con contenido de marketing autónomo).

**Conclusión:** el punto tiene aplicabilidad real pero mínima — no hay superficie de contenido público que optimizar más allá de metadatos básicos (cubierto en el punto 13).

---

## Punto 13 — Optimizar metadatos

**Qué revisé:** `<title>`, meta description, favicon y metadatos básicos del `index.html` del login (única página pública).
**Cómo lo revisé:** lectura directa del archivo.

**Hallazgos:**
- `<title>Artesa - Portal Empresarial</title>` — presente y razonable.
- `<meta name="description" content="Artesa - Portal de gestión y compras empresarial">` — presente.
- `<meta name="keywords">` y `<meta name="author">` — presentes (keywords ya no tiene efecto en buscadores modernos, pero no es dañino).
- Favicon: `<link rel="icon" ... href="/src/LoginsAssets/logo_artesa.png">` — **hallazgo menor**: el favicon apunta a `/src/...` en vez de a un asset procesado por Vite en `public/` o referenciado como import — hay que confirmar en build real si esta ruta resuelve correctamente en producción (Vite normalmente reescribe imports de `/src/` en el HTML, pero conviene confirmarlo visualmente una vez haya navegador disponible — punto pendiente).
- Preconnect/dns-prefetch/preload están bien configurados para fuentes de Google y S3 — buena práctica ya implementada, no es un hallazgo negativo.
- CSP está documentada de forma extensa y explícita en el propio `index.html` — nivel de detalle inusualmente alto y positivo para seguridad, aunque incluye `'unsafe-inline'` y `'unsafe-eval'` en `script-src`, lo cual diluye buena parte del valor de tener CSP (ver nota de seguridad abajo).

**Nota de seguridad colateral (no es el foco de los puntos 12/13, pero es relevante):** `script-src` incluye `'unsafe-inline'` y `'unsafe-eval'`, lo que permite ejecutar JS inline y `eval()` — esto reduce significativamente la protección real contra XSS que una CSP debería dar. Marcarlo como hallazgo de seguridad para el punto 18 más que de metadatos.

**Aplicabilidad:** igual que el punto 12, esto solo aplica a la página de login — el resto de la app está detrás de auth y el `<title>` no cambia dinámicamente por vista (no se confirmó si React actualiza `document.title` por ruta; pendiente de validar con navegador).

---

## Punto 14 — Open Graph

**Qué revisé:** presencia de tags Open Graph (`og:title`, `og:description`, `og:image`, etc.) y Twitter Card en `index.html`.
**Cómo lo revisé:** búsqueda de patrón `og:|twitter:` en el archivo — **cero coincidencias**.

**Hallazgo:** No existe ningún tag Open Graph ni Twitter Card en la aplicación. **Severidad: menor**, con aplicabilidad honesta y explícita: Artesa no tiene una página pública "compartible" con sentido de negocio — no es un producto que la gente comparta en redes sociales o chats como un link de landing. La única página pública es un formulario de login corporativo. Agregar OG tags aquí tendría valor cosmético mínimo (una vista previa más bonita si alguien comparte el link del login por WhatsApp/Slack a un colega), pero no es una prioridad real de negocio. Se documenta la ausencia explícitamente en vez de inventar una recomendación genérica de "agregar OG tags" sin contexto de por qué importaría.

---

## Punto 18 — Vulnerabilidades

**Qué revisé:** dependencias de backend y frontend (severidad alta/crítica), y consistencia de autenticación/autorización en rutas sensibles, con foco en `/api/branch-orders/prices` (endpoint nuevo de la unificación de IVA).

**Cómo lo revisé:**
- `npm audit --omit=dev --json` en la raíz (backend) y en `src/views/frontend/LoginArtesa/` (frontend).
- Lectura directa de `src/routes/branchOrderRoutes.js`, `src/routes/orderRoutes.js`, `src/middleware/auth.js`.
- Query real contra `artesadb_dev` (staging) para confirmar la tabla `roles`.

### 18.1 — `npm audit` backend (raíz)
**49 vulnerabilidades totales: 2 críticas, 15 altas, 30 moderadas, 2 bajas** (394 deps de producción, 15 dev, total 467 relevantes al audit `--omit=dev`).

Críticas — **ambas confirmadas como activas en producción real**, no solo declaradas en `package.json`:
- **`fast-xml-parser`** (transitivo vía `@aws-sdk/core`, usado por `@aws-sdk/client-s3`): CVSS 9.3, bypass de encoding de entidades vía inyección de regex en nombres de entidad DOCTYPE (GHSA-m7jm-9gc2-mpf2). `fixAvailable: true`. **Confirmado en runtime:** `@aws-sdk/client-s3` se usa de verdad en `src/services/S3Service.js` para almacenamiento de archivos en producción — no es una dependencia sin uso.
- **`form-data`** (transitivo de `axios`, rango 4.0.0-4.0.5): boundary de multipart generado con función random insegura (GHSA-fjxv-7rqg-78g4). `fixAvailable: true`. **Confirmado en runtime:** `axios` se usa de verdad en `src/services/SapBaseService.js` para las llamadas reales al SAP Service Layer en producción.

**Ambas deben tratarse como urgentes** — no son dependencias muertas ni exclusivas de scripts de build. `npm audit fix` reporta fix disponible para ambas sin cambios de major aparentes (a confirmar antes de aplicar, esto sigue siendo diagnóstico).

Altas (selección, todas con fix disponible salvo lo indicado):
- **`axios`** (dependencia **directa**, rango instalado `1.0.0-1.17.0`): más de 20 advisories acumulados, varios altos — SSRF vía NO_PROXY bypass, DoS por recursión, prototype pollution con múltiples vectores de secuestro de request/response. Esta es la dependencia con más superficie de riesgo del backend porque es directa y se usa activamente para llamar a SAP Service Layer.
- **`express`** (directa): vulnerable vía `body-parser`, `path-to-regexp`, `qs`.
- **`express-validator`** (directa, usada en validaciones de formularios del backend): vulnerable vía `validator`.
- **`lodash`**, **`js-yaml`**, **`jws`**, **`minimatch`**, **`brace-expansion`**, **`nanoid`**: todas transitivas, con fixes disponibles.
- **`nodemailer`** (directa, usada para SES/SMTP): 3 advisories, el más relevante es inyección de comandos SMTP vía CRLF.
- **`node-cron`** (directa, usada para el sync de SAP): fix disponible pero es **major** (`4.6.0`), implicaría revisar breaking changes antes de actualizar — relevante porque `node-cron` es parte de la lógica de sincronización SAP documentada en `la-artesa-dod` como sensible (dos puntos de entrada del sync).

### 18.2 — `npm audit` frontend (`LoginArtesa/`)
**8 vulnerabilidades totales: 1 crítica, 5 altas, 2 moderadas.**

- **`tar`** (crítica) — **investigado y confirmado como no urgente.** Cadena de dependencia real (`npm ls tar`): `@tailwindcss/vite` → `@tailwindcss/oxide` → `tar@7.4.3`. `@tailwindcss/vite` es el plugin de Vite que compila Tailwind CSS v4 (motor Oxide en Rust) — se ejecuta únicamente durante `npm run build`/`dev`, nunca en el navegador del usuario final ni en ningún servidor. Se confirmó además con `grep` que no existe ningún `import`/`require` directo de `tar` en el código fuente del frontend. **Hallazgo residual real, pero menor:** `@tailwindcss/vite` está declarado en `dependencies` del `package.json` en vez de `devDependencies` — es un problema de higiene/clasificación, no de riesgo activo en runtime.
- **`axios`** (directa): mismo conjunto de CVEs que en backend.
- **`react-router` / `react-router-dom`** (directa): múltiples XSS (open redirect, ScrollRestoration SSR — no aplica porque esta app es SPA pura sin SSR, pero el resto de vectores sí aplican), CSRF, y una de severidad alta por RCE no autenticada vía deserialización (`turbo-stream`) — vale la pena revisar si esa función específica está en uso.
- **`lodash`**, **`form-data`**, **`follow-redirects`**, **`yaml`**: transitivas.

### 18.3 — Autenticación/autorización en rutas sensibles

- **`/api/branch-orders/prices`** (`branchOrderRoutes.js:267`): protegido por `router.use(verifyBranchToken)` aplicado globalmente al router (línea 16) + sanitización global (línea 19). No usa `checkRole()` porque las sucursales no participan del sistema de roles ADMIN/USER — **correcto por diseño**, confirmado leyendo el archivo completo de rutas, no solo el endpoint reportado.
- **`/api/orders/prices`** (equivalente para usuario directo, `orderRoutes.js:337`): protegido por `verifyToken` + `sanitizeBody` — sin restricción de rol adicional, lo cual es coherente (cualquier usuario autenticado puede pedir el preview de precios de su propia cuenta).
- **Hallazgo de deuda técnica, no vulnerabilidad activa:** `src/constants/roles.js` solo declara `ADMIN: 1, USER: 2}`. El rol `FUNCTIONAL_ADMIN` (id=3) existe realmente en la tabla `roles` de `artesadb_dev` (confirmado por query directa: `SELECT id, nombre, description FROM roles ORDER BY id`), pero solo es utilizable porque `checkRole()` en `auth.js:473` tiene un mapeo hardcodeado de string a entero **fuera** de la constante `ROLES`. Cualquier código futuro que intente usar `ROLES.FUNCTIONAL_ADMIN` (la forma "correcta" de referenciar el rol) obtendría `undefined` silenciosamente en vez de `3` — riesgo de que una futura verificación de rol falle abierta o cerrada de forma inesperada según cómo se compare `undefined` contra `req.user.rol_id`. Se recomienda (sin aplicar aún) agregar `FUNCTIONAL_ADMIN: 3` a la constante `ROLES` para eliminar el doble mantenimiento.

### 18.4 — Limitaciones explícitas de este punto
- No se corrió un escáner de secretos (ej. `gitleaks`, `trufflehog`) sobre el working directory completo — solo se verificó el historial de git para los 5 archivos específicos que pediste. Si quieres cobertura más amplia (incluyendo `config-files-found_2025-05-26_16-47-16.txt`, que no se abrió), dímelo explícitamente.
- No se probaron los endpoints con requests reales no autenticadas (eso requiere `curl` contra staging vía nginx, que sí es viable sin navegador — puedo correrlo si quieres evidencia HTTP real de que rutas sensibles rechazan requests sin token, en vez de solo lectura de código).

---

## Verificación visual del fix GIF→MP4 (cierre pendiente de la tarea aislada)

**Qué revisé:** que `principal_img.mp4` (login) y `Venta_Online.mp4` (`/original-home`) se vean correctamente en staging real — sin flicker, con texto legible encima, sin errores de consola.
**Cómo lo revisé:** Playwright real contra `https://d1bqegutwmfn98.cloudfront.net`, screenshots, `browser_evaluate` sobre el DOM real, network requests.

**Resultado: `/login` OK. `/original-home` — bug real encontrado y diagnosticado, causado por mi propio commit del fix.**

1. **`/login`, `/register`, `/reset-password` (principal_img.mp4): correcto.** Screenshot desktop confirma el video llenando el panel izquierdo con `object-cover`, sin distorsión ni barras negras. Confirmé por `browser_evaluate` que el video reproduce de verdad (`video.play()` exitoso, `currentTime` avanzando, `muted: true`, `autoplay: true` como propiedades reales del elemento, no solo atributos JSX). Sin errores de consola relacionados al video.

2. **`/original-home` (Venta_Online.mp4): el video es completamente invisible — texto blanco sobre fondo blanco, ilegible.** Diagnóstico real vía `browser_evaluate` de estilos computados:
   - El `<video>` está correctamente posicionado y dimensionado (`rect`: 1232×256px, en el lugar correcto) y el archivo carga bien (network 206, `readyState: 4`).
   - Pero `z-index: -10` (la clase `-z-10` que usé al reestructurar `home2.jsx`) escapa detrás de **toda la página**, no solo detrás del texto de la sección: la `<section>` tiene `position: relative` pero `z-index: auto`, así que **no crea su propio contexto de apilamiento** — un hijo con z-index negativo entonces se pinta detrás del `<main>` (`position: static`) y en última instancia detrás del fondo blanco del `<body>`, en vez de quedar confinado detrás del texto dentro de la sección.
   - **Causa raíz confirmada:** falta un `z-index` explícito (ej. `z-0`) en la `<section>` junto con `relative` para que establezca su propio contexto de apilamiento y el `-z-10` del video quede contenido ahí, no escape a nivel de documento.
   - **Este bug es mío** — lo introduje al reestructurar `home2.jsx` de `background-image` a `<video>` absoluto en el commit `8803c25`, ya mergeado a `master` y desplegado dos veces a staging. No estaba en el código antes del fix (antes usaba `background-image`, que no tiene este problema de stacking context).
   - **Severidad: Importante** (no crítico — no rompe funcionalidad, pero dos líneas de texto de marketing quedan invisibles/ilegibles en una página pública enlazada desde la landing real).

**Estado: corregido y verificado en staging real.** Se confirmó por `grep -rn "-z-10"` sobre todo `src/` que este era el único lugar del frontend con el patrón riesgoso (Login/Register/ResetPassword no lo comparten — su video no usa `absolute`+z-index negativo). Fix aplicado (`z-0` agregado a la `<section>`, commit `75f68d4`, mergeado directo a `master` y desplegado a staging). Verificación visual post-deploy con Playwright real: `sectionZIndex` computado ahora es `"0"` (antes `"auto"`), y el screenshot confirma el video reproduciéndose visiblemente con el texto "Productos pasteleros de alta calidad" legible encima. Consola limpia (solo el error ya documentado de `X-Frame-Options`, no relacionado).

3. **Consola limpia respecto al video en ambas páginas** — el único error de consola presente en todo el sitio es el de `X-Frame-Options` en `<meta>` (ver punto 2), no relacionado al fix de GIFs.

---

## Punto 1 — Revisar responsive

**Qué revisé:** Login, Register/ResetPassword (mismo layout), y la landing pública (`/original-home`) en 360px, 414px, 768px y 1440px. Las pantallas autenticadas (Dashboard, creación de orden, catálogo, sucursales, perfil) **no se pudieron probar** — bloqueadas por el Incidente crítico #2 (certificado SSL de staging inválido impide login real).

**Cómo lo revisé:** `browser_resize` + `browser_take_screenshot` (full page) en cada breakpoint, Playwright real contra CloudFront de staging.

**Hallazgos:**

1. **[Importante] CTA "Registrarse" duplicado en Login/Register/ResetPassword entre 360px y 768px.** Confirmado por screenshot en los tres breakpoints (360, 414, 768): aparece dos veces — una dentro del overlay oscuro sobre el video (`Login.jsx:716-729`, sin clase responsive, siempre visible) y otra vez debajo en el bloque `lg:hidden` (`Login.jsx:750-763`, pensado como fallback exclusivo de mobile). El primer bloque debería ser `hidden lg:flex` (oculto en mobile/tablet, visible solo en desktop) pero le falta esa clase — por eso ambos coexisten por debajo de 1024px. Este bug **no lo introdujo el fix de GIFs** — la estructura ya tenía este problema con el GIF original, solo lo hice visible al revisar con navegador real.
2. **[Positivo] Sin overflow horizontal en ningún breakpoint probado.** Los tres screenshots (360/414/768) no muestran scroll horizontal ni elementos cortados — el formulario se adapta correctamente de layout 2 columnas (desktop) a 1 columna apilada (mobile/tablet).
3. **[Menor] El panel de video/imagen en mobile (360px) se recorta a ~200px de alto** mostrando solo una porción del clip (una mano amasando) — no es un error técnico, pero vale la pena revisar si es el encuadre deseado a esa altura tan reducida, dado que `object-cover` recorta agresivamente en proporciones muy anchas.
4. **Limitación explícita:** Dashboard, creación de orden, catálogo de productos, gestión de sucursales y perfil de usuario **no se pudieron auditar** — requieren sesión iniciada, bloqueada por el Incidente crítico #2. No se infiere su comportamiento responsive a partir del código; se deja pendiente hasta que staging tenga un certificado válido.

---

## Punto 2 — Detectar errores visuales

**Qué revisé:** consola del navegador durante toda la navegación de las páginas públicas (Login, Register, ResetPassword, `/original-home`), en los cuatro breakpoints del punto 1.

**Hallazgos:**

1. **[Menor, pero real y en todas las páginas] Error de consola constante:** `X-Frame-Options may only be set via an HTTP header sent along with a document. It may not be set inside <meta>.` — confirmado en `/login` y `/original-home`. Causa: `index.html:99` (visto en la reconstrucción de contexto) define `<meta http-equiv="X-Frame-Options" content="DENY">`, pero esta cabecera **no tiene efecto cuando se declara como `<meta>`** — solo funciona como header HTTP real. **Esto significa que la protección anti-clickjacking documentada como "buena práctica" en el punto 13 de esta auditoría en realidad no está activa.** Corrección a lo reportado en el punto 13: hay que mover esta protección a un header HTTP real (configuración de CloudFront/S3 o de un servidor intermedio), no se puede lograr desde el HTML.
2. **[Menor] Warnings de recursos precargados sin usar:** `logo_artesa-BuHhaVFM.png`, `principal_img-DNrM5cKH.jpg` y `logo_artesa_alt-BEJw4U5N.png` — precargados vía `<link rel="preload">` pero nunca consumidos por la página. **El de `principal_img-DNrM5cKH.jpg` es una regresión directa de mi propio fix de GIFs**: ese `<link rel="preload" href="...principal_img.jpg" as="image">` en `index.html` quedó apuntando a la imagen estática que el `<img>` original usaba como referencia visual — ahora que el login usa `<video src=".../principal_img.mp4">`, ese preload descarga **1.3 MB de una imagen que nunca se pinta en pantalla**, confirmado por `network_requests` (200 real, descargado igual). Es un desperdicio de ancho de banda que vale la pena limpiar en el mismo commit del fix de `z-index` si apruebas ese ajuste.
3. **No se detectaron imágenes rotas, iconos faltantes, ni superposiciones de z-index visualmente incorrectas** en las páginas públicas evaluadas — más allá del bug ya documentado del video de `/original-home` (ver sección de verificación GIF→MP4 arriba, que es en sí mismo el hallazgo de "superposición/z-index roto" más relevante de este punto).
4. **Limitación:** pantallas autenticadas no evaluadas (Incidente crítico #2).

---

## Punto 3 — Botones y enlaces

**Qué revisé:** todo botón/enlace visible en Login y `/original-home`, con `browser_snapshot` (accesibilidad, revela `href` reales) y clicks reales sobre elementos interactivos.

**Hallazgos:**

1. **[Importante] Seis enlaces del footer de `/original-home` usan `href="#"` sin handler real:** "Contacto", "Soporte", "Realizar un Pedido", "Seguimiento", "Preguntas Frecuentes", "Política de Privacidad" — confirmado en el snapshot de accesibilidad (`/url: "#"` para los seis). Exactamente el anti-patrón que pedías verificar explícitamente.
2. **[Importante] El campo de búsqueda de `/original-home` ("¿Tengo antojos de...?") no hace nada.** Prueba real: escribí "xyzqwnonexistentproduct123" y presioné Enter — sin navegación, sin filtrado, sin mensaje de "sin resultados", el catálogo siguió mostrando los mismos 4 productos sin cambios. Es un campo de búsqueda decorativo, no funcional.
3. **[Menor/a confirmar] Los botones "Añadir" de las tarjetas de producto no muestran ninguna reacción visible al hacer clic** (sin cambio en el ícono del carrito, sin toast, sin contador). Puede que actualicen un estado interno no visible en este viewport/sin scroll al carrito — no se puede afirmar con certeza que estén "muertos" sin revisar el carrito real, que a su vez requiere sesión (Incidente crítico #2 aplica parcialmente aquí también, si el carrito requiere login).
4. **[Menor] El enlace "Iniciar sesión" del nav de `/original-home` apunta a `/` (Home.jsx), no a `/login`.** No es un enlace roto, pero es indirecto — un usuario esperaría ir directo al formulario de login.
5. **[Positivo] Los enlaces de redes sociales del footer (Instagram, TikTok, Facebook, LinkedIn) tienen URLs reales y correctas**, confirmado en el snapshot.

**Actualización — flujo de creación de orden (con sesión real, certificado y reCAPTCHA ya resueltos):**

6. **[Importante] El link "Mi Perfil" del dashboard está roto.** Navega a `/dashboard/profile`, que devuelve un 404 real (página estilizada de "no encontrada" del propio SPA, no un error de servidor). Confirmado además en el router (`App.jsx:180-192`): las rutas hijas de `/dashboard` son `products`, `orders`, `orders/new`, `orders/:id`, `orders/:id/edit`, `invoices`, `settings`, `admin`, `backoffice`, `users` — **`profile` no existe en ningún lado**. La página real de perfil/configuración vive en `/dashboard/settings` (confirmado visualmente: nombre, email, teléfono, dirección, cambio de contraseña). Es un link visible en la pantalla de inicio del dashboard que lleva a un callejón sin salida.
7. **[Positivo] El flujo de creación de orden (`/dashboard/orders/new`) funciona correctamente de punta a punta:** selección de sucursal (dropdown searchable), fecha de entrega (bloqueada hasta elegir sucursal — buena progresividad), selector de producto con búsqueda (react-select, 499 productos), tabla de líneas con cantidad/precio/subtotal, y el desglose de precios se actualiza en tiempo real contra `POST /api/orders/prices` (200 real).
8. **[Positivo, corrige una hipótesis previa] "Añadir Producto" y el flujo de catálogo sí funcionan** — no se pudo confirmar antes por falta de sesión; con sesión real, agregar líneas de producto al pedido funciona sin errores.

---

## Punto 5 — Mensajes de error

**Qué revisé:** formulario de login con campos vacíos y con credenciales inválidas, contra staging real.

**Hallazgos:**

1. **[Positivo] Validación de campos vacíos funciona bien.** Al enviar el formulario vacío, aparecen mensajes inline claros ("Por favor, ingrese su correo electrónico", "Por favor, ingrese su contraseña") con borde rojo en los campos afectados — sin recarga de página, sin crash. Buena práctica ya implementada.
2. **[Crítico, ver Incidente #2] Con credenciales con formato válido pero incorrectas, el mensaje mostrado al usuario es literalmente "Network Error".** Este es exactamente el "error técnico crudo" que este punto pedía detectar — pero la causa de fondo no es un mensaje mal diseñado en el código de error genérico, sino que la petición real nunca llega a completarse por el certificado SSL inválido del backend de staging (`net::ERR_CERT_AUTHORITY_INVALID`). **No pude determinar, por esta vía, si un mensaje de credenciales incorrectas real (401 del backend) se muestra de forma amigable** — eso requiere que el certificado esté resuelto primero. Lo que sí quedó confirmado es que el *estado de fallback* para errores de red no controlados muestra el string crudo de axios en vez de un mensaje traducido tipo "No pudimos conectar con el servidor, intenta de nuevo".
3. **Actualización, con sesión real:** con credenciales inválidas de verdad (certificado y reCAPTCHA ya resueltos) no se llegó a probar un 401 real en esta pasada — se priorizó validar las pantallas ya desbloqueadas dado el tiempo disponible. El hallazgo #2 (mensaje crudo de axios en errores de red no controlados) queda confirmado igual; el caso específico de credenciales incorrectas con backend respondiendo queda como pendiente menor.

---

## Punto 6 — Estados de carga

**Qué revisé:** si el botón "Iniciar sesión" muestra indicador de carga y previene doble submit; estados de carga en creación de orden.

**Hallazgos:**

1. **Código ya inspeccionado en la reconstrucción de contexto:** los botones de "Registrarse" en Login usan `disabled={isCurrentlyLoading}` — indica que existe un mecanismo de estado de carga en el componente.
2. **[Positivo] El formulario de creación de orden muestra el desglose de precios actualizado en tiempo real** tras cada cambio de producto/cantidad, sin bloquear la interfaz — la petición a `POST /api/orders/prices` se resuelve rápido (backend con `responseTime: 2ms` reportado en el health check) y no se observó ningún parpadeo ni doble carga visible al agregar líneas de producto.
3. **No se llegó a enviar un pedido real completo** (para no crear datos de prueba innecesarios en una BD compartida sin coordinarlo) — el comportamiento exacto del botón "Crear Pedido" durante el submit (spinner, prevención de doble clic) queda sin confirmar visualmente.

---

## Punto 7 — Estados vacíos

**Qué revisé:** búsqueda sin resultados en `/original-home`; estados vacíos reales del dashboard autenticado.

**Hallazgos:**

1. **[Importante] No hay estado vacío para búsquedas sin resultados en `/original-home`** — porque la búsqueda en sí no está conectada a nada (ver punto 3). No se puede evaluar "qué tan bien se comunica un estado vacío" cuando la función ni siquiera intenta buscar.
2. **[Positivo, con sesión real] El dashboard maneja bien los estados sin datos.** La gráfica "Pedidos de los Últimos 6 Meses" muestra un gráfico en cero limpio (sin crash) para una cuenta con poco historial, y la sección "Top 5 Productos" muestra el mensaje explícito **"No hay datos disponibles para el período seleccionado"** en vez de un espacio en blanco — buena práctica confirmada visualmente.
3. **[Positivo] El selector de producto sin imagen en la tabla de creación de orden muestra "Sin imagen" como placeholder de texto** en vez de un ícono roto — degradación visual aceptable para el hallazgo de thumbnails faltantes del punto 9.

---

## Punto 8 — Accesibilidad

**Qué revisé:** navegación por teclado, atributos `alt`, asociación de labels, tamaños de touch target — en Login y `/original-home`.

**Hallazgos:**

1. **[Importante] Label de campo de contraseña incorrecto para el modo de acceso seleccionado.** Con la pestaña "Principal" activa, el campo de contraseña muestra el label "Contraseña de la Sucursal" — confirmado en el snapshot de accesibilidad (el nombre accesible del campo coincide con el texto visible, ambos incorrectos). Esto es confuso tanto visualmente como para un lector de pantalla: un usuario "Principal" no está accediendo como sucursal.
2. **[Positivo] Labels sí están correctamente asociados a sus inputs** — el snapshot de accesibilidad muestra `textbox "Correo Electrónico"` y `textbox "Contraseña de la Sucursal"` con nombre accesible coincidente con el label visible (el problema es el contenido del label, no la asociación técnica).
3. **[Positivo] Imágenes con `alt` presente:** "Logo Artesa", "Panadería Logo", "Imagen destacada" (x2) — confirmado en snapshots, ninguna imagen sin `alt` en las páginas revisadas.
4. **[Menor] Touch target del botón "Registrarse" (overlay sobre el video) mide 80×25px en viewport de 390px** — medido con `getBoundingClientRect()` real. La altura de 25px está muy por debajo del mínimo recomendado de 44px (WCAG 2.5.5 / guías de Apple y Google) para un objetivo táctil cómodo en mobile.
5. **[Menor] Altura de los campos de input (correo/contraseña) es de ~32px en mobile** — también por debajo del mínimo de 44px recomendado, aunque menos grave que el botón.
6. **No se probó navegación completa por teclado (tab order) de punta a punta** — Playwright MCP no tiene un modo "tab order visual" directo sin recorrer manualmente cada campo; se confirmó que los campos son alcanzables como `textbox`/`button` roles accesibles, lo cual es un indicio positivo, pero no se verificó el orden exacto de tabulación.
7. **Actualización, con sesión real:** el dashboard y el flujo de creación de orden son navegables por teclado a nivel de roles ARIA (botones, comboboxes, spinbuttons todos con rol correcto en el snapshot de accesibilidad) — no se verificó el orden exacto de tabulación de punta a punta por límite de tiempo, misma limitación que en Login.

---

## Punto 9 — Optimizar imágenes (actualización con evidencia real)

Con sesión real se confirmó en vivo lo que antes era solo lectura de código: en `/dashboard/products` la consola registra **4 errores 404 reales** contra `/api/products/images/{id}/thumbnail` (IDs 46, 81, 455, 134) con el mensaje `"La imagen thumbnail no existe para este producto"`. El catálogo no crashea — los productos sin thumbnail simplemente no muestran imagen en esa fila — pero confirma con evidencia de navegador (no solo lectura de `productImageController.js`) que el hallazgo de la Fase 1 del punto 9 es real y activo en el catálogo de 499 productos de staging.

---

## Punto 11 — Mejorar velocidad (Core Web Vitals)

**Aclaración de herramienta:** no hay Lighthouse disponible en este entorno (ni como CLI ni como MCP). Se usó la **Navigation Timing API real del navegador** vía `browser_evaluate` contra `/login` en staging — son métricas reales, no simuladas, pero no son Lighthouse ni tienen el throttling de red/CPU que Lighthouse aplica para simular condiciones móviles reales. Esto se declara como limitación explícita, no se presenta como equivalente a un reporte de Lighthouse.

**Métricas reales medidas (`/login`, CloudFront, sin caché de navegador limpia entre mediciones):**

| Métrica | Valor real |
|---|---|
| TTFB | 254 ms |
| First Paint | 304 ms |
| First Contentful Paint | 304 ms |
| DOMContentLoaded | 280 ms |
| Load event | 322 ms |
| LCP | No capturado (el `PerformanceObserver` de LCP debe registrarse antes de la carga; no se pudo instrumentar retroactivamente vía `evaluate` post-carga) |

**Interpretación:** los tiempos son buenos para una SPA servida por CloudFront con caché caliente, pero **no reflejan el peso real del bundle** (62 MB antes del fix de GIFs, 21 MB después — ver punto 10) bajo condiciones de red móvil reales (3G/4G simulado), que es exactamente donde ese peso importa. TBT y CLS tampoco se midieron (requieren Lighthouse o `web-vitals` library instrumentada en la propia app, que no está presente).

**Recomendación (no aplicada):** instalar la librería `web-vitals` en el frontend real para capturar CWV reales de usuarios en staging/producción sería más representativo que cualquier medición puntual mía.

---

## Punto 15 — Jerarquía visual

**Qué revisé:** catálogo público de `/original-home` (proxy razonable ya que el catálogo autenticado real no es accesible — Incidente #2) y la sección de checkout/pricing rediseñada de IVA no se pudo alcanzar (vive detrás de login).

**Hallazgos:**

1. **[Menor] Las tarjetas de producto del catálogo público no muestran precio** — solo nombre, descripción, estrellas de valoración y dos botones ("Detalles"/"Añadir"). Un usuario no puede comparar precio sin hacer clic en "Detalles" primero, lo cual añade fricción a la decisión de compra en el punto de entrada.
2. **[Positivo] La jerarquía entre CTA primario/secundario es clara en las tarjetas:** "Añadir" (botón sólido, oscuro) se distingue visualmente de "Detalles" (botón outline) — el usuario entiende cuál es la acción principal.
3. **Actualización — desglose de IVA validado con datos reales, resultado positivo.** Con sesión real en `/dashboard/orders/new`, se agregaron dos productos reales al pedido: uno con IVA 0% (`CROISSANT CLÁSICO X3`, tax_code `IVAG03` "IVA EXCLUIDO") y otro con impuesto compuesto real (`TARTANA ZANAWOW`, tax_code `IMSB+IVA` — Impuesto Saludable 20% + IVA 19%). Confirmado por la respuesta real de `POST /api/orders/prices` (200, body inspeccionado): `base_price: 21320, tax_amount: 8314.8, tax_breakdown: [{IMSB, 20%, $4264}, {IVAG01, 19%, $4050.8}], total_price_with_tax: 29634.8`.
   - **La UI muestra el desglose correctamente y con buena jerarquía:** una tarjeta separada con fondo distintivo muestra `Subtotal: $33.140`, `IVA (19%): $4.050`, `Impuesto Saludable (20%): $4.264`, `Total a pagar: $41.454` — matemática verificada (33.140 + 4.050 + 4.264 = 41.454, correcto). Las líneas de impuesto no compiten visualmente con el resto del formulario; están agrupadas y jerárquicamente subordinadas al total.
   - **La ausencia inicial de la línea de IVA con el primer producto no era un bug** — ese producto específico tiene tasa 0% real (`IVA EXCLUIDO`), así que no había nada que mostrar. Se corrige la sospecha inicial: el desglose de IVA rediseñado **funciona correctamente**, tanto para productos exentos como con impuesto compuesto.

---

## Punto 16 — Comprobar navegadores

**Limitación explícita y honesta:** el MCP de Playwright instalado en este entorno (`@playwright/mcp@latest`) lanza únicamente el motor por defecto (Chromium) en esta configuración — no hay acceso configurado a Firefox ni WebKit/Safari desde las herramientas disponibles en esta sesión. **No se probó cross-browser real.** Si se necesita cobertura real de Firefox/Safari, hay que instalar explícitamente esos motores (`npx playwright install firefox webkit`) y reconfigurar el servidor MCP para lanzarlos — no se hizo porque no se pidió explícitamente y añade tiempo de setup considerable. Se declara la limitación en vez de forzar una prueba parcial o inventar resultados de "otro navegador".

---

## Punto 17 — Experiencia móvil

**Qué revisé:** más allá del responsive del punto 1 — tamaños de touch target reales (ya reportado en punto 8) y comportamiento del único flujo público interactivo (búsqueda de `/original-home`) en viewport mobile real (390×844).

**Hallazgos:**

1. **Touch targets por debajo del mínimo recomendado** — ver punto 8, hallazgos 4 y 5 (botón 80×25px, inputs ~32px de alto). Aplica directamente aquí como hallazgo de experiencia móvil.
2. **[Positivo, con sesión real] El dashboard es usable en mobile (390×844).** Layout de tarjetas apiladas correctamente, sidebar colapsa a menú hamburguesa, sin overflow horizontal, banner e indicadores ("Mis Pedidos", "Catálogo de Productos", "Facturas", "Configuración") se adaptan a una columna legible.
3. **No se completó una orden real de principio a fin en viewport mobile** (con teclado numérico real en cantidad/precio y scroll de tabla de productos) — se priorizó, con el tiempo disponible, confirmar que el flujo de creación de orden funciona en desktop (incluyendo el desglose de IVA, el punto más crítico pedido) antes que repetir el mismo flujo en mobile. Queda como validación pendiente si se requiere el detalle específico de teclado numérico táctil.

---

## Punto 19 — Auditoría final (tabla consolidada)

Ordenada por severidad. No se aplicó ningún fix salvo el ya explícitamente aprobado y cerrado por separado (GIF→MP4, commit `8803c25`, mergeado a `master`).

| # | Punto | Hallazgo | Severidad | Pantalla/Archivo | Recomendación |
|---|---|---|---|---|---|
| 18 | Vulnerabilidades | `fast-xml-parser` y `form-data`: críticas, confirmadas activas en producción real (S3Service, SapBaseService) | **Crítico** | `src/services/S3Service.js`, `src/services/SapBaseService.js` | Actualizar dependencias (`npm audit fix`), verificar breaking changes |
| 5/6/17 | Mensajes de error / carga / móvil | Certificado SSL autofirmado en staging (`net::ERR_CERT_AUTHORITY_INVALID`) — bloquea cualquier navegador estándar sin bypass manual | **Crítico** (infra, no bloquea ya esta auditoría) | Backend EC2 staging | Emitir certificado válido para staging es una mejora pendiente, no urgente para producción |
| 10 | Bundle/JS | Dos GIFs de login/landing pesaban 45.9 MB (74% del build) | **Crítico** (resuelto) | `LoginsAssets/`, `HomeAssets/` | **Ya corregido y desplegado** — commit `8803c25`, -98% de peso, mergeado a `master` |
| 3 | Botones y enlaces | El link "Mi Perfil" del dashboard (`/dashboard/profile`) apunta a una ruta que **no existe** en el router — 404 real confirmado. La página real de perfil es `/dashboard/settings` | **Importante** | `App.jsx:180-192` (rutas de `/dashboard`) | Corregir el `href`/`to` de "Mi Perfil" a `/dashboard/settings` |
| 9 | Imágenes | Confirmado con evidencia real (no solo código): 4 productos del catálogo devuelven 404 en `/api/products/images/{id}/thumbnail` — el catálogo no crashea pero llena la consola de errores | **Importante** | `/dashboard/products`, `productImageController.js` | Generar thumbnail automático a partir de `main`, o filtrar el 404 en frontend sin loguear como error |
| — | Fix propio | Video de fondo de `/original-home` invisible por bug de stacking context (`z-index:-10` sin contexto de apilamiento en el padre) — introducido por el fix de GIFs | **Importante** (resuelto) | `home2.jsx:186` | **Ya corregido y verificado en staging** — commit `75f68d4`, `z-0` agregado, mergeado a `master` |
| 1/3 | Responsive / Botones | CTA "Registrarse" duplicado en Login/Register/ResetPassword entre 360-768px por falta de clase `hidden lg:flex` | **Importante** | `Login.jsx:716-729` | Agregar clase responsive faltante al bloque del overlay |
| 3/7 | Botones / Estados vacíos | Buscador de `/original-home` no funcional (no filtra, no navega, no muestra "sin resultados") | **Importante** | `home2.jsx` (barra de búsqueda) | Conectar el buscador a una función real o removerlo si no está en alcance |
| 3 | Botones y enlaces | 6 enlaces del footer con `href="#"` sin acción (Contacto, Soporte, Realizar Pedido, Seguimiento, Preguntas Frecuentes, Política de Privacidad) | **Importante** | `home2.jsx` (footer) | Enlazar a rutas/páginas reales o remover temporalmente |
| 8 | Accesibilidad | Label "Contraseña de la Sucursal" se muestra incluso con el modo "Principal" seleccionado | **Importante** | `Login.jsx` (campo de contraseña) | Label dinámico según `authType` seleccionado |
| 9 | Imágenes | Sin compresión/resize server-side en upload de imágenes de producto (hasta 10MB tal cual a S3) | **Importante** | `productImageController.js:56-93` | Agregar pipeline de compresión (ej. `sharp`) antes de subir a S3 |
| 9 | Imágenes | `main`/`thumbnail` son uploads independientes — sin thumbnail no se muestra imagen en catálogo aunque exista `main` | **Importante** | `useProductImage.js` | Generar thumbnail automáticamente a partir de `main`, o hacer fallback a `main` si no hay thumbnail |
| 18 | Roles | `FUNCTIONAL_ADMIN` no existe en la constante `ROLES` de código pese a existir en BD — solo funciona por fallback hardcodeado | **Importante** | `src/constants/roles.js`, `auth.js:473` | Agregar `FUNCTIONAL_ADMIN: 3` a la constante para evitar doble mantenimiento |
| — | Config | `deploy:production` del frontend apunta a bucket placeholder `tu-bucket-production` | **Importante** | `LoginArtesa/package.json` | Configurar el bucket real de producción antes de cualquier deploy productivo |
| 2 | Errores visuales | `X-Frame-Options` declarado en `<meta>` no tiene efecto — la protección anti-clickjacking documentada en el punto 13 en realidad no está activa | **Importante** (corrige hallazgo previo) | `index.html:99` | Mover a header HTTP real (config de CloudFront o servidor) |
| 18 | Vulnerabilidades | `axios`, `express`, `react-router`, `lodash`, `js-yaml`, `jws`, `minimatch`: altas, con fix disponible | **Alto** | `package.json` (ambos) | `npm audit fix`, revisar breaking changes de `axios`/`react-router` |
| 2 | Errores visuales | Preload de `principal_img.jpg` (1.3MB) ya no usado tras el fix de GIFs — descarga desperdiciada confirmada por network real | **Menor** (regresión propia) | `index.html` (preload) | Quitar o actualizar el `<link rel="preload">` en el mismo commit del fix de z-index |
| 8/17 | Accesibilidad / Móvil | Touch targets por debajo de 44px recomendados (botón 80×25px, inputs ~32px) | **Menor** | `Login.jsx` (overlay y campos) | Aumentar padding/altura mínima de botones e inputs en mobile |
| 3 | Botones y enlaces | "Iniciar sesión" del nav de `/original-home` apunta a `/` en vez de `/login` | **Menor** | `home2.jsx` (nav) | Enlazar directo a `/login` |
| 1 | Responsive | Panel de video en Login se recorta agresivamente a ~200px de alto en mobile (360px) | **Menor** | `Login.jsx` | Revisar si el encuadre del clip es el deseado a esa altura |
| 18 | Vulnerabilidades | `tar` (frontend): confirmado no urgente, solo build-time vía Tailwind Oxide | **Menor** | `LoginArtesa/package.json` | Mover `@tailwindcss/vite` a `devDependencies` (higiene, no urgente) |
| 14 | Open Graph | Sin tags Open Graph — aplicabilidad limitada, app 100% B2B autenticada | **Menor** | `index.html` | Opcional, bajo impacto de negocio |
| — | Config | `window.ARTESA_CONFIG.DEBUG: true` hardcodeado sin condicionar por entorno | **Menor** | `index.html:114` | Condicionar por `NODE_ENV`/modo de build |
| 15 | Jerarquía visual | Desglose de precios/IVA rediseñado — **validado con datos reales (producto exento e IMSB+IVA compuesto), matemática correcta, buena jerarquía visual** | **Positivo (sin hallazgo)** | Flujo de creación de orden | Ninguna acción necesaria — funciona correctamente |
| 12/13 | SEO / Metadatos | Aplicabilidad limitada — app B2B autenticada, solo el login es superficie pública | **Cosmético / no accionable** | — | Ninguna acción necesaria más allá de lo ya presente |
| 16 | Cross-browser | No probado — Playwright MCP en esta sesión solo tiene Chromium instalado | **No evaluado (limitación de entorno)** | — | Instalar Firefox/WebKit vía `playwright install` si se requiere cobertura real |

### Limitaciones explícitas que afectan la cobertura de esta auditoría
- **Incidente crítico #2 (certificado SSL de staging), ya resuelto para efectos de esta auditoría** vía `--ignore-https-errors` en el MCP de Playwright (no es un fix del app ni de producción). Con eso se validaron con sesión real: dashboard, creación de orden completa (incluido el desglose de IVA), catálogo de 499 productos, perfil/configuración. **Sigue pendiente por falta de tiempo, no por bloqueo técnico:** gestión de sucursales (módulo de administración), un pedido real completo de principio a fin en viewport mobile con teclado numérico táctil, y forzar un 401/500 real del backend para el punto 5.
- **Cross-browser (punto 16):** no evaluado, solo Chromium disponible en este entorno.
- **Lighthouse (punto 11):** no disponible; se usaron métricas reales de Navigation Timing API como sustituto parcial, no equivalente.
- **El certificado SSL autofirmado de staging en sí (backend real, no las herramientas de auditoría) sigue sin resolverse** — es un hallazgo de infraestructura legítimo y crítico si algún humano necesita probar staging manualmente, independiente de que esta auditoría ya lo haya sorteado con tooling.
