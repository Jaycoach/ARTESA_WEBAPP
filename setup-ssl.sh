#!/bin/bash
# setup-ssl.sh

echo "Creando directorio SSL..."
mkdir -p ssl

echo "Generando certificado SSL auto-firmado..."
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ssl/nginx.key \
    -out ssl/nginx.crt \
    -subj "/C=CO/ST=Bogota/L=Bogota/O=LaArtesa/OU=IT/CN=ec2-44-216-131-63.compute-1.amazonaws.com"

echo "Configurando permisos..."
chmod 600 ssl/nginx.key
chmod 644 ssl/nginx.crt

echo "Certificado SSL creado exitosamente en ./ssl/"
ls -la ssl/
