#!/bin/bash

echo "🚀 Iniciando deploy desde GitHub..."
echo "📅 $(date)"
echo "📂 Repositorio: https://github.com/Jaycoach/ARTESA_WEBAPP"

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Verificar conexión a internet
log_step "Verificando conectividad..."
if ! ping -c 1 github.com &> /dev/null; then
    log_error "Sin conexión a GitHub"
    exit 1
fi

# Verificar estado del repositorio
log_step "Verificando estado del repositorio..."
git fetch origin

if [ $? -ne 0 ]; then
    log_error "Error al conectar con GitHub. Verifica credenciales."
    exit 1
fi

# Comparar commits (usando master)
LOCAL=$(git rev-parse HEAD 2>/dev/null || echo "no-commit")
REMOTE=$(git rev-parse origin/master 2>/dev/null || echo "no-remote")

if [ "$LOCAL" = "$REMOTE" ]; then
    log_warning "No hay cambios nuevos en GitHub"
    log_info "Commit actual: ${LOCAL:0:8}"
    exit 0
fi

log_info "Nuevos cambios detectados:"
log_info "Local:  ${LOCAL:0:8}"
log_info "Remoto: ${REMOTE:0:8}"

# Mostrar qué cambió
log_step "Archivos modificados:"
git log --oneline --no-merges HEAD..origin/master | head -5

# Detener servicios
log_step "Deteniendo servicios Docker..."
docker-compose -f docker-compose.staging.yml down

# Hacer backup de archivos críticos (opcional)
log_step "Creando backup de configuración..."
cp .env.staging /tmp/.env.staging.backup.$(date +%Y%m%d_%H%M%S)

# Actualizar código (usando master)
log_step "Actualizando código desde GitHub..."
git pull origin master

if [ $? -ne 0 ]; then
    log_error "Error al hacer git pull"
    log_error "Revisa conflictos o problemas de permisos"
    exit 1
fi

# Verificar si hay cambios críticos
NEEDS_FULL_REBUILD=false

if git diff --name-only HEAD~1 HEAD | grep -E "(package\.json|Dockerfile|docker-compose)" &> /dev/null; then
    log_warning "Cambios críticos detectados, rebuild completo necesario"
    NEEDS_FULL_REBUILD=true
fi

# Build de la aplicación
if [ "$NEEDS_FULL_REBUILD" = true ]; then
    log_step "Realizando rebuild completo (dependencias/Docker)..."
    docker-compose -f docker-compose.staging.yml build --no-cache
else
    log_step "Realizando rebuild normal..."
    docker-compose -f docker-compose.staging.yml build
fi

# Levantar servicios
log_step "Iniciando servicios..."
docker-compose -f docker-compose.staging.yml up -d

# Esperar y verificar
log_step "Verificando estado de servicios..."
sleep 20

if docker-compose -f docker-compose.staging.yml ps | grep -q "Up"; then
    log_info "✅ Deploy completado exitosamente"
    
    # Mostrar información útil
    PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
    log_info "🌐 Aplicación disponible en: http://$PUBLIC_IP"
    log_info "📚 API Docs: http://$PUBLIC_IP/api-docs"
    log_info "💾 Commit actual: $(git rev-parse --short HEAD)"
    
else
    log_error "❌ Error: Los servicios no están funcionando correctamente"
    log_error "Logs de error:"
    docker-compose -f docker-compose.staging.yml logs --tail=30 app
    exit 1
fi

# Mostrar logs recientes
log_step "Últimos logs de la aplicación:"
docker-compose -f docker-compose.staging.yml logs --tail=15 app

echo ""
log_info "🎉 Deploy terminado exitosamente - $(date)"
log_info "⏱️  Duración: $SECONDS segundos"
