# Solución: Error de Autenticación SAP en Swagger

## Problema Identificado

El endpoint `/api/client-sync/sync-institutional` funciona desde curl pero falla desde Swagger con el error:
```
Error de autenticación con SAP B1: Request failed with status code 400
"Invalid company user" (código -2028)
```

## Causa Principal

El error "Invalid company user" indica que las credenciales SAP están incorrectas o el usuario no tiene permisos necesarios. Esto puede ocurrir por:

1. **Variables de entorno no cargadas correctamente** en el contenedor Docker
2. **Credenciales SAP modificadas** en el servidor de SAP
3. **Problemas de red o conectividad** entre el servidor y SAP
4. **Configuración inconsistente** entre ambientes

## Soluciones Implementadas

### 1. Endpoint de Diagnóstico SAP

Se agregó un nuevo endpoint para diagnosticar problemas de SAP:

**Endpoint:** `GET /api/client-sync/sap-diagnosis`

Este endpoint verifica:
- ✅ Configuración de variables de entorno SAP
- ✅ Estado de inicialización del servicio SAP
- ✅ Estado de autenticación actual
- ✅ Últimos errores registrados

### 2. Validación Mejorada de Credenciales

Se mejoró el servicio `SapBaseService.js` para:
- ✅ Validar configuración antes de intentar autenticación
- ✅ Mostrar información detallada de variables faltantes
- ✅ Logging mejorado para diagnóstico

### 3. Script de Diagnóstico Local

Se creó `scripts/sap-diagnosis.js` para verificar:
- ✅ Variables de entorno
- ✅ Conectividad de red a SAP
- ✅ Autenticación SAP
- ✅ Acceso a BusinessPartners
- ✅ Query de clientes institucionales

### 4. Documentación Swagger Mejorada

Se actualizó la documentación del endpoint con:
- ✅ Descripción detallada del proceso
- ✅ Ejemplos de respuesta
- ✅ Códigos de error específicos
- ✅ Información de configuración requerida

## Pasos para Diagnosticar y Resolver

### Paso 1: Verificar desde Swagger UI

1. Acceder a Swagger: `https://ec2-44-216-131-63.compute-1.amazonaws.com/api-docs`
2. Autenticarse con token de administrador
3. Ejecutar: `GET /api/client-sync/sap-diagnosis`
4. Revisar la respuesta para identificar problemas

### Paso 2: Ejecutar Script de Diagnóstico Local

```bash
# En el servidor de staging
cd /path/to/project
node scripts/sap-diagnosis.js
```

### Paso 3: Verificar Variables de Entorno en Docker

```bash
# Verificar variables en el contenedor
docker exec artesa-api-staging env | grep SAP

# Debería mostrar:
# SAP_SERVICE_LAYER_URL=https://vm-hbt-hm53.heinsohncloud.com.co:50000/b1s/v2
# SAP_USERNAME=Integracion_Artesa
# SAP_PASSWORD=Abc.1234
# SAP_COMPANY_DB=PRUEBAS_ARTESA_07ABR
# SAP_INSTITUTIONAL_GROUP_CODE=120
```

### Paso 4: Verificar Conectividad Manual

```bash
# Desde el servidor, probar conectividad SAP
curl -k -X POST "https://vm-hbt-hm53.heinsohncloud.com.co:50000/b1s/v2/Login" \\
  -H "Content-Type: application/json" \\
  -d '{
    "CompanyDB": "PRUEBAS_ARTESA_07ABR",
    "UserName": "Integracion_Artesa", 
    "Password": "Abc.1234"
  }'
```

### Paso 5: Reiniciar Servicios si es Necesario

```bash
# Reiniciar contenedor Docker
docker-compose -f docker-compose.staging.yml restart app

# Verificar logs
docker logs artesa-api-staging --tail 50
```

## Configuración Requerida

### Variables de Entorno Obligatorias

```bash
# Conexión SAP Service Layer
SAP_SERVICE_LAYER_URL=https://vm-hbt-hm53.heinsohncloud.com.co:50000/b1s/v2
SAP_USERNAME=Integracion_Artesa
SAP_PASSWORD=Abc.1234
SAP_COMPANY_DB=PRUEBAS_ARTESA_07ABR

# Código de grupo institucional (opcional, por defecto 120)
SAP_INSTITUTIONAL_GROUP_CODE=120
```

### Configuración en docker-compose.staging.yml

```yaml
services:
  app:
    environment:
      - NODE_ENV=staging
      - PORT=3000
    env_file:
      - .env.staging  # ← Debe contener las variables SAP
```

## Endpoint Corregido

### URL Completa
```
POST https://ec2-44-216-131-63.compute-1.amazonaws.com/api/client-sync/sync-institutional
```

### Headers Requeridos
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Respuesta Exitosa Esperada
```json
{
  "success": true,
  "message": "Sincronización de clientes institucionales completada exitosamente",
  "data": {
    "total": 5,
    "created": 2,
    "updated": 3,
    "errors": 0,
    "branches": {
      "total": 10,
      "created": 4,
      "updated": 6,
      "errors": 0
    }
  }
}
```

## Troubleshooting Adicional

### Error -2028: "Invalid company user"
- ✅ Verificar usuario y contraseña SAP
- ✅ Confirmar que el usuario existe en SAP
- ✅ Verificar permisos del usuario en SAP

### Error -2029: "Invalid company database"
- ✅ Verificar `SAP_COMPANY_DB`
- ✅ Confirmar que la base de datos existe
- ✅ Verificar permisos de acceso a la base de datos

### Error de Conectividad
- ✅ Verificar conectividad de red
- ✅ Comprobar firewall/puertos
- ✅ Verificar certificados SSL

### Funciona en curl pero no en Swagger
- ✅ Verificar autenticación JWT en Swagger
- ✅ Confirmar headers en Swagger UI
- ✅ Revisar configuración CORS
- ✅ Verificar variables de entorno en Docker

## Contacto para Soporte

Si los problemas persisten después de seguir estos pasos:

1. Ejecutar el script de diagnóstico y compartir resultados
2. Verificar logs del contenedor Docker
3. Contactar al administrador de SAP para verificar credenciales
4. Revisar conectividad de red entre servidores
