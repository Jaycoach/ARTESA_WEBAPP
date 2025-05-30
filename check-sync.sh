#!/bin/bash
echo "📊 Estado de sincronización con GitHub:"
echo "📂 Repositorio: https://github.com/Jaycoach/ARTESA_WEBAPP"
echo "🌿 Rama: master"
echo ""

git fetch origin
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/master)

if [ "$LOCAL" = "$REMOTE" ]; then
    echo "✅ EC2 está sincronizado con GitHub"
    echo "📌 Commit actual: $(git log --oneline -1)"
else
    echo "⚠️  Hay cambios pendientes en GitHub"
    echo "   Local:  ${LOCAL:0:8}"
    echo "   Remoto: ${REMOTE:0:8}"
    echo ""
    echo "🔄 Cambios pendientes:"
    git log --oneline HEAD..origin/master
    echo ""
    echo "💡 Ejecuta './deploy.sh' para actualizar"
fi

echo ""
echo "🐳 Estado de contenedores Docker:"
docker-compose -f docker-compose.staging.yml ps
