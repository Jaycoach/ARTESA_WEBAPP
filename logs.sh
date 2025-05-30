#!/bin/bash
echo "📋 Logs de la aplicación en tiempo real..."
docker-compose -f docker-compose.staging.yml logs -f app
