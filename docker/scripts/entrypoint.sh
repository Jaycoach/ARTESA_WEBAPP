#!/bin/bash
set -e

echo "🚀 Iniciando LA ARTESA API..."
echo "Entorno: ${NODE_ENV:-development}"
echo "Puerto: ${PORT:-3000}"

# Función para logging
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Verificar que las variables de entorno críticas estén presentes
if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_DATABASE" ]; then
    log "❌ ERROR: Variables de base de datos faltantes"
    exit 1
fi

if [ -z "$JWT_SECRET" ]; then
    log "❌ ERROR: JWT_SECRET no configurado"
    exit 1
fi

log "✅ Variables de entorno verificadas"

# Crear directorios si no existen
mkdir -p /app/uploads/client-profiles
mkdir -p /app/tmp
mkdir -p /app/logs
mkdir -p /app/public
mkdir -p /app/public/product-images

# Asegurar permisos correctos
chmod 755 /app/uploads /app/tmp /app/logs /app/public /app/public/product-images

log "📁 Directorios preparados"

# Esperar a que la base de datos esté disponible
wait_for_db() {
    log "🔄 Esperando conexión a la base de datos..."
    for i in {1..30}; do
        if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
            log "✅ Base de datos disponible"
            return 0
        fi
        log "⏳ Intento $i/30 - Base de datos no disponible, esperando..."
        sleep 2
    done
    log "❌ ERROR: No se pudo conectar a la base de datos después de 60 segundos"
    exit 1
}

# Solo esperar DB en producción o si está configurado
if [ "$NODE_ENV" = "production" ] || [ "$WAIT_FOR_DB" = "true" ]; then
    wait_for_db
fi

# Regenerar documentación Swagger si es necesario
if [ ! -f "/app/swagger.json" ] || [ "$REGENERATE_DOCS" = "true" ]; then
    log "📖 Generando documentación Swagger..."
    npm run generate-swagger || log "⚠️ Warning: No se pudo generar documentación Swagger"
fi

log "🎯 Iniciando aplicación..."

# Ejecutar comando pasado como parámetros
exec "$@"