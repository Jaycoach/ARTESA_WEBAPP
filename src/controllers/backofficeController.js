const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { createContextLogger } = require('../config/logger');
const ClientProfile = require('../models/clientProfile');
const ClientBranch = require('../models/ClientBranch');
const Order = require('../models/Order');
const AdminSettings = require('../models/AdminSettings');
const BackofficeAction = require('../models/BackofficeAction');
const EmailService = require('../services/EmailService');
const SapSalesPersonService = require('../services/SapSalesPersonService');

const logger = createContextLogger('BackofficeController');

/**
 * GET /api/backoffice/clients?search=
 * Lista clientes (client_profiles) con su estado activo/inactivo. Admite búsqueda.
 */
const listClients = async (req, res) => {
  try {
    const { search } = req.query;
    const clients = await ClientProfile.getAllForBackoffice({ search });

    res.status(200).json({ success: true, data: clients });
  } catch (error) {
    logger.error('Error al listar clientes en BackOffice', { error: error.message });
    res.status(500).json({ success: false, message: 'Error al listar clientes' });
  }
};

/**
 * GET /api/backoffice/clients/:clientId/branches
 * Lista las sucursales de un cliente específico.
 */
const listClientBranches = async (req, res) => {
  try {
    const { clientId } = req.params;
    const branches = await ClientBranch.getByClientId(clientId);

    res.status(200).json({ success: true, data: branches });
  } catch (error) {
    logger.error('Error al listar sucursales en BackOffice', {
      error: error.message,
      clientId: req.params.clientId
    });
    res.status(500).json({ success: false, message: 'Error al listar sucursales' });
  }
};

/**
 * POST /api/backoffice/clients/:userId/activate
 */
const activateClient = async (req, res) => {
  const { userId } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT cp.client_id, cp.company_name, u.is_active
       FROM client_profiles cp
       JOIN users u ON cp.user_id = u.id
       WHERE cp.user_id = $1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
    }

    await pool.query('UPDATE users SET is_active = true WHERE id = $1', [userId]);

    await BackofficeAction.log({
      adminUserId: req.user.id,
      actionType: 'activate_client',
      targetType: 'client_profile',
      targetId: rows[0].client_id,
      details: { user_id: parseInt(userId), company_name: rows[0].company_name, was_active: rows[0].is_active }
    });

    logger.info('Cliente activado desde BackOffice', { userId, adminId: req.user.id });

    res.status(200).json({
      success: true,
      message: 'Cliente activado exitosamente',
      data: { userId: parseInt(userId), clientId: rows[0].client_id, companyName: rows[0].company_name }
    });
  } catch (error) {
    logger.error('Error al activar cliente en BackOffice', { error: error.message, userId });
    res.status(500).json({ success: false, message: 'Error al activar cliente' });
  }
};

/**
 * POST /api/backoffice/clients/:userId/deactivate
 */
const deactivateClient = async (req, res) => {
  const { userId } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT cp.client_id, cp.company_name, u.is_active
       FROM client_profiles cp
       JOIN users u ON cp.user_id = u.id
       WHERE cp.user_id = $1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
    }

    await pool.query('UPDATE users SET is_active = false WHERE id = $1', [userId]);

    await BackofficeAction.log({
      adminUserId: req.user.id,
      actionType: 'deactivate_client',
      targetType: 'client_profile',
      targetId: rows[0].client_id,
      details: { user_id: parseInt(userId), company_name: rows[0].company_name, was_active: rows[0].is_active }
    });

    logger.info('Cliente inactivado desde BackOffice', { userId, adminId: req.user.id });

    res.status(200).json({
      success: true,
      message: 'Cliente inactivado exitosamente',
      data: { userId: parseInt(userId), clientId: rows[0].client_id, companyName: rows[0].company_name }
    });
  } catch (error) {
    logger.error('Error al inactivar cliente en BackOffice', { error: error.message, userId });
    res.status(500).json({ success: false, message: 'Error al inactivar cliente' });
  }
};

/**
 * POST /api/backoffice/branches/:branchId/reset-password
 * Genera una contraseña aleatoria, la hashea con bcrypt y la envía por correo a la sucursal.
 * Nunca se devuelve la contraseña en la respuesta de la API.
 */
