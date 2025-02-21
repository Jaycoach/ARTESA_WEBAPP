const fs = require('fs');
require('dotenv').config();

function generateSwagger() {
  // Lee el swagger template
  const swaggerTemplate = require('./swagger.json');

  // Define los servidores según el ambiente
  const servers = [
    {
      url: process.env.DEV_LOCAL_URL || 'http://localhost:3000',
      description: 'Servidor Local'
    }
  ];

  // Agregar Ngrok URL si está disponible
  if (process.env.DEV_NGROK_URL) {
    servers.push({
      url: process.env.DEV_NGROK_URL,
      description: 'Servidor Ngrok'
    });
  }

  // Actualiza los servidores en el template
  swaggerTemplate.servers = servers;

  // Asegúrate que las rutas tengan el prefijo /api correcto
  const newPaths = {};
  Object.keys(swaggerTemplate.paths).forEach(path => {
    const normalizedPath = path.startsWith('/api') ? path : `/api${path}`;
    newPaths[normalizedPath] = swaggerTemplate.paths[path];
  });
  swaggerTemplate.paths = newPaths;

  // Guarda el archivo actualizado
  fs.writeFileSync(
    './swagger.json',
    JSON.stringify(swaggerTemplate, null, 2)
  );

  console.log('Swagger file generated successfully');
  console.log('Servers configured:', servers);
}

generateSwagger();