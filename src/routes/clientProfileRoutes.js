// src/routes/clientProfileRoutes.js
const express = require('express');
const router = express.Router();
const clientProfileController = require('../controllers/clientProfileController');
const { verifyToken, checkRole } = require('../middleware/auth');
const { sanitizeParams } = require('../middleware/security');

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
 * components:
 *   schemas:
 *     ClientProfile:
 *       type: object
 *       properties:
 *         client_id:
 *           type: integer
 *           description: ID único del perfil de cliente
 *           example: 1
 *         user_id:
 *           type: integer
 *           description: ID del usuario asociado
 *           example: 5
 *         razonSocial:
 *           type: string
 *           description: Razón social de la empresa
 *           example: Empresa ABC
 *         nombre:
 *           type: string
 *           description: Nombre del contacto
 *           example: Juan Pérez
 *         telefono:
 *           type: string
 *           description: Teléfono de contacto
 *           example: "+57 3001234567"
 *         email:
 *           type: string
 *           format: email
 *           description: Email de contacto
 *           example: contacto@empresaabc.com
 *         direccion:
 *           type: string
 *           description: Dirección física
 *           example: Calle 123 #45-67
 *         ciudad:
 *           type: string
 *           description: Ciudad
 *           example: Bogotá
 *         pais:
 *           type: string
 *           description: País
 *           example: Colombia
 *         nit:
 *           type: string
 *           description: Identificación fiscal
 *           example: "901234567-8"
 *         tipoDocumento:
 *           type: string
 *           enum: [CC, CE, PASAPORTE]
 *           description: Tipo de documento de identidad
 *           example: CC
 *         numeroDocumento:
 *           type: string
 *           description: Número de documento
 *           example: "1234567890"
 *         representanteLegal:
 *           type: string
 *           description: Representante legal
 *           example: María Rodríguez
 *         actividadComercial:
 *           type: string
 *           description: Actividad comercial
 *           example: Venta al por mayor
 *         sectorEconomico:
 *           type: string
 *           description: Sector económico
 *           example: Comercio
 *         tamanoEmpresa:
 *           type: string
 *           enum: [Microempresa, Pequeña, Mediana, Grande]
 *           description: Tamaño de la empresa
 *           example: Pequeña
 *         ingresosMensuales:
 *           type: string
 *           description: Ingresos mensuales promedio
 *           example: "$10,000,000"
 *         patrimonio:
 *           type: string
 *           description: Patrimonio
 *           example: "$50,000,000"
 *         entidadBancaria:
 *           type: string
 *           description: Entidad bancaria
 *           example: Bancolombia
 *         tipoCuenta:
 *           type: string
 *           enum: [Ahorros, Corriente]
 *           description: Tipo de cuenta bancaria
 *           example: Corriente
 *         numeroCuenta:
 *           type: string
 *           description: Número de cuenta bancaria
 *           example: "123456789"
 *         nombreContacto:
 *           type: string
 *           description: Nombre del contacto alternativo
 *           example: Pedro Gómez
 *         cargoContacto:
 *           type: string
 *           description: Cargo del contacto alternativo
 *           example: Gerente Financiero
 *         telefonoContacto:
 *           type: string
 *           description: Teléfono del contacto alternativo
 *           example: "+57 3009876543"
 *         emailContacto:
 *           type: string
 *           format: email
 *           description: Email del contacto alternativo
 *           example: pedro@empresaabc.com
 *         fotocopiaCedula:
 *           type: string
 *           description: Ruta de archivo de la fotocopia de cédula
 *           example: "abc123.pdf"
 *         fotocopiaRut:
 *           type: string
 *           description: Ruta de archivo de la fotocopia del RUT
 *           example: "def456.pdf"
 *         anexosAdicionales:
 *           type: string
 *           description: Ruta de archivo de anexos adicionales
 *           example: "ghi789.pdf"
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Fecha de creación del perfil
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Fecha de última actualización
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ClientProfile'
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido - No tiene permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
router.get('/', 
  verifyToken, 
  checkRole([1]), // Solo administradores
  clientProfileController.getAllProfiles
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ClientProfile'
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Perfil no encontrado
 *       500:
 *         description: Error interno del servidor
 */
router.get('/user/:userId', 
  verifyToken, 
  clientProfileController.getProfileByUserId
);

/**
 * @swagger
 * /api/client-profiles:
 *   post:
 *     summary: Crear un nuevo perfil de cliente
 *     description: Crea un nuevo perfil de cliente en el sistema con todos los campos opcionales
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
 *               razonSocial:
 *                 type: string
 *                 description: Razón social de la empresa
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
 *                   $ref: '#/components/schemas/ClientProfile'
 *       400:
 *         description: Datos inválidos o el usuario ya tiene un perfil
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
router.post('/', 
  verifyToken,
  clientProfileController.createProfile
);

/**
 * @swagger
 * /api/client-profiles/user/{userId}:
 *   put:
 *     summary: Actualizar perfil de cliente por ID de usuario
 *     description: Actualiza los datos de un perfil de cliente existente usando ID de usuario
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
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               razonSocial:
 *                 type: string
 *                 description: Razón social de la empresa
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
 *               nit:
 *                 type: string
 *                 description: NIT de la empresa
 *               nit_number:
 *                 type: string
 *                 description: Número de NIT sin dígito de verificación
 *                 example: "901234567"
 *               verification_digit:
 *                 type: string
 *                 description: Dígito de verificación del NIT
 *                 example: "8"
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
 *                   $ref: '#/components/schemas/ClientProfile'
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Perfil no encontrado
 *       500:
 *         description: Error interno del servidor
 */
router.put('/user/:userId', 
  verifyToken,
  clientProfileController.updateProfileByUserId
);

/**
 * @swagger
 * /api/client-profiles/user/{userId}:
 *   delete:
 *     summary: Eliminar perfil de cliente por ID de usuario
 *     description: Elimina un perfil de cliente del sistema usando ID de usuario
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
 *                   $ref: '#/components/schemas/ClientProfile'
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido - No tiene permisos suficientes
 *       404:
 *         description: Perfil no encontrado
 *       500:
 *         description: Error interno del servidor
 */
router.delete('/user/:userId', 
  verifyToken,
  checkRole([1]), // Solo administradores pueden eliminar
  clientProfileController.deleteProfileByUserId
);
/**
 * @swagger
 * /api/client-profiles/user/{userId}/documents:
 *   get:
 *     summary: Listar documentos disponibles del perfil
 *     description: Obtiene la lista de documentos disponibles para un perfil de cliente
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
 *         description: Lista de documentos obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     cedula:
 *                       type: object
 *                       properties:
 *                         available:
 *                           type: boolean
 *                         downloadUrl:
 *                           type: string
 *                     rut:
 *                       type: object
 *                       properties:
 *                         available:
 *                           type: boolean
 *                         downloadUrl:
 *                           type: string
 *                     anexos:
 *                       type: object
 *                       properties:
 *                         available:
 *                           type: boolean
 *                         downloadUrl:
 *                           type: string
 */
router.get('/user/:userId/documents', 
  verifyToken,
  clientProfileController.listDocuments
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
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Archivo no encontrado
 *       500:
 *         description: Error interno del servidor
 */
router.get('/user/:userId/file/:fileType',
  verifyToken,
  clientProfileController.getFileByUserId
);
/**
 * @swagger
 * /api/client-profiles/user/{userId}/download/{fileType}:
 *   get:
 *     summary: Descarga directa de documento
 *     description: Descarga el contenido del documento directamente sin redirección
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
 *         description: Tipo de archivo a descargar
 *     responses:
 *       200:
 *         description: Archivo descargado exitosamente
 */
router.get('/user/:userId/download/:fileType',
  verifyToken,
  clientProfileController.downloadDocument
);

/**
 * @swagger
 * /api/client-profiles/{userId}/documents/{documentType}:
 *   post:
 *     summary: Subir documento de perfil
 *     description: Sube un documento al perfil de cliente (cédula, RUT, anexos)
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
 *         name: documentType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [cedula, rut, anexos]
 *         description: Tipo de documento
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - document
 *             properties:
 *               document:
 *                 type: string
 *                 format: binary
 *                 description: Archivo a subir
 *     responses:
 *       200:
 *         description: Documento subido exitosamente
 */
router.post('/:userId/documents/:documentType',
  verifyToken,
  clientProfileController.uploadProfileDocument
);

// RUTA TEMPORAL PARA DEBUGGING - REMOVER DESPUÉS
router.post('/debug/test-sap-sync', verifyToken, async (req, res) => {
  const logger = require('../config/logger').createContextLogger('DebugSAPSync');
  
  try {
    console.log('\n=== INICIO TEST SAP SYNC ===');
    console.log('Body recibido:', JSON.stringify(req.body, null, 2));
    console.log('Usuario autenticado:', req.user);
    
    const testProfile = {
      client_id: req.body.client_id || 999999,
      user_id: req.body.user_id || req.user.id,
      razonSocial: req.body.razonSocial || 'EMPRESA TEST DEBUG',
      nombre: req.body.nombre || 'CONTACTO TEST',
      telefono: req.body.telefono || '1234567890',
      email: req.body.email || 'test@debug.com',
      direccion: req.body.direccion || 'CALLE TEST 123',
      nit_number: req.body.nit_number || '123456789',
      verification_digit: req.body.verification_digit || 1
    };
    
    console.log('Perfil de prueba creado:', JSON.stringify(testProfile, null, 2));
    
    // Importar correctamente el sapServiceManager
    const sapServiceManager = require('../services/SapServiceManager');
    console.log('sapServiceManager importado:', !!sapServiceManager);
    console.log('sapServiceManager.initialized:', sapServiceManager.initialized);
    
    if (!sapServiceManager.initialized) {
      console.log('Inicializando SAP Service Manager...');
      await sapServiceManager.initialize();
      console.log('SAP Service Manager inicializado:', sapServiceManager.initialized);
    }
    
    console.log('Llamando a createOrUpdateLead...');
    const result = await sapServiceManager.createOrUpdateLead(testProfile);
    
    console.log('Resultado final:', JSON.stringify(result, null, 2));
    console.log('=== FIN TEST SAP SYNC ===\n');
    
    res.json({
      success: true,
      message: 'Test de sincronización completado',
      testProfile,
      sapResult: result
    });
    
  } catch (error) {
    console.log('ERROR en test:', error.message);
    console.log('Stack:', error.stack);
    
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Diagnóstico básico de SAP
router.post('/debug/sap-connection', verifyToken, async (req, res) => {
  try {
    const sapServiceManager = require('../services/SapServiceManager');
    
    const diagnostics = {
      step1_serviceManagerExists: !!sapServiceManager,
      step2_initialized: sapServiceManager.initialized,
      step3_clientServiceExists: !!sapServiceManager.clientService,
      step4_environmentVars: {
        SAP_SERVICE_LAYER_URL: !!process.env.SAP_SERVICE_LAYER_URL,
        SAP_DATABASE: !!process.env.SAP_DATABASE,
        SAP_USERNAME: !!process.env.SAP_USERNAME,
        SAP_PASSWORD: !!process.env.SAP_PASSWORD
      }
    };
    
    if (!sapServiceManager.initialized) {
      await sapServiceManager.initialize();
      diagnostics.step5_afterInitialization = sapServiceManager.initialized;
      diagnostics.step6_clientServiceAfterInit = !!sapServiceManager.clientService;
      diagnostics.step7_sessionExists = !!sapServiceManager.clientService?.sessionId;
    }
    
    res.json({
      success: true,
      diagnostics
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Test de creación de Lead en SAP únicamente
router.post('/debug/sap-lead-only', verifyToken, async (req, res) => {
  try {
    const testProfile = {
      client_id: 99999,
      user_id: req.user.id,
      razonSocial: 'TEST EMPRESA DEPURACION',
      nombre: 'TEST CONTACTO',
      telefono: '3001234567',
      email: 'test@depuracion.com',
      direccion: 'CALLE TEST 123',
      nit_number: '900123456',
      verification_digit: '1'
    };
    
    const sapServiceManager = require('../services/SapServiceManager');
    
    if (!sapServiceManager.initialized) {
      await sapServiceManager.initialize();
    }
    
    const sapResult = await sapServiceManager.clientService.createOrUpdateBusinessPartnerLead(testProfile);
    
    res.json({
      success: true,
      testProfile,
      sapResult,
      analysis: {
        sapResultExists: !!sapResult,
        hasSuccess: sapResult?.success,
        hasCardCode: !!sapResult?.cardCode,
        hasError: !!sapResult?.error
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      sapError: true
    });
  }
});

// Verificar qué GroupCode está usando actualmente
router.get('/debug/sap-groupcode', verifyToken, async (req, res) => {
  try {
    const testProfile = {
      nit_number: '900123456',
      verification_digit: '1'
    };
    
    const groupCode = parseInt(process.env.SAP_INSTITUTIONAL_GROUP_CODE) || 120;
    
    res.json({
      success: true,
      environment: {
        SAP_INSTITUTIONAL_GROUP_CODE: process.env.SAP_INSTITUTIONAL_GROUP_CODE,
        parsed_group_code: groupCode,
        default_fallback: 120
      },
      mock_business_partner: {
        GroupCode: groupCode,
        CardCode: `CI${testProfile.nit_number}`,
        CardType: 'cLid'
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;