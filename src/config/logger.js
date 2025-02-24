const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

// Definir formatos personalizados
const customFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Configurar transporte para archivo rotativo
const fileRotateTransport = new winston.transports.DailyRotateFile({
    filename: path.join('logs', '%DATE%-app.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    auditFile: path.join('logs', 'audit.json'),
    zippedArchive: true,
    format: customFormat
});

// Configurar transporte para errores
const errorRotateTransport = new winston.transports.DailyRotateFile({
    filename: path.join('logs', '%DATE%-error.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    level: 'error',
    zippedArchive: true,
    format: customFormat
});

// Crear el logger
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: customFormat,
    transports: [
        // Consola para desarrollo
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        fileRotateTransport,
        errorRotateTransport
    ]
});

// Eventos para manejo de rotación
fileRotateTransport.on('rotate', function(oldFilename, newFilename) {
    logger.info('Rotating log file', { oldFilename, newFilename });
});

// Función helper para crear un logger con contexto
function createContextLogger(context) {
    return {
        error: (message, meta = {}) => logger.error(message, { context, ...meta }),
        warn: (message, meta = {}) => logger.warn(message, { context, ...meta }),
        info: (message, meta = {}) => logger.info(message, { context, ...meta }),
        debug: (message, meta = {}) => logger.debug(message, { context, ...meta })
    };
}

module.exports = {
    logger,
    createContextLogger
};