const resetBranchPassword = async (req, res) => {
  const { branchId } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT cb.branch_id, cb.branch_name, cb.email_branch, cp.company_name
       FROM client_branches cb
       JOIN client_profiles cp ON cb.client_id = cp.client_id
       WHERE cb.branch_id = $1`,
      [branchId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sucursal no encontrada' });
    }

    const branch = rows[0];

    if (!branch.email_branch) {
      return res.status(409).json({
        success: false,
        message: 'La sucursal no tiene un correo de login registrado; no se puede notificar la nueva contraseña'
      });
    }

    const newPassword = crypto.randomBytes(10).toString('hex');
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `UPDATE client_branches SET password = $1, updated_at_auth = CURRENT_TIMESTAMP WHERE branch_id = $2`,
      [hashedPassword, branchId]
    );

    await EmailService.sendBackofficePasswordResetEmail(
      branch.email_branch,
      newPassword,
      branch.branch_name,
      branch.company_name
    );

    await BackofficeAction.log({
      adminUserId: req.user.id,
      actionType: 'reset_branch_password',
      targetType: 'client_branch',
      targetId: parseInt(branchId),
      details: { branch_name: branch.branch_name, notified_email: branch.email_branch }
    });

    logger.info('Password de sucursal reseteado desde BackOffice', { branchId, adminId: req.user.id });

    res.status(200).json({
      success: true,
      message: 'Contraseña restablecida y notificada por correo a la sucursal'
    });
  } catch (error) {
    logger.error('Error al resetear password de sucursal en BackOffice', { error: error.message, branchId });
    res.status(500).json({ success: false, message: 'Error al resetear la contraseña' });
  }
};

/**
 * POST /api/backoffice/orders
 * Crea una orden a nombre de un cliente elegido por el admin.
 * orders.user_id = cliente real (para que SapOrderService resuelva CardCode sin cambios).
 * orders.placed_by_user_id = admin que la creó. orders.order_origin = 'backoffice'.
 */
const createOrderForClient = async (req, res) => {
  try {
    const { user_id, total_amount, details, delivery_date, branch_id, comments, customer_po_number } = req.body;

    if (!user_id) {
      return res.status(400).json({ success: false, message: 'ID de cliente requerido' });
    }
    if (!branch_id) {
      return res.status(400).json({ success: false, message: 'Sucursal requerida' });
    }
    if (!details || details.length === 0) {
      return res.status(400).json({ success: false, message: 'No se puede crear una orden sin detalles' });
    }
    if (!total_amount || total_amount <= 0) {
      return res.status(400).json({ success: false, message: 'Monto total inválido' });
    }

    let parsedDeliveryDate;
    if (delivery_date) {
      const [dyear, dmonth, dday] = delivery_date.split('-').map(Number);
      parsedDeliveryDate = new Date(dyear, dmonth - 1, dday, 12, 0, 0);
      if (isNaN(parsedDeliveryDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Formato de fecha de entrega inválido' });
      }
    } else {
      const adminSettings = await AdminSettings.getSettings();
      parsedDeliveryDate = Order.calculateDeliveryDate(new Date(), adminSettings.orderTimeLimit);
    }

    const result = await Order.createOrder(
      user_id,
      total_amount,
      details,
      parsedDeliveryDate,
      1,
      branch_id,
      comments,
      null,
      customer_po_number
    );

    await pool.query(
      `UPDATE orders SET placed_by_user_id = $1, order_origin = 'backoffice' WHERE order_id = $2`,
      [req.user.id, result.order_id]
    );

    await BackofficeAction.log({
      adminUserId: req.user.id,
      actionType: 'create_order',
      targetType: 'order',
      targetId: result.order_id,
      details: { client_user_id: user_id, branch_id, details_count: result.details_count }
    });

    logger.info('Orden creada desde BackOffice a nombre de un cliente', {
      orderId: result.order_id,
      clientUserId: user_id,
      adminId: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Orden creada exitosamente a nombre del cliente',
      data: result
    });
  } catch (error) {
    logger.error('Error al crear orden desde BackOffice', {
      error: error.message,
      stack: error.stack,
      clientUserId: req.body?.user_id,
      adminId: req.user?.id
    });

    res.status(500).json({
      success: false,
      message: 'Error al crear la orden',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/backoffice/sap-sales-persons
 * Lista los vendedores (SalesPersons) de SAP, para elegir el mapeo de un admin BackOffice.
 */
const listSapSalesPersons = async (req, res) => {
  try {
    const salesPersons = await SapSalesPersonService.getSalesPersons();
    res.status(200).json({ success: true, data: salesPersons });
  } catch (error) {
    logger.error('Error al listar vendedores SAP en BackOffice', { error: error.message });
    res.status(502).json({ success: false, message: 'Error al consultar vendedores en SAP' });
  }
};

/**
 * PATCH /api/backoffice/users/:userId/sap-sales-employee-code
 * Mapea un admin BackOffice a un SalesEmployeeCode real de SAP (o lo limpia con null).
 */
const setSalesEmployeeMapping = async (req, res) => {
  const { userId } = req.params;
  const { sap_sales_employee_code } = req.body;

  try {
    const { rows } = await pool.query('SELECT id, rol_id FROM users WHERE id = $1', [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const code = sap_sales_employee_code === null || sap_sales_employee_code === undefined
      ? null
      : parseInt(sap_sales_employee_code, 10);

    await pool.query('UPDATE users SET sap_sales_employee_code = $1 WHERE id = $2', [code, userId]);

    await BackofficeAction.log({
      adminUserId: req.user.id,
      actionType: 'set_sales_employee_mapping',
      targetType: 'user',
      targetId: parseInt(userId),
      details: { sap_sales_employee_code: code }
    });

    logger.info('Mapeo de SalesEmployeeCode actualizado desde BackOffice', {
      userId, code, adminId: req.user.id
    });

    res.status(200).json({
      success: true,
      message: 'Mapeo actualizado exitosamente',
      data: { userId: parseInt(userId), sap_sales_employee_code: code }
    });
  } catch (error) {
    logger.error('Error al actualizar mapeo de SalesEmployeeCode', { error: error.message, userId });
    res.status(500).json({ success: false, message: 'Error al actualizar el mapeo' });
  }
};

module.exports = {
  listClients,
  listClientBranches,
  activateClient,
  deactivateClient,
  resetBranchPassword,
  createOrderForClient,
  listSapSalesPersons,
  setSalesEmployeeMapping
};
