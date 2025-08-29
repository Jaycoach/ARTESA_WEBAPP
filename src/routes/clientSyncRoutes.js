const express = require('express');
const router = express.Router();
const clientSyncController = require('../controllers/clientSyncController');
const { verifyToken, checkRole } = require('../middleware/auth');
const pool = require('../config/db');

/**
 * @swagger
 * tags:
 *   name: ClientSync
 *   description: Endpoints para sincronización de clientes con SAP Business One
 */

// Aplicar middleware de autenticación a todas las rutas
router.use(verifyToken);

// Solo los administradores pueden acceder a estas rutas
router.use(checkRole([1]));

/**
 * @swagger
 * /api/client-sync/status:
 *   get:
 *     summary: Obtener estado de sincronización de clientes
 *     description: Devuelve información sobre el estado de la sincronización de clientes con SAP B1
 *     tags: [ClientSync]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estado de sincronización de clientes
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
router.get('/status', clientSyncController.getSyncStatus);

/**
 * @swagger
 * /api/client-sync/sync:
 *   post:
 *     summary: Iniciar sincronización manual de clientes
 *     description: Inicia una sincronización de clientes con SAP B1 para activar usuarios
 *     tags: [ClientSync]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sincronización iniciada exitosamente
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
router.post('/sync', clientSyncController.syncClients);

/**
 * @swagger
 * /api/client-sync/clients/pending:
 *   get:
 *     summary: Obtener clientes pendientes de activación
 *     description: Devuelve la lista de clientes que están sincronizados con SAP pero aún no activados
 *     tags: [ClientSync]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de clientes pendientes de activación
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
router.get('/clients/pending', clientSyncController.getPendingClients);

/**
 * Sincronizar manualmente un cliente específico con SAP
 * @route POST /api/client-sync/client/{userId}/sync
 * @group ClientSync - Operaciones relacionadas con sincronización de clientes
 * @security bearerAuth
 * @param {number} userId.path.required - ID del usuario a sincronizar
 * @returns {object} 200 - Cliente sincronizado exitosamente
 * @returns {object} 401 - No autorizado
 * @returns {object} 403 - No tiene permisos para realizar esta acción
 * @returns {object} 404 - Cliente no encontrado
 * @returns {object} 500 - Error interno del servidor
 */
router.post('/client/:userId/sync', 
  verifyToken, 
  checkRole([1]), // Solo administradores
  clientSyncController.syncClient
);

/**
 * @swagger
 * /api/client-sync/client/{userId}/activate:
 *   post:
 *     summary: Activar un cliente manualmente
 *     description: Activa un cliente específico sin verificar su estado en SAP
 *     tags: [ClientSync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario a activar
 *     responses:
 *       200:
 *         description: Cliente activado exitosamente
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       404:
 *         description: Cliente no encontrado
 *       500:
 *         description: Error interno del servidor
 */
router.post('/client/:userId/activate', clientSyncController.activateClient);

/**
 * @swagger
 * /api/client-sync/client/{userId}/simulate-sync:
 *   post:
 *     summary: Simular sincronización completa con SAP para un usuario
 *     description: Simula la sincronización con SAP asignando un CardCode, marcando como sincronizado y activando el usuario
 *     tags: [ClientSync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario a sincronizar
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cardType:
 *                 type: string
 *                 enum: [Lead, Customer]
 *                 default: Customer
 *                 description: Tipo de Business Partner en SAP
 *               activateUser:
 *                 type: boolean
 *                 default: true
 *                 description: Si debe activar el usuario después de la sincronización
 *     responses:
 *       200:
 *         description: Sincronización simulada exitosamente
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
 *                   example: "Sincronización con SAP simulada exitosamente"
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: integer
 *                       example: 5
 *                     clientId:
 *                       type: integer
 *                       example: 3
 *                     cardcodeSap:
 *                       type: string
 *                       example: "CI1234567890"
 *                     cardType:
 *                       type: string
 *                       example: "Customer"
 *                     userActivated:
 *                       type: boolean
 *                       example: true
 *                     simulatedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Datos inválidos o usuario sin perfil
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       404:
 *         description: Usuario no encontrado
 *       500:
 *         description: Error interno del servidor
 */
