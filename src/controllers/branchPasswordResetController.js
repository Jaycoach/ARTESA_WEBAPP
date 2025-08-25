const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const BranchPasswordReset = require('../models/BranchPasswordReset');
const { createContextLogger } = require('../config/logger');
const EmailService = require('../services/EmailService');
const AuditService = require('../services/AuditService');

const logger = createContextLogger('BranchPasswordResetController');

/**
 * @swagger
 * components:
 *   schemas:
 *     BranchRequestResetRequest:
 *       type: object
 *       required:
 *         - mail
 *       properties:
 *         mail:
 *           type: string
 *           format: email
 *           description: Correo electrónico de la sucursal
 *           example: sucursal@cliente.com
 *         recaptchaToken:
 *           type: string
 *           description: Token de reCAPTCHA
 *     
 *     BranchRequestResetResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: Si el correo de sucursal existe, recibirás instrucciones para restablecer tu contraseña
 *         token:
 *           type: string
 *           description: Token de restablecimiento (solo en entorno de desarrollo)
 *     
 *     BranchResetPasswordRequest:
 *       type: object
 *       required:
 *         - token
 *         - newPassword
 *       properties:
 *         token:
 *           type: string
 *           description: Token de restablecimiento recibido por correo
 *         newPassword:
 *           type: string
 *           format: password
 *           description: Nueva contraseña de la sucursal
 *     
 *     BranchResetPasswordResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Contraseña de sucursal actualizada exitosamente
 */

