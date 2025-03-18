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
          client_id,
          user_id,
          company_name AS "razonSocial",
          contact_name AS "nombre",
          contact_phone AS "telefono",
          contact_email AS "email",
          address AS "direccion",
          city AS "ciudad",
          country AS "pais",
          tax_id AS "nit",
          price_list,
          notes,
          fotocopia_cedula AS "fotocopiaCedula",
          fotocopia_rut AS "fotocopiaRut",
          anexos_adicionales AS "anexosAdicionales",
          created_at,
          updated_at,
          (SELECT name FROM users WHERE id = cp.user_id) AS user_name
        FROM client_profiles cp
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
        if (profile.notes) {
          const extraData = JSON.parse(profile.notes);
          // Combinar el perfil base con los datos extra
          Object.assign(profile, extraData);
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
          client_id,
          user_id,
          company_name AS "razonSocial",
          contact_name AS "nombre",
          contact_phone AS "telefono",
          contact_email AS "email",
          address AS "direccion",
          city AS "ciudad",
          country AS "pais",
          tax_id AS "nit",
          price_list,
          notes,
          fotocopia_cedula AS "fotocopiaCedula",
          fotocopia_rut AS "fotocopiaRut",
          anexos_adicionales AS "anexosAdicionales",
          created_at,
          updated_at,
          (SELECT name FROM users WHERE id = cp.user_id) AS user_name
        FROM client_profiles cp
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
        if (profile.notes) {
          const extraData = JSON.parse(profile.notes);
          // Combinar el perfil base con los datos extra
          Object.assign(profile, extraData);
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
          client_id,
          user_id,
          company_name AS "razonSocial",
          contact_name AS "nombre",
          contact_phone AS "telefono",
          contact_email AS "email",
          address AS "direccion",
          city AS "ciudad",
          country AS "pais",
          tax_id AS "nit",
          price_list,
          notes,
          fotocopia_cedula AS "fotocopiaCedula",
          fotocopia_rut AS "fotocopiaRut",
          anexos_adicionales AS "anexosAdicionales",
          created_at,
          updated_at,
          (SELECT name FROM users WHERE id = cp.user_id) AS user_name
        FROM client_profiles cp
        ORDER BY company_name;
      `;
      
      const { rows } = await pool.query(query);
      
      // Procesar cada perfil para extraer datos adicionales
      const profiles = rows.map(profile => {
        try {
          if (profile.notes) {
            const extraData = JSON.parse(profile.notes);
            return { ...profile, ...extraData };
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
    
    // Extraer todos los demás campos para almacenarlos como JSON en notes
    const additionalFields = { ...clientData };
    
    // Eliminar campos que ya están mapeados a columnas de la base de datos
    ['userId', 'nombre', 'email', 'telefono', 'direccion', 'ciudad', 'pais', 
     'razonSocial', 'nit', 'fotocopiaCedula', 'fotocopiaRut', 'anexosAdicionales'].forEach(key => {
      delete additionalFields[key];
    });
    
    // Mapear los campos del formulario a los campos de la base de datos
    const query = `
      INSERT INTO client_profiles
      (user_id, company_name, contact_name, contact_phone, contact_email, 
       address, city, country, tax_id, notes,
       fotocopia_cedula, fotocopia_rut, anexos_adicionales, price_list)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
      clientData.listaPrecios || 1 // price_list (valor por defecto: 1)
    ];
    
    const { rows } = await pool.query(query, values);
    
    if (rows.length === 0) {
      throw new Error('No se pudo crear el perfil de cliente');
    }
    
    // Crear un objeto que combine los campos de la base de datos con los adicionales
    const createdProfile = {
      ...rows[0],
      ...additionalFields
    };
    
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
      
      // Eliminar campos que ya están mapeados a columnas de la base de datos
      ['nombre', 'email', 'telefono', 'direccion', 'ciudad', 'pais', 
       'razonSocial', 'nit', 'nit_number', 'verification_digit', 'fotocopiaCedula', 'fotocopiaRut', 'anexosAdicionales'].forEach(key => {
        delete additionalFields[key];
      });
      
      // Crear JSON con campos adicionales
      const notesJSON = JSON.stringify(additionalFields);
      
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
        notes = $11,
        fotocopia_cedula = COALESCE($12, fotocopia_cedula),
        fotocopia_rut = COALESCE($13, fotocopia_rut),
        anexos_adicionales = COALESCE($14, anexos_adicionales),
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $15
      RETURNING *;
      `;

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
      verification_digit,   // verification_digit (nuevo)
      notesJSON,            // notes
      fotocopiaCedula,      // fotocopia_cedula
      fotocopiaRut,         // fotocopia_rut
      anexosAdicionales,    // anexos_adicionales
      userId                // user_id para WHERE
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
    try {
      logger.debug('Eliminando perfil de cliente', { userId });
      
      const query = 'DELETE FROM client_profiles WHERE user_id = $1 RETURNING *;';
      
      const { rows } = await pool.query(query, [userId]);
      
      if (rows.length === 0) {
        logger.warn('Perfil de cliente no encontrado al eliminar', { userId });
        return null;
      }
      
      logger.info('Perfil de cliente eliminado exitosamente', { 
        userId,
        companyName: rows[0].company_name
      });
      
      return rows[0];
    } catch (error) {
      logger.error('Error al eliminar perfil de cliente', { 
        error: error.message,
        userId
      });
      throw error;
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
   * Convierte un perfil de cliente al formato esperado por SAP B1
   * @param {Object} profile - Perfil de cliente
   * @returns {Object} - Datos formateados para SAP B1
   */
  static toSapBusinessPartner(profile) {
    // Asegurarse que tenemos los datos mínimos necesarios
    if (!profile || !profile.nit_number || !profile.verification_digit) {
      throw new Error('Datos insuficientes para crear BusinessPartner en SAP');
    }
    
    // Construcción del objeto para SAP
    const businessPartner = {
      CardCode: `C${profile.nit_number}`, // Prefijo 'C' seguido del NIT sin DV
      CardName: profile.razonSocial || profile.nombre || profile.company_name || profile.contact_name || 'Sin nombre',
      CardType: "L", // Lead por defecto
      GroupCode: 102, // Grupo fijo
      FederalTaxID: `${profile.nit_number}-${profile.verification_digit}`,
      Phone1: profile.telefono || profile.contact_phone || "",
      EmailAddress: profile.email || profile.contact_email || "",
      Address: profile.direccion || profile.address || "",
      U_HBT_City: profile.ciudad || profile.city || "",
      U_HBT_Country: profile.pais || profile.country || "Colombia",
      Notes: profile.notas || profile.notes || "",
      PriceListNum: profile.listaPrecios || profile.price_list || 1
    };
    
    return businessPartner;
  }
}

module.exports = ClientProfile;