router.post('/client/:userId/simulate-sync', 
  checkRole([1]), // Solo administradores
  clientSyncController.simulateSapSync
);

/**
 * @swagger
 * /api/client-sync/sap-diagnosis:
 *   get:
 *     summary: Diagnóstico de conexión SAP
 *     description: Verifica el estado de la configuración y conexión SAP
 *     tags: [ClientSync]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Diagnóstico completado
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
router.get('/sap-diagnosis', 
  checkRole([1]), // Solo administradores
  clientSyncController.sapDiagnosis
);

/**
 * @swagger
 * /api/client-sync/sync-institutional:
 *   post:
 *     summary: Sincronizar clientes institucionales del grupo SAP
 *     description: |
 *       Sincroniza clientes del grupo Institucional desde SAP Business One con sus sucursales.
 *       
 *       **Configuración requerida:**
 *       - Variable de entorno `SAP_INSTITUTIONAL_GROUP_CODE` (por defecto: 120)
 *       - Credenciales SAP válidas configuradas en el servidor
 *       
 *       **Proceso:**
 *       1. Consulta clientes del grupo institucional en SAP con filtro: `GroupCode eq 120 and CardType eq 'C'`
 *       2. Para cada cliente encontrado:
 *          - Si no existe: crea usuario y perfil de cliente
 *          - Si existe: actualiza información del cliente
 *          - Sincroniza las sucursales del cliente
 *       
 *       **Ejemplo de respuesta exitosa:**
 *       ```json
 *       {
 *         "success": true,
 *         "message": "Sincronización de clientes institucionales completada exitosamente",
 *         "data": {
 *           "total": 5,
 *           "created": 2,
 *           "updated": 3,
 *           "errors": 0,
 *           "branches": {
 *             "total": 10,
 *             "created": 4,
 *             "updated": 6,
 *             "errors": 0
 *           }
 *         }
 *       }
 *       ```
 *     tags: [ClientSync]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sincronización completada exitosamente
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
 *                   example: "Sincronización de clientes institucionales completada exitosamente"
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       description: Total de clientes procesados
 *                     created:
 *                       type: integer
 *                       description: Clientes nuevos creados
 *                     updated:
 *                       type: integer
 *                       description: Clientes existentes actualizados
 *                     errors:
 *                       type: integer
 *                       description: Errores durante el procesamiento
 *                     branches:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           description: Total de sucursales procesadas
 *                         created:
 *                           type: integer
 *                           description: Sucursales nuevas creadas
 *                         updated:
 *                           type: integer
 *                           description: Sucursales existentes actualizadas
 *                         errors:
 *                           type: integer
 *                           description: Errores en sucursales
 *       401:
 *         description: No autorizado - Token JWT inválido o faltante
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Token no válido"
 *       403:
 *         description: No tiene permisos suficientes - Requiere rol de administrador
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Acceso denegado"
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Error al sincronizar clientes institucionales"
 *                 error:
 *                   type: string
 *                   example: "Error de autenticación con SAP B1: Invalid company user"
 */
