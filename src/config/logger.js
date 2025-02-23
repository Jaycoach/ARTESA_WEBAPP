const winston = require('winston');

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        new winston.transports.File({ 
            filename: 'logs/auth.log',
            level: 'debug'
        }),
        new winston.transports.File({ 
            filename: 'logs/errors.log', 
            level: 'error' 
        })
    ]
});

module.exports = logger;