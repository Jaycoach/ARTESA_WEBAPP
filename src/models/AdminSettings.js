const pool = require('../config/db');
const { createContextLogger } = require('../config/logger');

// Crear una instancia del logger con contexto
const logger = createContextLogger('AdminSettingsModel');

/**
 * Clase que representa el modelo de configuración administrativa
 * @class AdminSettings
 */
class AdminSettings {
  /**
   * Obtiene la configuración actual
   * @async
   * @returns {Promise<Object|null>} - Configuración actual o valores por defecto
   * @throws {Error} Si ocurre un error en la consulta
   */
  static async getSettings() {
    try {
      logger.debug('Obteniendo configuración actual del portal');
      
      // Verificar si existe la tabla admin_settings
      const tableExistsQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'admin_settings'
        );
      `;
      
      const tableResult = await pool.query(tableExistsQuery);
      const tableExists = tableResult.rows[0].exists;
      
      // Si la tabla no existe, crearla
      if (!tableExists) {
        logger.info('Tabla admin_settings no existe, creándola');
        await this.createAdminSettingsTable();
      }
      
      const query = `
        SELECT 
          order_time_limit AS "orderTimeLimit",
          home_banner_image_url AS "homeBannerImageUrl",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM admin_settings
        LIMIT 1;
      `;
      
      const { rows } = await pool.query(query);
      
      // Si no hay configuración, devolver valores por defecto
      if (rows.length === 0) {
        logger.info('No se encontró configuración, creando configuración por defecto');
        return await this.createDefaultSettings();
      }
      
      logger.debug('Configuración obtenida exitosamente');
      return rows[0];
    } catch (error) {
      logger.error('Error al obtener configuración administrativa', { 
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Actualiza la configuración
   * @async
   * @param {Object} settings - Configuración a actualizar
   * @param {string} settings.orderTimeLimit - Hora límite para pedidos (HH:MM)
   * @param {string} [settings.homeBannerImageUrl] - URL de la imagen del banner
   * @returns {Promise<Object>} - Configuración actualizada
   * @throws {Error} Si ocurre un error en la actualización
   */
  static async updateSettings(settings) {
    try {
      logger.debug('Actualizando configuración del portal', {
        orderTimeLimit: settings.orderTimeLimit
      });
      
      // Verificar si existe la tabla y crear si no existe
      const tableExistsQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'admin_settings'
        );
      `;
      
      const tableResult = await pool.query(tableExistsQuery);
      const tableExists = tableResult.rows[0].exists;
      
      if (!tableExists) {
        logger.info('Tabla admin_settings no existe, creándola');
        await this.createAdminSettingsTable();
      }
      
      // Verificar si hay configuración existente
      const existingQuery = 'SELECT COUNT(*) FROM admin_settings';
      const existingResult = await pool.query(existingQuery);
      const exists = existingResult.rows[0].count > 0;
      
      let result;
      
      if (exists) {
        // Actualizar configuración existente
        const updateQuery = `
          UPDATE admin_settings 
          SET 
            order_time_limit = $1,
            home_banner_image_url = COALESCE($2, home_banner_image_url),
            updated_at = CURRENT_TIMESTAMP
          RETURNING 
            order_time_limit AS "orderTimeLimit",
            home_banner_image_url AS "homeBannerImageUrl",
            created_at AS "createdAt",
            updated_at AS "updatedAt";
        `;
        
        result = await pool.query(updateQuery, [
          settings.orderTimeLimit,
          settings.homeBannerImageUrl || null
        ]);
      } else {
        // Insertar nueva configuración
        const insertQuery = `
          INSERT INTO admin_settings (
            order_time_limit, 
            home_banner_image_url
          )
          VALUES ($1, $2)
          RETURNING 
            order_time_limit AS "orderTimeLimit",
            home_banner_image_url AS "homeBannerImageUrl",
            created_at AS "createdAt",
            updated_at AS "updatedAt";
        `;
        
        result = await pool.query(insertQuery, [
          settings.orderTimeLimit,
          settings.homeBannerImageUrl || null
        ]);
      }
      
      logger.info('Configuración actualizada exitosamente');
      return result.rows[0];
    } catch (error) {
      logger.error('Error al actualizar configuración administrativa', { 
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Crea la tabla de configuración administrativa si no existe
   * @async
   * @private
   */
  static async createAdminSettingsTable() {
    try {
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS admin_settings (
          id SERIAL PRIMARY KEY,
          order_time_limit VARCHAR(5) NOT NULL DEFAULT '18:00',
          home_banner_image_url TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      
      await pool.query(createTableQuery);
      logger.info('Tabla admin_settings creada exitosamente');
    } catch (error) {
      logger.error('Error al crear tabla admin_settings', { 
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Crea una configuración por defecto
   * @async
   * @private
   * @returns {Promise<Object>} - Configuración por defecto
   */
  static async createDefaultSettings() {
    try {
      const insertQuery = `
        INSERT INTO admin_settings (
          order_time_limit,
          home_banner_image_url
        )
        VALUES (
          '18:00',
          NULL
        )
        RETURNING 
          order_time_limit AS "orderTimeLimit",
          home_banner_image_url AS "homeBannerImageUrl",
          created_at AS "createdAt",
          updated_at AS "updatedAt";
      `;
      
      const { rows } = await pool.query(insertQuery);
      logger.info('Configuración por defecto creada');
      
      return rows[0];
    } catch (error) {
      logger.error('Error al crear configuración por defecto', { 
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

module.exports = AdminSettings;