router.post('/sync-institutional', 
  checkRole([1]), // Solo administradores
  clientSyncController.syncInstitutionalClients
);
/**
 * @swagger
 * /api/client-sync/sync-ci-clients:
 *   post:
 *     summary: Sincronizar clientes con CardCode que inicia con "CI"
 *     description: Sincroniza todos los clientes de SAP cuyo CardCode comience con "CI" e inserta como usuarios inactivos que deberán usar recuperación de contraseña para activarse. Esta operación está diseñada para ejecutarse una sola vez al inicio del proyecto.
 *     tags: [ClientSync]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sincronización completada exitosamente
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
 *                   example: "Sincronización de clientes CI completada exitosamente"
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       description: Total de clientes procesados
 *                       example: 150
 *                     created:
 *                       type: integer
 *                       description: Clientes nuevos creados como inactivos
 *                       example: 140
 *                     updated:
 *                       type: integer
 *                       description: Clientes existentes actualizados
 *                       example: 10
 *                     errors:
 *                       type: integer
 *                       description: Errores durante el procesamiento
 *                       example: 0
 *                     skipped:
 *                       type: integer
 *                       description: Clientes omitidos
 *                       example: 0
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
router.post('/sync-ci-clients', 
  checkRole([1]), // Solo administradores
  clientSyncController.syncCIClients
);

/**
 * @swagger
 * /api/client-sync/list-ci-clients:
 *   get:
 *     summary: Listar clientes de SAP con CardCode que inicia con "CI"
 *     description: Obtiene la lista de clientes cuyo CardCode comience con "CI" directamente desde SAP sin sincronizar, útil para revisar antes de ejecutar la sincronización masiva
 *     tags: [ClientSync]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de clientes obtenida exitosamente
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
 *                   example: "Clientes CI obtenidos exitosamente"
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalClients:
 *                       type: integer
 *                       example: 150
 *                     clients:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           CardCode:
 *                             type: string
 *                             example: "CI1234567890"
 *                           CardName:
 *                             type: string
 *                             example: "EMPRESA EJEMPLO LTDA"
 *                           CardType:
 *                             type: string
 *                             example: "C"
 *                           GroupCode:
 *                             type: integer
 *                             example: 103
 *                           FederalTaxID:
 *                             type: string
 *                             example: "1234567890-1"
 *                           Phone1:
 *                             type: string
 *                             example: "3001234567"
 *                           EmailAddress:
 *                             type: string
 *                             example: "contacto@empresa.com"
 *                           Address:
 *                             type: string
 *                             example: "Calle 123 #45-67"
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
router.get('/list-ci-clients', 
  checkRole([1]), // Solo administradores
  clientSyncController.listCIClients
);

/**
 * @swagger
 * /api/client-sync/sync-all:
 *   post:
 *     summary: Iniciar sincronización manual completa con SAP
 *     description: Actualiza todos los perfiles de clientes con la información más reciente de SAP. Esta operación se ejecuta automáticamente a las 3 AM todos los días, pero puede ser iniciada manualmente.
 *     tags: [ClientSync]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sincronización iniciada exitosamente
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
router.post('/sync-all', 
  checkRole([1]), // Solo administradores
  clientSyncController.syncAllClients
);

/**
 * @swagger
 * /api/client-sync/branches/validate:
 *   get:
 *     summary: Validar sucursales de clientes institucionales
 *     description: Obtiene una lista de las sucursales encontradas en SAP para clientes institucionales y compara con las almacenadas localmente
 *     tags: [ClientSync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: clientId
 *         schema:
 *           type: integer
 *         description: ID del cliente específico para validar (opcional)
 *       - in: query
 *         name: cardCode
 *         schema:
 *           type: string
 *         description: Código SAP del cliente específico para validar (opcional)
 *     responses:
 *       200:
 *         description: Validación de sucursales completada exitosamente
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
 *                     totalClients:
 *                       type: integer
 *                       example: 15
 *                     clientsWithBranches:
 *                       type: integer
 *                       example: 12
 *                     totalSapBranches:
 *                       type: integer
 *                       example: 45
 *                     totalLocalBranches:
 *                       type: integer
 *                       example: 40
 *                     missingBranches:
 *                       type: integer
 *                       example: 5
 *                     extraBranches:
 *                       type: integer
 *                       example: 0
 *                     clientDetails:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           clientId:
 *                             type: integer
 *                           cardCode:
 *                             type: string
 *                           companyName:
 *                             type: string
 *                           sapBranches:
 *                             type: array
 *                           localBranches:
 *                             type: array
 *                           missing:
 *                             type: array
 *                           extra:
 *                             type: array
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
router.get('/branches/validate', 
  checkRole([1]), // Solo administradores
  clientSyncController.validateClientBranches
);
/**
 * @swagger
 * /api/client-sync/client/{cardCode}/branches/validate:
 *   get:
 *     summary: Validar sucursales de un cliente específico
 *     description: Valida las sucursales de un cliente específico comparando datos de SAP vs datos locales
 *     tags: [ClientSync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cardCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Código SAP del cliente (CardCode)
 *         example: "CI800230447"
 *     responses:
 *       200:
 *         description: Validación completada exitosamente
 *       404:
 *         description: Cliente no encontrado
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
router.get('/client/:cardCode/branches/validate', 
  checkRole([1]), // Solo administradores
  clientSyncController.validateSpecificClientBranches
);
/**
 * @swagger
 * /api/client-sync/branches/sync:
 *   post:
 *     summary: Sincronizar sucursales de clientes institucionales
 *     description: Sincroniza las sucursales de clientes institucionales desde SAP B1 hacia la base de datos local
 *     tags: [ClientSync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: clientId
 *         schema:
 *           type: integer
 *         description: ID del cliente específico para sincronizar (opcional)
 *       - in: query
 *         name: cardCode
 *         schema:
 *           type: string
 *         description: Código SAP del cliente específico para sincronizar (opcional)
 *       - in: query
 *         name: forceUpdate
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Forzar actualización de sucursales existentes
 *     responses:
 *       200:
 *         description: Sincronización de sucursales completada exitosamente
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
 *                   example: "Sincronización de sucursales completada exitosamente"
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalClients:
 *                       type: integer
 *                       example: 15
 *                     totalBranches:
 *                       type: integer
 *                       example: 45
 *                     created:
 *                       type: integer
 *                       example: 5
 *                     updated:
 *                       type: integer
 *                       example: 10
 *                     errors:
 *                       type: integer
 *                       example: 0
 *                     skipped:
 *                       type: integer
 *                       example: 2
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
router.post('/branches/sync', 
  checkRole([1]), // Solo administradores
  clientSyncController.syncClientBranches
);

/**
 * @swagger
 * /api/client-sync/client/{cardCode}/branches/sync:
 *   post:
 *     summary: Sincronizar sucursales de un cliente específico
 *     description: Sincroniza las sucursales de un cliente específico desde SAP B1 usando su CardCode
 *     tags: [ClientSync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cardCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Código SAP del cliente (CardCode)
 *     responses:
 *       200:
 *         description: Sincronización de sucursales completada exitosamente
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       404:
 *         description: Cliente no encontrado
 *       500:
 *         description: Error interno del servidor
 */
