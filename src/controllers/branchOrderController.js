const pool = require('../config/database');
const Order = require('../models/Order');
const { createContextLogger } = require('../config/logger');

const logger = createContextLogger('BranchOrderController');

/**
 * Controlador para gestión de órdenes desde contexto de sucursales
 */
class BranchOrderController {

  /**
   * Crear una nueva orden desde una sucursal
   */
  async createOrder(req, res) {
    try {
      const { branch_id, client_id } = req.branch;
      const { 
        delivery_date, 
        comments, 
        products,
        user_id // Usuario del cliente principal que creará la orden
      } = req.body;

      logger.debug('Creando orden desde sucursal', { 
        branchId: branch_id,
        clientId: client_id,
        userId: user_id,
        productsCount: products?.length
      });

      // Validar que el user_id corresponde al cliente de la sucursal
      const userValidationQuery = `
        SELECT cp.user_id, cp.client_id, u.name as user_name
        FROM client_profiles cp
        JOIN users u ON cp.user_id = u.id
        WHERE cp.user_id = $1 AND cp.client_id = $2
      `;

      const { rows: userRows } = await pool.query(userValidationQuery, [user_id, client_id]);
      
      if (userRows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'El usuario especificado no pertenece al cliente de esta sucursal'
        });
      }

      // Validar productos
      if (!products || !Array.isArray(products) || products.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Debe especificar al menos un producto'
        });
      }

      // Validar fecha de entrega
      if (delivery_date) {
        const deliveryDate = new Date(delivery_date);
        const today = new Date();
        if (deliveryDate <= today) {
          return res.status(400).json({
            success: false,
            message: 'La fecha de entrega debe ser posterior a hoy'
          });
        }
      }

      // Crear la orden usando el modelo existente pero con branch_id
      const orderData = {
        user_id,
        branch_id, // Importante: especificar la sucursal
        delivery_date,
        comments,
        products
      };

      const newOrder = await Order.create(orderData);

      logger.info('Orden creada exitosamente desde sucursal', {
        orderId: newOrder.order_id,
        branchId: branch_id,
        userId: user_id,
        totalAmount: newOrder.total_amount
      });

      res.status(201).json({
        success: true,
        message: 'Orden creada exitosamente',
        data: newOrder
      });

    } catch (error) {
      logger.error('Error al crear orden desde sucursal', {
        error: error.message,
        stack: error.stack,
        branchId: req.branch?.branch_id
      });

      res.status(500).json({
        success: false,
        message: 'Error al crear la orden',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Obtener detalles de una orden específica de la sucursal
   */
  async getOrderDetails(req, res) {
    try {
      const { branch_id, client_id } = req.branch;
      const { orderId } = req.params;

      logger.debug('Obteniendo detalles de orden para sucursal', { 
        branchId: branch_id,
        orderId
      });

      const query = `
        SELECT 
          o.*,
          os.status_name,
          os.status_color,
          u.name as user_name,
          u.mail as user_email,
          cb.branch_name,
          cb.address as branch_address,
          cb.city as branch_city,
          cp.company_name as client_company_name
        FROM orders o
        JOIN order_status os ON o.status_id = os.status_id
        JOIN users u ON o.user_id = u.id
        JOIN client_branches cb ON o.branch_id = cb.branch_id
        JOIN client_profiles cp ON u.id = cp.user_id
        WHERE o.order_id = $1 
          AND o.branch_id = $2
          AND o.user_id IN (
            SELECT cp2.user_id 
            FROM client_profiles cp2 
            WHERE cp2.client_id = $3
          )
      `;

      const { rows: orderRows } = await pool.query(query, [orderId, branch_id, client_id]);

      if (orderRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Orden no encontrada o no pertenece a esta sucursal'
        });
      }

      const order = orderRows[0];

      // Obtener detalles de productos
      const detailsQuery = `
        SELECT 
          od.*,
          p.name as product_name,
          p.description as product_description,
          p.sap_code,
          p.image_url as product_image
        FROM order_details od
        JOIN products p ON od.product_id = p.product_id
        WHERE od.order_id = $1
        ORDER BY od.order_detail_id
      `;

      const { rows: details } = await pool.query(detailsQuery, [orderId]);

      // Obtener notas de la orden
      const notesQuery = `
        SELECT 
          on.*,
          u.name as created_by
        FROM order_notes on
        LEFT JOIN users u ON on.user_id = u.id
        WHERE on.order_id = $1
        ORDER BY on.created_at DESC
      `;

      const { rows: notes } = await pool.query(notesQuery, [orderId]);

      const orderWithDetails = {
        ...order,
        total_amount: parseFloat(order.total_amount),
        subtotal: parseFloat(order.subtotal),
        tax_amount: parseFloat(order.tax_amount),
        invoice_total: order.invoice_total ? parseFloat(order.invoice_total) : null,
        products: details.map(detail => ({
          ...detail,
          unit_price: parseFloat(detail.unit_price),
          line_total: parseFloat(detail.unit_price) * parseInt(detail.quantity)
        })),
        notes: notes
      };

      res.status(200).json({
        success: true,
        data: orderWithDetails
      });

    } catch (error) {
      logger.error('Error al obtener detalles de orden desde sucursal', {
        error: error.message,
        stack: error.stack,
        branchId: req.branch?.branch_id,
        orderId: req.params?.orderId
      });

      res.status(500).json({
        success: false,
        message: 'Error al obtener detalles de la orden',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Obtener productos con precios para la sucursal
   */
  async getProductsForBranch(req, res) {
    try {
      const { branch_id, client_id } = req.branch;
      const { search, category, active_only = true } = req.query;

      logger.debug('Obteniendo productos para sucursal', { 
        branchId: branch_id,
        clientId: client_id,
        search,
        category
      });

      // Obtener la lista de precios del cliente
      const clientQuery = `
        SELECT cp.price_list_code
        FROM client_profiles cp
        WHERE cp.client_id = $1
        LIMIT 1
      `;

      const { rows: clientRows } = await pool.query(clientQuery, [client_id]);
      const priceListCode = clientRows[0]?.price_list_code || '1'; // Lista por defecto

      let whereConditions = ['p.is_active = true'];
      let queryParams = [];
      let paramIndex = 1;

      if (search) {
        whereConditions.push(`(p.name ILIKE $${paramIndex} OR p.sap_code ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`);
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      if (category) {
        whereConditions.push(`p.sap_group = $${paramIndex}`);
        queryParams.push(parseInt(category));
        paramIndex++;
      }

      const whereClause = whereConditions.join(' AND ');

      const query = `
        SELECT 
          p.*,
          CASE 
            WHEN pl.price IS NOT NULL THEN pl.price
            WHEN $${paramIndex} = '1' THEN p.price_list1
            WHEN $${paramIndex} = '2' THEN p.price_list2
            WHEN $${paramIndex} = '3' THEN p.price_list3
            ELSE p.price_list1
          END as current_price
        FROM products p
        LEFT JOIN price_lists pl ON p.sap_code = pl.product_code 
          AND pl.price_list_code = $${paramIndex}
          AND pl.is_active = true
        WHERE ${whereClause}
        ORDER BY p.name ASC
      `;

      queryParams.push(priceListCode);
      const { rows: products } = await pool.query(query, queryParams);

      res.status(200).json({
        success: true,
        data: products.map(product => ({
          ...product,
          price_list1: parseFloat(product.price_list1),
          price_list2: parseFloat(product.price_list2),
          price_list3: parseFloat(product.price_list3),
          current_price: parseFloat(product.current_price)
        }))
      });

    } catch (error) {
      logger.error('Error al obtener productos para sucursal', {
        error: error.message,
        stack: error.stack,
        branchId: req.branch?.branch_id
      });

      res.status(500).json({
        success: false,
        message: 'Error al obtener productos',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Actualizar el estado de una orden desde sucursal (solo ciertas transiciones permitidas)
   */
  async updateOrderStatus(req, res) {
    try {
      const { branch_id, client_id } = req.branch;
      const { orderId } = req.params;
      const { status_id, note } = req.body;

      logger.debug('Actualizando estado de orden desde sucursal', { 
        branchId: branch_id,
        orderId,
        newStatusId: status_id
      });

      // Verificar que la orden pertenece a la sucursal
      const orderQuery = `
        SELECT o.*, os.status_name as current_status
        FROM orders o
        JOIN order_status os ON o.status_id = os.status_id
        WHERE o.order_id = $1 
          AND o.branch_id = $2
          AND o.user_id IN (
            SELECT cp.user_id 
            FROM client_profiles cp 
            WHERE cp.client_id = $3
          )
      `;

      const { rows: orderRows } = await pool.query(orderQuery, [orderId, branch_id, client_id]);

      if (orderRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Orden no encontrada o no pertenece a esta sucursal'
        });
      }

      const order = orderRows[0];

      // Validar transiciones de estado permitidas para sucursales
      // Por ejemplo, solo permitir cancelar órdenes pendientes
      const allowedTransitions = {
        1: [5], // De pendiente a cancelada
        2: [], // Procesada no se puede cambiar
        3: [], // Enviada no se puede cambiar
        4: [], // Entregada no se puede cambiar
        5: [] // Cancelada no se puede cambiar
      };

      if (!allowedTransitions[order.status_id] || !allowedTransitions[order.status_id].includes(parseInt(status_id))) {
        return res.status(400).json({
          success: false,
          message: `No se permite cambiar el estado de ${order.current_status} al estado solicitado`
        });
      }

      // Actualizar el estado
      const updateQuery = `
        UPDATE orders 
        SET status_id = $1, updated_at = CURRENT_TIMESTAMP
        WHERE order_id = $2
        RETURNING *
      `;

      const { rows: updatedRows } = await pool.query(updateQuery, [status_id, orderId]);

      // Agregar nota si se proporciona
      if (note) {
        await pool.query(
          `INSERT INTO order_notes (order_id, note_type, note, created_at) 
           VALUES ($1, 'STATUS_CHANGE', $2, CURRENT_TIMESTAMP)`,
          [orderId, note]
        );
      }

      logger.info('Estado de orden actualizado desde sucursal', {
        orderId,
        branchId: branch_id,
        oldStatus: order.status_id,
        newStatus: status_id
      });

      res.status(200).json({
        success: true,
        message: 'Estado de la orden actualizado exitosamente',
        data: updatedRows[0]
      });

    } catch (error) {
      logger.error('Error al actualizar estado de orden desde sucursal', {
        error: error.message,
        stack: error.stack,
        branchId: req.branch?.branch_id,
        orderId: req.params?.orderId
      });

      res.status(500).json({
        success: false,
        message: 'Error al actualizar el estado de la orden',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

    /**
     * Obtener productos disponibles para la sucursal
     */
    async getProductsForBranch(req, res) {
        try {
            const { branch_id, client_id } = req.branch;
            const { search, category, active_only = true } = req.query;

            logger.debug('Obteniendo productos para sucursal', { 
            branchId: branch_id,
            clientId: client_id,
            search,
            category
            });

            // Obtener la lista de precios del cliente
            const clientQuery = `
            SELECT cp.price_list_code
            FROM client_profiles cp
            WHERE cp.client_id = $1
            LIMIT 1
            `;

            const { rows: clientRows } = await pool.query(clientQuery, [client_id]);
            const priceListCode = clientRows[0]?.price_list_code || '1'; // Lista por defecto

            let whereConditions = ['p.is_active = true'];
            let queryParams = [];
            let paramIndex = 1;

            if (search) {
            whereConditions.push(`(p.name ILIKE $${paramIndex} OR p.sap_code ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`);
            queryParams.push(`%${search}%`);
            paramIndex++;
            }

            if (category) {
            whereConditions.push(`p.sap_group = $${paramIndex}`);
            queryParams.push(parseInt(category));
            paramIndex++;
            }

            const whereClause = whereConditions.join(' AND ');

            const query = `
            SELECT 
                p.*,
                CASE 
                WHEN pl.price IS NOT NULL THEN pl.price
                WHEN $${paramIndex} = '1' THEN p.price_list1
                WHEN $${paramIndex} = '2' THEN p.price_list2
                WHEN $${paramIndex} = '3' THEN p.price_list3
                ELSE p.price_list1
                END as current_price
            FROM products p
            LEFT JOIN price_lists pl ON p.sap_code = pl.product_code 
                AND pl.price_list_code = $${paramIndex}
                AND pl.is_active = true
            WHERE ${whereClause}
            ORDER BY p.name ASC
            `;

            queryParams.push(priceListCode);
            const { rows: products } = await pool.query(query, queryParams);

            res.status(200).json({
            success: true,
            data: products.map(product => ({
                ...product,
                price_list1: parseFloat(product.price_list1),
                price_list2: parseFloat(product.price_list2),
                price_list3: parseFloat(product.price_list3),
                current_price: parseFloat(product.current_price)
            }))
            });

        } catch (error) {
            logger.error('Error al obtener productos para sucursal', {
            error: error.message,
            stack: error.stack,
            branchId: req.branch?.branch_id
            });

            res.status(500).json({
            success: false,
            message: 'Error al obtener productos',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
}

module.exports = new BranchOrderController();