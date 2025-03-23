const AdminSettings = require('../models/AdminSettings');
const S3Service = require('../services/S3Service');
const { createContextLogger } = require('../config/logger');
const AuditService = require('../services/AuditService');
const orderScheduler = require('../services/OrderScheduler');

// Crear una instancia del logger con contexto
const logger = createContextLogger('AdminController');

/**
 * Controlador para administración del portal
 */
class AdminController {
  /**
   * @swagger
   * /api/admin/settings:
   *   get:
   *     summary: Obtener configuración del portal
   *     description: Recupera la configuración actual del portal administrativo
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Configuración recuperada exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     orderTimeLimit:
   *                       type: string
   *                       example: "18:00"
   *                     homeBannerImageUrl:
   *                       type: string
   *                       example: "https://tu-bucket.s3.amazonaws.com/banners/imagen.jpg"
   *       401:
   *         description: No autorizado
   *       403:
   *         description: No tiene permisos suficientes
   *       500:
   *         description: Error interno del servidor
   */
  async getSettings(req, res) {
    try {
      logger.debug('Solicitando configuración del portal', { 
        userId: req.user?.id 
      });

      // Determinar qué datos devolver basado en el rol del usuario
      const isAdmin = req.user.rol_id === 1 || req.user.rol_id === 3;
      
      // Registrar en auditoría
      await AuditService.logAuditEvent(
        AuditService.AUDIT_EVENTS.DATA_ACCESSED,
        {
          details: {
            action: 'GET_ADMIN_SETTINGS',
            method: req.method,
            path: req.path
          },
          ipAddress: req.ip
        },
        req.user.id
      );
      
      // Obtener configuración
      const settings = await AdminSettings.getSettings();
      
      // Si no es administrador, devolver solo orderTimeLimit
      if (!isAdmin) {
        res.status(200).json({
          success: true,
          data: {
            orderTimeLimit: settings.orderTimeLimit
          }
        });
      } else {
        // Los administradores obtienen todos los datos
        res.status(200).json({
          success: true,
          data: settings
        });
      }
    } catch (error) {
      logger.error('Error al obtener configuración del portal', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al obtener configuración del portal',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  /**
   * @swagger
   * /api/admin/settings:
   *   post:
   *     summary: Actualizar configuración del portal
   *     description: Actualiza la configuración del portal administrativo
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required:
   *               - orderTimeLimit
   *             properties:
   *               orderTimeLimit:
   *                 type: string
   *                 description: Hora límite para pedidos (HH:MM)
   *                 example: "18:00"
   *               homeBannerImage:
   *                 type: string
   *                 format: binary
   *                 description: Imagen para el banner de la página principal
   *     responses:
   *       200:
   *         description: Configuración actualizada exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "Configuración actualizada exitosamente"
   *                 data:
   *                   type: object
   *                   properties:
   *                     orderTimeLimit:
   *                       type: string
   *                       example: "18:00"
   *                     homeBannerImageUrl:
   *                       type: string
   *                       example: "https://tu-bucket.s3.amazonaws.com/banners/imagen.jpg"
   *       400:
   *         description: Datos inválidos
   *       401:
   *         description: No autorizado
   *       403:
   *         description: No tiene permisos suficientes
   *       500:
   *         description: Error interno del servidor
   */
  async updateSettings(req, res) {
    try {
      const { orderTimeLimit } = req.body;
      
      logger.debug('Actualizando configuración del portal', { 
        userId: req.user?.id,
        orderTimeLimit
      });
      
      // Validar la hora límite (formato HH:MM)
      if (!orderTimeLimit || !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(orderTimeLimit)) {
        return res.status(400).json({
          success: false,
          message: 'Formato de hora inválido. Debe ser HH:MM',
          errorCode: 'VAL_INVALID_FORMAT'
        });
      }
      
      // Verificar si hay archivo de imagen
      let imageUrl = null;
      if (req.files && req.files.homeBannerImage) {
        const file = req.files.homeBannerImage;
        
        // Validar que sea una imagen
        if (!file.mimetype.startsWith('image/')) {
          return res.status(400).json({
            success: false,
            message: 'El archivo debe ser una imagen',
            errorCode: 'FILE_INVALID_TYPE'
          });
        }
        
        // Subir a S3
        const key = `banners/home-banner-${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
        
        logger.debug('Subiendo imagen de banner a S3', { 
          fileName: file.name,
          fileSize: file.size,
          key
        });
        
        // Subir la imagen a S3
        imageUrl = await S3Service.uploadFormFile(file, key, { 
          public: true 
        });
        
        logger.info('Imagen de banner subida exitosamente', { 
          fileName: file.name,
          imageUrl
        });
      }
      
      // Crear objeto de configuración a actualizar
      const settingsToUpdate = {
        orderTimeLimit
      };
      
      // Solo incluir la URL de la imagen si se subió una nueva
      if (imageUrl) {
        settingsToUpdate.homeBannerImageUrl = imageUrl;
      }
      
      // Actualizar configuración
      const updatedSettings = await AdminSettings.updateSettings(settingsToUpdate);
      
      // Registrar en auditoría
      await AuditService.logAuditEvent(
        AuditService.AUDIT_EVENTS.DATA_ACCESSED,
        {
          details: {
            action: 'UPDATE_ADMIN_SETTINGS',
            orderTimeLimit,
            imageUpdated: !!imageUrl
          },
          ipAddress: req.ip
        },
        req.user.id,
        AuditService.SEVERITY_LEVELS.INFO
      );

      if (settingsToUpdate.orderTimeLimit) {
        try {
          await orderScheduler.updateTaskSettings({
            orderTimeLimit: settingsToUpdate.orderTimeLimit
          });
          
          logger.info('Configuración de programación de órdenes actualizada', {
            orderTimeLimit: settingsToUpdate.orderTimeLimit
          });
        } catch (schedulerError) {
          logger.error('Error al actualizar programación de órdenes', {
            error: schedulerError.message,
            stack: schedulerError.stack
          });
          // No fallamos la operación principal si hay error en el scheduler
        }
      }
      
      res.status(200).json({
        success: true,
        message: 'Configuración actualizada exitosamente',
        data: updatedSettings
      });
    } catch (error) {
      logger.error('Error al actualizar configuración del portal', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al actualizar configuración del portal',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

// Exportar instancia del controlador
module.exports = new AdminController();