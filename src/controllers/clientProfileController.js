// src/controllers/clientProfileController.js
const pool = require('../config/db');
const { createContextLogger } = require('../config/logger');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Crear una instancia del logger con contexto
const logger = createContextLogger('ClientProfileController');

// Directorio donde se guardarán los archivos subidos
const uploadDir = path.join(__dirname, '../uploads/client-profiles');

// Asegurarse de que el directorio existe
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Función para guardar un archivo y devolver su ruta
const saveFile = async (file) => {
  if (!file) return null;
  
  const uniqueFilename = `${uuidv4()}_${file.name}`;
  const filePath = path.join(uploadDir, uniqueFilename);
  
  // Asegurarse de que el buffer del archivo se guarda correctamente
  await fs.promises.writeFile(filePath, file.data);
  
  return uniqueFilename; // Devolver solo el nombre del archivo
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
 *         company_name:
 *           type: string
 *           description: Nombre de la empresa
 *           example: Empresa ABC
 *         contact_name:
 *           type: string
 *           description: Nombre del contacto
 *           example: Juan Pérez
 *         contact_phone:
 *           type: string
 *           description: Teléfono de contacto
 *           example: "+57 3001234567"
 *         contact_email:
 *           type: string
 *           format: email
 *           description: Email de contacto
 *           example: contacto@empresaabc.com
 *         address:
 *           type: string
 *           description: Dirección física
 *           example: Calle 123 #45-67
 *         city:
 *           type: string
 *           description: Ciudad
 *           example: Bogotá
 *         country:
 *           type: string
 *           description: País
 *           example: Colombia
 *         tax_id:
 *           type: string
 *           description: Identificación fiscal
 *           example: "901234567-8"
 *         price_list:
 *           type: integer
 *           description: Lista de precios asignada (1, 2 o 3)
 *           example: 2
 *         notes:
 *           type: string
 *           description: Notas adicionales
 *           example: Cliente preferencial, atender con prioridad
 *         fotocopia_cedula:
 *           type: string
 *           description: Ruta de archivo de la fotocopia de cédula
 *         fotocopia_rut:
 *           type: string
 *           description: Ruta de archivo de la fotocopia del RUT
 *         anexos_adicionales:
 *           type: string
 *           description: Ruta de archivo de anexos adicionales
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
      
      const query = `
          SELECT cp.*, u.name as user_name, u.mail as user_email 
          FROM client_profiles cp
          LEFT JOIN users u ON cp.user_Id = u.id
          ORDER BY cp.company_name;
      `;
      
      const { rows } = await pool.query(query);
      
      // Agregar URLs para archivos
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const profiles = rows.map(profile => {
        const result = { ...profile };
        
        if (result.fotocopia_cedula) {
          result.fotocopia_cedula_url = `${baseUrl}/api/client-profiles/${profile.client_id}/file/cedula`;
        }
        
        if (result.fotocopia_rut) {
          result.fotocopia_rut_url = `${baseUrl}/api/client-profiles/${profile.client_id}/file/rut`;
        }
        
        if (result.anexos_adicionales) {
          result.anexos_adicionales_url = `${baseUrl}/api/client-profiles/${profile.client_id}/file/anexos`;
        }
        
        return result;
      });
      
      res.status(200).json({
        success: true,
        data: profiles
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
   * /api/client-profiles/{id}:
   *   get:
   *     summary: Obtener perfil de cliente por ID
   *     description: Recupera los detalles de un perfil de cliente específico
   *     tags: [ClientProfiles]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
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
  async getProfileById(req, res) {
    try {
      const { id } = req.params;
      
      logger.debug('Obteniendo perfil de cliente por ID', { profileId: id });
      
      const query = `
        SELECT cp.*, u.name as user_name, u.mail as user_email 
        FROM client_profiles cp
        LEFT JOIN users u ON cp.user_id = u.id
        WHERE cp.client_id = $1;
      `;
      
      const { rows } = await pool.query(query, [id]);
      
      if (rows.length === 0) {
        logger.warn('Perfil de cliente no encontrado', { profileId: id });
        return res.status(404).json({
          success: false,
          message: 'Perfil de cliente no encontrado'
        });
      }
      
      // Agregar URLs para archivos
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const profile = rows[0];
      
      if (profile.fotocopia_cedula) {
        profile.fotocopia_cedula_url = `${baseUrl}/api/client-profiles/${id}/file/cedula`;
      }
      
      if (profile.fotocopia_rut) {
        profile.fotocopia_rut_url = `${baseUrl}/api/client-profiles/${id}/file/rut`;
      }
      
      if (profile.anexos_adicionales) {
        profile.anexos_adicionales_url = `${baseUrl}/api/client-profiles/${id}/file/anexos`;
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
      
      logger.debug('Obteniendo perfil de cliente por ID de usuario', { userId });
      
      const query = `
        SELECT cp.*, u.name as user_name, u.mail as user_email 
        FROM client_profiles cp
        LEFT JOIN users u ON cp.user_id = u.id
        WHERE cp.user_id = $1;
      `;
      
      const { rows } = await pool.query(query, [userId]);
      
      if (rows.length === 0) {
        logger.warn('Perfil de cliente no encontrado', { userId });
        return res.status(404).json({
          success: false,
          message: 'Perfil de cliente no encontrado'
        });
      }
      
      // Agregar URLs para archivos
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const profile = rows[0];
      
      if (profile.fotocopia_cedula) {
        profile.fotocopia_cedula_url = `${baseUrl}/api/client-profiles/user/${userId}/file/cedula`;
      }
      
      if (profile.fotocopia_rut) {
        profile.fotocopia_rut_url = `${baseUrl}/api/client-profiles/user/${userId}/file/rut`;
      }
      
      if (profile.anexos_adicionales) {
        profile.anexos_adicionales_url = `${baseUrl}/api/client-profiles/user/${userId}/file/anexos`;
      }
      
      res.status(200).json({
        success: true,
        data: profile
      });
    } catch (error) {
      logger.error('Error al obtener perfil de cliente por ID de usuario', {
        error: error.message,
        stack: error.stack,
        userId: req.params.userId
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
   *     description: Crea un nuevo perfil de cliente en el sistema
   *     tags: [ClientProfiles]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required:
   *               - company_name
   *             properties:
   *               user_id:
   *                 type: integer
   *                 description: ID del usuario asociado
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
   *       201:
   *         description: Perfil creado exitosamente
   *       400:
   *         description: Datos inválidos
   *       401:
   *         description: No autorizado
   *       403:
   *         description: Prohibido - No tiene permisos suficientes
   *       500:
   *         description: Error interno del servidor
   */
  async createProfile(req, res) {
    try {
      const {
        user_id,
        company_name,
        contact_name,
        contact_phone,
        contact_email,
        address,
        city,
        country,
        tax_id,
        price_list,
        notes
      } = req.body;
      
      logger.debug('Creando nuevo perfil de cliente', { 
        companyName: company_name,
        userId: user_id
      });
      
      // Validación básica
      if (!company_name) {
        return res.status(400).json({
          success: false,
          message: 'El nombre de la empresa es requerido'
        });
      }
      
      // Verificar si ya existe un perfil para este usuario
      if (user_id) {
        const checkQuery = 'SELECT client_id FROM client_profiles WHERE user_id = $1';
        const { rows } = await pool.query(checkQuery, [user_id]);
        
        if (rows.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'Este usuario ya tiene un perfil, debe actualizarlo'
          });
        }
      }
      
      // Procesar archivos si existen
      let fotocopiaCedulaPath = null;
      let fotocopiaRutPath = null;
      let anexosAdicionalesPath = null;
      
      if (req.files) {
        if (req.files.fotocopia_cedula) {
          fotocopiaCedulaPath = await saveFile(req.files.fotocopia_cedula);
        }
        
        if (req.files.fotocopia_rut) {
          fotocopiaRutPath = await saveFile(req.files.fotocopia_rut);
        }
        
        if (req.files.anexos_adicionales) {
          anexosAdicionalesPath = await saveFile(req.files.anexos_adicionales);
        }
      }
      
      const query = `
        INSERT INTO client_profiles
        (user_id, company_name, contact_name, contact_phone, contact_email, address, city, country, tax_id, price_list, notes, fotocopia_cedula, fotocopia_rut, anexos_adicionales)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *;
      `;
      
      const values = [
        user_id,
        company_name,
        contact_name,
        contact_phone,
        contact_email,
        address,
        city,
        country,
        tax_id,
        price_list,
        notes,
        fotocopiaCedulaPath,
        fotocopiaRutPath,
        anexosAdicionalesPath
      ];
      
      const { rows } = await pool.query(query, values);
      
      // Agregar URLs para archivos en la respuesta
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const profile = rows[0];
      
      if (profile.fotocopia_cedula) {
        profile.fotocopia_cedula_url = `${baseUrl}/api/client-profiles/${profile.client_id}/file/cedula`;
      }
      
      if (profile.fotocopia_rut) {
        profile.fotocopia_rut_url = `${baseUrl}/api/client-profiles/${profile.client_id}/file/rut`;
      }
      
      if (profile.anexos_adicionales) {
        profile.anexos_adicionales_url = `${baseUrl}/api/client-profiles/${profile.client_id}/file/anexos`;
      }
      
      logger.info('Perfil de cliente creado exitosamente', {
        profileId: profile.client_id,
        companyName: company_name
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
        companyName: req.body?.company_name
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
   * /api/client-profiles/{id}:
   *   put:
   *     summary: Actualizar perfil de cliente
   *     description: Actualiza los datos de un perfil de cliente existente
   *     tags: [ClientProfiles]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
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
  async updateProfile(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      logger.debug('Actualizando perfil de cliente', { 
        profileId: id,
        fields: Object.keys(updateData)
      });
      
      // Obtener el perfil actual para verificar si existe y recuperar información de archivos
      const checkQuery = 'SELECT * FROM client_profiles WHERE client_id = $1';
      const checkResult = await pool.query(checkQuery, [id]);
      
      if (checkResult.rows.length === 0) {
        logger.warn('Perfil de cliente no encontrado al actualizar', { profileId: id });
        return res.status(404).json({
          success: false,
          message: 'Perfil de cliente no encontrado'
        });
      }
      
      const currentProfile = checkResult.rows[0];
      
      // Procesar archivos si existen
      let fotocopiaCedulaPath = currentProfile.fotocopia_cedula;
      let fotocopiaRutPath = currentProfile.fotocopia_rut;
      let anexosAdicionalesPath = currentProfile.anexos_adicionales;
      
      if (req.files) {
        // Si hay nuevos archivos, eliminar los anteriores y guardar los nuevos
        if (req.files.fotocopia_cedula) {
          if (currentProfile.fotocopia_cedula) {
            const oldPath = path.join(uploadDir, currentProfile.fotocopia_cedula);
            if (fs.existsSync(oldPath)) {
              fs.unlinkSync(oldPath);
            }
          }
          fotocopiaCedulaPath = await saveFile(req.files.fotocopia_cedula);
        }
        
        if (req.files.fotocopia_rut) {
          if (currentProfile.fotocopia_rut) {
            const oldPath = path.join(uploadDir, currentProfile.fotocopia_rut);
            if (fs.existsSync(oldPath)) {
              fs.unlinkSync(oldPath);
            }
          }
          fotocopiaRutPath = await saveFile(req.files.fotocopia_rut);
        }
        
        if (req.files.anexos_adicionales) {
          if (currentProfile.anexos_adicionales) {
            const oldPath = path.join(uploadDir, currentProfile.anexos_adicionales);
            if (fs.existsSync(oldPath)) {
              fs.unlinkSync(oldPath);
            }
          }
          anexosAdicionalesPath = await saveFile(req.files.anexos_adicionales);
        }
      }
      
      // Filtrar y validar campos permitidos
      const allowedFields = [
        'user_id', 'company_name', 'contact_name', 'contact_phone',
        'contact_email', 'address', 'city', 'country', 'tax_id',
        'price_list', 'notes'
      ];
      
      const updates = [];
      const values = [];
      let paramCount = 1;
      
      Object.entries(updateData).forEach(([key, value]) => {
        if (allowedFields.includes(key) && value !== undefined) {
          updates.push(`${key} = $${paramCount}`);
          values.push(value);
          paramCount++;
        }
      });
      
      // Agregar campos de archivos a las actualizaciones
      updates.push(`fotocopia_cedula = $${paramCount}`);
      values.push(fotocopiaCedulaPath);
      paramCount++;
      
      updates.push(`fotocopia_rut = $${paramCount}`);
      values.push(fotocopiaRutPath);
      paramCount++;
      
      updates.push(`anexos_adicionales = $${paramCount}`);
      values.push(anexosAdicionalesPath);
      paramCount++;
      
      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No se proporcionaron campos válidos para actualizar'
        });
      }
      
      values.push(id);
      
      const query = `
        UPDATE client_profiles
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE client_id = $${paramCount}
        RETURNING *;
      `;
      
      const { rows } = await pool.query(query, values);
      
      // Agregar URLs para archivos en la respuesta
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const profile = rows[0];
      
      if (profile.fotocopia_cedula) {
        profile.fotocopia_cedula_url = `${baseUrl}/api/client-profiles/${id}/file/cedula`;
      }
      
      if (profile.fotocopia_rut) {
        profile.fotocopia_rut_url = `${baseUrl}/api/client-profiles/${id}/file/rut`;
      }
      
      if (profile.anexos_adicionales) {
        profile.anexos_adicionales_url = `${baseUrl}/api/client-profiles/${id}/file/anexos`;
      }
      
      logger.info('Perfil de cliente actualizado exitosamente', {
        profileId: id,
        companyName: profile.company_name
      });
      
      res.status(200).json({
        success: true,
        message: 'Perfil de cliente actualizado exitosamente',
        data: profile
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
   * /api/client-profiles/{id}:
   *   delete:
   *     summary: Eliminar perfil de cliente
   *     description: Elimina un perfil de cliente del sistema
   *     tags: [ClientProfiles]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
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
  async deleteProfile(req, res) {
    try {
      const { id } = req.params;
      
      logger.debug('Eliminando perfil de cliente', { profileId: id });
      
      // Primero obtenemos el perfil para obtener las rutas de archivos
      const getQuery = 'SELECT * FROM client_profiles WHERE client_id = $1';
      const getResult = await pool.query(getQuery, [id]);
      
      if (getResult.rows.length === 0) {
        logger.warn('Perfil de cliente no encontrado al eliminar', { profileId: id });
        return res.status(404).json({
          success: false,
          message: 'Perfil de cliente no encontrado'
        });
      }
      
      const profile = getResult.rows[0];
      
      // Eliminar los archivos asociados al perfil
      if (profile.fotocopia_cedula) {
        const cedulaPath = path.join(uploadDir, profile.fotocopia_cedula);
        if (fs.existsSync(cedulaPath)) {
          fs.unlinkSync(cedulaPath);
        }
      }
      
      if (profile.fotocopia_rut) {
        const rutPath = path.join(uploadDir, profile.fotocopia_rut);
        if (fs.existsSync(rutPath)) {
          fs.unlinkSync(rutPath);
        }
      }
      
      if (profile.anexos_adicionales) {
        const anexosPath = path.join(uploadDir, profile.anexos_adicionales);
        if (fs.existsSync(anexosPath)) {
          fs.unlinkSync(anexosPath);
        }
      }
      
      // Luego eliminamos el perfil de la base de datos
      const deleteQuery = 'DELETE FROM client_profiles WHERE client_id = $1 RETURNING *;';
      
      const { rows } = await pool.query(deleteQuery, [id]);
      
      logger.info('Perfil de cliente eliminado exitosamente', {
        profileId: id,
        companyName: profile.company_name
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
   * /api/client-profiles/{id}/file/{fileType}:
   *   get:
   *     summary: Obtener archivo de perfil de cliente
   *     description: Recupera un archivo asociado al perfil de cliente (cédula, RUT o anexos)
   *     tags: [ClientProfiles]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
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
  async getFile(req, res) {
    try {
      const { id, fileType } = req.params;
      
      logger.debug('Obteniendo archivo de perfil de cliente', { 
        profileId: id, 
        fileType 
      });
      
      // Obtener el perfil para verificar si existe y obtener la ruta del archivo
      const query = 'SELECT * FROM client_profiles WHERE client_id = $1';
      const { rows } = await pool.query(query, [id]);
      
      if (rows.length === 0) {
        logger.warn('Perfil de cliente no encontrado', { profileId: id });
        return res.status(404).json({
          success: false,
          message: 'Perfil de cliente no encontrado'
        });
      }
      
      const profile = rows[0];
      let fileName;
      
      // Determinar qué archivo se está solicitando
      if (fileType === 'cedula' && profile.fotocopia_cedula) {
        fileName = profile.fotocopia_cedula;
      } else if (fileType === 'rut' && profile.fotocopia_rut) {
        fileName = profile.fotocopia_rut;
      } else if (fileType === 'anexos' && profile.anexos_adicionales) {
        fileName = profile.anexos_adicionales;
      } else {
        logger.warn('Archivo no encontrado en el perfil', { 
          profileId: id, 
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
          profileId: id, 
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
      let contentType = 'application/octet-stream'; // Por defecto
      
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
      
      if (mimeTypes[ext]) {
        contentType = mimeTypes[ext];
      }
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      
      // Enviar el archivo como respuesta
      return res.sendFile(filePath);
    } catch (error) {
      logger.error('Error al obtener archivo de perfil de cliente', {
        error: error.message,
        stack: error.stack,
        profileId: req.params.id,
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
      
      // Obtener el perfil para verificar si existe y obtener la ruta del archivo
      const query = 'SELECT * FROM client_profiles WHERE user_id = $1';
      const { rows } = await pool.query(query, [userId]);
      
      if (rows.length === 0) {
        logger.warn('Perfil de cliente no encontrado por ID de usuario', { userId });
        return res.status(404).json({
          success: false,
          message: 'Perfil de cliente no encontrado'
        });
      }
      
      const profile = rows[0];
      let fileName;
      
      // Determinar qué archivo se está solicitando
      if (fileType === 'cedula' && profile.fotocopia_cedula) {
        fileName = profile.fotocopia_cedula;
      } else if (fileType === 'rut' && profile.fotocopia_rut) {
        fileName = profile.fotocopia_rut;
      } else if (fileType === 'anexos' && profile.anexos_adicionales) {
        fileName = profile.anexos_adicionales;
      } else {
        logger.warn('Archivo no encontrado en el perfil', { 
          userId, 
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
      const ext = path.extname(fileName).toLowerCase();
      let contentType = 'application/octet-stream'; // Por defecto
      
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
      
      if (mimeTypes[ext]) {
        contentType = mimeTypes[ext];
      }
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      
      // Enviar el archivo como respuesta
      return res.sendFile(filePath);
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
}

// Crear una instancia del controlador
const clientProfileController = new ClientProfileController();

// Exportar los métodos individualmente

module.exports = {
  getAllProfiles: clientProfileController.getAllProfiles,
  getProfileById: clientProfileController.getProfileById,
  getProfileByUserId: clientProfileController.getProfileByUserId,
  createProfile: clientProfileController.createProfile,
  updateProfile: clientProfileController.updateProfile,
  deleteProfile: clientProfileController.deleteProfile,
  getFile: clientProfileController.getFile,
  getFileByUserId: clientProfileController.getFileByUserId
};