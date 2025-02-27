// src/routes/clientProfileRoutes.js
const express = require('express');
const router = express.Router();
const clientProfileController = require('../controllers/clientProfileController');
const { verifyToken, checkRole } = require('../middleware/auth');
const { sanitizeBody, sanitizeParams } = require('../middleware/security');

// Aplicar middleware de seguridad a todas las rutas
router.use(sanitizeBody, sanitizeParams);

/**
 * @swagger
 * tags:
 *   name: ClientProfiles
 *   description: Endpoints para gestión de perfiles de clientes
 */

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ClientProfile'
 *       401:
 *         description: No autorizado - Token no proporcionado o inválido
 *       403:
 *         description: Prohibido - Sin permisos de administrador
 *       500:
 *         description: Error interno del servidor
 */
router.get('/client-profiles', 
  verifyToken, 
  checkRole([1]), // Solo administradores
  clientProfileController.getAllProfiles
);

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ClientProfile'
 *       401:
 *         description: No autorizado - Token no proporcionado o inválido
 *       404:
 *         description: Perfil no encontrado
 *       500:
 *         description: Error interno del servidor
 */
router.get('/client-profiles/:id', 
  verifyToken, 
  clientProfileController.getProfileById
);

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
 *         application/json:
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
 *     responses:
 *       201:
 *         description: Perfil creado exitosamente
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
 *                   example: Perfil de cliente creado exitosamente
 *                 data:
 *                   $ref: '#/components/schemas/ClientProfile'
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado - Token no proporcionado o inválido
 *       403:
 *         description: Prohibido - Sin permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
router.post('/client-profiles', 
  verifyToken, 
  checkRole([1]), // Solo administradores pueden crear perfiles
  clientProfileController.createProfile
);

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
 *         application/json:
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
 *     responses:
 *       200:
 *         description: Perfil actualizado exitosamente
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
 *                   example: Perfil de cliente actualizado exitosamente
 *                 data:
 *                   $ref: '#/components/schemas/ClientProfile'
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado - Token no proporcionado o inválido
 *       403:
 *         description: Prohibido - Sin permisos suficientes
 *       404:
 *         description: Perfil no encontrado
 *       500:
 *         description: Error interno del servidor
 */
router.put('/client-profiles/:id', 
  verifyToken, 
  checkRole([1]), // Solo administradores pueden actualizar perfiles
  clientProfileController.updateProfile
);

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
 *                   example: Perfil de cliente eliminado exitosamente
 *                 data:
 *                   $ref: '#/components/schemas/ClientProfile'
 *       401:
 *         description: No autorizado - Token no proporcionado o inválido
 *       403:
 *         description: Prohibido - Sin permisos suficientes
 *       404:
 *         description: Perfil no encontrado
 *       500:
 *         description: Error interno del servidor
 */
router.delete('/client-profiles/:id', 
  verifyToken, 
  checkRole([1]), // Solo administradores pueden eliminar perfiles
  clientProfileController.deleteProfile
);

module.exports = router;