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

# Variables para control de deploy
DEPLOY_MODE=""
NEEDS_FULL_REBUILD=false
NEEDS_PARTIAL_REBUILD=false

# Mostrar opciones de deploy si hay cambios recientes
echo ""
echo "🤔 Selecciona el tipo de despliegue:"
echo "1) 🚀 Rápido - Solo código (sin cambios en dependencias)"
echo "2) 🔧 Parcial - Rebuild con caché (cambios menores)"
echo "3) 🏗️  Completo - Rebuild sin caché (cambios en package.json/Dockerfile)"
echo "4) 🔍 Auto-detectar cambios"
echo ""
read -p "Selecciona una opción [1-4]: " deploy_choice


case $deploy_choice in
    1)
        DEPLOY_MODE="fast"
        echo "✅ Modo rápido seleccionado"
        ;;
    2)
        DEPLOY_MODE="partial"
        NEEDS_PARTIAL_REBUILD=true
        echo "✅ Modo parcial seleccionado"
        ;;
    3)
        DEPLOY_MODE="full"
        NEEDS_FULL_REBUILD=true
        echo "✅ Modo completo seleccionado"
        ;;
    4)
        DEPLOY_MODE="auto"
        echo "🔍 Auto-detectando cambios..."
        # Verificar si hay cambios críticos (si existe git)
        if command -v git >/dev/null 2>&1 && [ -d ".git" ]; then
            if git diff --name-only HEAD~1 HEAD 2>/dev/null | grep -E "(package\.json|package-lock\.json|Dockerfile|docker-compose)" >/dev/null; then
                echo "⚠️  Cambios críticos detectados en dependencias o Docker"
                NEEDS_FULL_REBUILD=true
            elif git diff --name-only HEAD~1 HEAD 2>/dev/null | grep -E "\.(js|json|ts|env)$" >/dev/null; then
                echo "📝 Cambios en código detectados"
                NEEDS_PARTIAL_REBUILD=true
            else
                echo "📄 Cambios menores detectados"
            fi
        else
            echo "⚠️  No se puede auto-detectar, usando modo parcial"
            NEEDS_PARTIAL_REBUILD=true
        fi
        ;;
    *)
        echo "❌ Opción inválida, usando modo auto-detectar"
        DEPLOY_MODE="auto"
        NEEDS_PARTIAL_REBUILD=true
        ;;
esac

echo ""

# Ejecutar deploy según el modo seleccionado
if [ "$DEPLOY_MODE" = "fast" ]; then
    echo "🚀 Deploy rápido - Solo reiniciando contenedores..."
    docker-compose --env-file .env.staging -f docker-compose.staging.yml restart
    
elif [ "$DEPLOY_MODE" = "partial" ] || [ "$NEEDS_PARTIAL_REBUILD" = true ]; then
    echo "🔧 Deploy parcial - Rebuild con caché..."
    # Paso 1: Detener contenedores
    echo "⛔ Deteniendo contenedores existentes..."
    docker-compose --env-file .env.staging -f docker-compose.staging.yml down
    
    # Paso 2: Rebuild con caché (más rápido)
    echo "🔨 Reconstruyendo con caché..."
    docker-compose --env-file .env.staging -f docker-compose.staging.yml build
    
    # Paso 3: Levantar contenedores
    echo "🚀 Levantando contenedores..."
    docker-compose --env-file .env.staging -f docker-compose.staging.yml up -d
    
elif [ "$DEPLOY_MODE" = "full" ] || [ "$NEEDS_FULL_REBUILD" = true ]; then
    echo "🏗️  Deploy completo - Rebuild sin caché..."
    # Paso 1: Detener contenedores antiguos
    echo "⛔ Deteniendo contenedores existentes..."
    docker-compose --env-file .env.staging -f docker-compose.staging.yml down
    
    # Limpiar recursos Docker no utilizados
    echo "🧹 Limpiando recursos Docker no utilizados..."
    docker system prune -f
    docker volume prune -f
    
    # Paso 2: Reconstruir sin caché (el modo actual)
    echo "🔧 Reconstruyendo imagen sin caché..."
    docker-compose --env-file .env.staging -f docker-compose.staging.yml build --no-cache
    
    # Paso 3: Levantar contenedores
    echo "🚀 Levantando contenedores..."
    docker-compose --env-file .env.staging -f docker-compose.staging.yml up -d
    
else
    echo "❌ Modo de deploy no reconocido"
    exit 1
fi

# Esperar que los contenedores se inicialicen
echo "⏳ Esperando inicialización de contenedores..."
case $DEPLOY_MODE in
    "fast") echo "   ⚡ Tiempo estimado: ~30 segundos" ;;
    "partial") echo "   🔧 Tiempo estimado: ~2-3 minutos" ;;
    "full") echo "   🏗️  Tiempo estimado: ~8-10 minutos" ;;
esac
sleep 15

# Mostrar progreso en tiempo real para deploy completo
if [ "$DEPLOY_MODE" = "full" ]; then
    echo "🔍 Mostrando progreso del build..."
    echo "   (Esto puede tomar varios minutos la primera vez)"
fi

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
