// src/routes/clientProfileRoutes.js - Versión completa
const express = require('express');
const router = express.Router();
const clientProfileController = require('../controllers/clientProfileController');
const { verifyToken, checkRole } = require('../middleware/auth');
const { sanitizeParams } = require('../middleware/security');
const fileUpload = require('express-fileupload');

// Middleware para manejar la subida de archivos
router.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 }, // Límite de 10MB
  useTempFiles: false,
  abortOnLimit: true,
  responseOnLimit: "Archivo demasiado grande. El límite es de 10MB."
}));

// Aplicar middleware de sanitización a todas las rutas
router.use(sanitizeParams);

/**
 * @swagger
 * tags:
 *   name: ClientProfiles
 *   description: Endpoints para gestión de perfiles de clientes
 */

/**
 * @swagger
 * /api/client-profiles:
 *   get:
 *     summary: Obtener todos los perfiles de clientes
 *     description: Recupera la lista de todos los perfiles de clientes (requiere rol de administrador)
 *     tags: [ClientProfiles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de perfiles recuperada exitosamente
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido - No tiene permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
router.get('/client-profiles', 
  verifyToken, 
  checkRole([1]), // Solo administradores
  clientProfileController.getAllProfiles
);

/**
 * @swagger
 * /api/client-profiles/{id}:
 *   get:
 *     summary: Obtener perfil de cliente por ID
 *     description: Recupera los detalles de un perfil de cliente específico
 *     tags: [ClientProfiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del perfil de cliente
 *     responses:
 *       200:
 *         description: Perfil recuperado exitosamente
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Perfil no encontrado
 *       500:
 *         description: Error interno del servidor
 */
router.get('/client-profiles/:id', 
  verifyToken, 
  clientProfileController.getProfileById
);

/**
 * @swagger
 * /api/client-profiles/user/{userId}:
 *   get:
 *     summary: Obtener perfil de cliente por ID de usuario
 *     description: Recupera los detalles del perfil de un cliente por su ID de usuario
 *     tags: [ClientProfiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Perfil recuperado exitosamente
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Perfil no encontrado
 *       500:
 *         description: Error interno del servidor
 */
router.get('/client-profiles/user/:userId', 
  verifyToken, 
  clientProfileController.getProfileByUserId
);