router.post('/client/:cardCode/branches/sync', 
  checkRole([1]), // Solo administradores
  async (req, res) => {
    try {
      const { cardCode } = req.params;
      
      // Buscar el cliente por CardCode
      const clientQuery = `
        SELECT client_id, cardcode_sap, company_name
        FROM client_profiles 
        WHERE cardcode_sap = $1
      `;
      
      const { rows } = await pool.query(clientQuery, [cardCode]);
      
      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Cliente con CardCode ${cardCode} no encontrado`
        });
      }
      
      const client = rows[0];
      
      // Configurar req.query para reutilizar el controlador existente
      req.query = {
        clientId: client.client_id,
        cardCode: cardCode,
        forceUpdate: false
      };
      
      // Llamar al método existente
      return clientSyncController.syncClientBranches(req, res);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al sincronizar sucursales del cliente',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);
/**
 * @swagger
 * /api/client-sync/test-email-ses:
 *   post:
 *     summary: Probar envío de correo con AWS SES (Capa Gratuita)
 *     description: Envía un correo de prueba usando AWS SES con validaciones de capa gratuita
 *     tags: [ClientSync]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *             properties:
 *               to:
 *                 type: string
 *                 format: email
 *                 description: Dirección de correo destino (debe estar verificada en capa gratuita)
 *                 example: "test@artesapanaderia.com"
 *               subject:
 *                 type: string
 *                 description: Asunto del correo
 *                 default: "Prueba AWS SES - La Artesa Panadería"
 *     responses:
 *       200:
 *         description: Correo enviado exitosamente
 *       400:
 *         description: Datos inválidos o límites excedidos
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error al enviar correo
 */
router.post('/test-email-ses', 
  checkRole([1]), // Solo administradores
  clientSyncController.testEmailSes
);

router.get('/debug/client/:userId', clientSyncController.debugClientStatus);

module.exports = router;