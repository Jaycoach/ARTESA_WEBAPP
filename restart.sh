#!/bin/bash
echo "🔄 Reiniciando aplicación..."
docker-compose -f docker-compose.staging.yml restart
echo "✅ Aplicación reiniciada"