/**
 * @swagger
 * /api/client-profiles:
 *   post:
 *     summary: Crear un nuevo perfil de cliente
 *     description: Crea un nuevo perfil de cliente en el sistema con todos los campos del formulario
 *     tags: [ClientProfiles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: ID del usuario asociado
 *               nombre:
 *                 type: string
 *                 description: Nombre completo
 *               tipoDocumento:
 *                 type: string
 *                 enum: [CC, CE, PASAPORTE]
 *                 description: Tipo de documento de identidad
 *               numeroDocumento:
 *                 type: string
 *                 description: Número de documento
 *               direccion:
 *                 type: string
 *                 description: Dirección física
 *               ciudad:
 *                 type: string
 *                 description: Ciudad
 *               pais:
 *                 type: string
 *                 description: País
 *                 default: Colombia
 *               telefono:
 *                 type: string
 *                 description: Teléfono de contacto
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Correo electrónico
 *               razonSocial:
 *                 type: string
 *                 description: Razón social de la empresa
 *               nit:
 *                 type: string
 *                 description: NIT de la empresa
 *               representanteLegal:
 *                 type: string
 *                 description: Representante legal
 *               actividadComercial:
 *                 type: string
 *                 description: Actividad comercial
 *               sectorEconomico:
 *                 type: string
 *                 description: Sector económico
 *               tamanoEmpresa:
 *                 type: string
 *                 enum: [Microempresa, Pequeña, Mediana, Grande]
 *                 description: Tamaño de la empresa
 *               ingresosMensuales:
 *                 type: string
 *                 description: Ingresos mensuales promedio
 *               patrimonio:
 *                 type: string
 *                 description: Patrimonio
 *               entidadBancaria:
 *                 type: string
 *                 description: Entidad bancaria
 *               tipoCuenta:
 *                 type: string
 *                 enum: [Ahorros, Corriente]
 *                 description: Tipo de cuenta bancaria
 *               numeroCuenta:
 *                 type: string
 *                 description: Número de cuenta bancaria
 *               nombreContacto:
 *                 type: string
 *                 description: Nombre del contacto alternativo
 *               cargoContacto:
 *                 type: string
 *                 description: Cargo del contacto alternativo
 *               telefonoContacto:
 *                 type: string
 *                 description: Teléfono del contacto alternativo
 *               emailContacto:
 *                 type: string
 *                 format: email
 *                 description: Email del contacto alternativo
 *               fotocopiaCedula:
 *                 type: string
 *                 format: binary
 *                 description: Fotocopia de la cédula
 *               fotocopiaRut:
 *                 type: string
 *                 format: binary
 *                 description: Fotocopia del RUT
 *               anexosAdicionales:
 *                 type: string
 *                 format: binary
 *                 description: Anexos adicionales
 *     responses:
 *       201:
 *         description: Perfil creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Perfil de cliente creado exitosamente
 *                 data:
 *                   type: object
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
router.post('/client-profiles', 
  verifyToken,
  clientProfileController.createProfile
);

/**
 * @swagger
 * /api/client-profiles/{id}:
 *   put:
 *     summary: Actualizar perfil de cliente
 *     description: Actualiza los datos de un perfil de cliente existente
 *     tags: [ClientProfiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del perfil de cliente
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *                 description: Nombre completo
 *               tipoDocumento:
 *                 type: string
 *                 enum: [CC, CE, PASAPORTE]
 *                 description: Tipo de documento de identidad
 *               numeroDocumento:
 *                 type: string
 *                 description: Número de documento
 *               direccion:
 *                 type: string
 *                 description: Dirección física
 *               ciudad:
 *                 type: string
 *                 description: Ciudad
 *               pais:
 *                 type: string
 *                 description: País
 *               telefono:
 *                 type: string
 *                 description: Teléfono de contacto
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Correo electrónico
 *               razonSocial:
 *                 type: string
 *                 description: Razón social de la empresa
 *               nit:
 *                 type: string
 *                 description: NIT de la empresa
 *               representanteLegal:
 *                 type: string
 *                 description: Representante legal
 *               actividadComercial:
 *                 type: string
 *                 description: Actividad comercial
 *               sectorEconomico:
 *                 type: string
 *                 description: Sector económico
 *               tamanoEmpresa:
 *                 type: string
 *                 enum: [Microempresa, Pequeña, Mediana, Grande]
 *                 description: Tamaño de la empresa
 *               ingresosMensuales:
 *                 type: string
 *                 description: Ingresos mensuales promedio
 *               patrimonio:
 *                 type: string
 *                 description: Patrimonio
 *               entidadBancaria:
 *                 type: string
 *                 description: Entidad bancaria
 *               tipoCuenta:
 *                 type: string
 *                 enum: [Ahorros, Corriente]
 *                 description: Tipo de cuenta bancaria
 *               numeroCuenta:
 *                 type: string
 *                 description: Número de cuenta bancaria
 *               nombreContacto:
 *                 type: string
 *                 description: Nombre del contacto alternativo
 *               cargoContacto:
 *                 type: string
 *                 description: Cargo del contacto alternativo
 *               telefonoContacto:
 *                 type: string
 *                 description: Teléfono del contacto alternativo
 *               emailContacto:
 *                 type: string
 *                 format: email
 *                 description: Email del contacto alternativo
 *               fotocopiaCedula:
 *                 type: string
 *                 format: binary
 *                 description: Fotocopia de la cédula
 *               fotocopiaRut:
 *                 type: string
 *                 format: binary
 *                 description: Fotocopia del RUT
 *               anexosAdicionales:
 *                 type: string
 *                 format: binary
 *                 description: Anexos adicionales
 *     responses:
 *       200:
 *         description: Perfil actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Perfil de cliente actualizado exitosamente
 *                 data:
 *                   type: object
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Perfil no encontrado
 *       500:
 *         description: Error interno del servidor
 */
router.put('/client-profiles/:id', 
  verifyToken,
  clientProfileController.updateProfile
);

/**
 * @swagger
 * /api/client-profiles/{id}:
 *   delete:
 *     summary: Eliminar perfil de cliente
 *     description: Elimina un perfil de cliente del sistema
 *     tags: [ClientProfiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del perfil de cliente
 *     responses:
 *       200:
 *         description: Perfil eliminado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Perfil de cliente eliminado exitosamente
 *                 data:
 *                   type: object
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido - No tiene permisos suficientes
 *       404:
 *         description: Perfil no encontrado
 *       500:
 *         description: Error interno del servidor
 */
router.delete('/client-profiles/:id', 
  verifyToken,
  clientProfileController.deleteProfile
);

/**
 * @swagger
 * /api/client-profiles/{id}/file/{fileType}:
 *   get:
 *     summary: Obtener archivo de perfil de cliente
 *     description: Recupera un archivo asociado al perfil de cliente (cédula, RUT o anexos)
 *     tags: [ClientProfiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del perfil de cliente
 *       - in: path
 *         name: fileType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [cedula, rut, anexos]
 *         description: Tipo de archivo a obtener
 *     responses:
 *       200:
 *         description: Archivo recuperado exitosamente
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Archivo no encontrado
 *       500:
 *         description: Error interno del servidor
 */
router.get('/client-profiles/:id/file/:fileType',
  verifyToken,
  clientProfileController.getFile
);

/**
 * @swagger
 * /api/client-profiles/user/{userId}/file/{fileType}:
 *   get:
 *     summary: Obtener archivo de perfil de cliente por ID de usuario
 *     description: Recupera un archivo asociado al perfil de cliente por ID de usuario
 *     tags: [ClientProfiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario
 *       - in: path
 *         name: fileType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [cedula, rut, anexos]
 *         description: Tipo de archivo a obtener
 *     responses:
 *       200:
 *         description: Archivo recuperado exitosamente
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Archivo no encontrado
 *       500:
 *         description: Error interno del servidor
 */
router.get('/client-profiles/user/:userId/file/:fileType',
  verifyToken,
  clientProfileController.getFileByUserId
);

module.exports = router;