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
    
    // Validar que exista userId
    if (!userId) {
      throw new Error('Se requiere el ID de usuario para crear el perfil');
    }
    
    // Generar clientprofilecode_sap si tenemos nit_number
    let clientProfileCode = null;
    if (clientData.nit_number) {
      clientProfileCode = `CI${clientData.nit_number}`;
    }

    // Extraer todos los demás campos para almacenarlos como JSON en notes
    const additionalFields = { ...clientData };
    
    // Eliminar campos que ya están mapeados a columnas de la base de datos
    ['userId', 'nombre', 'email', 'telefono', 'direccion', 'ciudad', 'pais', 
      'razonSocial', 'nit', 'fotocopiaCedula', 'fotocopiaRut', 'anexosAdicionales',
      'nit_number', 'verification_digit', 'cardcode_sap', 'clientprofilecode_sap', 'listaPrecios'].forEach(key => {
      delete additionalFields[key];
    });
    
    // Mapear los campos del formulario a los campos de la base de datos
    const query = `
      INSERT INTO client_profiles
      (user_id, company_name, contact_name, contact_phone, contact_email, 
       address, city, country, tax_id, notes,
       fotocopia_cedula, fotocopia_rut, anexos_adicionales, price_list, 
       nit_number, verification_digit, cardcode_sap, clientprofilecode_sap)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18 )
      RETURNING *;
    `;
    
    // Crear JSON con campos adicionales
    const notesJSON = Object.keys(additionalFields).length > 0 ? 
      JSON.stringify(additionalFields) : null;
  
    const values = [
      userId,                  // user_id
      razonSocial,             // company_name
      nombre,                  // contact_name
      telefono,                // contact_phone
      email,                   // contact_email
      direccion,               // address
      ciudad,                  // city
      pais || 'Colombia',      // country (valor por defecto)
      nit,                     // tax_id
      notesJSON,               // notes (campos adicionales en JSON)
      fotocopiaCedula,         // fotocopia_cedula
      fotocopiaRut,            // fotocopia_rut
      anexosAdicionales,       // anexos_adicionales
      clientData.listaPrecios || 1, // price_list (valor por defecto: 1)
      clientData.nit_number,   // nit_number
      clientData.verification_digit, // verification_digit
      clientData.cardcode_sap, // cardcode_sap
      clientProfileCode        // clientprofilecode_sap
    ];

    // También actualizar is_active en la tabla de usuarios
    await pool.query('UPDATE users SET is_active = false WHERE id = $1', [userId]);
    logger.debug('Usuario marcado como inactivo hasta aprobación por SAP', { userId });
    
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
      
      // Extraer campos del formulario
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
        verification_digit
      } = updateData;
      
      // Extraer campos adicionales para almacenar en notes
      const additionalFields = { ...updateData };

      // Generar clientprofilecode_sap si tenemos nit_number
      let clientProfileCode = null;
      if (nit_number) {
        clientProfileCode = `CI${nit_number}`;
      }
      
      // Eliminar campos que ya están mapeados a columnas de la base de datos
      ['nombre', 'email', 'telefono', 'direccion', 'ciudad', 'pais', 
        'razonSocial', 'nit', 'nit_number', 'verification_digit', 'fotocopiaCedula', 'fotocopiaRut', 'anexosAdicionales',
        'cardcode_sap', 'clientprofilecode_sap', 'sap_lead_synced'].forEach(key => {
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
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $17
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

      const values = [
      razonSocial,          // company_name
      nombre,               // contact_name
      telefono,             // contact_phone
      email,                // contact_email
      direccion,            // address
      ciudad,               // city
      pais,                 // country
      nit,                  // tax_id
      nit_number,           // nit_number (nuevo)
      verification_digit,   // verification_digit
      updateData.cardcode_sap, // cardcode_sap
      clientProfileCode,    // Para generar clientprofilecode_sap
      notesJSON,            // notes
      fotocopiaCedula,      // fotocopia_cedula
      fotocopiaRut,         // fotocopia_rut
      anexosAdicionales,    // anexos_adicionales
      userId                // user_id para WHERE
      ];

      // También actualizar is_active en la tabla de usuarios
      await pool.query('UPDATE users SET is_active = false WHERE id = $1', [userId]);
      logger.debug('Usuario marcado como inactivo hasta aprobación por SAP', { userId });
            
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
      
      // Primero, actualizar is_active a false en la tabla users
      await client.query('UPDATE users SET is_active = false WHERE id = $1', [userId]);
      
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
      CardCode: `C${nit_number}`, // Prefijo 'C' seguido del NIT sin DV
      CardName: companyName,
      CardType: "L", // Lead por defecto (siempre L)
      PriceListNum: 1, // Siempre 1
      GroupCode: 102, // Siempre 102
      FederalTaxID: `${nit_number}-${verification_digit}`,
      Phone1: phone,
      EmailAddress: email,
      Address: address,
      // Campo adicional para facilitar referencia interna
      U_AR_ArtesaCode: `C${nit_number}`
    };
    
    return businessPartner;
  }
}

module.exports = ClientProfile;