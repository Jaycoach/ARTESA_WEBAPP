// src/controllers/clientProfileController.js
const pool = require('../config/db');
const { createContextLogger } = require('../config/logger');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ClientProfile = require('../models/clientProfile');

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
  
  try {
    const uniqueFilename = `${uuidv4()}${path.extname(file.name)}`;
    const filePath = path.join(uploadDir, uniqueFilename);
    
    // Mover el archivo a la ubicación final
    await file.mv(filePath);
    
    return uniqueFilename; // Devolver solo el nombre del archivo
  } catch (error) {
    logger.error('Error al guardar archivo', {
      error: error.message,
      fileName: file.name,
      fileSize: file.size
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
      
      const profiles = await ClientProfile.getAll();
      
      // Agregar URLs para archivos
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const profilesWithUrls = profiles.map(profile => {
        const result = { ...profile };
        
        if (result.fotocopiaCedula) {
          result.fotocopiaCedulaUrl = `${baseUrl}/api/client-profiles/${profile.client_id}/file/cedula`;
        }
        
        if (result.fotocopiaRut) {
          result.fotocopiaRutUrl = `${baseUrl}/api/client-profiles/${profile.client_id}/file/rut`;
        }
        
        if (result.anexosAdicionales) {
          result.anexosAdicionalesUrl = `${baseUrl}/api/client-profiles/${profile.client_id}/file/anexos`;
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
      
      const profile = await ClientProfile.getById(id);
      
      if (!profile) {
        logger.warn('Perfil de cliente no encontrado', { profileId: id });
        return res.status(404).json({
          success: false,
          message: 'Perfil de cliente no encontrado'
        });
      }
      
      // Agregar URLs para archivos
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      if (profile.fotocopiaCedula) {
        profile.fotocopiaCedulaUrl = `${baseUrl}/api/client-profiles/${id}/file/cedula`;
      }
      
      if (profile.fotocopiaRut) {
        profile.fotocopiaRutUrl = `${baseUrl}/api/client-profiles/${id}/file/rut`;
      }
      
      if (profile.anexosAdicionales) {
        profile.anexosAdicionalesUrl = `${baseUrl}/api/client-profiles/${id}/file/anexos`;
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
        profile.fotocopiaCedulaUrl = `${baseUrl}/api/client-profiles/user/${userId}/file/cedula`;
      }
      
      if (profile.fotocopiaRut) {
        profile.fotocopiaRutUrl = `${baseUrl}/api/client-profiles/user/${userId}/file/rut`;
      }
      
      if (profile.anexosAdicionales) {
        profile.anexosAdicionalesUrl = `${baseUrl}/api/client-profiles/user/${userId}/file/anexos`;
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
      // Depuración inicial
      // Extraer datos de la solicitud
      const clientData = { ...req.body };

      logger.debug('Recibiendo datos para perfil de cliente', { 
        bodyFields: Object.keys(clientData),
        filesExist: !!req.files,
        filesFields: req.files ? Object.keys(req.files) : []
      });
      
      // Asegurar que userId sea un entero
      if (clientData.userId) {
        clientData.userId = parseInt(clientData.userId);
      } else if (req.user && req.user.id) {
        // Si no se proporciona userId, usar el del usuario autenticado
        clientData.userId = req.user.id;
      }
      
      logger.debug('Creando nuevo perfil de cliente', { 
        userId: clientData.userId,
        razonSocial: clientData.razonSocial
      });
      
      // Validación básica
      //if (!clientData.razonSocial) {
        //return res.status(400).json({
          //success: false,
          //message: 'La razón social es requerida'
        //});
      //}
      
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
          if (req.files.fotocopiaCedula) {
            clientData.fotocopiaCedula = await saveFile(req.files.fotocopiaCedula);
          }
          
          if (req.files.fotocopiaRut) {
            clientData.fotocopiaRut = await saveFile(req.files.fotocopiaRut);
          }
          
          if (req.files.anexosAdicionales) {
            clientData.anexosAdicionales = await saveFile(req.files.anexosAdicionales);
          }
        }
      } catch (fileError) {
        logger.error('Error procesando archivos', {
          error: fileError.message,
          stack: fileError.stack
        });
        // Continuamos sin archivos
      }
      
      // Crear el perfil
      const profile = await ClientProfile.create(clientData);
      
      // Agregar URLs para archivos en la respuesta
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      if (profile.fotocopiaCedula) {
        profile.fotocopiaCedulaUrl = `${baseUrl}/api/client-profiles/${profile.client_id}/file/cedula`;
      }
      
      if (profile.fotocopiaRut) {
        profile.fotocopiaRutUrl = `${baseUrl}/api/client-profiles/${profile.client_id}/file/rut`;
      }
      
      if (profile.anexosAdicionales) {
        profile.anexosAdicionalesUrl = `${baseUrl}/api/client-profiles/${profile.client_id}/file/anexos`;
      }
      
      logger.info('Perfil de cliente creado exitosamente', {
        profileId: profile.client_id,
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
      const updateData = { ...req.body };
      
      logger.debug('Actualizando perfil de cliente', { 
        profileId: id,
        fields: Object.keys(updateData)
      });
      
      // Obtener el perfil actual para verificar si existe
      const existingProfile = await ClientProfile.getById(id);
      
      if (!existingProfile) {
        logger.warn('Perfil de cliente no encontrado al actualizar', { profileId: id });
        return res.status(404).json({
          success: false,
          message: 'Perfil de cliente no encontrado'
        });
      }
      
      // Procesar archivos si existen
      if (req.files) {
        // Si hay nuevos archivos, eliminar los anteriores y guardar los nuevos
        if (req.files.fotocopiaCedula) {
          if (existingProfile.fotocopiaCedula) {
            const oldPath = path.join(uploadDir, existingProfile.fotocopiaCedula);
            if (fs.existsSync(oldPath)) {
              fs.unlinkSync(oldPath);
            }
          }
          updateData.fotocopiaCedula = await saveFile(req.files.fotocopiaCedula);
        }
        
        if (req.files.fotocopiaRut) {
          if (existingProfile.fotocopiaRut) {
            const oldPath = path.join(uploadDir, existingProfile.fotocopiaRut);
            if (fs.existsSync(oldPath)) {
              fs.unlinkSync(oldPath);
            }
          }
          updateData.fotocopiaRut = await saveFile(req.files.fotocopiaRut);
        }
        
        if (req.files.anexosAdicionales) {
          if (existingProfile.anexosAdicionales) {
            const oldPath = path.join(uploadDir, existingProfile.anexosAdicionales);
            if (fs.existsSync(oldPath)) {
              fs.unlinkSync(oldPath);
            }
          }
          updateData.anexosAdicionales = await saveFile(req.files.anexosAdicionales);
        }
      }
      
      // Actualizar el perfil
      const updatedProfile = await ClientProfile.update(id, updateData);
      
      if (!updatedProfile) {
        return res.status(404).json({
          success: false,
          message: 'Error al actualizar perfil'
        });
      }
      
      // Agregar URLs para archivos en la respuesta
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      if (updatedProfile.fotocopiaCedula) {
        updatedProfile.fotocopiaCedulaUrl = `${baseUrl}/api/client-profiles/${id}/file/cedula`;
      }
      
      if (updatedProfile.fotocopiaRut) {
        updatedProfile.fotocopiaRutUrl = `${baseUrl}/api/client-profiles/${id}/file/rut`;
      }
      
      if (updatedProfile.anexosAdicionales) {
        updatedProfile.anexosAdicionalesUrl = `${baseUrl}/api/client-profiles/${id}/file/anexos`;
      }
      
      logger.info('Perfil de cliente actualizado exitosamente', {
        profileId: id,
        razonSocial: updatedProfile.razonSocial
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
      const profile = await ClientProfile.getById(id);
      
      if (!profile) {
        logger.warn('Perfil de cliente no encontrado al eliminar', { profileId: id });
        return res.status(404).json({
          success: false,
          message: 'Perfil de cliente no encontrado'
        });
      }
      
      // Eliminar los archivos asociados al perfil
      if (profile.fotocopiaCedula) {
        const cedulaPath = path.join(uploadDir, profile.fotocopiaCedula);
        if (fs.existsSync(cedulaPath)) {
          fs.unlinkSync(cedulaPath);
        }
      }
      
      if (profile.fotocopiaRut) {
        const rutPath = path.join(uploadDir, profile.fotocopiaRut);
        if (fs.existsSync(rutPath)) {
          fs.unlinkSync(rutPath);
        }
      }
      
      if (profile.anexosAdicionales) {
        const anexosPath = path.join(uploadDir, profile.anexosAdicionales);
        if (fs.existsSync(anexosPath)) {
          fs.unlinkSync(anexosPath);
        }
      }
      
      // Luego eliminamos el perfil de la base de datos
      const deletedProfile = await ClientProfile.delete(id);
      
      logger.info('Perfil de cliente eliminado exitosamente', {
        profileId: id,
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
      const profile = await ClientProfile.getById(id);
      
      if (!profile) {
        logger.warn('Perfil de cliente no encontrado', { profileId: id });
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
      
      // Obtener el perfil por ID de usuario
      const profile = await ClientProfile.getByUserId(userId);
      
      if (!profile) {
        logger.warn('Perfil de cliente no encontrado por ID de usuario', { userId });
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