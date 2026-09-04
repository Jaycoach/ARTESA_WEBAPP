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

## Monitoreo proactivo (para que esto no vuelva a pasar desapercibido)

Ademas de la renovacion automatica (que ya fallo una vez en silencio),
`scripts/production/ssl-expiry-check-cron.sh` corre semanalmente por cron en
el host y dispara una alerta por correo (AWS SES, via el `EmailService`
existente del proyecto) si al certificado le quedan menos de 15 dias — de
forma independiente a que certbot funcione o no.

- Script de verificacion base: `scripts/tests/check-ssl-cert.sh`
- Cron/orquestador: `scripts/production/ssl-expiry-check-cron.sh`
- Envio de alerta: `scripts/production/ssl-expiry-mailer.js` (dentro del
  contenedor de la app, via `docker exec`, reutilizando las credenciales SMTP
  ya cargadas ahi)
- Destinatario: variable de entorno `SSL_ALERT_EMAIL_TO` (`.env.production` /
  `.env.staging`, no versionada)
- Script de aceptacion: `scripts/tests/check-ssl-monitor.sh`

**Pendiente (tarea separada, a criterio de Jonathan):** agregar una capa de
monitoreo externa independiente del propio EC2 (ej. UptimeRobot / Better
Uptime) — el cron de arriba sigue viviendo en el mismo host que ya fallo en
silencio una vez; un chequeo externo no comparte ese punto de falla.
