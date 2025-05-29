#!/bin/bash

# Configurar manejo de errores
set -euo pipefail

# Función para manejar errores
handle_error() {
   echo "❌ Error en línea $1. Saliendo..."
   docker-compose --env-file .env.staging -f docker-compose.staging.yml logs --tail=50 || true
   exit 1
}
trap 'handle_error $LINENO' ERR

echo "============================="
echo "🚀 Iniciando despliegue STAGING"
echo "============================="

# Backup de logs anteriores
echo "💾 Creando backup de logs anteriores..."
mkdir -p backups/$(date +%Y%m%d_%H%M%S)
docker-compose --env-file .env.staging -f docker-compose.staging.yml logs > backups/$(date +%Y%m%d_%H%M%S)/previous_logs.txt 2>/dev/null || true

# Paso 1: Detener contenedores antiguos
echo "⛔ Deteniendo contenedores existentes..."
docker-compose --env-file .env.staging -f docker-compose.staging.yml down

# Limpiar recursos Docker no utilizados
echo "🧹 Limpiando recursos Docker no utilizados..."
docker system prune -f
docker volume prune -f

# Paso 2: Reconstruir sin caché
echo "🔧 Reconstruyendo imagen sin caché..."
docker-compose --env-file .env.staging -f docker-compose.staging.yml build --no-cache

# Paso 3: Levantar contenedores
echo "🚀 Levantando contenedores..."
docker-compose --env-file .env.staging -f docker-compose.staging.yml up -d

# Esperar que los contenedores se inicialicen
echo "⏳ Esperando inicialización de contenedores..."
sleep 15

# Verificar health endpoint para STAGING
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
   # Método 1: Probar a través de nginx local
   if curl -s -f http://localhost/api/health >/dev/null 2>&1; then
       echo "✅ API STAGING respondiendo correctamente (nginx local)"
       break
   fi
   
   # Método 2: Probar directamente en el contenedor
   if docker exec artesa-api-staging curl -s -f http://localhost:3000/api/health >/dev/null 2>&1; then
       echo "✅ API STAGING funcionando en contenedor"
       echo "⚠️  Nginx proxy podría tener problemas"
       break
   fi
   
   echo "⏳ Esperando que la API STAGING responda... ($((RETRY_COUNT + 1))/$MAX_RETRIES)"
   sleep 2
   RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
   echo "❌ La API STAGING no respondió después de $MAX_RETRIES intentos"
   echo "🔍 Debug info:"
   echo "   - Probando nginx local:"
   curl -v http://localhost/api/health 2>&1 | head -10 || echo "   Nginx local falló"
   echo "   - Probando contenedor directo:"
   docker exec artesa-api-staging curl -s http://localhost:3000/api/health || echo "   Contenedor falló"
   echo ""
   echo "📋 Logs de error:"
   docker-compose --env-file .env.staging -f docker-compose.staging.yml logs --tail=50
   exit 1
fi

echo "✅ Despliegue STAGING completado exitosamente!"
echo ""
echo "📊 Información del despliegue STAGING:"
echo "🌐 API Health: http://ec2-44-216-131-63.compute-1.amazonaws.com/api/health"
echo "📚 Swagger: http://ec2-44-216-131-63.compute-1.amazonaws.com/api-docs"
echo "🔍 CORS Debug: http://ec2-44-216-131-63.compute-1.amazonaws.com/api/cors-debug"
echo "🏠 Local: http://localhost/api/health"
echo ""
echo "🐳 Contenedores STAGING activos:"
docker-compose --env-file .env.staging -f docker-compose.staging.yml ps
echo ""
echo "📝 Para ver logs en tiempo real:"
echo "   docker-compose --env-file .env.staging -f docker-compose.staging.yml logs -f"
