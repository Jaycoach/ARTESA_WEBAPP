const pool = require('../config/db');

class Roles {
    static instance = null;
    static roles = {};
    static lastUpdate = null;
    static updateInterval = 5 * 60 * 1000; // 5 minutos

    static async initialize() {
        if (!this.instance) {
            this.instance = new Roles();
            await this.loadRoles();
        }
        return this.instance;
    }

    static async loadRoles() {
        try {
            const { rows } = await pool.query('SELECT id, nombre FROM roles');
            this.roles = rows.reduce((acc, role) => {
                acc[role.nombre.toUpperCase()] = role.id;
                return acc;
            }, {});
            this.lastUpdate = Date.now();
            return this.roles;
        } catch (error) {
            console.error('Error loading roles:', error);
            throw error;
        }
    }

    static async getRoles() {
        // Recargar roles si han pasado más de 5 minutos
        if (!this.lastUpdate || Date.now() - this.lastUpdate > this.updateInterval) {
            await this.loadRoles();
        }
        return this.roles;
    }

    static async getRoleId(roleName) {
        const roles = await this.getRoles();
        return roles[roleName.toUpperCase()];
    }
}

// Inicializar roles al importar el módulo
Roles.initialize().catch(console.error);

module.exports = Roles;