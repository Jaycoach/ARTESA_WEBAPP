const pool = require('../config/db');
const { createContextLogger } = require('../config/logger');

const logger = createContextLogger('BranchDashboardController');

/**
 * Controlador para dashboard y estadísticas de sucursales
 */
class BranchDashboardController {

  /**
   * Obtener estadísticas generales del dashboard para la sucursal
   */
  async getDashboardStats(req, res) {
    try {
      const { branch_id, client_id } = req.branch;

      logger.debug('Obteniendo estadísticas de dashboard para sucursal', { 
        branchId: branch_id,
        clientId: client_id
      });

      // Estadísticas de órdenes de la sucursal en los últimos 30 días
      const ordersStatsQuery = `
        SELECT 
          COUNT(*) as total_orders,
          COUNT(CASE WHEN o.status_id = 1 THEN 1 END) as pending_orders,
          COUNT(CASE WHEN o.status_id = 2 THEN 1 END) as processing_orders,
          COUNT(CASE WHEN o.status_id = 3 THEN 1 END) as shipped_orders,
          COUNT(CASE WHEN o.status_id = 4 THEN 1 END) as delivered_orders,
          COALESCE(SUM(o.total_amount), 0) as total_amount,
          COALESCE(AVG(o.total_amount), 0) as average_order_value
        FROM orders o
        WHERE o.branch_id = $1 
          AND o.order_date >= CURRENT_DATE - INTERVAL '30 days'
          AND o.user_id IN (
            SELECT cp.user_id 
            FROM client_profiles cp 
            WHERE cp.client_id = $2
          )
      `;

      const { rows: orderStats } = await pool.query(ordersStatsQuery, [branch_id, client_id]);

      // Estadísticas de facturas del último mes
      const invoicesStatsQuery = `
        SELECT 
          COUNT(*) as total_invoices,
          COALESCE(SUM(o.invoice_total), 0) as total_invoiced
        FROM orders o
        WHERE o.branch_id = $1 
          AND o.invoice_date IS NOT NULL
          AND o.invoice_date >= CURRENT_DATE - INTERVAL '30 days'
          AND o.user_id IN (
            SELECT cp.user_id 
            FROM client_profiles cp 
            WHERE cp.client_id = $2
          )
      `;

      const { rows: invoiceStats } = await pool.query(invoicesStatsQuery, [branch_id, client_id]);

      // Producto más vendido del mes
      const topProductQuery = `
        SELECT 
          p.name as product_name,
          p.sap_code,
          SUM(od.quantity) as total_quantity,
          SUM(od.quantity * od.unit_price) as total_sales
        FROM order_details od
        JOIN orders o ON od.order_id = o.order_id
        JOIN products p ON od.product_id = p.product_id
        WHERE o.branch_id = $1 
          AND o.order_date >= CURRENT_DATE - INTERVAL '30 days'
          AND o.user_id IN (
            SELECT cp.user_id 
            FROM client_profiles cp 
            WHERE cp.client_id = $2
          )
        GROUP BY p.product_id, p.name, p.sap_code
        ORDER BY total_quantity DESC
        LIMIT 1
      `;

      const { rows: topProduct } = await pool.query(topProductQuery, [branch_id, client_id]);

      const stats = {
        orders: {
          total: parseInt(orderStats[0].total_orders),
          pending: parseInt(orderStats[0].pending_orders),
          processing: parseInt(orderStats[0].processing_orders),
          shipped: parseInt(orderStats[0].shipped_orders),
          delivered: parseInt(orderStats[0].delivered_orders),
          total_amount: parseFloat(orderStats[0].total_amount),
          average_order_value: parseFloat(orderStats[0].average_order_value)
        },
        invoices: {
          total: parseInt(invoiceStats[0].total_invoices),
          total_invoiced: parseFloat(invoiceStats[0].total_invoiced)
        },
        top_product: topProduct[0] ? {
          name: topProduct[0].product_name,
          sap_code: topProduct[0].sap_code,
          quantity_sold: parseInt(topProduct[0].total_quantity),
          total_sales: parseFloat(topProduct[0].total_sales)
        } : null
      };

      res.status(200).json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Error al obtener estadísticas de dashboard', {
        error: error.message,
        stack: error.stack,
        branchId: req.branch?.branch_id
      });

      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas del dashboard',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Obtener historial de órdenes de la sucursal
   */
  async getOrderHistory(req, res) {
    try {
      const { branch_id, client_id } = req.branch;
      const { 
        page = 1, 
        limit = 10, 
        status_id, 
        start_date, 
        end_date,
        search 
      } = req.query;

      logger.debug('Obteniendo historial de órdenes para sucursal', { 
        branchId: branch_id,
        clientId: client_id,
        page,
        limit,
        status_id
      });

      const offset = (parseInt(page) - 1) * parseInt(limit);
      let whereConditions = ['o.branch_id = $1'];
      let queryParams = [branch_id];
      let paramIndex = 2;

      // Agregar filtro por cliente
      whereConditions.push(`o.user_id IN (SELECT cp.user_id FROM client_profiles cp WHERE cp.client_id = $${paramIndex})`);
      queryParams.push(client_id);
      paramIndex++;

      if (status_id) {
        whereConditions.push(`o.status_id = $${paramIndex}`);
        queryParams.push(parseInt(status_id));
        paramIndex++;
      }

      if (start_date) {
        whereConditions.push(`o.order_date >= $${paramIndex}`);
        queryParams.push(start_date);
        paramIndex++;
      }

      if (end_date) {
        whereConditions.push(`o.order_date <= $${paramIndex}`);
        queryParams.push(end_date);
        paramIndex++;
      }

      if (search) {
        whereConditions.push(`(o.order_id::text ILIKE $${paramIndex} OR u.name ILIKE $${paramIndex})`);
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      const whereClause = whereConditions.join(' AND ');

      // Query para contar total de registros
      const countQuery = `
        SELECT COUNT(*) as total
        FROM orders o
        JOIN users u ON o.user_id = u.id
        WHERE ${whereClause}
      `;

      const { rows: countResult } = await pool.query(countQuery, queryParams);
      const totalRecords = parseInt(countResult[0].total);

      // Query principal para obtener las órdenes
      const ordersQuery = `
        SELECT 
          o.order_id,
          o.order_date,
          o.delivery_date,
          o.total_amount,
          o.subtotal,
          o.tax_amount,
          o.invoice_date,
          o.invoice_total,
          o.docnum_sap,
          o.comments,
          os.name as status_name,
          os.status_color,
          u.name as user_name,
          u.mail as user_email,
          COUNT(od.order_detail_id) as products_count
        FROM orders o
        JOIN order_status os ON o.status_id = os.status_id
        JOIN users u ON o.user_id = u.id
        LEFT JOIN order_details od ON o.order_id = od.order_id
        WHERE ${whereClause}
        GROUP BY o.order_id, os.name, u.name, u.mail
        ORDER BY o.order_date DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(parseInt(limit), offset);
      const { rows: orders } = await pool.query(ordersQuery, queryParams);

      const pagination = {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalRecords,
        pages: Math.ceil(totalRecords / parseInt(limit))
      };

      res.status(200).json({
        success: true,
        data: {
          orders: orders.map(order => ({
            ...order,
            total_amount: parseFloat(order.total_amount),
            subtotal: parseFloat(order.subtotal),
            tax_amount: parseFloat(order.tax_amount),
            invoice_total: order.invoice_total ? parseFloat(order.invoice_total) : null,
            products_count: parseInt(order.products_count)
          })),
          pagination
        }
      });

    } catch (error) {
      logger.error('Error al obtener historial de órdenes', {
        error: error.message,
        stack: error.stack,
        branchId: req.branch?.branch_id
      });

      res.status(500).json({
        success: false,
        message: 'Error al obtener historial de órdenes',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Obtener productos más vendidos para la sucursal
   */
  async getTopSellingProducts(req, res) {
    try {
      const { branch_id, client_id } = req.branch;
      const { months = 6, limit = 10 } = req.query;

      logger.debug('Obteniendo productos más vendidos para sucursal', { 
        branchId: branch_id,
        clientId: client_id,
        months,
        limit
      });

      const query = `
        SELECT 
          p.product_id,
          p.name as product_name,
          p.sap_code,
          p.description,
          p.image_url,
          SUM(od.quantity) as total_quantity,
          SUM(od.quantity * od.unit_price) as total_sales,
          COUNT(DISTINCT o.order_id) as orders_count,
          AVG(od.unit_price) as average_price
        FROM order_details od
        JOIN orders o ON od.order_id = o.order_id
        JOIN products p ON od.product_id = p.product_id
        WHERE o.branch_id = $1 
          AND o.order_date >= CURRENT_DATE - INTERVAL '${parseInt(months)} months'
          AND o.user_id IN (
            SELECT cp.user_id 
            FROM client_profiles cp 
            WHERE cp.client_id = $2
          )
        GROUP BY p.product_id, p.name, p.sap_code, p.description, p.image_url
        ORDER BY total_quantity DESC
        LIMIT $3
      `;

      const { rows: products } = await pool.query(query, [branch_id, client_id, parseInt(limit)]);

      res.status(200).json({
        success: true,
        data: products.map(product => ({
          ...product,
          total_quantity: parseInt(product.total_quantity),
          total_sales: parseFloat(product.total_sales),
          orders_count: parseInt(product.orders_count),
          average_price: parseFloat(product.average_price)
        }))
      });

    } catch (error) {
      logger.error('Error al obtener productos más vendidos', {
        error: error.message,
        stack: error.stack,
        branchId: req.branch?.branch_id
      });

      res.status(500).json({
        success: false,
        message: 'Error al obtener productos más vendidos',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Obtener estadísticas mensuales de ventas para la sucursal
   */
  async getMonthlyStats(req, res) {
    try {
      const { branch_id, client_id } = req.branch;
      const { months = 6 } = req.query;

      logger.debug('Obteniendo estadísticas mensuales para sucursal', { 
        branchId: branch_id,
        clientId: client_id,
        months
      });

      const query = `
        SELECT 
          DATE_TRUNC('month', o.order_date) as month,
          COUNT(*) as orders_count,
          SUM(o.total_amount) as total_sales,
          AVG(o.total_amount) as average_order_value,
          COUNT(DISTINCT od.product_id) as unique_products
        FROM orders o
        LEFT JOIN order_details od ON o.order_id = od.order_id
        WHERE o.branch_id = $1 
          AND o.order_date >= CURRENT_DATE - INTERVAL '${parseInt(months)} months'
          AND o.user_id IN (
            SELECT cp.user_id 
            FROM client_profiles cp 
            WHERE cp.client_id = $2
          )
        GROUP BY DATE_TRUNC('month', o.order_date)
        ORDER BY month DESC
      `;

      const { rows: stats } = await pool.query(query, [branch_id, client_id]);

      res.status(200).json({
        success: true,
        data: stats.map(stat => ({
          month: stat.month,
          orders_count: parseInt(stat.orders_count),
          total_sales: parseFloat(stat.total_sales),
          average_order_value: parseFloat(stat.average_order_value),
          unique_products: parseInt(stat.unique_products)
        }))
      });

    } catch (error) {
      logger.error('Error al obtener estadísticas mensuales', {
        error: error.message,
        stack: error.stack,
        branchId: req.branch?.branch_id
      });

      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas mensuales',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Obtener historial de facturas para la sucursal
   */
  async getInvoiceHistory(req, res) {
    try {
      const { branch_id, client_id } = req.branch;
      const { 
        page = 1, 
        limit = 10, 
        start_date, 
        end_date,
        search 
      } = req.query;

      logger.debug('Obteniendo historial de facturas para sucursal', { 
        branchId: branch_id,
        clientId: client_id,
        page,
        limit
      });

      const offset = (parseInt(page) - 1) * parseInt(limit);
      let whereConditions = ['o.branch_id = $1', 'o.invoice_date IS NOT NULL'];
      let queryParams = [branch_id];
      let paramIndex = 2;

      // Agregar filtro por cliente
      whereConditions.push(`o.user_id IN (SELECT cp.user_id FROM client_profiles cp WHERE cp.client_id = $${paramIndex})`);
      queryParams.push(client_id);
      paramIndex++;

      if (start_date) {
        whereConditions.push(`o.invoice_date >= $${paramIndex}`);
        queryParams.push(start_date);
        paramIndex++;
      }

      if (end_date) {
        whereConditions.push(`o.invoice_date <= $${paramIndex}`);
        queryParams.push(end_date);
        paramIndex++;
      }

      if (search) {
        whereConditions.push(`(o.docnum_sap ILIKE $${paramIndex} OR u.name ILIKE $${paramIndex})`);
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      const whereClause = whereConditions.join(' AND ');

      // Query para contar total de registros
      const countQuery = `
        SELECT COUNT(*) as total
        FROM orders o
        JOIN users u ON o.user_id = u.id
        WHERE ${whereClause}
      `;

      const { rows: countResult } = await pool.query(countQuery, queryParams);
      const totalRecords = parseInt(countResult[0].total);

      // Query principal para obtener las facturas
      const invoicesQuery = `
        SELECT 
          o.order_id,
          o.order_date,
          o.delivery_date,
          o.invoice_date,
          o.invoice_total,
          o.docnum_sap,
          o.total_amount,
          u.name as user_name,
          u.mail as user_email,
          os.name as status_name,
          COUNT(od.order_detail_id) as products_count
        FROM orders o
        JOIN order_status os ON o.status_id = os.status_id
        JOIN users u ON o.user_id = u.id
        LEFT JOIN order_details od ON o.order_id = od.order_id
        WHERE ${whereClause}
        GROUP BY o.order_id, os.name, u.name, u.mail
        ORDER BY o.invoice_date DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(parseInt(limit), offset);
      const { rows: invoices } = await pool.query(invoicesQuery, queryParams);

      const pagination = {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalRecords,
        pages: Math.ceil(totalRecords / parseInt(limit))
      };

      res.status(200).json({
        success: true,
        data: {
          invoices: invoices.map(invoice => ({
            ...invoice,
            total_amount: parseFloat(invoice.total_amount),
            invoice_total: parseFloat(invoice.invoice_total),
            products_count: parseInt(invoice.products_count)
          })),
          pagination
        }
      });

    } catch (error) {
      logger.error('Error al obtener historial de facturas', {
        error: error.message,
        stack: error.stack,
        branchId: req.branch?.branch_id
      });

      res.status(500).json({
        success: false,
        message: 'Error al obtener historial de facturas',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Obtener productos disponibles para la sucursal (redirige a branchOrderController)
   */
  async getProductsForBranch(req, res) {
    // Esta funcionalidad ya existe en branchOrderController
    // Redirigir la llamada o incluir referencia
    const branchOrderController = require('./branchOrderController');
    return branchOrderController.getProductsForBranch(req, res);
  }
}

module.exports = new BranchDashboardController();