class BranchPasswordResetController {
  /**
   * @swagger
   * /api/branch-password/request-reset:
   *   post:
   *     summary: Solicitar restablecimiento de contraseña para sucursal
   *     description: Envía un correo electrónico con un token para restablecer la contraseña de una sucursal
   *     tags: [BranchAuth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/BranchRequestResetRequest'
   *     responses:
   *       200:
   *         description: Solicitud procesada exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/BranchRequestResetResponse'
   *       400:
   *         description: Datos inválidos
   *       500:
   *         description: Error interno del servidor
   */
  async requestReset(req, res) {
    try {
      const { mail, recaptchaToken } = req.body;
      
      logger.info('Iniciando solicitud de reset de contraseña para sucursal', { mail });
      
      if (!mail) {
        return res.status(400).json({ 
          success: false,
          message: 'El correo electrónico es requerido' 
        });
      }

      // Buscar sucursal por email
      const { rows } = await pool.query(
        `SELECT cb.branch_id, cb.email_branch, cb.branch_name, cb.client_id, cb.is_login_enabled,
                cp.company_name
         FROM client_branches cb
         LEFT JOIN client_profiles cp ON cb.client_id = cp.client_id
         WHERE cb.email_branch = $1`,
        [mail]
      );

      if (rows.length === 0) {
        logger.info('Email de sucursal no encontrado', { mail });
        return res.status(200).json({ 
          message: 'Si el correo de sucursal existe, recibirás instrucciones para restablecer tu contraseña'
        });
      }

      const branch = rows[0];

      // Verificar que la sucursal tenga login habilitado
      if (!branch.is_login_enabled) {
        logger.warn('Intento de reset en sucursal con login deshabilitado', {
          branchId: branch.branch_id,
          mail
        });
        return res.status(200).json({ 
          message: 'Si el correo de sucursal existe, recibirás instrucciones para restablecer tu contraseña'
        });
      }

      // Verificar que tenga contraseña configurada
      const { rows: passwordRows } = await pool.query(
        'SELECT password FROM client_branches WHERE branch_id = $1 AND password IS NOT NULL',
        [branch.branch_id]
      );

      if (passwordRows.length === 0) {
        logger.warn('Intento de reset en sucursal sin contraseña configurada', {
          branchId: branch.branch_id,
          mail
        });
        return res.status(200).json({ 
          message: 'Si el correo de sucursal existe, recibirás instrucciones para restablecer tu contraseña'
        });
      }

      // Generar token único
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 3600000); // 1 hora

      // Guardar token en la base de datos
      await BranchPasswordReset.createToken(branch.branch_id, resetToken, expiresAt);

      // Enviar correo electrónico
      try {
        await EmailService.sendBranchPasswordResetEmail(
          mail, 
          resetToken,
          branch.branch_name,
          branch.company_name || 'Cliente'
        );

        logger.info('Correo de reset enviado para sucursal', {
          branchId: branch.branch_id,
          mail
        });

        // Registrar en auditoría
        await AuditService.logAuditEvent(
          AuditService.AUDIT_EVENTS.SECURITY_EVENT,
          {
            details: {
              action: 'BRANCH_PASSWORD_RESET_REQUESTED',
              branchId: branch.branch_id,
              clientId: branch.client_id,
              email: mail
            },
            ipAddress: req.ip
          },
          null, // No hay user_id para branches
          branch.branch_id
        );

      } catch (emailError) {
        logger.error('Error enviando correo de reset para sucursal', {
          error: emailError.message,
          branchId: branch.branch_id,
          mail
        });

        return res.status(500).json({ 
          success: false,
          message: 'Error enviando correo de restablecimiento' 
        });
      }

      const response = { 
        message: 'Si el correo de sucursal existe, recibirás instrucciones para restablecer tu contraseña'
      };

      // En desarrollo, incluir el token para pruebas
      if (process.env.NODE_ENV === 'development') {
        response.token = resetToken;
        logger.debug('Token de reset incluido en respuesta (desarrollo)', {
          branchId: branch.branch_id,
          token: resetToken.substring(0, 8) + '...'
        });
      }

      res.status(200).json(response);

    } catch (error) {
      logger.error('Error en solicitud de reset para sucursal', {
        error: error.message,
        stack: error.stack,
        mail: req.body.mail
      });

      res.status(500).json({ 
        success: false,
        message: 'Error interno del servidor' 
      });
    }
  }

  /**
   * @swagger
   * /api/branch-password/reset:
   *   post:
   *     summary: Restablecer contraseña de sucursal
   *     description: Restablece la contraseña de una sucursal usando un token válido
   *     tags: [BranchAuth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/BranchResetPasswordRequest'
   *     responses:
   *       200:
   *         description: Contraseña actualizada correctamente
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/BranchResetPasswordResponse'
   *       400:
   *         description: Token inválido o expirado
   *       500:
   *         description: Error interno del servidor
   */
  async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;

      logger.info('Iniciando reset de contraseña para sucursal', {
        token: token ? token.substring(0, 8) + '...' : 'undefined'
      });

      if (!token || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Token y nueva contraseña son requeridos'
        });
      }

      // Validar longitud de contraseña
      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'La contraseña debe tener al menos 8 caracteres'
        });
      }

      // Buscar token válido
      const tokenData = await BranchPasswordReset.findValidToken(token);

      if (!tokenData) {
        logger.warn('Token inválido o expirado para reset de sucursal', {
          token: token.substring(0, 8) + '...'
        });

        return res.status(400).json({
          success: false,
          message: 'Token inválido o expirado'
        });
      }

      // Hashear nueva contraseña
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Actualizar contraseña en la base de datos
      await pool.query(
        `UPDATE client_branches 
         SET password = $1, updated_at_auth = CURRENT_TIMESTAMP 
         WHERE branch_id = $2`,
        [hashedPassword, tokenData.branch_id]
      );

      // Marcar token como usado
      await BranchPasswordReset.markTokenAsUsed(token);

      // Registrar en auditoría
      await AuditService.logAuditEvent(
        AuditService.AUDIT_EVENTS.SECURITY_EVENT,
        {
          details: {
            action: 'BRANCH_PASSWORD_RESET_COMPLETED',
            branchId: tokenData.branch_id,
            clientId: tokenData.client_id,
            email: tokenData.email_branch
          },
          ipAddress: req.ip
        },
        null, // No hay user_id para branches
        tokenData.branch_id
      );

      logger.info('Contraseña de sucursal actualizada exitosamente', {
        branchId: tokenData.branch_id,
        branchName: tokenData.branch_name
      });

      res.status(200).json({
        success: true,
        message: 'Contraseña de sucursal actualizada exitosamente'
      });

    } catch (error) {
      logger.error('Error reseteando contraseña de sucursal', {
        error: error.message,
        stack: error.stack,
        token: req.body.token ? req.body.token.substring(0, 8) + '...' : 'undefined'
      });

      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}

module.exports = new BranchPasswordResetController();