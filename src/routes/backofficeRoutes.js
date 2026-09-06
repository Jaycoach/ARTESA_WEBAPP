const express = require('express');
const router = express.Router();
const backofficeController = require('../controllers/backofficeController');
const { verifyToken, checkRole } = require('../middleware/auth');
const { sanitizeBody } = require('../middleware/security');

/**
 * @swagger
 * tags:
 *   name: BackOffice
 *   description: Gestión de clientes/sucursales y creación de pedidos a nombre de un cliente (rol ADMIN o BACKOFFICE)
 */

router.use(verifyToken);
router.use(checkRole([1, 4])); // ADMIN (superadmin) o BACKOFFICE
router.use(sanitizeBody);

router.get('/clients', backofficeController.listClients);
router.get('/clients/:clientId/branches', backofficeController.listClientBranches);
router.post('/clients/:userId/activate', backofficeController.activateClient);
router.post('/clients/:userId/deactivate', backofficeController.deactivateClient);
router.post('/branches/:branchId/reset-password', backofficeController.resetBranchPassword);
router.post('/clients/:clientId/product-prices', backofficeController.getClientProductPrices);
router.post('/orders', backofficeController.createOrderForClient);
router.get('/sap-sales-persons', backofficeController.listSapSalesPersons);
router.patch('/users/:userId/sap-sales-employee-code', backofficeController.setSalesEmployeeMapping);

module.exports = router;
