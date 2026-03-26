#!/bin/bash

# Configurar manejo de errores
set -euo pipefail

# Función para manejar errores
handle_error() {
    echo "❌ Error en línea $1. Saliendo..."
    docker compose --env-file .env.production -f docker-compose.production.yml logs --tail=50 || true
    exit 1
}
trap 'handle_error $LINENO' ERR

echo "============================="
echo "🚀 Iniciando despliegue PRODUCCIÓN"
echo "============================="

# Variables para control de deploy
DEPLOY_MODE=""
NEEDS_FULL_REBUILD=false
NEEDS_PARTIAL_REBUILD=false

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
        echo "❌ Opción inválida, usando modo parcial"
        DEPLOY_MODE="partial"
        NEEDS_PARTIAL_REBUILD=true
        ;;
esac

echo ""

if [ "$DEPLOY_MODE" = "fast" ]; then
    echo "🚀 Deploy rápido - Solo reiniciando contenedores..."
    docker compose --env-file .env.production -f docker-compose.production.yml restart

elif [ "$DEPLOY_MODE" = "partial" ] || [ "$NEEDS_PARTIAL_REBUILD" = true ]; then
    echo "🔧 Deploy parcial - Rebuild con caché..."
    echo "⛔ Deteniendo contenedores existentes..."
    docker compose --env-file .env.production -f docker-compose.production.yml down
    echo "🔨 Reconstruyendo con caché..."
    docker compose --env-file .env.production -f docker-compose.production.yml build
    echo "🚀 Levantando contenedores..."
    docker compose --env-file .env.production -f docker-compose.production.yml up -d

elif [ "$DEPLOY_MODE" = "full" ] || [ "$NEEDS_FULL_REBUILD" = true ]; then
    echo "🏗️  Deploy completo - Rebuild sin caché..."
    echo "⛔ Deteniendo contenedores existentes..."
    docker compose --env-file .env.production -f docker-compose.production.yml down
    echo "🧹 Limpiando recursos Docker no utilizados..."
    docker system prune -f
    docker volume prune -f
    echo "🔧 Reconstruyendo imagen sin caché..."
    docker compose --env-file .env.production -f docker-compose.production.yml build --no-cache
    echo "🚀 Levantando contenedores..."
    docker compose --env-file .env.production -f docker-compose.production.yml up -d

else
    echo "❌ Modo de deploy no reconocido"
    exit 1
fi

echo "⏳ Esperando inicialización de contenedores..."
case $DEPLOY_MODE in
    "fast") echo "   ⚡ Tiempo estimado: ~30 segundos" ;;
    "partial") echo "   🔧 Tiempo estimado: ~2-3 minutos" ;;
    "full") echo "   🏗️  Tiempo estimado: ~8-10 minutos" ;;
esac
sleep 15

# Verificar health endpoint para PRODUCCIÓN
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s -f https://api.artesapanaderia.com/api/health >/dev/null 2>&1; then
        echo "✅ API PRODUCCIÓN respondiendo correctamente"
        break
    fi

    if docker compose --env-file .env.production -f docker-compose.production.yml exec app curl -s -f http://localhost:3000/api/health >/dev/null 2>&1; then
        echo "✅ API PRODUCCIÓN funcionando en contenedor"
        echo "⚠️  Nginx proxy podría tener problemas"
        break
    fi

    echo "⏳ Esperando que la API PRODUCCIÓN responda... ($((RETRY_COUNT + 1))/$MAX_RETRIES)"
    sleep 2
    RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "❌ La API PRODUCCIÓN no respondió después de $MAX_RETRIES intentos"
    echo "📋 Logs de error:"
    docker compose --env-file .env.production -f docker-compose.production.yml logs --tail=50
    exit 1
fi

echo "✅ Despliegue PRODUCCIÓN completado exitosamente!"
echo ""
echo "📊 Información del despliegue PRODUCCIÓN:"
echo "🌐 API Health: https://api.artesapanaderia.com/api/health"
echo "📚 Swagger: https://api.artesapanaderia.com/api-docs"
echo ""
echo "🐳 Contenedores PRODUCCIÓN activos:"
docker compose --env-file .env.production -f docker-compose.production.yml ps
echo ""
echo "📝 Para ver logs en tiempo real:"
echo "   docker compose --env-file .env.production -f docker-compose.production.yml logs -f"