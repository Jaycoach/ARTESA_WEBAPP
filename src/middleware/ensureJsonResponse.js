const ensureJsonResponse = (req, res, next) => {
    // Solo aplica al prefijo de API
    if (req.path.startsWith('/api') && !req.path.startsWith('/api-docs')) {
      res.setHeader('Content-Type', 'application/json');
      
      // Interceptar res.send para asegurar que siempre se envía JSON
      const originalSend = res.send;
      res.send = function(data) {
        try {
          // Si los datos ya son un objeto, convertirlos a JSON string
          if (typeof data === 'object') {
            arguments[0] = JSON.stringify(data);
          } 
          // Si los datos son string pero no JSON válido, envolver en un objeto
          else if (typeof data === 'string' && !data.startsWith('{') && !data.startsWith('[')) {
            arguments[0] = JSON.stringify({ message: data });
          }
        } catch (err) {
          console.error('Error formatando respuesta como JSON:', err);
        }
        return originalSend.apply(this, arguments);
      };
    }
    next();
  };
  
  module.exports = ensureJsonResponse;