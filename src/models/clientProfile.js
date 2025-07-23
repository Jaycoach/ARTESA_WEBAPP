// src/models/ClientProfile.js - Versión actualizada
const pool = require('../config/db');
const { createContextLogger } = require('../config/logger');
const S3UrlManager = require('../utils/S3UrlManager');


// Crear una instancia del logger con contexto
const logger = createContextLogger('ClientProfileModel');

/**
 * Clase que representa el modelo de perfiles de cliente actualizado
 * para coincidir con el formulario del frontend
 * @class ClientProfile
 */
class ClientProfile {
  /**
   * Obtiene un perfil de cliente por su ID
   * @async
   * @param {number} userId - ID del perfil de cliente
   * @returns {Promise<Object|null>} - Perfil de cliente encontrado o null si no existe
   * @throws {Error} Si ocurre un error en la consulta
   */
  static async getByUserId(userId) {
    try {
      logger.debug('Buscando perfil de cliente por ID', { userId });
      
      const query = `
        SELECT 
          cp.client_id,
          cp.user_id,
          cp.company_name AS "razonSocial",
          u.name AS "nombre",
          cp.contact_phone AS "telefono",
          u.mail AS "email",
          cp.address AS "direccion",
          cp.city AS "ciudad",
          cp.country AS "pais",
          cp.tax_id AS "nit",
          cp.nit_number,
          cp.verification_digit,
          cp.cardcode_sap,
          cp.clientprofilecode_sap,
          cp.price_list,
          cp.price_list_code,
          cp.notes,
          cp.fotocopia_cedula AS "fotocopiaCedula",
          cp.fotocopia_rut AS "fotocopiaRut",
          cp.anexos_adicionales AS "anexosAdicionales",
          cp.created_at,
          cp.updated_at,
          u.name AS user_name
        FROM client_profiles cp
		    JOIN users u ON cp.user_id = u.id
        WHERE user_id = $1;
      `;
      
      const { rows } = await pool.query(query, [userId]);
      
      if (rows.length === 0) {
        logger.debug('Perfil de cliente no encontrado', { userId });
        return null;
      }
      
      // Extraer campos adicionales del campo notes si está en formato JSON
      const profile = rows[0];
      try {
        if (profile.notes && typeof profile.notes === 'string') {
          // Intentar parsear como JSON
          const extraData = JSON.parse(profile.notes);
          
          // Almacenar los datos adicionales en extraInfo para que estén disponibles
          profile.extraInfo = { ...extraData };
        }
      } catch (e) {
        logger.warn('No se pudo parsear los datos adicionales del perfil', {
          userId,
          error: e.message
        });
      }
      
      logger.debug('Perfil de cliente encontrado', { userId });
      return profile;
    } catch (error) {
      logger.error('Error al buscar perfil de cliente por ID', { 
        error: error.message,
        userId
      });
      throw error;
    }
  }
  
  /**
   * Obtiene un perfil de cliente por ID de usuario
   * @async
   * @param {number} userId - ID del usuario
   * @returns {Promise<Object|null>} - Perfil de cliente encontrado o null si no existe
   * @throws {Error} Si ocurre un error en la consulta
   */
  static async getById(userId) {
    try {
      logger.debug('Buscando perfil de cliente por ID', { userId });
      
      const query = `
        SELECT 
          cp.client_id,
          cp.user_id,
          cp.company_name AS "razonSocial",
          u.name AS "nombre",
          cp.contact_phone AS "telefono",
          u.mail AS "email",
          cp.address AS "direccion",
          cp.city AS "ciudad",
          cp.country AS "pais",
          cp.tax_id AS "nit",
          cp.nit_number,
          cp.verification_digit,
          cp.cardcode_sap,
          cp.clientprofilecode_sap,
          cp.price_list,
          cp.price_list_code,
          cp.notes,
          cp.fotocopia_cedula AS "fotocopiaCedula",
          cp.fotocopia_rut AS "fotocopiaRut",
          cp.anexos_adicionales AS "anexosAdicionales",
          cp.created_at,
          cp.updated_at,
          u.name AS user_name
        FROM client_profiles cp
		    JOIN users u ON cp.user_id = u.id
        WHERE user_id = $1;
      `;
      
      const { rows } = await pool.query(query, [userId]);
      
      if (rows.length === 0) {
        logger.debug('Perfil de cliente no encontrado', { userId });
        return null;
      }
      
      // Extraer campos adicionales del campo notes si está en formato JSON
      const profile = rows[0];
      try {
        if (profile.notes && typeof profile.notes === 'string') {
        // Intentar parsear como JSON
          const extraData = JSON.parse(profile.notes);
          
          // Almacenar los datos adicionales en extraInfo para que estén disponibles
          profile.extraInfo = { ...extraData };
        }
      } catch (e) {
        logger.warn('No se pudo parsear los datos adicionales del perfil', {
          userId,
          error: e.message
        });
      }
      
      logger.debug('Perfil de cliente encontrado', { userId });
      return profile;
    } catch (error) {
      logger.error('Error al buscar perfil de cliente por ID', { 
        error: error.message,
        userId
      });
      throw error;
    }
  }
  
