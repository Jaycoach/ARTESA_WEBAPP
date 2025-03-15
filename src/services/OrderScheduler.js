const cron = require('node-cron');
const Order = require('../models/Order');
const AdminSettings = require('../models/AdminSettings');
const { createContextLogger } = require('../config/logger');

const logger = createContextLogger('OrderScheduler');

/**
 * Clase para manejar la programación de tareas relacionadas con órdenes
 */
class OrderScheduler {
  constructor() {
    this.tasks = [];
    this.initialized = false;
  }

  /**
   * Inicializa el servicio de programación de órdenes
   */
  async initialize() {
    if (this.initialized) return;

    try {
      logger.info('Inicializando servicio de programación de órdenes');

      // Obtener configuración administrativa
      const settings = await AdminSettings.getSettings();
      const orderTimeLimit = settings.orderTimeLimit || '18:00';
      
      // Configurar tareas
      this.setupDailyOrderStatusTask(orderTimeLimit);
      
      this.initialized = true;
      logger.info('Servicio de programación de órdenes inicializado correctamente', {
        orderTimeLimit
      });
    } catch (error) {
      logger.error('Error al inicializar servicio de programación de órdenes', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Configura tarea diaria para actualizar estados de órdenes después de la hora límite
   * @param {string} orderTimeLimit - Hora límite en formato HH:MM
   */
  setupDailyOrderStatusTask(orderTimeLimit) {
    // Extraer horas y minutos de la hora límite
    const [hours, minutes] = orderTimeLimit.split(':').map(Number);
    
    // Configurar tarea cron para ejecutarse 5 minutos después de la hora límite cada día
    const cronExpression = `${minutes + 5} ${hours} * * 1-5`;
    
    logger.info('Configurando tarea programada para actualizar estados de órdenes', {
      orderTimeLimit,
      cronExpression
    });
    
    const task = cron.schedule(cronExpression, async () => {
      try {
        logger.info('Ejecutando actualización programada de estados de órdenes');
        
        // Obtener configuración actualizada
        const settings = await AdminSettings.getSettings();
        const currentOrderTimeLimit = settings.orderTimeLimit || orderTimeLimit;
        
        // Actualizar órdenes pendientes a "En Producción"
        const updatedCount = await Order.updatePendingOrdersStatus(currentOrderTimeLimit);
        
        logger.info('Actualización programada completada', {
          updatedCount,
          timeLimit: currentOrderTimeLimit
        });
      } catch (error) {
        logger.error('Error en actualización programada de estados de órdenes', {
          error: error.message,
          stack: error.stack
        });
      }
    });
    
    // Almacenar la tarea para posible referencia futura
    this.tasks.push({
      name: 'dailyOrderStatusUpdate',
      task,
      cronExpression
    });
  }

  /**
   * Actualiza la configuración de las tareas programadas
   * @param {Object} settings - Nueva configuración
   */
  async updateTaskSettings(settings) {
    try {
      logger.info('Actualizando configuración de tareas programadas', {
        orderTimeLimit: settings.orderTimeLimit
      });
      
      // Detener tareas existentes
      this.tasks.forEach(taskInfo => {
        taskInfo.task.stop();
      });
      
      // Limpiar lista de tareas
      this.tasks = [];
      
      // Configurar nuevas tareas con la configuración actualizada
      this.setupDailyOrderStatusTask(settings.orderTimeLimit || '18:00');
      
      logger.info('Configuración de tareas programadas actualizada correctamente');
    } catch (error) {
      logger.error('Error al actualizar configuración de tareas programadas', {
        error: error.message,
        stack: error.stack
      });
    }
  }
  
  /**
   * Ejecuta manualmente la actualización de estados de órdenes
   * @returns {Promise<number>} Número de órdenes actualizadas
   */
  async runStatusUpdate() {
    try {
      logger.info('Ejecutando actualización manual de estados de órdenes');
      
      // Obtener configuración
      const settings = await AdminSettings.getSettings();
      const orderTimeLimit = settings.orderTimeLimit || '18:00';
      
      // Actualizar órdenes pendientes
      const updatedCount = await Order.updatePendingOrdersStatus(orderTimeLimit);
      
      logger.info('Actualización manual completada', {
        updatedCount,
        timeLimit: orderTimeLimit
      });
      
      return updatedCount;
    } catch (error) {
      logger.error('Error en actualización manual de estados de órdenes', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

// Exportar instancia única (singleton)
const orderScheduler = new OrderScheduler();
module.exports = orderScheduler;