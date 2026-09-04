# Certificados SSL — La Artesa

## Estado vigente (actualizado 2026-09-04)

| Dominio | Ambiente | Tipo de certificado | Vence | Renovacion |
|---|---|---|---|---|
| `api.artesapanaderia.com` | Produccion (52.20.47.155) | Let's Encrypt (ECDSA) | **2026-12-03** | Automatica via `certbot-renew.timer` + authenticator `webroot` |
| `ec2-44-216-131-63.compute-1.amazonaws.com` (staging) | Staging (44.216.131.63) | Autofirmado (`ssl/nginx.crt`) | 2027-02-24 | Manual — no usa certbot (ver incidente mas abajo) |

## Incidente 2026-09-04: expiracion no detectada en produccion

El certificado de produccion vencio el 2026-06-23. El timer `certbot-renew.timer`
seguia activo pero fallaba en cada corrida desde entonces porque
`authenticator = standalone` necesita bindear el puerto 80, y ese puerto lo
ocupa permanentemente el contenedor `artesa-nginx-production`. Nadie se
entero hasta que el frontend empezo a mostrar "Network Error" al hacer
login, ~2 meses despues.

**Fix aplicado:** migracion a `authenticator = webroot`, con un bind mount
nuevo `./certbot-webroot:/var/www/certbot` en el servicio nginx
(`docker-compose.production.yml`) y `--deploy-hook "docker exec
artesa-nginx-production nginx -s reload"` persistido en el renewal conf del
host (`/etc/letsencrypt/renewal/api.artesapanaderia.com.conf`, no versionado
en git — es estado propio de certbot). Verificado con
`scripts/tests/check-ssl-cert.sh`.

**Nota sobre staging:** se confirmo por SSH que `certbot` esta instalado en
el host de staging pero nunca se uso — no existe ningun archivo en
`/etc/letsencrypt/renewal/`, el timer esta `disabled`, y el certificado que
sirve nginx es autofirmado (vigente hasta 2027-02-24). No aplica el mismo
patron de falla porque staging no depende de una renovacion automatica.

## Monitoreo proactivo — cron semanal en produccion (para que esto no vuelva a pasar desapercibido)

Ademas de la renovacion automatica (que ya fallo una vez en silencio),
`scripts/production/ssl-expiry-check-cron.sh` corre **cada lunes a las 7:00
am (hora del servidor, `0 7 * * 1` en crontab de `ec2-user`)** en el host de
produccion y dispara una alerta por correo (AWS SES, via el `EmailService`
existente del proyecto) si al certificado le quedan menos de **15 dias** —
de forma independiente a que certbot funcione o no.

- Script de verificacion base: [`scripts/tests/check-ssl-cert.sh`](../scripts/tests/check-ssl-cert.sh)
  — valida (1) dias hasta expiracion, (2) `curl` a `/api/health` sin `-k`
  (exige cadena TLS valida), (3) `certbot renew --dry-run` si se le pasan
  credenciales SSH.
- Cron/orquestador: [`scripts/production/ssl-expiry-check-cron.sh`](../scripts/production/ssl-expiry-check-cron.sh)
  (invocado como `ssl-expiry-check-cron.sh api.artesapanaderia.com
  artesa-api-production 15`).
- Envio de alerta: [`scripts/production/ssl-expiry-mailer.js`](../scripts/production/ssl-expiry-mailer.js)
  (dentro del contenedor `artesa-api-production`, via `docker exec`,
  reutilizando las credenciales SMTP ya cargadas ahi — sin cliente SES
  nuevo).
- Destinatario: variable de entorno `SSL_ALERT_EMAIL_TO=aws@artesapanaderia.com`
  en `.env.production` (no versionada en git).
- **Script de aceptacion (para validar el mecanismo completo, no solo leer el
  codigo):** [`scripts/tests/check-ssl-monitor.sh`](../scripts/tests/check-ssl-monitor.sh)
  — corre el cron contra el dominio real (espera exit 0) y contra
  `expired.badssl.com` como caso de prueba de cert vencido (espera exit != 0
  y confirma que el correo se disparo, via el marcador `MAIL_SENT_OK` con el
  `messageId` real que devuelve SES). Validado en produccion el 2026-09-04,
  4/4 checks OK — ver `CHANGELOG.md`.

### Decision explicita: staging NO tiene este cron

Se instalo inicialmente en staging tambien, pero se revirtio tras detectar
que **siempre habria disparado una alerta falsa**: el check 2 del script
(`curl` sin `-k`, exige cadena de certificacion confiable) falla contra el
certificado autofirmado de staging con `SEC_E_UNTRUSTED_ROOT` — no porque el
certificado este por vencer (vence en 2027), sino porque un autofirmado
nunca pasa validacion de cadena. Dejarlo activo habria entrenado a ignorar
la alerta semanal ("cry wolf"). Staging tampoco tiene el riesgo real que
motiva este monitoreo (no depende de renovacion automatica, ver seccion de
arriba), asi que se decidio no monitorearlo por este mecanismo. La variable
`SSL_ALERT_EMAIL_TO` quedo configurada en `.env.staging` por si se retoma
mas adelante, pero sin cron asociado.

## Pendiente — monitor externo (Opcion 1, complementaria al cron)

**Estado: IMPLEMENTADO — bloqueado, no VALIDADO.** El cron de arriba vive en
el mismo EC2 que ya fallo en silencio una vez (certbot-renew.timer activo
pero fallando sin que nadie se enterara por ~2 meses); un monitor externo,
fuera de AWS, no comparte ese punto de falla. No se ha ejecutado ningun paso
de configuracion todavia — bloqueado porque la cuenta de correo
`aws@artesapanaderia.com` (ya existente) aun no tiene acceso asignado a
Jonathan para recibir las notificaciones.

Pasos a ejecutar en cuanto haya acceso a `aws@artesapanaderia.com` (a cargo
de Jonathan, no de Claude Code — requiere credenciales de una cuenta de
terceros):

1. Iniciar sesion en [Better Stack](https://betterstack.com) (o crear la
   cuenta ahi) usando `aws@artesapanaderia.com`.
2. Crear un monitor tipo **HTTPS/TLS** sobre
   `https://api.artesapanaderia.com/api/health`, con el chequeo de
   certificado SSL activado explicitamente (no solo uptime — Better Stack
   distingue el chequeo de expiracion de certificado del chequeo de
   disponibilidad del endpoint).
3. Configurar el canal de alerta al mismo correo
   `aws@artesapanaderia.com` (y opcionalmente Slack, si el equipo lo usa
   para notificaciones operativas).
4. Validar que el dashboard del monitor muestre la fecha de expiracion
   correcta del certificado (**3-dic-2026** al momento de escribir esto) —
   esa coincidencia es la confirmacion de que el monitor esta leyendo el
   certificado real y no cacheando datos viejos.

Cuando estos 4 pasos esten hechos, esta seccion debe actualizarse a
**VALIDADO** con captura o confirmacion del dashboard como evidencia,
siguiendo el mismo criterio de DoD que el resto de este documento.
