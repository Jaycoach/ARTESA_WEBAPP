// Opciones de express-fileupload para el banner del portal (POST /api/admin/settings
// y su equivalente del BackOffice, POST /api/backoffice/settings).
// NO es la misma configuración que app.js:158-168 (esa es de /upload, /client-profiles,
// /images — 10MB, con parseNested/safeFileNames/debug). Mismo nombre de librería,
// configuraciones deliberadamente distintas para rutas distintas; no se unifican.
module.exports = {
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  useTempFiles: true,
  tempFileDir: './tmp/',
  createParentPath: true,
  abortOnLimit: true,
  responseOnLimit: 'El archivo excede el límite de 5MB.'
};
