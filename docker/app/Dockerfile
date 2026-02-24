# Usar imagen oficial de Node.js 22 Alpine (más liviana)
FROM node:22-alpine

# Instalar dependencias del sistema necesarias
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    bash

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S artesa && \
    adduser -S artesa -u 1001 -G artesa

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias primero (para cache de Docker)
COPY package*.json ./

# Configurar npm para mejor conectividad y timeouts más largos
RUN npm config set registry https://registry.npmjs.org/ && \
    npm config set fetch-retries 10 && \
    npm config set fetch-retry-factor 3 && \
    npm config set fetch-retry-mintimeout 30000 && \
    npm config set fetch-retry-maxtimeout 180000 && \
    npm config set fetch-timeout 300000 && \
    npm config set maxsockets 5

# Instalar dependencias con flags actualizados
RUN npm install --omit=dev --omit=optional --no-audit --legacy-peer-deps

# Crear directorio public y establecer permisos antes de copiar código
RUN mkdir -p public && \
    chown -R artesa:artesa /app

# Copiar código fuente ANTES de cambiar usuario
COPY . .

# Copiar y configurar script de entrada
COPY docker/scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Crear directorios y establecer permisos
RUN mkdir -p uploads tmp logs public public/product-images && \
    chown -R artesa:artesa /app && \
    chown artesa:artesa /entrypoint.sh

# Generar documentación Swagger como usuario artesa
USER artesa
RUN npm run generate-swagger
USER root

# Limpiar caché npm
RUN npm cache clean --force

# Cambiar a usuario no-root AL FINAL
USER artesa

# Exponer puerto de la aplicación
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Comando de entrada
ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "start"]