  /**
   * Obtiene todos los perfiles de clientes
   * @async
   * @returns {Promise<Array<Object>>} - Lista de perfiles de clientes
   * @throws {Error} Si ocurre un error en la consulta
   */
  static async getAll() {
    try {
      logger.debug('Obteniendo todos los perfiles de clientes');
      
      const query = `
        SELECT 
          cp.client_id,
          cp.user_id,
          cp.company_name AS "razonSocial",
          u.name AS "nombre",
          cp.contact_phone AS "telefono",
          u.mail AS "email",
          cp.address AS "direccion",
          cp.city AS "ciudad",
          cp.country AS "pais",
          cp.tax_id AS "nit",
          cp.nit_number,
          cp.verification_digit,
          cp.cardcode_sap,
          cp.clientprofilecode_sap,
          cp.price_list,
          cp.price_list_code,
          cp.notes,
          cp.fotocopia_cedula AS "fotocopiaCedula",
          cp.fotocopia_rut AS "fotocopiaRut",
          cp.anexos_adicionales AS "anexosAdicionales",
          cp.created_at,
          cp.updated_at,
          u.name AS user_name
        FROM client_profiles cp
		    JOIN users u ON cp.user_id = u.id
        ORDER BY company_name;
      `;
      
      const { rows } = await pool.query(query);
      
      // Procesar cada perfil para extraer datos adicionales
      const profiles = rows.map(profile => {
        try {
          if (profile.notes && typeof profile.notes === 'string') {
            // Intentar parsear como JSON
            const extraData = JSON.parse(profile.notes);
            
            // Almacenar los datos adicionales en extraInfo para que estén disponibles
            profile.additionalInfo = { ...extraData };
          }
        } catch (e) {
          logger.warn('No se pudo parsear los datos adicionales de un perfil', {
            userId: profile.client_id,
            error: e.message
          });
        }
        return profile;
      });
      
      logger.debug('Perfiles de clientes obtenidos', { count: profiles.length });
      return profiles;
    } catch (error) {
      logger.error('Error al obtener todos los perfiles de clientes', { 
        error: error.message
      });
      throw error;
    }
  }

/**
 * Crea un nuevo perfil de cliente con mapeo al formulario del frontend
 * @async
 * @param {Object} clientData - Datos del perfil de cliente
 * @returns {Promise<Object>} - Perfil de cliente creado
 * @throws {Error} Si ocurre un error en la inserción
 */
  static async create(clientData) {
    // Asegurar que solo se pueda crear un perfil por usuario
    const existingProfile = await this.getByUserId(clientData.userId);
    if (existingProfile) {
      throw new Error('El usuario ya tiene un perfil');
    }
    try {
      // Extraer los campos principales que se almacenan directamente
      const {
        userId,
        nombre = null,
        email = null,
        telefono = null,
        direccion = null,
        ciudad = null,
        pais = null,
        telefonoContacto = null,
        emailContacto = null,
        razonSocial = null,
        nit = null,
        // Campos de archivos
        fotocopiaCedula = null,
        fotocopiaRut = null,
        anexosAdicionales = null
      } = clientData;
      
      logger.debug('Creando nuevo perfil de cliente', { 
        userId,
        nombre,
        email
      });

      // Validaciones de longitud de campos - TODOS los character varying son 255 máximo
      const fieldLimits = {
        company_name: 255,
        contact_name: 255, 
        contact_phone: 255,
        contact_email: 255,
        address: 255,
        city: 255,
        country: 255,
        tax_id: 255,
        nit_number: 255,
        fotocopia_cedula: 255,
        fotocopia_rut: 255,
        anexos_adicionales: 255,
        cardcode_sap: 255,
        clientprofilecode_sap: 255,
        price_list_code: 255
      };

      // Función para truncar campos si exceden el límite
      const truncateField = (value, limit) => {
        if (!value) return value;
        const stringValue = String(value);
        if (stringValue.length > limit) {
          logger.warn(`Campo truncado de ${stringValue.length} a ${limit} caracteres`, {
            originalLength: stringValue.length,
            truncatedValue: stringValue.substring(0, limit)
          });
          return stringValue.substring(0, limit);
        }
        return stringValue;
      };

      // Truncar campos según los límites
      let razonSocialTruncated = truncateField(razonSocial, fieldLimits.company_name);
      let nombreTruncated = truncateField(nombre, fieldLimits.contact_name);
      let direccionTruncated = truncateField(direccion, fieldLimits.address);
      let ciudadTruncated = truncateField(ciudad, fieldLimits.city);
      let paisTruncated = truncateField(pais, fieldLimits.country);
      let nitTruncated = truncateField(nit, fieldLimits.tax_id);

      // Truncar campos de contacto
      const contactPhone = truncateField(telefonoContacto || telefono, fieldLimits.contact_phone);
      const contactEmail = truncateField(emailContacto || email, fieldLimits.contact_email);

      // Truncar campos de archivos
      let fotocopiaCedulaTruncated = truncateField(fotocopiaCedula, fieldLimits.fotocopia_cedula);
      let fotocopiaRutTruncated = truncateField(fotocopiaRut, fieldLimits.fotocopia_rut);
      let anexosAdicionalesTruncated = truncateField(anexosAdicionales, fieldLimits.anexos_adicionales);

      // Truncar campos específicos del NIT
      if (clientData.nit_number) {
        clientData.nit_number = truncateField(clientData.nit_number, fieldLimits.nit_number);
      }

      // Generar clientprofilecode_sap después del truncamiento
      let clientProfileCode = null;
      if (clientData.nit_number) {
        clientProfileCode = `CI${clientData.nit_number}`;
        // Validar que el clientProfileCode no exceda 255 caracteres
        if (clientProfileCode && clientProfileCode.length > 255) {
          logger.warn('clientProfileCode excede 255 caracteres, truncando', {
            originalLength: clientProfileCode.length,
            original: clientProfileCode,
            truncated: clientProfileCode.substring(0, 255)
          });
          clientProfileCode = clientProfileCode.substring(0, 255);
        }

        // Validar que listaPreciosCodigo no exceda 255 caracteres
        if (listaPreciosCodigo && listaPreciosCodigo.length > 255) {
          logger.warn('listaPreciosCodigo excede 255 caracteres, truncando', {
            originalLength: listaPreciosCodigo.length,
            original: listaPreciosCodigo,
            truncated: listaPreciosCodigo.substring(0, 255)
          });
          listaPreciosCodigo = listaPreciosCodigo.substring(0, 255);
        }
      }
      
      // Validar que exista userId
      if (!userId) {
        throw new Error('Se requiere el ID de usuario para crear el perfil');
      }

      // Extraer todos los demás campos para almacenarlos como JSON en notes
      const additionalFields = { ...clientData };
      
      // Eliminar campos que ya están mapeados a columnas de la base de datos
      ['userId', 'nombre', 'email', 'telefono', 'direccion', 'ciudad', 'pais', 
        'razonSocial', 'nit', 'fotocopiaCedula', 'fotocopiaRut', 'anexosAdicionales',
        'nit_number', 'verification_digit', 'cardcode_sap', 'clientprofilecode_sap', 'listaPrecios',
        'telefonoContacto', 'emailContacto'].forEach(key => {
        delete additionalFields[key];
      });
      
      // Mapear los campos del formulario a los campos de la base de datos
      const query = `
        INSERT INTO client_profiles (
          user_id, company_name, contact_name, contact_phone, contact_email, 
          address, city, country, tax_id, nit_number, verification_digit, 
          fotocopia_cedula, fotocopia_rut, anexos_adicionales, notes, 
          price_list, price_list_code, cardcode_sap, cardtype_sap, clientprofilecode_sap,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) RETURNING *
      `;

      // Crear JSON con campos adicionales
      const notesJSON = Object.keys(additionalFields).length > 0 ? 
        JSON.stringify(additionalFields) : null;

      const values = [
        userId,                           // $1 - user_id
        razonSocialTruncated,            // $2 - company_name
        nombreTruncated,                 // $3 - contact_name
        contactPhone,                    // $4 - contact_phone
        contactEmail,                    // $5 - contact_email
        direccionTruncated,              // $6 - address
        ciudadTruncated,                 // $7 - city
        paisTruncated || 'Colombia',     // $8 - country
        nitTruncated,                    // $9 - tax_id
        clientData.nit_number,           // $10 - nit_number
        clientData.verification_digit,   // $11 - verification_digit
        fotocopiaCedulaTruncated,        // $12 - fotocopia_cedula
        fotocopiaRutTruncated,           // $13 - fotocopia_rut
        anexosAdicionalesTruncated,      // $14 - anexos_adicionales
        notesJSON,                       // $15 - notes
        clientData.listaPrecios || 1,    // $16 - price_list
        clientData.listaPreciosCodigo || null, // $17 - price_list_code
        null,                            // $18 - cardcode_sap
        'cLid',                          // $19 - cardtype_sap
        clientProfileCode                // $20 - clientprofilecode_sap
      ];

      const { rows } = await pool.query(query, values);
      
      if (rows.length === 0) {
        throw new Error('No se pudo crear el perfil de cliente');
      }

      const createdProfile = rows[0];
      
      // Asegurar que los campos críticos estén presentes en el perfil resultante
      if (clientData.nit_number) createdProfile.nit_number = clientData.nit_number;
      if (clientData.verification_digit !== undefined) createdProfile.verification_digit = clientData.verification_digit;
      logger.debug('Campos críticos en el perfil creado:', {
        nit_number: createdProfile.nit_number,
        verification_digit: createdProfile.verification_digit,
        tax_id: createdProfile.tax_id || clientData.nit
      });
      
      // Renombrar campos para coincidir con el formulario
      const profile = {
        client_id: createdProfile.client_id,
        user_id: createdProfile.user_id,
        nombre: createdProfile.contact_name,
        email: createdProfile.contact_email,
        telefono: createdProfile.contact_phone,
        direccion: createdProfile.address,
        ciudad: createdProfile.city,
        pais: createdProfile.country,
        razonSocial: createdProfile.company_name,
        nit: createdProfile.tax_id,
        nit_number: createdProfile.nit_number,              // ← AGREGAR ESTO
        verification_digit: createdProfile.verification_digit, // ← Y ESTO
        fotocopiaCedula: createdProfile.fotocopia_cedula,
        fotocopiaRut: createdProfile.fotocopia_rut,
        anexosAdicionales: createdProfile.anexos_adicionales,
        created_at: createdProfile.created_at,
        updated_at: createdProfile.updated_at,
        ...additionalFields
      };
      
      logger.info('Perfil de cliente creado exitosamente', { 
        userId: profile.client_id,
        userId
      });
      
      return profile;
    } catch (error) {
      logger.error('Error al crear perfil de cliente', { 
        error: error.message,
        userId: clientData.userId,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Crea un nuevo perfil de cliente usando una conexión transaccional existente
   * @async
   * @param {Object} client - Conexión de base de datos transaccional
   * @param {Object} clientData - Datos del perfil de cliente
   * @returns {Promise<Object>} - Perfil de cliente creado
   * @throws {Error} Si ocurre un error en la inserción
   */
  static async createWithTransaction(client, clientData) {
    // Asegurar que solo se pueda crear un perfil por usuario
    const existingProfile = await this.getByUserId(clientData.userId);
    if (existingProfile) {
      throw new Error('El usuario ya tiene un perfil');
    }
    
    try {
      // Extraer los campos principales que se almacenan directamente
      const {
        userId,
        nombre = null,
        email = null,
        telefono = null,
        direccion = null,
        ciudad = null,
        pais = null,
        telefonoContacto = null,
        emailContacto = null,
        razonSocial = null,
        nit = null,
        nit_number = null,
        verification_digit = null,
        fotocopiaCedula = null,
        fotocopiaRut = null,
        anexosAdicionales = null,
        listaPreciosCodigo = null,
        cardcode_sap = null
      } = clientData;
      
      // Extraer campos adicionales para almacenar en notes
      const additionalFields = { ...clientData };
      
      // Generar clientprofilecode_sap si tenemos nit_number
      let clientProfileCode = null;
      if (nit_number) {
        clientProfileCode = `CI${nit_number}`;
      }
      
      // Eliminar campos que ya están mapeados a columnas de la base de datos
      ['userId', 'nombre', 'email', 'telefono', 'direccion', 'ciudad', 'pais', 
        'razonSocial', 'nit', 'fotocopiaCedula', 'fotocopiaRut', 'anexosAdicionales',
        'nit_number', 'verification_digit', 'cardcode_sap', 'clientprofilecode_sap', 'listaPrecios',
        'telefonoContacto', 'emailContacto', 'listaPreciosCodigo'].forEach(key => {
        delete additionalFields[key];
      });
      
      // Convertir campos adicionales a JSON
      const notesJSON = Object.keys(additionalFields).length > 0 
        ? JSON.stringify(additionalFields) 
        : null;
      // Truncar todos los campos character varying a 255 caracteres máximo
      const companyNameTrunc = razonSocial ? razonSocial.substring(0, 255) : null;
      const contactNameTrunc = nombre ? nombre.substring(0, 255) : null;
      const contactPhoneTrunc = telefono ? telefono.substring(0, 255) : null;
      const contactEmailTrunc = email ? email.substring(0, 255) : null;
      const addressTrunc = direccion ? direccion.substring(0, 255) : null;
      const cityTrunc = ciudad ? ciudad.substring(0, 255) : null;
      const countryTrunc = pais ? pais.substring(0, 255) : null;
      const taxIdTrunc = nit ? nit.substring(0, 255) : null;
      const nitNumberTrunc = nit_number ? nit_number.substring(0, 255) : null;
      const fotocopiaCedulaTrunc = fotocopiaCedula ? fotocopiaCedula.substring(0, 255) : null;
      const fotocopiaRutTrunc = fotocopiaRut ? fotocopiaRut.substring(0, 255) : null;
      const anexosAdicionalesTrunc = anexosAdicionales ? anexosAdicionales.substring(0, 255) : null;
      
      logger.debug('Creando perfil de cliente con datos procesados', {
        userId,
        companyName: companyNameTrunc,
        nit_number: nitNumberTrunc,
        verification_digit
      });
      
      // **USAR LA CONEXIÓN TRANSACCIONAL EN LUGAR DE pool.query**
      const query = `
        INSERT INTO client_profiles (
          user_id, company_name, contact_name, contact_phone, contact_email,
          address, city, country, tax_id, nit_number, verification_digit,
          cardcode_sap, clientprofilecode_sap, notes,
          fotocopia_cedula, fotocopia_rut, anexos_adicionales, price_list_code
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
        ) RETURNING *;
      `;
      
      const values = [
        userId,                    // $1
        companyNameTrunc,          // $2
        contactNameTrunc,          // $3
        contactPhoneTrunc,         // $4
        contactEmailTrunc,         // $5
        addressTrunc,              // $6
        cityTrunc,                 // $7
        countryTrunc,              // $8
        taxIdTrunc,                // $9
        nitNumberTrunc,            // $10
        verification_digit,        // $11
        cardcode_sap,              // $12
        clientProfileCode,         // $13
        notesJSON,                 // $14
        fotocopiaCedulaTrunc,      // $15
        fotocopiaRutTrunc,         // $16
        anexosAdicionalesTrunc,    // $17
        listaPreciosCodigo || null // $18
      ];
      
      const { rows } = await client.query(query, values);
      const createdProfile = rows[0];
      
      // Asegurar que los campos críticos estén presentes en el perfil
      createdProfile.nit_number = clientData.nit_number;
      createdProfile.verification_digit = clientData.verification_digit;
      
      logger.debug('Campos críticos en el perfil creado:', {
        nit_number: createdProfile.nit_number,
        verification_digit: createdProfile.verification_digit,
        tax_id: createdProfile.tax_id || clientData.nit
      });
      
      // Renombrar campos para coincidir con el formulario
      const profile = {
        client_id: createdProfile.client_id,
        user_id: createdProfile.user_id,
        nombre: createdProfile.contact_name,
        email: createdProfile.contact_email,
        telefono: createdProfile.contact_phone,
        direccion: createdProfile.address,
        ciudad: createdProfile.city,
        pais: createdProfile.country,
        razonSocial: createdProfile.company_name,
        nit: createdProfile.tax_id,
        nit_number: createdProfile.nit_number,
        verification_digit: createdProfile.verification_digit,
        fotocopiaCedula: createdProfile.fotocopia_cedula,
        fotocopiaRut: createdProfile.fotocopia_rut,
        anexosAdicionales: createdProfile.anexos_adicionales,
        created_at: createdProfile.created_at,
        updated_at: createdProfile.updated_at,
        ...additionalFields
      };
      
      logger.info('Perfil de cliente creado exitosamente en transacción', { 
        userId: profile.client_id,
        userId
      });
      
      return profile;
    } catch (error) {
      logger.error('Error al crear perfil de cliente en transacción', { 
        error: error.message,
        userId: clientData.userId,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Actualiza un perfil de cliente existente
   * @async
   * @param {number} userId - ID del cliente
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<Object|null>} - Perfil actualizado o null si no existe
   * @throws {Error} Si ocurre un error en la actualización
   */
  static async updateByUserId(userId, updateData) {
    try {
      logger.debug('Actualizando perfil de cliente', { 
        userId,
        fields: Object.keys(updateData)
      });
      
      const {
        nombre,
        email,
        telefono,
        direccion,
        ciudad,
        pais,
        razonSocial,
        nit,
        fotocopiaCedula,
        fotocopiaRut,
        anexosAdicionales,
        // Otros campos específicos que quizás queramos extraer
        tipoDocumento,
        numeroDocumento,
        nit_number,
        verification_digit,
        listaPreciosCodigo
      } = updateData;
      
      // Extraer campos adicionales para almacenar en notes
      const additionalFields = { ...updateData };

      // Generar clientprofilecode_sap si tenemos nit_number
      let clientProfileCode = null;
      if (nit_number) {
        clientProfileCode = `CI${nit_number}`;
      }
      
      // Eliminar campos que ya están mapeados a columnas de la base de datos
      ['userId', 'nombre', 'email', 'telefono', 'direccion', 'ciudad', 'pais', 
        'razonSocial', 'nit', 'fotocopiaCedula', 'fotocopiaRut', 'anexosAdicionales',
        'nit_number', 'verification_digit', 'cardcode_sap', 'clientprofilecode_sap', 'listaPrecios',
        'telefonoContacto', 'emailContacto', 'listaPreciosCodigo'].forEach(key => {
        delete additionalFields[key];
      });
      
      
      // Construir la consulta de actualización
      const query = `
      UPDATE client_profiles
      SET 
        company_name = COALESCE($1, company_name),
        contact_name = COALESCE($2, contact_name),
        contact_phone = COALESCE($3, contact_phone),
        contact_email = COALESCE($4, contact_email),
        address = COALESCE($5, address),
        city = COALESCE($6, city),
        country = COALESCE($7, country),
        tax_id = COALESCE($8, tax_id),
        nit_number = COALESCE($9, nit_number),
        verification_digit = COALESCE($10, verification_digit),
        cardcode_sap = COALESCE($11, cardcode_sap),
        clientprofilecode_sap = COALESCE($12, CASE WHEN $9 IS NOT NULL THEN CONCAT('C', $9) ELSE clientprofilecode_sap END),
        notes = $13,
        fotocopia_cedula = COALESCE($14, fotocopia_cedula),
        fotocopia_rut = COALESCE($15, fotocopia_rut),
        anexos_adicionales = COALESCE($16, anexos_adicionales),
        price_list_code = COALESCE($17, price_list_code),
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $18
      RETURNING *;
      `;

      // Obtener perfil actual para preservar datos adicionales
      const currentProfile = await this.getByUserId(userId);
      let existingAdditionalData = {};

      // Extraer datos adicionales existentes si hay
      if (currentProfile && currentProfile.notes) {
        try {
          existingAdditionalData = JSON.parse(currentProfile.notes);
        } catch (e) {
          logger.warn('Error al parsear notes existente', { error: e.message });
        }
      }

      // Fusionar datos adicionales existentes con nuevos
      const mergedAdditionalData = { ...existingAdditionalData, ...additionalFields };

      // Crear JSON con campos adicionales
      const notesJSON = Object.keys(mergedAdditionalData).length > 0 ? 
        JSON.stringify(mergedAdditionalData) : null;

      // Función para truncar campos si exceden el límite
      const truncateField = (value, limit) => {
        if (!value) return value;
        const stringValue = String(value);
        if (stringValue.length > limit) {
          logger.warn(`Campo truncado de ${stringValue.length} a ${limit} caracteres`, {
            originalLength: stringValue.length,
            truncatedValue: stringValue.substring(0, limit)
          });
          return stringValue.substring(0, limit);
        }
        return stringValue;
      };

      // Definir ANTES del array values, después de extraer additionalFields
      const { telefonoContacto, emailContacto } = updateData;
      // Aplicar las mismas validaciones de truncamiento en update
      const razonSocialTrunc = truncateField(razonSocial, 255);
      const nombreTrunc = truncateField(nombre, 255);
      const direccionTrunc = truncateField(direccion, 255);
      const ciudadTrunc = truncateField(ciudad, 255);
      const paisTrunc = truncateField(pais, 255);
      const nitTrunc = truncateField(nit, 255);
      const fotocopiaCedulaTrunc = truncateField(fotocopiaCedula, 255);
      const fotocopiaRutTrunc = truncateField(fotocopiaRut, 255);
      const anexosAdicionalesTrunc = truncateField(anexosAdicionales, 255);
      const nitNumberTrunc = truncateField(nit_number, 255);

      const contactPhone = truncateField(telefonoContacto || telefono, 255);
      const contactEmail = truncateField(emailContacto || email, 255);

      const values = [
        razonSocialTrunc,          // $1 - company_name
        nombreTrunc,               // $2 - contact_name
        contactPhone,              // $3 - contact_phone
        contactEmail,              // $4 - contact_email
        direccionTrunc,            // $5 - address
        ciudadTrunc,               // $6 - city
        paisTrunc,                 // $7 - country
        nitTrunc,                  // $8 - tax_id
        nitNumberTrunc,            // $9 - nit_number
        verification_digit,        // $10 - verification_digit
        updateData.cardcode_sap,   // $11 - cardcode_sap
        clientProfileCode,         // $12 - Para generar clientprofilecode_sap
        notesJSON,                 // $13 - notes
        fotocopiaCedulaTrunc,      // $14 - fotocopia_cedula
        fotocopiaRutTrunc,         // $15 - fotocopia_rut
        anexosAdicionalesTrunc,    // $16 - anexos_adicionales
        updateData.listaPreciosCodigo || null, // $17 - price_list_code
        userId                     // $18 - user_id para WHERE
      ];

      const { rows } = await pool.query(query, values);
      
      if (rows.length === 0) {
        logger.warn('Perfil de cliente no encontrado al actualizar', { userId });
        return null;
      }
      
      // Crear un objeto que combine los campos de la base de datos con los adicionales
      const updatedProfile = {
        ...rows[0],
        ...additionalFields
      };
      
      // Renombrar campos para coincidir con el formulario
      const profile = {
        client_id: updatedProfile.client_id,
        user_id: updatedProfile.user_id,
        nombre: updatedProfile.contact_name,
        email: updatedProfile.contact_email,
        telefono: updatedProfile.contact_phone,
        direccion: updatedProfile.address,
        ciudad: updatedProfile.city,
        pais: updatedProfile.country,
        razonSocial: updatedProfile.company_name,
        nit: updatedProfile.tax_id,
        fotocopiaCedula: updatedProfile.fotocopia_cedula,
        fotocopiaRut: updatedProfile.fotocopia_rut,
        anexosAdicionales: updatedProfile.anexos_adicionales,
        created_at: updatedProfile.created_at,
        updated_at: updatedProfile.updated_at,
        ...additionalFields
      };
      
      logger.info('Perfil de cliente actualizado exitosamente', { 
        userId,
        razonSocial: updatedProfile.company_name
      });

      // Agregar extraInfo si existe
      if (additionalFields && Object.keys(additionalFields).length > 0) {
        profile.extraInfo = additionalFields;
      }
      
      return profile;
    } catch (error) {
      logger.error('Error al actualizar perfil de cliente', { 
        error: error.message,
        userId
      });
      throw error;
    }
  }
  
  /**
   * Elimina un perfil de cliente
   * @async
   * @param {number} userId - ID del cliente
   * @returns {Promise<Object|null>} - Perfil eliminado o null si no existe
   * @throws {Error} Si ocurre un error en la eliminación
   */
  static async deleteByUserId(userId) {
    const client = await pool.connect();
    try {
      logger.debug('Eliminando perfil de cliente', { userId });
      
      // Iniciar transacción
      await client.query('BEGIN');

      // Luego, eliminar el perfil
      const query = 'DELETE FROM client_profiles WHERE user_id = $1 RETURNING *;';
      const { rows } = await client.query(query, [userId]);
      
      if (rows.length === 0) {
        // Si no se encontró el perfil, hacer rollback y retornar null
        await client.query('ROLLBACK');
        logger.warn('Perfil de cliente no encontrado al eliminar', { userId });
        return null;
      }
      
      // Confirmar transacción
      await client.query('COMMIT');
      
      logger.info('Perfil de cliente eliminado exitosamente y usuario desactivado', { 
        userId,
        companyName: rows[0].company_name
      });
      
      return rows[0];
    } catch (error) {
      // Rollback en caso de error
      await client.query('ROLLBACK');
      
      logger.error('Error al eliminar perfil de cliente', { 
        error: error.message,
        userId,
        stack: error.stack
      });
      throw error;
    } finally {
      // Liberar el cliente de la conexión
      client.release();
    }
  }
  
  /**
   * Verifica si un usuario ya tiene un perfil
   * @async
   * @param {number} userId - ID del usuario
   * @returns {Promise<boolean>} - true si el usuario ya tiene un perfil, false en caso contrario
   * @throws {Error} Si ocurre un error en la consulta
   */
  static async userHasProfile(userId) {
    try {
      logger.debug('Verificando si el usuario ya tiene un perfil', { userId });
      
      const query = 'SELECT client_id FROM client_profiles WHERE user_id = $1 LIMIT 1;';
      
      const { rows } = await pool.query(query, [userId]);
      
      const hasProfile = rows.length > 0;
      
      logger.debug('Resultado de verificación de perfil de usuario', {
        userId,
        hasProfile
      });
      
      return hasProfile;
    } catch (error) {
      logger.error('Error al verificar si el usuario tiene perfil', { 
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Verifica si un NIT ya existe en la base de datos
   * @async
   * @param {string} nitNumber - Número de NIT sin DV
   * @param {number} [excludeUserId] - ID de usuario a excluir de la verificación (para actualizaciones)
   * @returns {Promise<{exists: boolean, clientId: number|null, userId: number|null}>} - Resultado de la verificación
   * @throws {Error} Si ocurre un error en la consulta
   */
  static async nitExists(nitNumber, excludeUserId = null) {
    try {
      logger.debug('Verificando si el NIT ya existe', { 
        nitNumber, 
        excludeUserId 
      });
      
      let query = 'SELECT client_id, user_id FROM client_profiles WHERE nit_number = $1';
      const params = [nitNumber];
      
      if (excludeUserId) {
        query += ' AND user_id != $2';
        params.push(excludeUserId);
      }
      
      const { rows } = await pool.query(query, params);
      
      const exists = rows.length > 0;
      const result = {
        exists,
        clientId: exists ? rows[0].client_id : null,
        userId: exists ? rows[0].user_id : null
      };
      
      logger.debug('Resultado de verificación de NIT existente', result);
      
      return result;
    } catch (error) {
      logger.error('Error al verificar si el NIT existe', { 
        error: error.message,
        nitNumber,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Convierte un perfil de cliente al formato esperado por SAP B1
   * @param {Object} profile - Perfil de cliente
   * @returns {Object} - Datos formateados para SAP B1
   */
  static toSapBusinessPartner(profile) {
    // Asegurarse que tenemos los datos mínimos necesarios
    if (!profile) {
      throw new Error('Perfil no proporcionado para crear BusinessPartner en SAP');
    }
    
    // Intenta extraer nit_number y verification_digit de varias posibles fuentes
    const nit_number = profile.nit_number || 
                      (profile.additionalData && profile.additionalData.nit_number) || 
                      (profile.extraInfo && profile.extraInfo.nit_number);
                      
    const verification_digit = profile.verification_digit || 
                            (profile.additionalData && profile.additionalData.verification_digit) || 
                            (profile.extraInfo && profile.extraInfo.verification_digit);
    
    // Verificar que tengamos los datos críticos
    if (!nit_number || verification_digit === undefined) {
      throw new Error('NIT y dígito de verificación son requeridos para crear BusinessPartner en SAP');
    }
    
    // Extraer otros campos con múltiples fallbacks para mayor robustez
    const companyName = profile.razonSocial || profile.company_name || 
                      (profile.additionalData && profile.additionalData.razonSocial) || 
                      profile.nombre || profile.contact_name || 'Sin nombre';
    
    // Formatear teléfono (asegurar que solo tenga dígitos numéricos)
    let phone = profile.telefono || profile.contact_phone || 
                (profile.additionalData && profile.additionalData.telefono) || '';
    phone = phone.replace(/\D/g, '').substring(0, 20);
                
    const email = profile.email || profile.contact_email || 
                (profile.additionalData && profile.additionalData.email) || '';
                
    const address = profile.direccion || profile.address || 
                  (profile.additionalData && profile.additionalData.direccion) || '';
                  
    // Construcción del objeto para SAP con exactamente el formato requerido
    const businessPartner = {
      CardCode: `CI${nit_number}`, // Prefijo 'C' seguido del NIT sin DV
      CardName: companyName,
      CardType: "L", // Lead por defecto (siempre L)
      PriceListNum: 1, // Siempre 1
      GroupCode: parseInt(process.env.SAP_INSTITUTIONAL_GROUP_CODE) || 120, // Para clientes institucionales
      FederalTaxID: `${nit_number}-${verification_digit}`,
      Phone1: phone,
      EmailAddress: email,
      Address: address,
      // Campo adicional para facilitar referencia interna
      U_AR_ArtesaCode: `CI${nit_number}`
    };
    
    return businessPartner;
  }
}

module.exports = ClientProfile;