# 🔐 ARTESA — Acceso a Ambientes y Monitoreo de Logs

> **Proyecto:** La Artesa — Portal de Pedidos y Gestión de Clientes
> **Referencia:** 20250207-01 | Cliente: MASORG
> **Actualizado:** Junio 2026

---

## 📋 Tabla de Contenidos

1. [Conexión SSH](#1-conexión-ssh)
2. [Logs en Vivo](#2-logs-en-vivo)
3. [Comandos de Estado General](#3-comandos-de-estado-general)
4. [Deploy Frontend](#4-deploy-frontend)
5. [Deploy Backend](#5-deploy-backend)
6. [Acceso a URLs](#6-acceso-a-urls)

---

## 1. Conexión SSH

> Las llaves `.pem` deben estar disponibles localmente. Ejecutar desde PowerShell en el directorio donde se encuentren las llaves, o especificar la ruta completa.

### 🟡 Staging

```bash
ssh -i "artesa-key.pem" ec2-user@44.216.131.63
```

### 🟢 Producción

```bash
ssh -i "artesa-portal-prod-key.pem" ec2-user@52.20.47.155
```

---

## 2. Logs en Vivo

> Todos los comandos de logs se ejecutan **dentro del servidor EC2** correspondiente, luego de conectarse por SSH.

### 🔵 API — Logs en tiempo real

#### Staging
```bash
docker logs -f artesa-api-staging --tail=50
```

#### Producción
```bash
docker logs -f artesa-api-production --tail=50
```

---

### 🔵 Nginx — Logs en tiempo real

#### Staging
```bash
docker logs -f artesa-nginx-staging --tail=50
```

#### Producción
```bash
docker logs -f artesa-nginx-production --tail=50
```

---

### 🔵 Logs con filtro por palabra clave

Útil para rastrear errores específicos (SAP, reCAPTCHA, sincronización, etc.).

#### Staging — filtrar por término
```bash
docker logs artesa-api-staging --tail=200 2>&1 | grep -i "ERROR"
docker logs artesa-api-staging --tail=200 2>&1 | grep -i "SAP"
docker logs artesa-api-staging --tail=200 2>&1 | grep -i "sync"
docker logs artesa-api-staging --tail=200 2>&1 | grep -i "recaptcha"
```

#### Producción — filtrar por término
```bash
docker logs artesa-api-production --tail=200 2>&1 | grep -i "ERROR"
docker logs artesa-api-production --tail=200 2>&1 | grep -i "SAP"
docker logs artesa-api-production --tail=200 2>&1 | grep -i "sync"
docker logs artesa-api-production --tail=200 2>&1 | grep -i "recaptcha"
```

---

### 🔵 Logs de las últimas N líneas (sin seguimiento)

```bash
# Staging — últimas 100 líneas
docker logs artesa-api-staging --tail=100

# Producción — últimas 100 líneas
docker logs artesa-api-production --tail=100
```

---

### 🔵 Logs con timestamp

```bash
# Staging
docker logs -f artesa-api-staging --tail=50 --timestamps

# Producción
docker logs -f artesa-api-production --tail=50 --timestamps
```

---

## 3. Comandos de Estado General

> Ejecutar dentro del EC2 correspondiente luego de conectarse por SSH.

### Estado de contenedores Docker

```bash
docker ps
```

### Reiniciar contenedores (aplica cambios de variables de entorno)

> ⚠️ Usar siempre `down` + `up -d` — el `restart` NO re-inyecta variables de entorno.

#### Staging
```bash
cd /home/ec2-user/artesa-api
docker-compose -f docker-compose.staging.yml down
docker-compose -f docker-compose.staging.yml up -d
```

#### Producción
```bash
cd /home/ec2-user/artesa-api
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d
```

### Verificar variables de entorno activas en el contenedor

```bash
# Staging
docker exec artesa-api-staging env | grep -E "NODE_ENV|SAP|RECAPTCHA|DB_DATABASE"

# Producción
docker exec artesa-api-production env | grep -E "NODE_ENV|SAP|RECAPTCHA|DB_DATABASE"
```

### Ejecutar curl interno contra la API

> El puerto 3000 no está expuesto al host — siempre usar `docker exec`.

```bash
# Staging — health check
docker exec artesa-api-staging curl -s http://localhost:3000/api/health

# Producción — health check
docker exec artesa-api-production curl -s http://localhost:3000/api/health
```

### Ver último commit desplegado

```bash
cd /home/ec2-user/artesa-api && git log --oneline -5
```

---

## 4. Deploy Frontend

> Ejecutar desde **PowerShell local**, posicionado en la carpeta del frontend.

```powershell
cd "C:\Users\jayco\OneDrive\CLIENTES\MASORG\Desarrollo\LaArtesa\src\views\frontend\LoginArtesa"
```

### Staging
```powershell
.\deploy-frontend.ps1 -Environment staging
```

### Producción
```powershell
.\deploy-frontend.ps1 -Environment production
```

### Verificar fecha del bundle desplegado en S3

```powershell
# Staging
aws s3 ls s3://artesa-frontend-staging/index.html --profile artesa

# Producción
aws s3 ls s3://artesa-frontend-production/index.html --profile artesa
```

---

## 5. Deploy Backend

> Ejecutar dentro del EC2 correspondiente luego de conectarse por SSH.

### Staging
```bash
cd /home/ec2-user/artesa-api && git pull && bash deploy-staging.sh
```

### Producción
```bash
cd /home/ec2-user/artesa-api && git pull && bash deploy-production.sh
```

---

## 6. Acceso a URLs

| Recurso | Staging | Producción |
|---|---|---|
| **Frontend** | https://d1bqegutwmfn98.cloudfront.net | https://app.artesapanaderia.com |
| **API Health** | https://ec2-44-216-131-63.compute-1.amazonaws.com/api/health | https://api.artesapanaderia.com/api/health |
| **CloudFront ID** | `EW6Z1KU9EFB7I` | `E2DQU9UCJBZKP5` |
| **S3 Bucket** | `artesa-frontend-staging` | `artesa-frontend-production` |
| **EC2 IP** | `44.216.131.63` | `52.20.47.155` |
| **DB** | `artesadb_dev` | `laartesa` |

### RDS (acceso vía PGAdmin con túnel SSH)
```
Host:  laartesa-db.csbsswgcszct.us-east-1.rds.amazonaws.com
Port:  5432
User:  laartesa_admin
```

> ⚠️ No usar `psql` directo desde EC2 — bloqueado por `pg_hba.conf`. Siempre acceder vía PGAdmin con túnel SSH.

---

## ⚠️ Notas Importantes

- **Cambios de `.env` en EC2** requieren `docker-compose down` + `up -d` — nunca solo `restart`.
- **Staging es la fuente de verdad** para validar archivos fuente. Tiene paridad con local y debe tenerla con producción.
- **El frontend es estático en S3** — un deploy de backend no actualiza el frontend. Deben hacerse por separado.
- **Siempre desplegar staging primero**, validar, y luego producción.
- **Contraseñas con `$`** en `.env` requieren `$$$$` para que Docker Compose resuelva a `$$` en runtime.