// src/controllers/clientProfileController.js
const pool = require('../config/db');
const { createContextLogger } = require('../config/logger');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ClientProfile = require('../models/clientProfile');
const S3Service = require('../services/S3Service');
const sapServiceManager = require('../services/SapServiceManager');

// Crear una instancia del logger con contexto
const logger = createContextLogger('ClientProfileController');

// Directorio donde se guardarán los archivos subidos
const uploadDir = path.join(__dirname, '../uploads/client-profiles');

// Asegurarse de que el directorio existe
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Guarda un archivo en el sistema y devuelve el nombre único generado
 * @param {Object} file - Objeto de archivo de express-fileupload
 * @returns {Promise<string|null>} - Nombre del archivo guardado o null si no hay archivo
 */
const saveFile = async (file, userId, documentType) => {
  if (!file) return null;
  
  try {
    // Estrategia mejorada para manejar posibles arrays
    const fileToSave = Array.isArray(file) ? file[0] : file;
    
    logger.debug('Procesando archivo para guardar', {
      name: fileToSave.name,
      size: fileToSave.size,
      mimetype: fileToSave.mimetype,
      userId,
      documentType
    });
    
    // Validar el archivo
    const allowedMimeTypes = [
      'application/pdf', 
      'image/jpeg', 
      'image/png', 
      'image/gif',
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (!allowedMimeTypes.includes(fileToSave.mimetype)) {
      logger.warn('Tipo de archivo no permitido', {
        fileName: fileToSave.name,
        mimeType: fileToSave.mimetype
      });
      throw new Error(`Tipo de archivo no permitido: ${fileToSave.mimetype}`);
    }
    
    // Generar nombre único
    const fileExtension = path.extname(fileToSave.name) || '.bin';
    const fileNameSafe = `${Date.now()}${fileExtension}`;
    
    // Definir la clave para S3 o la ruta local
    const key = `client-profiles/${userId}/${documentType}/${fileNameSafe}`;

    // Determinar si usamos S3 o almacenamiento local
    if (process.env.STORAGE_MODE === 's3') {
      // Subir a S3 con configuración de privacidad
      return await S3Service.uploadFormFile(fileToSave, key, {
        public: false, // Documentos privados, requieren URL firmada
        contentType: fileToSave.mimetype
      });
    } else {
      // Modo local (comportamiento original)
      const filePath = path.join(uploadDir, fileNameSafe);
      
      // Si estamos usando tempFiles, hay que mover el archivo
      if (fileToSave.tempFilePath) {
        // Asegurarse de que el directorio existe
        const fileDir = path.dirname(filePath);
        if (!fs.existsSync(fileDir)) {
          fs.mkdirSync(fileDir, { recursive: true });
        }
        
        fs.renameSync(fileToSave.tempFilePath, filePath);
      } else {
        // Mover el archivo a la ubicación final usando mv()
        await fileToSave.mv(filePath);
      }
      
      logger.info('Archivo guardado localmente', {
        originalName: fileToSave.name,
        newFileName: fileNameSafe,
        fileSize: fileToSave.size,
        filePath
      });

      // Devolver la ruta relativa para almacenamiento local
      return fileNameSafe;
    }
  } catch (error) {
    logger.error('Error al guardar archivo', {
      error: error.message,
      fileName: file.name,
      fileSize: file.size,
      stack: error.stack
    });
    throw error;
  }
};

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
 *         fotocopiaCedulaUrl:
 *           type: string
 *           description: URL para acceder a la fotocopia de cédula
 *           example: "http://example.com/api/client-profiles/1/file/cedula"
 *         fotocopiaRut:
 *           type: string
 *           description: Ruta de archivo de la fotocopia del RUT
 *           example: "def456.pdf"
 *         fotocopiaRutUrl:
 *           type: string
 *           description: URL para acceder a la fotocopia del RUT
 *           example: "http://example.com/api/client-profiles/1/file/rut"
 *         anexosAdicionales:
 *           type: string
 *           description: Ruta de archivo de anexos adicionales
 *           example: "ghi789.pdf"
 *         anexosAdicionalesUrl:
 *           type: string
 *           description: URL para acceder a los anexos adicionales
 *           example: "http://example.com/api/client-profiles/1/file/anexos"
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Fecha de creación del perfil
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Fecha de última actualización
 */
class ClientProfileController {
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
  async getAllProfiles(req, res) {
    try {
      logger.debug('Obteniendo todos los perfiles de clientes');
      
      const profiles = await ClientProfile.getAll();
      
      // Agregar URLs para archivos
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const profilesWithUrls = profiles.map(profile => {
        const result = { ...profile };
        
        if (result.fotocopiaCedula) {
          result.fotocopiaCedulaUrl = `${baseUrl}/api/client-profiles/${profile.user_id}/file/cedula`;
        }
        
        if (result.fotocopiaRut) {
          result.fotocopiaRutUrl = `${baseUrl}/api/client-profiles/${profile.user_id}/file/rut`;
        }
        
        if (result.anexosAdicionales) {
          result.anexosAdicionalesUrl = `${baseUrl}/api/client-profiles/${profile.user_id}/file/anexos`;
        }
        
        return result;
      });
      
      res.status(200).json({
        success: true,
        data: profilesWithUrls
      });
    } catch (error) {
      logger.error('Error al obtener perfiles de clientes', {
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al obtener perfiles de clientes',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * @swagger
   * /api/client-profiles/user/{userId}:
   *   get:
   *     summary: Obtener perfil de cliente por ID
   *     description: Recupera los detalles de un perfil de cliente específico
   *     tags: [ClientProfiles]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: userId
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
  async getProfileByUserId(req, res) {
    try {
      const { userId } = req.params;
      
      logger.debug('Obteniendo perfil de cliente por ID', { userId });
      
      const profile = await ClientProfile.getByUserId(userId);
      
      if (!profile) {
        logger.warn('Perfil de cliente no encontrado', { userId });
        return res.status(404).json({
          success: false,
          message: 'Perfil de cliente no encontrado'
        });
      }
      
      // Agregar URLs para archivos
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      if (profile.fotocopiaCedula) {
        profile.fotocopiaCedulaUrl = `${baseUrl}/api/client-profiles/${userId}/file/cedula`;
      }
      
      if (profile.fotocopiaRut) {
        profile.fotocopiaRutUrl = `${baseUrl}/api/client-profiles/${userId}/file/rut`;
      }
      
      if (profile.anexosAdicionales) {
        profile.anexosAdicionalesUrl = `${baseUrl}/api/client-profiles/${userId}/file/anexos`;
      }
      
      // Procesar correctamente los datos adicionales en el campo notes
      if (profile.notes && typeof profile.notes === 'string' && profile.notes.startsWith('{')) {
        try {
          // Crear un objeto para almacenar los datos adicionales
          const notesData = JSON.parse(profile.notes);
          
          // Almacenar todos los datos adicionales en additionalInfo
          profile.additionalInfo = { ...notesData };
          
          // IMPORTANTE: No permitir que campos críticos se sobrescriban
          // Los campos críticos de la base de datos tienen prioridad
          const criticalFields = ['nit_number', 'verification_digit', 'cardcode_sap', 'clientprofilecode_sap'];
          criticalFields.forEach(field => {
            // Si existe en los datos adicionales pero ya está en el perfil, eliminar del objeto adicional
            if (field in notesData && profile[field] !== undefined && profile[field] !== null) {
              delete profile.additionalInfo[field]; // Eliminar del additionalInfo
            }
          });
        } catch (e) {
          logger.warn('Error al parsear campo notes JSON', { 
            error: e.message, 
            userId,
            notes: profile.notes.substring(0, 100) // Log primeros 100 caracteres 
          });
        }
      }
      
      res.status(200).json({
        success: true,
        data: profile
      });
    } catch (error) {
      logger.error('Error al obtener perfil de cliente', {
        error: error.message,
        stack: error.stack,
        profileId: req.params.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al obtener perfil de cliente',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

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
 *               telefono:
 *                 type: string
 *                 description: Teléfono de contacto
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Correo electrónico
 *               direccion:
 *                 type: string
 *                 description: Dirección física
 *               ciudad:
 *                 type: string
 *                 description: Ciudad
 *               pais:
 *                 type: string
 *                 description: País
 *               nit:
 *                 type: string
 *                 description: NIT o identificación fiscal
 *               tipoDocumento:
 *                 type: string
 *                 enum: [CC, CE, PASAPORTE]
 *                 description: Tipo de documento
 *               numeroDocumento:
 *                 type: string
 *                 description: Número de documento
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
  async createProfile(req, res) {
    try {
      logger.debug('Headers de la solicitud:', {
        contentType: req.headers['content-type'],
        contentLength: req.headers['content-length']
      });
      // Depuración inicial
      logger.debug('Recibiendo datos para perfil de cliente', { 
        bodyFields: Object.keys(req.body),
        bodyContent: JSON.stringify(req.body).substring(0, 1000), // Muestra los primeros 1000 caracteres
        filesExist: !!req.files,
        filesKeys: req.files ? Object.keys(req.files) : [],
        filesInfo: req.files ? Object.keys(req.files).map(key => ({
          key,
          name: req.files[key].name,
          size: req.files[key].size,
          mimetype: req.files[key].mimetype
        })) : []
      });
      
      // Extraer datos de la solicitud - usar solo campos camelCase
      const clientData = {};
      
      // Mapear campos específicos para evitar duplicidad
      const fieldMap = {
        // Campos básicos
        'userId': 'userId',
        'razonSocial': 'razonSocial',
        'nombre': 'nombre',
        'telefono': 'telefono',
        'email': 'email',
        'direccion': 'direccion', 
        'ciudad': 'ciudad',
        'pais': 'pais',
        'nit': 'nit',
        'nit_number': 'nit_number',
        'verification_digit': 'verification_digit',
        
        // Campos adicionales
        'tipoDocumento': 'tipoDocumento',
        'numeroDocumento': 'numeroDocumento',
        'representanteLegal': 'representanteLegal',
        'actividadComercial': 'actividadComercial',
        'sectorEconomico': 'sectorEconomico',
        'tamanoEmpresa': 'tamanoEmpresa',
        'ingresosMensuales': 'ingresosMensuales',
        'patrimonio': 'patrimonio',
        'entidadBancaria': 'entidadBancaria',
        'tipoCuenta': 'tipoCuenta',
        'numeroCuenta': 'numeroCuenta',
        'nombreContacto': 'nombreContacto',
        'cargoContacto': 'cargoContacto',
        'telefonoContacto': 'telefonoContacto',
        'emailContacto': 'emailContacto',
        
        // Compatibilidad hacia atrás con campos en snake_case
        'company_name': 'razonSocial',
        'contact_name': 'nombre',
        'contact_phone': 'telefono',
        'contact_email': 'email',
        'address': 'direccion',
        'city': 'ciudad',
        'country': 'pais',
        'tax_id': 'nit',
        'price_list': 'listaPrecios',
        'notes': 'notas',
        'fotocopia_cedula': 'fotocopiaCedula',
        'fotocopia_rut': 'fotocopiaRut',
        'anexos_adicionales': 'anexosAdicionales'
      };

      // Extraer campos adicionales (que no son parte del modelo pero se quieren almacenar)
      const additionalFields = {};
        
      // Iterar sobre req.body para encontrar campos que no están en el mapeo estándar
      Object.keys(req.body).forEach(key => {
        if (!fieldMap[key] && req.body[key] !== undefined && req.body[key] !== '') {
          additionalFields[key] = req.body[key];
        }
      });
      
      // Asignar solo los campos que nos interesan
      Object.keys(req.body).forEach(key => {
        if (fieldMap[key] && req.body[key] !== undefined && req.body[key] !== '') {
          clientData[fieldMap[key]] = req.body[key];
        }
      });
      
      // Asegurar que userId sea un entero
      if (clientData.userId) {
        clientData.userId = parseInt(clientData.userId);
      } else if (req.user && req.user.id) {
        // Si no se proporciona userId, usar el del usuario autenticado
        clientData.userId = req.user.id;
      }
      
      logger.debug('Datos procesados para creación de perfil de cliente', { 
        userId: clientData.userId,
        razonSocial: clientData.razonSocial,
        nombre: clientData.nombre,
        processedFields: Object.keys(clientData).length
      });
      
      // Verificar si ya existe un perfil para este usuario
      if (clientData.userId) {
        const hasProfile = await ClientProfile.userHasProfile(clientData.userId);
        
        if (hasProfile) {
          return res.status(400).json({
            success: false,
            message: 'Este usuario ya tiene un perfil, debe actualizarlo'
          });
        }
      }
      
      // Procesar archivos si existen
    try {
      if (req.files) {
        // Mapeo de campos antiguos a nuevos y viceversa
        const fileFieldMap = {
          'fotocopiaCedula': 'fotocopiaCedula',
          'fotocopia_cedula': 'fotocopiaCedula',
          'fotocopiaRut': 'fotocopiaRut',
          'fotocopia_rut': 'fotocopiaRut', 
          'anexosAdicionales': 'anexosAdicionales',
          'anexos_adicionales': 'anexosAdicionales'
        };
        
        // Procesar cada campo de archivo soportado
        for (const field in req.files) {
          if (fileFieldMap[field]) {
            const standardizedField = fileFieldMap[field];
            // Determinar el tipo de documento para la ruta
            const docType = standardizedField === 'fotocopiaCedula' ? 'cedula' : 
                          standardizedField === 'fotocopiaRut' ? 'rut' : 'anexos';
            
            clientData[standardizedField] = await saveFile(req.files[field], clientData.userId, docType);
          }
        }
      }
    } catch (fileError) {
      logger.error('Error procesando archivos', {
        error: fileError.message,
        stack: fileError.stack
      });
      // Continuamos sin archivos
    }

    // Validar que si se proporciona NIT o dígito de verificación, ambos sean proporcionados
    if ((clientData.nit_number && !clientData.verification_digit) || 
    (!clientData.nit_number && clientData.verification_digit)) {
      return res.status(400).json({
      success: false,
      message: 'Si proporciona el NIT, debe incluir también el dígito de verificación y viceversa'
      });
    }

    // Calcular tax_id a partir de nit_number y verification_digit
    if (clientData.nit_number && clientData.verification_digit) {
      clientData.nit = `${clientData.nit_number}-${clientData.verification_digit}`;
      logger.debug('tax_id calculado a partir de NIT', {
        nit_number: clientData.nit_number,
        verification_digit: clientData.verification_digit,
        tax_id: clientData.nit
      });
    }
      // Verificar que los valores críticos se mantengan intactos
      logger.debug('Valores críticos antes de crear perfil', {
        nit_number: clientData.nit_number,
        verification_digit: clientData.verification_digit,
        nit: clientData.nit
      });
        
      // Iterar sobre req.body para encontrar campos que no están en el mapeo estándar
      Object.keys(req.body).forEach(key => {
        if (!fieldMap[key] && req.body[key] !== undefined && req.body[key] !== '') {
          additionalFields[key] = req.body[key];
        }
      });

      // Asegurar que no hay campos críticos duplicados en notes
      const criticalFields = ['nit_number', 'verification_digit', 'cardcode_sap', 'clientprofilecode_sap'];
      criticalFields.forEach(field => {
        if (field in additionalFields) {
          logger.warn(`Campo crítico "${field}" encontrado en datos adicionales, se usará valor principal`, {
            inAdditional: additionalFields[field],
            inMain: clientData[field]
          });
          delete additionalFields[field];
        }
      });

      // Crear el perfil con datos adicionales almacenados como JSON en notes
      if (Object.keys(additionalFields).length > 0) {
        clientData.notes = JSON.stringify(additionalFields);
      }

      // Crear el perfil
      const profile = await ClientProfile.create(clientData);
      
      // Agregar URLs para archivos en la respuesta
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      if (profile.fotocopiaCedula) {
        profile.fotocopiaCedulaUrl = `${baseUrl}/api/client-profiles/${profile.user_id}/file/cedula`;
      }
      
      if (profile.fotocopiaRut) {
        profile.fotocopiaRutUrl = `${baseUrl}/api/client-profiles/${profile.user_id}/file/rut`;
      }
      
      if (profile.anexosAdicionales) {
        profile.anexosAdicionalesUrl = `${baseUrl}/api/client-profiles/${profile.user_id}/file/anexos`;
      }

      // Verificar si se debe sincronizar con SAP
      if (profile.nit_number && profile.verification_digit) {
        try {
          logger.debug('Intentando sincronizar perfil con SAP', {
            nit_number: profile.nit_number,
            verification_digit: profile.verification_digit,
            client_id: profile.client_id,
            user_id: profile.user_id
          });
          
          // Verificar que el servicio de SAP esté inicializado
          if (!sapServiceManager.initialized) {
            logger.debug('Inicializando servicio de SAP antes de sincronizar');
            await sapServiceManager.initialize();
          }
          
          // Intentar crear en SAP
          const sapResult = await sapServiceManager.createOrUpdateLead(profile)
          
          logger.debug('Resultado de sincronización con SAP', {
            success: sapResult.success,
            cardCode: sapResult.cardCode,
            isNew: sapResult.isNew,
            client_id: profile.client_id
          });
          
          // Actualizar el perfil con la información de SAP
          if (sapResult.success) {
            await pool.query(
              `UPDATE client_profiles 
              SET cardcode_sap = $1, sap_lead_synced = true, updated_at = CURRENT_TIMESTAMP
              WHERE client_id = $2`,
              [sapResult.cardCode, profile.client_id]
            );
            
            // Actualizar objeto para la respuesta
            profile.cardcode_sap = sapResult.cardCode;
            profile.sap_lead_synced = true;
            
            logger.info('Perfil de cliente sincronizado con SAP como Lead', {
              clientId: profile.client_id,
              cardcodeSap: sapResult.cardCode,
              isNew: sapResult.isNew
            });
          }
        } catch (sapError) {
          // No fallamos la creación del perfil si falla SAP, solo logueamos el error
          logger.error('Error al sincronizar perfil con SAP', {
            error: sapError.message,
            stack: sapError.stack,
            clientId: profile.client_id
          });
        }
      }
      
      logger.info('Perfil de cliente creado exitosamente', {
        userId: profile.user_id,
        userId: clientData.userId
      });
      
      res.status(201).json({
        success: true,
        message: 'Perfil de cliente creado exitosamente',
        data: profile
      });
    } catch (error) {
      logger.error('Error al crear perfil de cliente', {
        error: error.message,
        stack: error.stack,
        userId: req.body?.userId
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al crear perfil de cliente',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * @swagger
   * /api/client-profiles/user/{userId}:
   *   put:
   *     summary: Actualizar perfil de cliente
   *     description: Actualiza los datos de un perfil de cliente existente
   *     tags: [ClientProfiles]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: userId
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
   *               company_name:
   *                 type: string
   *                 description: Nombre de la empresa
   *               contact_name:
   *                 type: string
   *                 description: Nombre del contacto
   *               contact_phone:
   *                 type: string
   *                 description: Teléfono de contacto
   *               contact_email:
   *                 type: string
   *                 format: email
   *                 description: Email de contacto
   *               address:
   *                 type: string
   *                 description: Dirección física
   *               city:
   *                 type: string
   *                 description: Ciudad
   *               country:
   *                 type: string
   *                 description: País
   *               tax_id:
   *                 type: string
   *                 description: Identificación fiscal
   *               price_list:
   *                 type: integer
   *                 description: Lista de precios asignada (1, 2 o 3)
   *               notes:
   *                 type: string
   *                 description: Notas adicionales
   *               fotocopia_cedula:
   *                 type: string
   *                 format: binary
   *                 description: Archivo de fotocopia de cédula
   *               fotocopia_rut:
   *                 type: string
   *                 format: binary
   *                 description: Archivo de fotocopia de RUT
   *               anexos_adicionales:
   *                 type: string
   *                 format: binary
   *                 description: Archivos de anexos adicionales
   *     responses:
   *       200:
   *         description: Perfil actualizado exitosamente
   *       400:
   *         description: Datos inválidos
   *       401:
   *         description: No autorizado
   *       403:
   *         description: Prohibido - No tiene permisos suficientes
   *       404:
   *         description: Perfil no encontrado
   *       500:
   *         description: Error interno del servidor
   */
  async updateProfileByUserId(req, res) {
    try {
      const { userId } = req.params;
      
      // Agregar logs para depuración
      logger.debug('Iniciando actualización de perfil de cliente', { 
        userId,
        method: req.method,
        path: req.path,
        bodyFields: Object.keys(req.body),
        hasFiles: !!req.files,
        fileFields: req.files ? Object.keys(req.files) : []
      });
      
      // Verificar que tengamos datos para actualizar
      if (Object.keys(req.body).length === 0 && (!req.files || Object.keys(req.files).length === 0)) {
        return res.status(400).json({
          success: false,
          message: 'No se proporcionaron datos para actualizar'
        });
      }

      // Validar que si se proporciona NIT o dígito de verificación, ambos sean proporcionados
      if ((req.body.nit_number && !req.body.verification_digit) || 
      (!req.body.nit_number && req.body.verification_digit)) {
        return res.status(400).json({
          success: false,
          message: 'Si proporciona el NIT, debe incluir también el dígito de verificación y viceversa'
        });
      }
      
      // Extraer datos de la solicitud
      const updateData = {};
      
      // Mapear campos específicos para estandarizar nombres
      const fieldMap = {
        // Campos básicos en camelCase
        'razonSocial': 'razonSocial',
        'nombre': 'nombre',
        'telefono': 'telefono',
        'email': 'email',
        'direccion': 'direccion', 
        'ciudad': 'ciudad',
        'pais': 'pais',
        'nit': 'nit',
        
        // Campos adicionales
        'tipoDocumento': 'tipoDocumento',
        'numeroDocumento': 'numeroDocumento',
        'representanteLegal': 'representanteLegal',
        'actividadComercial': 'actividadComercial',
        'sectorEconomico': 'sectorEconomico',
        'tamanoEmpresa': 'tamanoEmpresa',
        'ingresosMensuales': 'ingresosMensuales',
        'patrimonio': 'patrimonio',
        'entidadBancaria': 'entidadBancaria',
        'tipoCuenta': 'tipoCuenta',
        'numeroCuenta': 'numeroCuenta',
        'nombreContacto': 'nombreContacto',
        'cargoContacto': 'cargoContacto',
        'telefonoContacto': 'telefonoContacto',
        'emailContacto': 'emailContacto',
        
        // Compatibilidad con campos en snake_case
        'company_name': 'razonSocial',
        'contact_name': 'nombre',
        'contact_phone': 'telefono',
        'contact_email': 'email',
        'address': 'direccion',
        'city': 'ciudad',
        'country': 'pais',
        'tax_id': 'nit',
        'nit_number': 'nit_number',
        'verification_digit': 'verification_digit',  
        'price_list': 'listaPrecios',
        'notes': 'notas'
      };

      // Extraer campos adicionales que no son parte del modelo estándar
      const additionalFields = {};

      // Iterar sobre req.body para encontrar campos adicionales
      Object.keys(req.body).forEach(key => {
        if (!fieldMap[key] && req.body[key] !== undefined && req.body[key] !== '') {
          additionalFields[key] = req.body[key];
        }
      });
      
      // Asignar solo los campos que tienen valor
      Object.keys(req.body).forEach(key => {
        if (fieldMap[key] && req.body[key] !== undefined && req.body[key] !== '') {
          updateData[fieldMap[key]] = req.body[key];
        }
      });
      
      // Calcular tax_id a partir de nit_number y verification_digit si ambos están presentes
      if (updateData.nit_number && updateData.verification_digit) {
        updateData.nit = `${updateData.nit_number}-${updateData.verification_digit}`;
        logger.debug('tax_id actualizado a partir de NIT', {
          nit_number: updateData.nit_number,
          verification_digit: updateData.verification_digit,
          tax_id: updateData.nit
        });
      }

      // Iterar sobre req.body para encontrar campos adicionales
      Object.keys(req.body).forEach(key => {
        if (!fieldMap[key] && req.body[key] !== undefined && req.body[key] !== '') {
          additionalFields[key] = req.body[key];
        }
      });

      // Verificar que los campos críticos se mantengan para la actualización
      logger.debug('Valores críticos antes de actualizar perfil', {
        nit_number: updateData.nit_number,
        verification_digit: updateData.verification_digit,
        nit: updateData.nit
      });
      
      logger.debug('Datos para actualización de perfil de cliente', { 
        userId,
        fields: Object.keys(updateData)
      });
      
      // Obtener el perfil actual para verificar si existe
      const existingProfile = await ClientProfile.getByUserId(userId);

      // Obtener datos adicionales existentes
      let existingAdditionalData = {};
      if (existingProfile.notes) {
        try {
          existingAdditionalData = JSON.parse(existingProfile.notes);
        } catch (e) {
          logger.warn('Error al parsear datos adicionales existentes', {
            error: e.message,
            notes: existingProfile.notes.substring(0, 100)
          });
        }
      }

      // Fusionar con nuevos datos adicionales
      const mergedAdditionalData = { ...existingAdditionalData, ...additionalFields };

      // Guardar datos adicionales como JSON en campo notes
      if (Object.keys(mergedAdditionalData).length > 0) {
        updateData.notes = JSON.stringify(mergedAdditionalData);
      }

      // Actualizar clientData con datos fusionados para campos adicionales
      updateData.additionalData = mergedAdditionalData;
      
      if (!existingProfile) {
        logger.warn('Perfil de cliente no encontrado al actualizar', { userId });
        return res.status(404).json({
          success: false,
          message: 'Perfil de cliente no encontrado'
        });
      }
      
      // Verificar si el usuario tiene permisos para actualizar este perfil
      if (req.user.rol_id !== 1 && existingProfile.user_id !== req.user.id) {
        logger.warn('Intento no autorizado de actualizar perfil', {
          userId: req.user.id,
          userId,
          profileOwnerId: existingProfile.user_id
        });
        
        return res.status(403).json({
          success: false,
          message: 'No tiene permisos para actualizar este perfil'
        });
      }
      
      // Procesar archivos si existen
      try {
        if (req.files) {
          // Mapeo de campos de archivos para estandarizar
          const fileFieldMap = {
            'fotocopiaCedula': 'fotocopiaCedula',
            'fotocopia_cedula': 'fotocopiaCedula',
            'fotocopiaRut': 'fotocopiaRut',
            'fotocopia_rut': 'fotocopiaRut',
            'anexosAdicionales': 'anexosAdicionales',
            'anexos_adicionales': 'anexosAdicionales'
          };
          
          // Procesar cada campo de archivo que exista
          for (const field in req.files) {
            if (fileFieldMap[field]) {
              const standardizedField = fileFieldMap[field];
              
              // Determinar el tipo de documento para la ruta
              const docType = standardizedField === 'fotocopiaCedula' ? 'cedula' : 
                            standardizedField === 'fotocopiaRut' ? 'rut' : 'anexos';
              
              // Si estamos usando S3 y hay un archivo anterior, eliminar de S3
              if (process.env.STORAGE_MODE === 's3') {
                const oldValue = existingProfile[standardizedField];
                if (oldValue) {
                  // Intentar extraer la clave del archivo anterior
                  const oldKey = S3Service.extractKeyFromUrl(oldValue);
                  if (oldKey) {
                    try {
                      // Eliminar el archivo anterior de S3
                      await S3Service.deleteFile(oldKey);
                      logger.debug('Archivo anterior eliminado de S3', { 
                        key: oldKey,
                        field: standardizedField 
                      });
                    } catch (deleteError) {
                      logger.warn('No se pudo eliminar archivo anterior de S3', {
                        error: deleteError.message,
                        key: oldKey
                      });
                      // Continuar a pesar del error
                    }
                  }
                }
              } else {
                // Modo local: eliminar archivo anterior si existe
                const oldFileField = standardizedField;
                if (existingProfile[oldFileField]) {
                  const oldPath = path.join(uploadDir, existingProfile[oldFileField]);
                  if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                    logger.debug('Archivo anterior eliminado localmente', { 
                      path: oldPath, 
                      field: oldFileField 
                    });
                  }
                }
              }
              
              // Guardar el nuevo archivo
              updateData[standardizedField] = await saveFile(req.files[field], userId, docType);
              logger.debug('Nuevo archivo guardado', { 
                field: standardizedField, 
                value: updateData[standardizedField] 
              });
            }
          }
        }
      } catch (fileError) {
        logger.error('Error procesando archivos en actualización', {
          error: fileError.message,
          stack: fileError.stack,
          userId
        });
        // Continuamos sin archivos
      }
      
      // Actualizar el perfil
      const updatedProfile = await ClientProfile.updateByUserId(userId, updateData);
      
      if (!updatedProfile) {
        return res.status(404).json({
          success: false,
          message: 'Error al actualizar perfil'
        });
      }

      // Verificar si se añadió/modificó NIT y dígito de verificación
      if (updatedProfile.nit_number && updatedProfile.verification_digit) {
        // Comprobar si ya estaba sincronizado con SAP
        const shouldSync = !updatedProfile.sap_lead_synced || !updatedProfile.cardcode_sap;
        
        // Definir si hay cambios en datos relevantes para SAP
        const hasChangedSapRelevantData = 
          updateData.razonSocial || updateData.nombre || 
          updateData.telefono || updateData.email ||
          updateData.direccion || updateData.nit_number;
          
        logger.debug('Evaluando criterios para sincronización con SAP', {
          shouldSync,
          hasChangedSapRelevantData,
          nit_number: updatedProfile.nit_number,
          verification_digit: updatedProfile.verification_digit,
          client_id: updatedProfile.client_id
        });
          
        // Si debe sincronizarse (primera vez o se modificaron datos)
        if (shouldSync || hasChangedSapRelevantData) {
          try {
            // Verificar que el servicio de SAP esté inicializado
            if (!sapServiceManager.initialized) {
              logger.debug('Inicializando servicio de SAP antes de sincronizar');
              await sapServiceManager.initialize();
            }
            
            logger.info('Intentando sincronizar perfil con SAP', {
              client_id: updatedProfile.client_id,
              nit: updatedProfile.nit_number
            });
            
            // Intentar crear/actualizar en SAP
            const sapResult = await sapServiceManager.createOrUpdateBusinessPartnerLead(updatedProfile);
            
            logger.debug('Resultado de sincronización con SAP', {
              success: sapResult.success,
              cardCode: sapResult.cardCode,
              client_id: updatedProfile.client_id
            });
            
            // Actualizar el perfil con la información de SAP
            if (sapResult.success) {
              await pool.query(
                `UPDATE client_profiles 
                SET cardcode_sap = $1, sap_lead_synced = true, updated_at = CURRENT_TIMESTAMP
                WHERE client_id = $2`,
                [sapResult.cardCode, updatedProfile.client_id]
              );
              
              // Actualizar objeto para la respuesta
              updatedProfile.cardcode_sap = sapResult.cardCode;
              updatedProfile.sap_lead_synced = true;
              
              logger.info('Perfil de cliente sincronizado con SAP como Lead', {
                clientId: updatedProfile.client_id,
                cardcodeSap: sapResult.cardCode,
                isNew: sapResult.isNew
              });
            }
          } catch (sapError) {
            // No fallamos la actualización del perfil si falla SAP, solo logueamos el error
            logger.error('Error al sincronizar perfil con SAP', {
              error: sapError.message,
              stack: sapError.stack,
              clientId: updatedProfile.client_id
            });
          }
        }
      }

      // Agregar URLs para archivos en la respuesta
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      if (updatedProfile.fotocopiaCedula) {
        updatedProfile.fotocopiaCedulaUrl = `${baseUrl}/api/client-profiles/${userId}/file/cedula`;
      }
      
      if (updatedProfile.fotocopiaRut) {
        updatedProfile.fotocopiaRutUrl = `${baseUrl}/api/client-profiles/${userId}/file/rut`;
      }
      
      if (updatedProfile.anexosAdicionales) {
        updatedProfile.anexosAdicionalesUrl = `${baseUrl}/api/client-profiles/${userId}/file/anexos`;
      }
      
      logger.info('Perfil de cliente actualizado exitosamente', {
        userId,
        razonSocial: updatedProfile.razonSocial || existingProfile.razonSocial
      });
      
      res.status(200).json({
        success: true,
        message: 'Perfil de cliente actualizado exitosamente',
        data: updatedProfile
      });
    } catch (error) {
      logger.error('Error al actualizar perfil de cliente', {
        error: error.message,
        stack: error.stack,
        profileId: req.params.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al actualizar perfil de cliente',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * @swagger
   * /api/client-profiles/user/{userId}:
   *   delete:
   *     summary: Eliminar perfil de cliente
   *     description: Elimina un perfil de cliente del sistema
   *     tags: [ClientProfiles]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: userId
   *         required: true
   *         schema:
   *           type: integer
   *         description: ID del perfil de cliente
   *     responses:
   *       200:
   *         description: Perfil eliminado exitosamente
   *       401:
   *         description: No autorizado
   *       403:
   *         description: Prohibido - No tiene permisos suficientes
   *       404:
   *         description: Perfil no encontrado
   *       500:
   *         description: Error interno del servidor
   */
  async deleteProfileByUserId(req, res) {
    try {
      const { userId } = req.params;
      
      logger.debug('Eliminando perfil de cliente', { userId });
      
      // Primero obtenemos el perfil para obtener las rutas de archivos
      const profile = await ClientProfile.getByUserId(userId);
      
      if (!profile) {
        logger.warn('Perfil de cliente no encontrado al eliminar', { userId });
        return res.status(404).json({
          success: false,
          message: 'Perfil de cliente no encontrado'
        });
      }
      
      // Eliminar los archivos asociados al perfil
      if (profile.fotocopiaCedula) {
        if (process.env.STORAGE_MODE === 's3') {
          const key = S3Service.extractKeyFromUrl(profile.fotocopiaCedula);
          if (key) {
            try {
              await S3Service.deleteFile(key);
              logger.debug('Archivo de cédula eliminado de S3', { key });
            } catch (error) {
              logger.warn('Error al eliminar archivo de S3', { key, error: error.message });
            }
          }
        } else {
          const cedulaPath = path.join(uploadDir, profile.fotocopiaCedula);
          if (fs.existsSync(cedulaPath)) {
            fs.unlinkSync(cedulaPath);
          }
        }
      }

      if (profile.fotocopiaRut) {
        if (process.env.STORAGE_MODE === 's3') {
          const key = S3Service.extractKeyFromUrl(profile.fotocopiaRut);
          if (key) {
            try {
              await S3Service.deleteFile(key);
              logger.debug('Archivo de RUT eliminado de S3', { key });
            } catch (error) {
              logger.warn('Error al eliminar archivo de S3', { key, error: error.message });
            }
          }
        } else {
          const rutPath = path.join(uploadDir, profile.fotocopiaRut);
          if (fs.existsSync(rutPath)) {
            fs.unlinkSync(rutPath);
          }
        }
      }

      if (profile.anexosAdicionales) {
        if (process.env.STORAGE_MODE === 's3') {
          const key = S3Service.extractKeyFromUrl(profile.anexosAdicionales);
          if (key) {
            try {
              await S3Service.deleteFile(key);
              logger.debug('Archivo de anexos eliminado de S3', { key });
            } catch (error) {
              logger.warn('Error al eliminar archivo de S3', { key, error: error.message });
            }
          }
        } else {
          const anexosPath = path.join(uploadDir, profile.anexosAdicionales);
          if (fs.existsSync(anexosPath)) {
            fs.unlinkSync(anexosPath);
          }
        }
      }
      
      // Luego eliminamos el perfil de la base de datos
      const deletedProfile = await ClientProfile.deleteByUserId(userId);
      
      logger.info('Perfil de cliente eliminado exitosamente', {
        userId,
        razonSocial: profile.razonSocial
      });
      
      res.status(200).json({
        success: true,
        message: 'Perfil de cliente eliminado exitosamente',
        data: profile
      });
    } catch (error) {
      logger.error('Error al eliminar perfil de cliente', {
        error: error.message,
        stack: error.stack,
        profileId: req.params.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al eliminar perfil de cliente',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  /**
   * @swagger
   * /api/client-profiles/user/{userId}/file/{fileType}:
   *   get:
   *     summary: Obtener archivo de perfil de cliente
   *     description: Recupera un archivo asociado al perfil de cliente (cédula, RUT o anexos)
   *     tags: [ClientProfiles]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: userId
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
  // Mejora del manejo de archivos en la función getFile para manejar tipos MIME correctamente

async getFile(req, res) {
  try {
    const { userId, fileType } = req.params;
    
    logger.debug('Obteniendo archivo de perfil de cliente', { 
      userId: userId, 
      fileType 
    });
    
    // Obtener el perfil para verificar si existe y obtener la ruta del archivo
    const profile = await ClientProfile.getByUserId(userId);
    
    if (!profile) {
      logger.warn('Perfil de cliente no encontrado', { userId });
      return res.status(404).json({
        success: false,
        message: 'Perfil de cliente no encontrado'
      });
    }
    
    let fileName;
    
    // Determinar qué archivo se está solicitando
    if (fileType === 'cedula' && profile.fotocopiaCedula) {
      fileName = profile.fotocopiaCedula;
    } else if (fileType === 'rut' && profile.fotocopiaRut) {
      fileName = profile.fotocopiaRut;
    } else if (fileType === 'anexos' && profile.anexosAdicionales) {
      fileName = profile.anexosAdicionales;
    } else {
      logger.warn('Archivo no encontrado en el perfil', { 
        userId: userId, 
        fileType 
      });
      
      return res.status(404).json({
        success: false,
        message: 'Archivo no encontrado'
      });
    }
    
    const filePath = path.join(uploadDir, fileName);
    
    // Verificar si el archivo existe en el sistema de archivos
    if (!fs.existsSync(filePath)) {
      logger.warn('Archivo no encontrado en el servidor', { 
        userId: userId, 
        fileType, 
        path: filePath 
      });
      
      return res.status(404).json({
        success: false,
        message: 'Archivo no encontrado en el servidor'
      });
    }
    
    // Obtener el tipo de contenido basado en la extensión del archivo
    const ext = path.extname(fileName).toLowerCase();
    
    // Mapear extensiones comunes a tipos de contenido
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain'
    };
    
    // Usar el tipo MIME correcto o por defecto
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    // Configurar headers para descarga o visualización
    res.setHeader('Content-Type', contentType);
    
    // Para PDFs y imágenes, intentar mostrarlas en línea
    const inlineTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif'];
    if (inlineTypes.includes(contentType)) {
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    } else {
      // Para otros tipos, forzar descarga
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    }
    
    // Enviar el archivo como respuesta
    return this.getFileByUserId(req, res);
  } catch (error) {
    logger.error('Error al obtener archivo de perfil de cliente', {
      error: error.message,
      stack: error.stack,
      profileId: req.params.userId,
      fileType: req.params.fileType
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al obtener archivo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
  
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
  async getFileByUserId(req, res) {
    try {
      const { userId, fileType } = req.params;
      
      logger.debug('Obteniendo archivo de perfil de cliente por ID de usuario', { 
        userId, 
        fileType 
      });
      
      // Obtener el perfil por ID de usuario
      const profile = await ClientProfile.getByUserId(userId);
      
      if (!profile) {
        logger.warn('Perfil de cliente no encontrado por ID de usuario', { userId });
        return res.status(404).json({
          success: false,
          message: 'Perfil de cliente no encontrado'
        });
      }
      
      // Validar que el usuario tenga permiso
      if (req.user.id !== parseInt(userId) && req.user.rol_id !== 1) {
        return res.status(403).json({
          success: false,
          message: 'No tiene permiso para acceder a este documento'
        });
      }
      
      // Obtener la URL según el tipo de documento
      let documentUrl;
      switch (fileType) {
        case 'cedula':
          documentUrl = profile.fotocopiaCedula;
          break;
        case 'rut':
          documentUrl = profile.fotocopiaRut;
          break;
        case 'anexos':
          documentUrl = profile.anexosAdicionales;
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Tipo de documento no válido'
          });
      }
      
      if (!documentUrl) {
        return res.status(404).json({
          success: false,
          message: `El documento ${fileType} no existe para este perfil`
        });
      }
      
      // Modo S3
      if (process.env.STORAGE_MODE === 's3') {
        // Si es una URL firmada que aún no ha expirado, redirigir directamente
        if (documentUrl.includes('Signature=') && !documentUrl.includes('localhost')) {
          return res.redirect(documentUrl);
        }
        
        // Extraer la clave de S3 de la URL
        const key = S3Service.extractKeyFromUrl(documentUrl);
        if (!key) {
          logger.warn('No se pudo determinar la clave S3 del documento', { documentUrl });
          return res.status(404).json({
            success: false,
            message: 'No se pudo determinar la ubicación del documento'
          });
        }
        
        // Verificar que el archivo existe
        const exists = await S3Service.fileExists(key);
        if (!exists) {
          logger.warn('Documento no encontrado en S3', { key });
          return res.status(404).json({
            success: false,
            message: 'Documento no encontrado'
          });
        }
        
        // Generar URL firmada para acceso temporal
        const signedUrl = await S3Service.getSignedUrl('getObject', key, 3600); // 1 hora
        
        // Redirigir al documento
        return res.redirect(signedUrl);
      }
      // Modo local (comportamiento original)
      else {
        const filePath = path.join(uploadDir, documentUrl);
        
        // Verificar si el archivo existe en el sistema de archivos
        if (!fs.existsSync(filePath)) {
          logger.warn('Archivo no encontrado en el servidor', { 
            userId, 
            fileType, 
            path: filePath 
          });
          
          return res.status(404).json({
            success: false,
            message: 'Archivo no encontrado en el servidor'
          });
        }
        
        // Obtener el tipo de contenido basado en la extensión del archivo
        const ext = path.extname(documentUrl).toLowerCase();
        
        // Mapear extensiones comunes a tipos de contenido
        const mimeTypes = {
          '.pdf': 'application/pdf',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.doc': 'application/msword',
          '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '.xls': 'application/vnd.ms-excel',
          '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          '.txt': 'text/plain'
        };
        
        // Usar el tipo MIME correcto o por defecto
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        
        // Configurar headers para descarga o visualización
        res.setHeader('Content-Type', contentType);
        
        // Para PDFs y imágenes, intentar mostrarlas en línea
        const inlineTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif'];
        if (inlineTypes.includes(contentType)) {
          res.setHeader('Content-Disposition', `inline; filename="${documentUrl}"`);
        } else {
          // Para otros tipos, forzar descarga
          res.setHeader('Content-Disposition', `attachment; filename="${documentUrl}"`);
        }
        
        // Enviar el archivo como respuesta
        return res.sendFile(filePath);
      }
    } catch (error) {
      logger.error('Error al obtener archivo de perfil de cliente por ID de usuario', {
        error: error.message,
        stack: error.stack,
        userId: req.params.userId,
        fileType: req.params.fileType
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al obtener archivo',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
    /**
   * @swagger
   * /api/client-profiles/{userId}/documents/{documentType}:
   *   post:
   *     summary: Subir documento de perfil
   *     description: Sube un documento específico (cédula, RUT, anexos) al perfil del cliente
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
   *       400:
   *         description: Datos inválidos
   *       401:
   *         description: No autorizado
   *       403:
   *         description: Prohibido - No tiene permisos
   *       404:
   *         description: Perfil no encontrado
   *       500:
   *         description: Error interno del servidor
   */
  async uploadProfileDocument(req, res) {
    try {
      const { userId, documentType } = req.params;
      
      if (!userId || !documentType) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere el ID de usuario y el tipo de documento'
        });
      }
      
      if (!req.files || !req.files.document) {
        return res.status(400).json({
          success: false,
          message: 'No se ha proporcionado ningún archivo'
        });
      }
      
      // Obtener perfil de cliente
      const profile = await ClientProfile.getByUserId(userId);
      if (!profile) {
        return res.status(404).json({
          success: false,
          message: 'Perfil de cliente no encontrado'
        });
      }
      
      // Validar que el usuario tenga permiso
      if (req.user.id !== parseInt(userId) && req.user.rol_id !== 1) {
        return res.status(403).json({
          success: false,
          message: 'No tiene permiso para modificar este perfil'
        });
      }
      
      const file = req.files.document;
      
      // Eliminar archivo anterior si existe
      let fieldToUpdate;
      switch (documentType) {
        case 'cedula':
          fieldToUpdate = 'fotocopiaCedula';
          break;
        case 'rut':
          fieldToUpdate = 'fotocopiaRut';
          break;
        case 'anexos':
          fieldToUpdate = 'anexosAdicionales';
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Tipo de documento no válido'
          });
      }
      
      // Si hay un archivo anterior, eliminarlo
      if (profile[fieldToUpdate]) {
        if (process.env.STORAGE_MODE === 's3') {
          const oldKey = S3Service.extractKeyFromUrl(profile[fieldToUpdate]);
          if (oldKey) {
            try {
              await S3Service.deleteFile(oldKey);
              logger.debug('Archivo anterior eliminado de S3', { 
                key: oldKey,
                field: fieldToUpdate 
              });
            } catch (error) {
              logger.warn('Error al eliminar archivo anterior de S3', {
                error: error.message,
                key: oldKey
              });
            }
          }
        } else {
          const oldPath = path.join(uploadDir, profile[fieldToUpdate]);
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
            logger.debug('Archivo anterior eliminado localmente', { 
              path: oldPath
            });
          }
        }
      }
      
      // Guardar nuevo archivo
      const fileUrl = await saveFile(file, userId, documentType);
      
      // Actualizar el perfil
      const updateData = {
        [fieldToUpdate]: fileUrl
      };
      
      const updatedProfile = await ClientProfile.updateByUserId(userId, updateData);
      
      if (!updatedProfile) {
        return res.status(500).json({
          success: false,
          message: 'Error al actualizar perfil con nuevo documento'
        });
      }
      
      res.status(200).json({
        success: true,
        message: `Documento ${documentType} subido exitosamente`,
        data: {
          documentType,
          url: fileUrl
        }
      });
    } catch (error) {
      logger.error('Error al subir documento de perfil', {
        error: error.message,
        stack: error.stack,
        userId: req.params.userId,
        documentType: req.params.documentType
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al subir documento',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

// Crear una instancia del controlador
const clientProfileController = new ClientProfileController();

module.exports = {
  getAllProfiles: clientProfileController.getAllProfiles,
  getProfileByUserId: clientProfileController.getProfileByUserId,
  createProfile: clientProfileController.createProfile,
  updateProfileByUserId: clientProfileController.updateProfileByUserId,
  deleteProfileByUserId: clientProfileController.deleteProfileByUserId,
  getFile: clientProfileController.getFile,
  getFileByUserId: clientProfileController.getFileByUserId,
  uploadProfileDocument: clientProfileController.uploadProfileDocument
};