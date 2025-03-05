// src/models/ClientProfile.js - Versión actualizada
const pool = require('../config/db');
const { createContextLogger } = require('../config/logger');

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
   * @param {number} clientId - ID del perfil de cliente
   * @returns {Promise<Object|null>} - Perfil de cliente encontrado o null si no existe
   * @throws {Error} Si ocurre un error en la consulta
   */
  static async getById(clientId) {
    try {
      logger.debug('Buscando perfil de cliente por ID', { clientId });
      
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
        WHERE client_id = $1;
      `;
      
      const { rows } = await pool.query(query, [clientId]);
      
      if (rows.length === 0) {
        logger.debug('Perfil de cliente no encontrado', { clientId });
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
          clientId,
          error: e.message
        });
      }
      
      logger.debug('Perfil de cliente encontrado', { clientId });
      return profile;
    } catch (error) {
      logger.error('Error al buscar perfil de cliente por ID', { 
        error: error.message,
        clientId
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
  static async getByUserId(userId) {
    try {
      logger.debug('Buscando perfil de cliente por ID de usuario', { userId });
      
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
        logger.debug('Perfil de cliente no encontrado por ID de usuario', { userId });
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
      
      logger.debug('Perfil de cliente encontrado por ID de usuario', { userId });
      return profile;
    } catch (error) {
      logger.error('Error al buscar perfil de cliente por ID de usuario', { 
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
            clientId: profile.client_id,
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
        tipoDocumento = null,
        numeroDocumento = null,
        // Otros campos
        fotocopiaCedula = null,
        fotocopiaRut = null,
        anexosAdicionales = null
      } = clientData;
      
      logger.debug('Creando nuevo perfil de cliente con campos opcionales', { 
        userId,
        nombre,
        email
      });
      
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
        pais,                    // country
        nit,                     // tax_id
        notesJSON,               // notes (campos adicionales en JSON)
        fotocopiaCedula,         // fotocopia_cedula
        fotocopiaRut,            // fotocopia_rut
        anexosAdicionales,       // anexos_adicionales
        1                        // price_list (valor por defecto)
      ];
      
      const { rows } = await pool.query(query, values);
      
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
        clientId: profile.client_id,
        userId
      });
      
      return profile;
    } catch (error) {
      logger.error('Error al crear perfil de cliente', { 
        error: error.message,
        userId: clientData.userId
      });
      throw error;
    }
  }
  
  /**
   * Actualiza un perfil de cliente existente
   * @async
   * @param {number} clientId - ID del perfil de cliente
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<Object|null>} - Perfil actualizado o null si no existe
   * @throws {Error} Si ocurre un error en la actualización
   */
  static async update(clientId, updateData) {
    try {
      logger.debug('Actualizando perfil de cliente', { 
        clientId,
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
        numeroDocumento
      } = updateData;
      
      // Extraer campos adicionales para almacenar en notes
      const additionalFields = { ...updateData };
      
      // Eliminar campos que ya están mapeados a columnas de la base de datos
      ['nombre', 'email', 'telefono', 'direccion', 'ciudad', 'pais', 
       'razonSocial', 'nit', 'fotocopiaCedula', 'fotocopiaRut', 'anexosAdicionales'].forEach(key => {
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
          notes = $9,
          fotocopia_cedula = COALESCE($10, fotocopia_cedula),
          fotocopia_rut = COALESCE($11, fotocopia_rut),
          anexos_adicionales = COALESCE($12, anexos_adicionales),
          updated_at = CURRENT_TIMESTAMP
        WHERE client_id = $13
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
        notesJSON,            // notes
        fotocopiaCedula,      // fotocopia_cedula
        fotocopiaRut,         // fotocopia_rut
        anexosAdicionales,    // anexos_adicionales
        clientId              // client_id para WHERE
      ];
      
      const { rows } = await pool.query(query, values);
      
      if (rows.length === 0) {
        logger.warn('Perfil de cliente no encontrado al actualizar', { clientId });
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
        clientId,
        razonSocial: updatedProfile.company_name
      });
      
      return profile;
    } catch (error) {
      logger.error('Error al actualizar perfil de cliente', { 
        error: error.message,
        clientId
      });
      throw error;
    }
  }
  
  /**
   * Elimina un perfil de cliente
   * @async
   * @param {number} clientId - ID del perfil de cliente
   * @returns {Promise<Object|null>} - Perfil eliminado o null si no existe
   * @throws {Error} Si ocurre un error en la eliminación
   */
  static async delete(clientId) {
    try {
      logger.debug('Eliminando perfil de cliente', { clientId });
      
      const query = 'DELETE FROM client_profiles WHERE client_id = $1 RETURNING *;';
      
      const { rows } = await pool.query(query, [clientId]);
      
      if (rows.length === 0) {
        logger.warn('Perfil de cliente no encontrado al eliminar', { clientId });
        return null;
      }
      
      logger.info('Perfil de cliente eliminado exitosamente', { 
        clientId,
        companyName: rows[0].company_name
      });
      
      return rows[0];
    } catch (error) {
      logger.error('Error al eliminar perfil de cliente', { 
        error: error.message,
        clientId
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
}

module.exports = ClientProfile;