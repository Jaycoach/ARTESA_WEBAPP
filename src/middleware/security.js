const validator = require('validator');

// Sanitizar strings
const sanitizeString = (str) => {
  if (!str) return str;
  return validator.escape(str.trim());
};

// Sanitizar números
const sanitizeNumber = (num) => {
  if (typeof num === 'number') return num;
  if (!num) return null;
  return Number(validator.escape(String(num)));
};

// Middleware para sanitizar el body
const sanitizeBody = (req, res, next) => {
  if (req.body) {
    const sanitizedBody = {};
    
    Object.keys(req.body).forEach(key => {
      const value = req.body[key];
      
      if (typeof value === 'string') {
        sanitizedBody[key] = sanitizeString(value);
      } else if (typeof value === 'number') {
        sanitizedBody[key] = sanitizeNumber(value);
      } else if (Array.isArray(value)) {
        sanitizedBody[key] = value.map(item => {
          if (typeof item === 'string') return sanitizeString(item);
          if (typeof item === 'number') return sanitizeNumber(item);
          return item;
        });
      } else if (typeof value === 'object' && value !== null) {
        sanitizedBody[key] = Object.keys(value).reduce((acc, k) => {
          if (typeof value[k] === 'string') acc[k] = sanitizeString(value[k]);
          else if (typeof value[k] === 'number') acc[k] = sanitizeNumber(value[k]);
          else acc[k] = value[k];
          return acc;
        }, {});
      } else {
        sanitizedBody[key] = value;
      }
    });

    req.body = sanitizedBody;
  }
  next();
};

// Middleware para validar y sanitizar parámetros de URL
const sanitizeParams = (req, res, next) => {
  if (req.params) {
    Object.keys(req.params).forEach(key => {
      req.params[key] = sanitizeString(req.params[key]);
    });
  }
  next();
};

// Middleware para prevenir ataques de SQL Injection en queries
const validateQueryParams = (req, res, next) => {
  const sqlInjectionPattern = /('|"|;)\s*(--|\/\*|\*\/|xp_|sp_|exec\s+|execute\s+|insert\s+into|select\s+from|delete\s+from|update\s+|drop\s+table|union\s+select|into\s+outfile|load_file)/i;
  
  const checkValue = (value, key) => {
    // Excepción para URLs de imágenes
    if (key === 'imageUrl' && typeof value === 'string') {
      return true; // Permitir cualquier valor para imageUrl
    }
    
    if (typeof value === 'string' && sqlInjectionPattern.test(value)) {
      return false;
    }
    return true;
  };

  // Revisar query params
  if (req.query) {
    for (let key in req.query) {
      if (!checkValue(req.query[key], key)) {
        return res.status(403).json({ 
          error: 'Invalid query parameter detected' 
        });
      }
    }
  }

  // Revisar body params
  if (req.body) {
    const checkObject = (obj) => {
      for (let key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          if (!checkObject(obj[key])) return false;
        } else if (!checkValue(obj[key], key)) {
          return false;
        }
      }
      return true;
    };

    if (!checkObject(req.body)) {
      logger.warn('Solicitud rechazada por parámetros inválidos', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        body: JSON.stringify(req.body)
      });
      return res.status(403).json({ 
        error: 'Invalid request body parameter detected' 
      });
    }
  }

  next();
};

// Headers de seguridad
const securityHeaders = (req, res, next) => {
  // Prevenir clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  // Habilitar la protección XSS en navegadores antiguos
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Prevenir MIME-sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Política de seguridad de contenido
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  // Strict Transport Security
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
};

// Bloquear acceso a archivos sensibles
app.use((req, res, next) => {
  const sensitiveFiles = ['.env', '.git', 'package.json', 'config', 'logs'];
  const requestedPath = req.path.toLowerCase();
  
  if (sensitiveFiles.some(file => requestedPath.includes(file))) {
    logger.warn('Intento de acceso a archivo sensible bloqueado', {
      path: req.path,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    return res.status(403).json({
      status: 'error',
      message: 'Acceso prohibido'
    });
  }
  next();
});

module.exports = {
  sanitizeBody,
  sanitizeParams,
  validateQueryParams,
  securityHeaders
};