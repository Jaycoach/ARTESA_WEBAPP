#!/bin/bash
echo "🧹 Limpiando contenedores y volúmenes de Docker..."
docker-compose down -v
docker system prune -f
docker volume prune -f
echo "✅ Limpieza completada"