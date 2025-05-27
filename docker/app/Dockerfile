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

# Instalar dependencias como root, luego cambiar permisos
RUN npm ci --only=production && \
    npm cache clean --force && \
    chown -R artesa:artesa /app

# Cambiar a usuario no-root
USER artesa

# Copiar código fuente (excluyendo archivos innecesarios via .dockerignore)
COPY --chown=artesa:artesa . .

# Crear directorios necesarios
RUN mkdir -p uploads tmp logs && \
    chmod 755 uploads tmp logs

# Generar documentación Swagger
RUN npm run generate-swagger

# Exponer puerto de la aplicación
EXPOSE 3000

# Usar script de entrada personalizado
COPY docker/scripts/entrypoint.sh /app/docker/scripts/entrypoint.sh
USER root
RUN chmod +x /entrypoint.sh
USER artesa

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Comando de entrada
ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "start"]