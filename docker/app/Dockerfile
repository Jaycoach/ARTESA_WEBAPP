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

# Configurar npm para mejor conectividad
RUN npm config set registry https://registry.npmjs.org/
RUN npm config set fetch-retries 5
RUN npm config set fetch-retry-factor 2
RUN npm config set fetch-retry-mintimeout 20000
RUN npm config set fetch-retry-maxtimeout 120000

# Instalar dependencias como root
RUN npm install --only=production --no-optional --no-audit

# Copiar código fuente
COPY . .

# Copiar script de entrada
COPY docker/scripts/entrypoint.sh /entrypoint.sh

# Crear TODOS los directorios y establecer permisos EN UNA SOLA OPERACIÓN
RUN mkdir -p uploads tmp logs public && \
    chmod +x /entrypoint.sh && \
    chown -R artesa:artesa /app && \
    chown artesa:artesa /entrypoint.sh

# Generar documentación Swagger como usuario artesa
USER artesa
RUN npm run generate-swagger

# Volver a root para limpiar caché
USER root
RUN npm cache clean --force

# Cambiar definitivamente a usuario no-root
USER artesa

# Exponer puerto de la aplicación
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Comando de entrada
ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "start"]