/**
 * @typedef {Object} Role
 * @property {number} id - ID único del rol
 * @property {string} nombre - Nombre del rol
 */

const pool = require('../config/db');
const { createContextLogger } = require('../config/logger');

// Crear una instancia del logger con contexto
const logger = createContextLogger('RolesModel');

/**
 * Clase singleton que maneja los roles del sistema
 * @class Roles
 */
class Roles {
    static instance = null;
    static roles = {};
    static lastUpdate = null;
    static updateInterval = 5 * 60 * 1000; // 5 minutos

    /**
     * Inicializa la instancia singleton de Roles
     * @async
     * @returns {Promise<Roles>} Instancia de la clase Roles
     */
    static async initialize() {
        if (!this.instance) {
            logger.debug('Inicializando singleton de Roles');
            this.instance = new Roles();
            await this.loadRoles();
        }
        return this.instance;
    }

    /**
     * Carga los roles desde la base de datos
     * @async
     * @returns {Promise<Object>} Objeto con los roles mapeados (NOMBRE_ROL: id)
     * @throws {Error} Si ocurre un error al cargar los roles
     */
    static async loadRoles() {
        try {
            logger.debug('Cargando roles desde la base de datos');
            const { rows } = await pool.query('SELECT id, nombre FROM roles');
            this.roles = rows.reduce((acc, role) => {
                acc[role.nombre.toUpperCase()] = role.id;
                return acc;
            }, {});
            this.lastUpdate = Date.now();
            logger.info('Roles cargados exitosamente', { roleCount: rows.length });
            return this.roles;
        } catch (error) {
            logger.error('Error al cargar roles', { error: error.message });
            throw error;
        }
    }

    /**
     * Obtiene todos los roles del sistema
     * @async
     * @returns {Promise<Object>} Objeto con los roles mapeados (NOMBRE_ROL: id)
     */
    static async getRoles() {
        // Recargar roles si han pasado más de 5 minutos
        if (!this.lastUpdate || Date.now() - this.lastUpdate > this.updateInterval) {
            logger.debug('Recargando roles (caché expirada)');
            await this.loadRoles();
        }
        return this.roles;
    }

    /**
     * Obtiene el ID de un rol por su nombre
     * @async
     * @param {string} roleName - Nombre del rol
     * @returns {Promise<number|undefined>} ID del rol o undefined si no existe
     */
    static async getRoleId(roleName) {
        const roles = await this.getRoles();
        const roleId = roles[roleName.toUpperCase()];
        
        if (!roleId) {
            logger.warn('Rol no encontrado', { roleName });
        }
        
        return roleId;
    }
    
    /**
     * Obtiene información de todos los roles
     * @async
     * @returns {Promise<Array<Role>>} Lista de todos los roles con su información completa
     */
    static async getAllRolesInfo() {
        try {
            const query = 'SELECT id, nombre, description, created_at FROM roles ORDER BY id';
            const { rows } = await pool.query(query);
            return rows;
        } catch (error) {
            logger.error('Error al obtener información de roles', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Obtiene información de un rol por su ID
     * @async
     * @param {number} roleId - ID del rol
     * @returns {Promise<Role|null>} Información del rol o null si no existe
     */
    static async getRoleById(roleId) {
        try {
            const query = 'SELECT id, nombre, description, created_at FROM roles WHERE id = $1';
            const { rows } = await pool.query(query, [roleId]);
            
            if (rows.length === 0) {
                logger.warn('Rol no encontrado por ID', { roleId });
                return null;
            }
            
            return rows[0];
        } catch (error) {
            logger.error('Error al obtener rol por ID', { error: error.message, roleId });
            throw error;
        }
    }
}

// Inicializar roles al importar el módulo
Roles.initialize().catch(error => {
    logger.error('Error en inicialización de roles', { error: error.message });
});

module.exports = Roles;