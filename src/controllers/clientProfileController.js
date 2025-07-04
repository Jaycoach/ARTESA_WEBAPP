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
    let fileExtension = path.extname(fileToSave.name);
    if (!fileExtension) {
      // Determinar extensión basada en MIME type
      const mimeToExt = {
        'application/pdf': '.pdf',
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'application/msword': '.doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
        'application/vnd.ms-excel': '.xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx'
      };
      fileExtension = mimeToExt[fileToSave.mimetype] || '.bin';
    }
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

      // Obtener contactos para cada perfil
      for (const profile of profilesWithUrls) {
        try {
          const contactsQuery = `
            SELECT contact_id, name, position, phone, email, is_primary, created_at
            FROM client_contacts
            WHERE client_id = $1
            ORDER BY is_primary DESC, contact_id ASC
          `;
          const contactsResult = await pool.query(contactsQuery, [profile.client_id]);
          profile.contacts = contactsResult.rows;
        } catch (contactError) {
          logger.warn('Error al obtener contactos del perfil', {
            error: contactError.message,
            clientId: profile.client_id
          });
          profile.contacts = [];
        }
      }
      
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

      // Obtener contactos asociados
      const contactsQuery = `
        SELECT contact_id, name, position, phone, email, is_primary, created_at
        FROM client_contacts
        WHERE client_id = $1
        ORDER BY is_primary DESC, contact_id ASC
      `;

      try {
        const contactsResult = await pool.query(contactsQuery, [profile.client_id]);
        profile.contacts = contactsResult.rows;
      } catch (contactError) {
        logger.warn('Error al obtener contactos del perfil', {
          error: contactError.message,
          clientId: profile.client_id
        });
        profile.contacts = [];
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
 *     description: Crea un nuevo perfil de cliente en el sistema con transaccionalidad completa
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
 *               nit_number:
 *                 type: string
 *                 description: Número de NIT sin dígito de verificación
 *               verification_digit:
 *                 type: string
 *                 description: Dígito de verificación del NIT
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
    
    logger.debug('Recibiendo datos para perfil de cliente', { 
      bodyFields: Object.keys(req.body),
      filesExist: !!req.files,
      filesKeys: req.files ? Object.keys(req.files) : []
    });
    
    // Extraer datos de la solicitud
    const clientData = {};
    
    // Mapear campos específicos
    const fieldMap = {
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
      // Compatibilidad hacia atrás
      'company_name': 'razonSocial',
      'contact_name': 'nombre',
      'contact_phone': 'telefono',
      'contact_email': 'email',
      'address': 'direccion',
      'city': 'ciudad',
      'country': 'pais',
      'tax_id': 'nit'
    };
    
    // Asignar campos mapeados
    Object.keys(req.body).forEach(key => {
      if (fieldMap[key] && req.body[key] !== undefined && req.body[key] !== '') {
        clientData[fieldMap[key]] = req.body[key];
      }
    });

    // Procesar NIT
    if (req.body.nit_number) clientData.nit_number = req.body.nit_number;
    if (req.body.verification_digit) clientData.verification_digit = req.body.verification_digit;

    if (!clientData.nit_number && req.body.nit) {
      const parts = req.body.nit.split('-');
      if (parts.length > 0) {
        clientData.nit_number = parts[0];
        if (parts.length > 1 && !clientData.verification_digit) {
          clientData.verification_digit = parts[1];
        }
      }
    }

    // Procesar userId
    if (clientData.userId) {
      clientData.userId = parseInt(clientData.userId);
    } else if (req.user && req.user.id) {
      clientData.userId = req.user.id;
    }
    
    logger.debug('Datos procesados para creación de perfil', { 
      userId: clientData.userId,
      razonSocial: clientData.razonSocial,
      nit_number: clientData.nit_number,
      verification_digit: clientData.verification_digit
    });
    
    // Validaciones
    if (clientData.userId) {
      const hasProfile = await ClientProfile.userHasProfile(clientData.userId);
      if (hasProfile) {
        return res.status(400).json({
          success: false,
          message: 'Este usuario ya tiene un perfil, debe actualizarlo'
        });
      }
    }

    if ((clientData.nit_number && !clientData.verification_digit) || 
        (!clientData.nit_number && clientData.verification_digit)) {
      return res.status(400).json({
        success: false,
        message: 'Si proporciona el NIT, debe incluir también el dígito de verificación y viceversa'
      });
    }

    // Verificar NIT duplicado en BD
    if (clientData.nit_number) {
      const nitCheck = await ClientProfile.nitExists(clientData.nit_number);
      if (nitCheck.exists) {
        logger.warn('Intento de crear perfil con NIT duplicado', {
          nit_number: clientData.nit_number,
          existingClientId: nitCheck.clientId,
          existingUserId: nitCheck.userId
        });
        
        return res.status(400).json({
          success: false,
          message: 'El NIT ya está registrado en el sistema',
          data: { duplicateNIT: true, nitNumber: clientData.nit_number }
        });
      }
    }
    
    // Procesar archivos
    try {
      if (req.files) {
        const fileFieldMap = {
          'fotocopiaCedula': 'fotocopiaCedula',
          'fotocopia_cedula': 'fotocopiaCedula',
          'fotocopiaRut': 'fotocopiaRut',
          'fotocopia_rut': 'fotocopiaRut', 
          'anexosAdicionales': 'anexosAdicionales',
          'anexos_adicionales': 'anexosAdicionales'
        };
        
        for (const field in req.files) {
          if (fileFieldMap[field]) {
            const standardizedField = fileFieldMap[field];
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
    }

    // Calcular tax_id
    if (clientData.nit_number && clientData.verification_digit) {
      clientData.nit = `${clientData.nit_number}-${clientData.verification_digit}`;
    }

    // Extraer campos adicionales
    // Lista de campos que van específicamente a notes
    const fieldsForNotes = [
      'tipoDocumento', 'actividadComercial', 'numeroCuenta', 'entidadBancaria', 
      'tamanoEmpresa', 'cargoContacto', 'ingresosMensuales', 'representanteLegal', 
      'sectorEconomico', 'numeroDocumento', 'nombreContacto', 'patrimonio', 'tipoCuenta'
    ];

    // Extraer campos adicionales
    const additionalFields = {};

    // Procesar campos específicos para notes
    fieldsForNotes.forEach(field => {
      if (req.body[field] !== undefined && req.body[field] !== '') {
        additionalFields[field] = req.body[field];
      }
    });

    // Procesar cualquier otro campo que no esté en el fieldMap principal
    const mainFields = ['userId', 'nombre', 'email', 'telefono', 'direccion', 'ciudad', 'pais', 
      'razonSocial', 'nit', 'nit_number', 'verification_digit'];

    Object.keys(req.body).forEach(key => {
      if (!mainFields.includes(key) && !fieldsForNotes.includes(key) && 
          req.body[key] !== undefined && req.body[key] !== '') {
        additionalFields[key] = req.body[key];
      }
    });

    // Procesar campos adicionales
    const criticalFields = ['nit_number', 'verification_digit', 'cardcode_sap', 'clientprofilecode_sap'];
    criticalFields.forEach(field => {
      if (field in additionalFields) {
        logger.warn(`Campo crítico "${field}" encontrado en datos adicionales, se usará valor principal`);
        delete additionalFields[field];
      }
    });

    if (Object.keys(additionalFields).length > 0) {
      clientData.notes = JSON.stringify(additionalFields);
    }

    // Verificar CardCode en SAP antes de crear
    if (clientData.nit_number && clientData.verification_digit) {
      const cardCodeToCheck = `CI${clientData.nit_number}`;
      try {
        // Asegurar inicialización SAP
        if (!sapServiceManager.initialized) {
          await sapServiceManager.initialize();
        }
        
        const existingPartner = await sapServiceManager.clientService.getBusinessPartnerBySapCode(cardCodeToCheck);
        if (existingPartner) {
          logger.warn('CardCode ya existe en SAP', {
            cardCode: cardCodeToCheck,
            userId: clientData.userId,
            existingPartner: existingPartner.CardCode
          });
          
          return res.status(400).json({
            success: false,
            message: 'Ya existe un cliente en SAP con este NIT. Contacte al administrador.',
            error: 'DUPLICATE_CARDCODE_SAP'
          });
        }
      } catch (sapError) {
        logger.debug('Error al verificar CardCode en SAP (continuando)', {
          error: sapError.message,
          cardCode: cardCodeToCheck
        });
      }
    }

    let profileForResponse = null;

    // TRANSACCIÓN COMPLETA
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      logger.info('Iniciando transacción para crear perfil de cliente', {
        userId: clientData.userId,
        email: clientData.email,
        nombre: clientData.nombre
      });
      
      // Crear el perfil usando el modelo (que maneja su propia lógica de BD)
      const profile = await ClientProfile.create(clientData);

      logger.info('Perfil de cliente creado exitosamente por el modelo', {
        clientId: profile.client_id,
        userId: profile.user_id
      });

      profileForResponse = profile;
      
      // Procesar archivos de forma transaccional
      const uploadPromises = [];
      const uploadedFiles = [];
      
      if (req.files) {
        const fileFieldMap = {
          'fotocopiaCedula': 'cedula',
          'fotocopia_cedula': 'cedula', 
          'fotocopiaRut': 'rut',
          'fotocopia_rut': 'rut',
          'anexosAdicionales': 'anexos',
          'anexos_adicionales': 'anexos'
        };
        
        for (const field in req.files) {
          if (fileFieldMap[field]) {
            const docType = fileFieldMap[field];
            try {
              const uploadedUrl = await saveFile(req.files[field], clientData.userId, docType);
              uploadedFiles.push({ field, docType, url: uploadedUrl });
              logger.info('Archivo subido exitosamente', { field, docType, url: uploadedUrl });
            } catch (uploadError) {
              logger.error('Error al subir archivo', { 
                field, 
                docType, 
                error: uploadError.message 
              });
              throw new Error(`Error al subir archivo ${field}: ${uploadError.message}`);
            }
          }
        }
      }
      
      // Sincronizar con SAP (CRÍTICO - hacer rollback si falla)
      let sapSyncResult = null;
      try {
        if (profileForResponse.nit_number && profileForResponse.verification_digit !== undefined) {
          const sapProfileData = {
            client_id: profile.client_id,
            user_id: profile.user_id,
            razonSocial: profile.razonSocial,
            nombre: profile.nombre, 
            telefono: profile.telefono,
            email: profile.email,
            direccion: profile.direccion,
            nit_number: profile.nit_number,
            verification_digit: profile.verification_digit
          };
          
          logger.info('Verificando estado de SAP antes de sincronización', {
            sapServiceManagerExists: !!sapServiceManager,
            isInitialized: sapServiceManager?.initialized,
            clientServiceExists: !!sapServiceManager?.clientService,
            clientId: profile.client_id
          });
          
          logger.info('Iniciando sincronización con SAP', {
            clientId: profile.client_id,
            sapProfileData: {
              razonSocial: sapProfileData.razonSocial,
              nit: `${sapProfileData.nit_number}-${sapProfileData.verification_digit}`
            }
          });
          
          if (!sapServiceManager.initialized) {
            logger.info('Inicializando SAP Service Manager');
            await sapServiceManager.initialize();
          }
          
          // Verificar que el clientService esté disponible
          if (!sapServiceManager.clientService) {
            throw new Error('SAP Client Service no está disponible después de la inicialización');
          }
          
          // Verificar sesión SAP
          if (!sapServiceManager.clientService.sessionId) {
            logger.info('No hay sesión SAP activa, iniciando login');
            await sapServiceManager.clientService.login();
            
            if (!sapServiceManager.clientService.sessionId) {
              throw new Error('No se pudo establecer sesión con SAP');
            }
          }
          
          logger.info('Estado SAP verificado, procediendo con sincronización', {
            sessionActive: !!sapServiceManager.clientService.sessionId,
            clientId: profile.client_id
          });
          
          sapSyncResult = await sapServiceManager.createOrUpdateLead(sapProfileData);

          if (!sapSyncResult) {
            logger.error('sapSyncResult es null o undefined', {
              clientId: profile.client_id,
              sapServiceManagerInitialized: sapServiceManager.initialized,
              clientServiceInitialized: sapServiceManager?.clientService?.initialized
            });
            // Si sapSyncResult es null, crear un error controlado
            throw new Error('La respuesta de SAP es nula - posible error de conectividad');
          }

          if (sapSyncResult && sapSyncResult.success === true && sapSyncResult.cardCode) {
            // Actualizar perfil con datos de SAP dentro de la transacción
            const updateResult = await client.query(
              `UPDATE client_profiles 
              SET cardcode_sap = $1, 
                  clientprofilecode_sap = $2, 
                  sap_lead_synced = true,
                  cardtype_sap = 'cLid',
                  updated_at = CURRENT_TIMESTAMP
              WHERE client_id = $3 
              RETURNING *`,
              [sapSyncResult.cardCode, sapSyncResult.artesaCode, profile.client_id]
            );
            
            logger.info('Perfil creado con CardType inicial', {
              clientId: profile.client_id,
              initialCardType: 'cLid',
              cardCode: sapSyncResult.cardCode
            });
            
            if (updateResult.rows.length > 0) {
              profileForResponse = updateResult.rows[0];
              logger.info('Perfil actualizado con datos de SAP exitosamente', {
                clientId: profile.client_id,
                cardCode: sapSyncResult.cardCode,
                artesaCode: sapSyncResult.artesaCode
              });
            }
          } else {
            // Logging más detallado del error
            const errorDetails = {
              sapSyncResult: sapSyncResult,
              hasSuccess: sapSyncResult?.success,
              hasCardCode: !!sapSyncResult?.cardCode,
              error: sapSyncResult?.error,
              clientId: profile.client_id
            };
            
            logger.error('Error crítico en sincronización SAP, revirtiendo transacción', errorDetails);
            
            // Verificar si es un error recuperable
            if (sapSyncResult?.error && (
              sapSyncResult.error.includes('Network Error') || 
              sapSyncResult.error.includes('ECONNREFUSED') ||
              sapSyncResult.error.includes('timeout') ||
              sapSyncResult.error.includes('ETIMEDOUT')
            )) {
              logger.warn('Error de conectividad con SAP, continuando sin sincronización', {
                clientId: profile.client_id,
                error: sapSyncResult.error
              });
              // No hacer rollback por errores de conectividad - continuar
            } else {
              // Para otros errores, hacer rollback
              throw new Error(`Error en sincronización SAP: ${sapSyncResult?.error || 'Respuesta incompleta de SAP'}`);
            }
          }
        } else {
          logger.warn('No se puede sincronizar con SAP: faltan datos de NIT', {
            clientId: profileForResponse.client_id,
            hasNitNumber: !!profileForResponse.nit_number,
            hasVerificationDigit: profileForResponse.verification_digit !== undefined
          });
        }
      } catch (sapError) {
        // Logging detallado del error de SAP
        logger.error('Error crítico de SAP - detalles completos', {
          error: sapError.message,
          stack: sapError.stack,
          clientId: profile.client_id,
          sapServiceManagerInitialized: sapServiceManager?.initialized,
          clientServiceInitialized: sapServiceManager?.clientService?.initialized,
          sessionId: sapServiceManager?.clientService?.sessionId ? 'EXISTE' : 'NO_EXISTE',
          nit_number: profile.nit_number,
          verification_digit: profile.verification_digit
        });
        
        // Verificar si es un error de conectividad vs error de lógica
        if (sapError.message.includes('Network Error') || 
            sapError.message.includes('ECONNREFUSED') ||
            sapError.message.includes('timeout') ||
            sapError.message.includes('ETIMEDOUT') ||
            sapError.message.includes('posible error de conectividad')) {
          logger.warn('Error de conectividad con SAP, continuando sin sincronización', {
            clientId: profile.client_id,
            error: sapError.message
          });
          // No hacer rollback por errores de conectividad
          sapSyncResult = { success: false, error: sapError.message, connectivity_issue: true };
        } else {
          // Para errores de lógica, sí hacer rollback
          throw new Error(`Error crítico en SAP: ${sapError.message}`);
        }
      }

      // Verificar estado final antes de confirmar
      logger.info('Estado final antes de confirmar transacción', {
        clientId: profile.client_id,
        sapSyncSuccess: !!sapSyncResult?.success,
        cardCodeSap: sapSyncResult?.cardCode,
        profileForResponseExists: !!profileForResponse
      });
      
      // CONFIRMAR transacción - todo lo crítico fue exitoso
      await client.query('COMMIT');
      
      logger.info('Transacción confirmada exitosamente', {
        clientId: profileForResponse.client_id,
        userId: profileForResponse.user_id,
        sapSynced: !!sapSyncResult?.success
      });
      
    } catch (error) {
      // Hacer rollback en caso de error crítico
      try {
        await client.query('ROLLBACK');
        logger.info('Rollback ejecutado exitosamente debido a error crítico');
      } catch (rollbackError) {
        logger.error('Error al ejecutar rollback', { 
          error: rollbackError.message 
        });
      }
      
      // Limpiar archivos subidos en caso de rollback
      if (req.files) {
        const filesToClean = [
          { field: 'fotocopiaCedula', type: 'cedula' },
          { field: 'fotocopiaRut', type: 'rut' },
          { field: 'anexosAdicionales', type: 'anexos' }
        ];
        
        for (const fileInfo of filesToClean) {
          if (clientData[fileInfo.field]) {
            try {
              if (process.env.STORAGE_MODE === 's3') {
                const fileKey = S3Service.extractKeyFromUrl(clientData[fileInfo.field]);
                if (fileKey) {
                  await S3Service.deleteFile(fileKey);
                  logger.info(`Archivo ${fileInfo.type} limpiado de S3`, { key: fileKey });
                }
              } else {
                const filePath = path.join(uploadDir, path.basename(clientData[fileInfo.field]));
                if (fs.existsSync(filePath)) {
                  fs.unlinkSync(filePath);
                  logger.info(`Archivo ${fileInfo.type} limpiado localmente`, { path: filePath });
                }
              }
            } catch (cleanupError) {
              logger.warn(`Error al limpiar archivo ${fileInfo.type}`, { 
                error: cleanupError.message 
              });
            }
          }
        }
      }
      
      logger.error('Error crítico al crear perfil, transacción revertida', {
        error: error.message,
        stack: error.stack,
        userId: clientData.userId
      });
      
      return res.status(500).json({
        success: false,
        message: 'Error al crear perfil de cliente. Proceso cancelado.',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del sistema'
      });
    } finally {
      // Liberar conexión siempre
      client.release();
    }

    // Verificar que tenemos el perfil para la respuesta
    if (!profileForResponse) {
      return res.status(500).json({
        success: false,
        message: 'Error al crear perfil de cliente. No se pudo obtener los datos del perfil creado.',
        error: process.env.NODE_ENV === 'development' ? 'profileForResponse is null' : 'Error interno del sistema'
      });
    }

    // Agregar URLs para archivos
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    if (profileForResponse.fotocopiaCedula) {
      profileForResponse.fotocopiaCedulaUrl = `${baseUrl}/api/client-profiles/${profileForResponse.user_id}/file/cedula`;
    }

    if (profileForResponse.fotocopiaRut) {
      profileForResponse.fotocopiaRutUrl = `${baseUrl}/api/client-profiles/${profileForResponse.user_id}/file/rut`;
    }

    if (profileForResponse.anexosAdicionales) {
      profileForResponse.anexosAdicionalesUrl = `${baseUrl}/api/client-profiles/${profileForResponse.user_id}/file/anexos`;
    }

    logger.info('Perfil de cliente creado exitosamente', {
      userId: profileForResponse.user_id,
      clientId: profileForResponse.client_id
    });

    res.status(201).json({
      success: true,
      message: 'Perfil de cliente creado exitosamente',
      data: {
        client_id: profileForResponse.client_id,
        user_id: profileForResponse.user_id,
        company_name: profileForResponse.razonSocial,
        contact_name: profileForResponse.nombre,
        contact_phone: profileForResponse.telefono,
        contact_email: profileForResponse.email,
        address: profileForResponse.direccion,
        city: profileForResponse.ciudad,
        country: profileForResponse.pais,
        tax_id: profileForResponse.nit,
        price_list: null,
        notes: profileForResponse.notes,
        fotocopia_cedula: profileForResponse.fotocopiaCedulaUrl,
        fotocopia_rut: profileForResponse.fotocopiaRutUrl,
        anexos_adicionales: profileForResponse.anexosAdicionalesUrl,
        created_at: profileForResponse.created_at,
        updated_at: profileForResponse.updated_at,
        nit_number: profileForResponse.nit_number,
        verification_digit: profileForResponse.verification_digit,
        cardcode_sap: profileForResponse.cardcode_sap,
        clientprofilecode_sap: profileForResponse.clientprofilecode_sap,
        sap_lead_synced: profileForResponse.sap_lead_synced,
        cardtype_sap: "cLid"
      }
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
 *               razonSocial:
 *                 type: string
 *                 description: Razón social de la empresa
 *               nombre:
 *                 type: string
 *                 description: Nombre del contacto
 *               telefono:
 *                 type: string
 *                 description: Teléfono de contacto
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email de contacto
 *               direccion:
 *                 type: string
 *                 description: Dirección física
 *               nit_number:
 *                 type: string
 *                 description: Número de NIT sin dígito de verificación
 *               verification_digit:
 *                 type: string
 *                 description: Dígito de verificación del NIT
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
    
    logger.debug('Iniciando actualización de perfil de cliente', { 
      userId,
      method: req.method,
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

    // Validar NIT/dígito verificación
    if ((req.body.nit_number && !req.body.verification_digit) || 
        (!req.body.nit_number && req.body.verification_digit)) {
      return res.status(400).json({
        success: false,
        message: 'Si proporciona el NIT, debe incluir también el dígito de verificación y viceversa'
      });
    }
    
    // Extraer datos de actualización
    const updateData = {};
    
    const fieldMap = {
      'razonSocial': 'razonSocial',
      'nombre': 'nombre',
      'telefono': 'telefono',
      'email': 'email',
      'direccion': 'direccion', 
      'ciudad': 'ciudad',
      'pais': 'pais',
      'nit': 'nit',
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
      // Compatibilidad con snake_case
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

    // Extraer campos adicionales
    // Lista de campos que van específicamente a notes
    const fieldsForNotes = [
      'tipoDocumento', 'actividadComercial', 'numeroCuenta', 'entidadBancaria', 
      'tamanoEmpresa', 'cargoContacto', 'ingresosMensuales', 'representanteLegal', 
      'sectorEconomico', 'numeroDocumento', 'nombreContacto', 'patrimonio', 'tipoCuenta'
    ];

    // Extraer campos adicionales
    const additionalFields = {};

    // Procesar campos específicos para notes
    fieldsForNotes.forEach(field => {
      if (req.body[field] !== undefined && req.body[field] !== '') {
        additionalFields[field] = req.body[field];
      }
    });

    // Procesar cualquier otro campo que no esté en el fieldMap
    Object.keys(req.body).forEach(key => {
      if (!fieldMap[key] && !fieldsForNotes.includes(key) && 
          req.body[key] !== undefined && req.body[key] !== '') {
        additionalFields[key] = req.body[key];
      }
    });
    
    // Asignar campos que tienen valor
    Object.keys(req.body).forEach(key => {
      if (fieldMap[key] && req.body[key] !== undefined && req.body[key] !== '') {
        updateData[fieldMap[key]] = req.body[key];
      }
    });

    // Validar NIT duplicado DESPUÉS de definir updateData
    if (updateData.nit_number) {
      const nitCheck = await ClientProfile.nitExists(updateData.nit_number, userId);
      if (nitCheck.exists) {
        logger.warn('Intento de actualizar perfil con NIT duplicado', {
          nit_number: updateData.nit_number,
          userId,
          existingClientId: nitCheck.clientId,
          existingUserId: nitCheck.userId
        });
        
        return res.status(400).json({
          success: false,
          message: 'El NIT ya está registrado para otro usuario en el sistema',
          data: {
            duplicateNIT: true,
            nitNumber: updateData.nit_number
          }
        });
      }
    }

    // Verificar NIT en SAP DESPUÉS de definir updateData
    if (updateData.nit_number && updateData.verification_digit) {
      try {
        const profile = existingProfile; // Asegurar que tenemos referencia al perfil
        logger.info('Verificando estado de SAP antes de sincronización', {
          sapServiceManagerExists: !!sapServiceManager,
          isInitialized: sapServiceManager?.initialized,
          clientServiceExists: !!sapServiceManager?.clientService,
          clientId: profile.client_id
        });
        if (!sapServiceManager.initialized) {
          await sapServiceManager.initialize();
        }

        // Verificar conexión SAP específicamente
        if (!sapServiceManager.clientService.sessionId) {
          logger.info('Sesión SAP no activa, iniciando login');
          await sapServiceManager.clientService.login();
          if (!sapServiceManager.clientService.sessionId) {
            throw new Error('No se pudo establecer sesión con SAP para crear Lead');
          }
        }
        
        const sapCheck = await sapServiceManager.clientService.nitExistsInSAP(
          updateData.nit_number,
          updateData.verification_digit
        );
        
        if (sapCheck.exists) {
          logger.info('NIT ya existe en SAP, utilizando código SAP existente', {
            nit_number: updateData.nit_number,
            cardCode: sapCheck.cardCode
          });
          
          updateData.cardcode_sap = sapCheck.cardCode;
        }
      } catch (sapError) {
        // Logging detallado del error de SAP
        logger.error('Error crítico de SAP - detalles completos', {
          error: sapError.message,
          stack: sapError.stack,
          clientId: profile.client_id,
          sapServiceManagerInitialized: sapServiceManager?.initialized,
          clientServiceInitialized: sapServiceManager?.clientService?.initialized,
          sessionId: sapServiceManager?.clientService?.sessionId ? 'EXISTE' : 'NO_EXISTE',
          nit_number: profile.nit_number,
          verification_digit: profile.verification_digit
        });
        
        // Verificar si es un error de conectividad vs error de lógica
        if (sapError.message.includes('Network Error') || sapError.message.includes('ECONNREFUSED')) {
          logger.warn('Error de conectividad con SAP, continuando sin sincronización', {
            clientId: profile.client_id,
            error: sapError.message
          });
          // No hacer rollback por errores de conectividad
        } else {
          // Para errores de lógica, sí hacer rollback
          throw new Error(`Error crítico en SAP: ${sapError.message}`);
        }
      }
    }
    
    // Calcular tax_id
    if (updateData.nit_number && updateData.verification_digit) {
      updateData.nit = `${updateData.nit_number}-${updateData.verification_digit}`;
      logger.debug('tax_id actualizado a partir de NIT', {
        nit_number: updateData.nit_number,
        verification_digit: updateData.verification_digit,
        tax_id: updateData.nit
      });
    }

    logger.debug('Datos para actualización de perfil de cliente', { 
      userId,
      fields: Object.keys(updateData)
    });
    
    // Obtener perfil existente
    const existingProfile = await ClientProfile.getByUserId(userId);
    
    if (!existingProfile) {
      logger.warn('Perfil de cliente no encontrado al actualizar', { userId });
      return res.status(404).json({
        success: false,
        message: 'Perfil de cliente no encontrado'
      });
    }
    
    // Verificar permisos
    if (req.user.rol_id !== 1 && existingProfile.user_id !== req.user.id) {
      logger.warn('Intento no autorizado de actualizar perfil', {
        requestingUserId: req.user.id,
        targetUserId: userId,
        profileOwnerId: existingProfile.user_id
      });
      
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para actualizar este perfil'
      });
    }

    // Obtener y fusionar datos adicionales existentes
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

    const mergedAdditionalData = { ...existingAdditionalData, ...additionalFields };

    if (Object.keys(mergedAdditionalData).length > 0) {
      updateData.notes = JSON.stringify(mergedAdditionalData);
    }
    
    // Procesar archivos
    try {
      if (req.files) {
        const fileFieldMap = {
          'fotocopiaCedula': 'fotocopiaCedula',
          'fotocopia_cedula': 'fotocopiaCedula',
          'fotocopiaRut': 'fotocopiaRut',
          'fotocopia_rut': 'fotocopiaRut',
          'anexosAdicionales': 'anexosAdicionales',
          'anexos_adicionales': 'anexosAdicionales'
        };
        
        for (const field in req.files) {
          if (fileFieldMap[field]) {
            const standardizedField = fileFieldMap[field];
            const docType = standardizedField === 'fotocopiaCedula' ? 'cedula' : 
                          standardizedField === 'fotocopiaRut' ? 'rut' : 'anexos';
            
            // Eliminar archivo anterior si existe
            if (process.env.STORAGE_MODE === 's3') {
              const oldValue = existingProfile[standardizedField];
              if (oldValue) {
                const oldKey = S3Service.extractKeyFromUrl(oldValue);
                if (oldKey) {
                  try {
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
                  }
                }
              }
            } else {
              if (existingProfile[standardizedField]) {
                const oldPath = path.join(uploadDir, existingProfile[standardizedField]);
                if (fs.existsSync(oldPath)) {
                  fs.unlinkSync(oldPath);
                  logger.debug('Archivo anterior eliminado localmente', { 
                    path: oldPath, 
                    field: standardizedField 
                  });
                }
              }
            }
            
            // Guardar nuevo archivo
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
    }
    
    // Actualizar perfil
    const updatedProfile = await ClientProfile.updateByUserId(userId, updateData);
    
    if (!updatedProfile) {
      return res.status(404).json({
        success: false,
        message: 'Error al actualizar perfil'
      });
    }

    // Actualizar contactos si se proporcionaron datos de contacto
    if (updateData.nombre || updateData.telefono || updateData.email) {
      try {
        // Actualizar contacto principal
        await pool.query(
          `UPDATE client_contacts 
          SET name = COALESCE($1, name), 
              phone = COALESCE($2, phone), 
              email = COALESCE($3, email),
              updated_at = CURRENT_TIMESTAMP
          WHERE client_id = $4 AND is_primary = true`,
          [updateData.nombre, updateData.telefono, updateData.email, existingProfile.client_id]
        );
        
        logger.debug('Contacto principal actualizado', {
          clientId: existingProfile.client_id
        });
      } catch (contactUpdateError) {
        logger.warn('Error al actualizar contacto principal', {
          error: contactUpdateError.message,
          clientId: existingProfile.client_id
        });
      }
    }

    // Manejar contacto alternativo si se actualizaron esos datos
    if (updateData.nombreContacto || updateData.telefonoContacto || updateData.emailContacto) {
      try {
        // Verificar si existe contacto alternativo
        const altContactQuery = 'SELECT contact_id FROM client_contacts WHERE client_id = $1 AND is_primary = false';
        const altContactResult = await pool.query(altContactQuery, [existingProfile.client_id]);
        
        if (altContactResult.rows.length > 0) {
          // Actualizar contacto alternativo existente
          await pool.query(
            `UPDATE client_contacts 
            SET name = COALESCE($1, name), 
                position = COALESCE($2, position),
                phone = COALESCE($3, phone), 
                email = COALESCE($4, email),
                updated_at = CURRENT_TIMESTAMP
            WHERE client_id = $5 AND is_primary = false`,
            [
              updateData.nombreContacto, 
              updateData.cargoContacto,
              updateData.telefonoContacto, 
              updateData.emailContacto, 
              existingProfile.client_id
            ]
          );
        } else if (updateData.nombreContacto) {
          // Crear nuevo contacto alternativo
          await pool.query(
            `INSERT INTO client_contacts (client_id, name, position, phone, email, is_primary, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
              existingProfile.client_id,
              updateData.nombreContacto,
              updateData.cargoContacto || 'Contacto Alternativo',
              updateData.telefonoContacto,
              updateData.emailContacto
            ]
          );
        }
        
        logger.debug('Contacto alternativo procesado', {
          clientId: existingProfile.client_id
        });
      } catch (altContactError) {
        logger.warn('Error al procesar contacto alternativo', {
          error: altContactError.message,
          clientId: existingProfile.client_id
        });
      }
    }

    // Verificar sincronización con SAP
    if (updatedProfile.nit_number && updatedProfile.verification_digit) {
      const shouldSync = !updatedProfile.sap_lead_synced || !updatedProfile.cardcode_sap;
      
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
        
      if (shouldSync || hasChangedSapRelevantData) {
        try {
          if (!sapServiceManager.initialized) {
            logger.debug('Inicializando servicio de SAP antes de sincronizar');
            await sapServiceManager.initialize();
          }
          
          logger.info('Intentando sincronizar perfil con SAP', {
            client_id: updatedProfile.client_id,
            nit: updatedProfile.nit_number
          });
          
          const sapResult = await sapServiceManager.clientService.createOrUpdateBusinessPartnerLead(updatedProfile);
          
          logger.debug('Resultado de sincronización con SAP', {
            success: sapResult.success,
            cardCode: sapResult.cardCode,
            client_id: updatedProfile.client_id
          });
          
          if (sapResult.success) {
            await pool.query(
              `UPDATE client_profiles 
                SET cardcode_sap = $1, sap_lead_synced = true, updated_at = CURRENT_TIMESTAMP
                WHERE client_id = $2`,
              [sapResult.cardCode, updatedProfile.client_id]
            );
            
            updatedProfile.cardcode_sap = sapResult.cardCode;
            updatedProfile.sap_lead_synced = true;
            
            logger.info('Perfil de cliente sincronizado con SAP como Lead', {
              clientId: updatedProfile.client_id,
              cardcodeSap: sapResult.cardCode,
              isNew: sapResult.isNew
            });
          }
        } catch (sapError) {
          logger.error('Error al sincronizar perfil con SAP', {
            error: sapError.message,
            stack: sapError.stack,
            clientId: updatedProfile.client_id
          });
        }
      }
    }

    // Agregar URLs para archivos
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
      userId: req.params.userId
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
      
      logger.debug('Solicitando eliminación de perfil de cliente', { 
        userId, 
        requestingUserId: req.user.id 
      });
  
      // Verificar si existen órdenes asociadas a este usuario
      const ordersQuery = 'SELECT COUNT(*) as order_count FROM orders WHERE user_id = $1';
      const ordersResult = await pool.query(ordersQuery, [userId]);
      
      if (ordersResult.rows[0].order_count > 0) {
        logger.warn('Intento de eliminar perfil de cliente con órdenes asociadas', {
          userId,
          orderCount: ordersResult.rows[0].order_count,
          requestingUserId: req.user.id
        });
        
        return res.status(400).json({
          success: false,
          message: 'No se puede eliminar el perfil porque tiene órdenes asociadas',
          data: {
            orderCount: ordersResult.rows[0].order_count
          }
        });
      }
  
      // Si no hay órdenes, proceder con la eliminación
      const deletedProfile = await ClientProfile.deleteByUserId(userId);
      
      if (!deletedProfile) {
        return res.status(404).json({
          success: false,
          message: 'Perfil de cliente no encontrado'
        });
      }
      
      logger.info('Perfil de cliente eliminado exitosamente', {
        userId,
        clientId: deletedProfile.client_id,
        requestingUserId: req.user.id
      });
      
      res.status(200).json({
        success: true,
        message: 'Perfil de cliente eliminado exitosamente',
        data: deletedProfile
      });
    } catch (error) {
      logger.error('Error al eliminar perfil de cliente', {
        error: error.message,
        stack: error.stack,
        userId: req.params.userId,
        requestingUserId: req.user?.id
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
    return res.sendFile(filePath);
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
        
        // Para Swagger/API testing, devolver el enlace firmado en lugar de redirigir
        if (req.headers['user-agent'] && 
            (req.headers['user-agent'].includes('swagger') || 
            req.headers['user-agent'].includes('Swagger') ||
            req.headers['postman-token'] || 
            req.headers['x-requested-with'])) {
          const signedUrl = await S3Service.getSignedUrl('getObject', key, 3600);
          return res.json({
            success: true,
            downloadUrl: signedUrl,
            message: 'Use la URL downloadUrl para acceder al documento directamente'
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
   * Descarga directa de documento (para frontend)
   */
  async downloadDocument(req, res) {
    try {
      const { userId, fileType } = req.params;
      
      logger.debug('Iniciando descarga directa de documento', { 
        userId: userId, 
        fileType 
      });
      
      // Obtener el perfil para verificar si existe y obtener la ruta del archivo
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

      // Modo S3 - Obtener contenido directamente
      if (process.env.STORAGE_MODE === 's3') {
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

        // Generar URL firmada nueva para descarga directa
        try {
          const signedUrl = await S3Service.getSignedUrl('getObject', key, 3600);
          
          logger.debug('URL firmada generada exitosamente', {
            key: key,
            urlLength: signedUrl.length,
            userId: userId,
            fileType: fileType
          });
          
          // Para Swagger/API testing, devolver el enlace en lugar de redirigir
          if (req.headers['user-agent'] && 
              (req.headers['user-agent'].includes('swagger') || 
              req.headers['user-agent'].includes('Swagger') ||
              req.headers['postman-token'] || 
              req.headers['x-requested-with'])) {
            return res.json({
              success: true,
              downloadUrl: signedUrl,
              message: 'Use la URL downloadUrl para acceder al documento directamente'
            });
          }

          // En lugar de redirigir, descargar contenido y enviarlo directamente
          try {
            const fileData = await S3Service.getFileContent(key);
            
            // Configurar headers para descarga
            res.setHeader('Content-Type', fileData.contentType || 'application/octet-stream');
            res.setHeader('Content-Disposition', `attachment; filename="${fileData.fileName || 'documento'}"`);
            res.setHeader('Content-Length', fileData.content.length);
            res.setHeader('Cache-Control', 'private, no-cache');
            
            // Enviar el contenido como buffer binario
            return res.end(fileData.content);
            
          } catch (downloadError) {
            logger.error('Error descargando contenido de S3', {
              error: downloadError.message,
              key: key,
              userId: userId,
              fileType: fileType
            });
            
            return res.status(500).json({
              success: false,
              message: 'Error al descargar el documento'
            });
          }
          
        } catch (signedUrlError) {
          logger.error('Error generando URL firmada, intentando descarga directa', {
            error: signedUrlError.message,
            key: key,
            userId: userId,
            fileType: fileType
          });
          
          // Fallback: intentar descarga directa del contenido
          const fileData = await S3Service.getFileContent(key);
          
          // Configurar headers para descarga
          res.setHeader('Content-Type', fileData.contentType);
          res.setHeader('Content-Disposition', `attachment; filename="${fileData.fileName}"`);
          res.setHeader('Content-Length', fileData.content.length);

          // Enviar el contenido como buffer binario
          return res.end(fileData.content);
        }
      }
      // Modo local - usar método existente
      else {
        const uploadDir = path.join(process.cwd(), 'uploads');
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
        
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        const fileName = path.basename(documentUrl);
        
        // Configurar headers para descarga
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        
        // Enviar el archivo
        return res.sendFile(filePath);
      }
      
    } catch (error) {
      logger.error('Error en descarga directa de documento', {
        error: error.message,
        stack: error.stack,
        userId: req.params.userId,
        fileType: req.params.fileType
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al descargar documento',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  /**
   * Lista documentos disponibles para un perfil
   */
  async listDocuments(req, res) {
    try {
      const { userId } = req.params;
      
      // Obtener el perfil por ID de usuario
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
          message: 'No tiene permiso para acceder a este perfil'
        });
      }
      
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      const documents = {
        cedula: {
          available: !!profile.fotocopiaCedula,
          downloadUrl: profile.fotocopiaCedula ? `${baseUrl}/api/client-profiles/user/${userId}/file/cedula` : null
        },
        rut: {
          available: !!profile.fotocopiaRut,
          downloadUrl: profile.fotocopiaRut ? `${baseUrl}/api/client-profiles/user/${userId}/file/rut` : null
        },
        anexos: {
          available: !!profile.anexosAdicionales,
          downloadUrl: profile.anexosAdicionales ? `${baseUrl}/api/client-profiles/user/${userId}/file/anexos` : null
        }
      };
      
      res.json({
        success: true,
        data: documents
      });
      
    } catch (error) {
      logger.error('Error al listar documentos', {
        error: error.message,
        stack: error.stack,
        userId: req.params.userId
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al obtener lista de documentos'
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
  uploadProfileDocument: clientProfileController.uploadProfileDocument,
  listDocuments: clientProfileController.listDocuments,
  downloadDocument: clientProfileController.downloadDocument
};