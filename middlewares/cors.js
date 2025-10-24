///middlewares/cors.js
const cors = require('cors');

/**
 * Configuración de CORS personalizada
 */
const corsOptions = {
  origin: function (origin, callback) {
    // Lista de dominios permitidos
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8080'];

    // Permitir requests sin origin (aplicaciones móviles, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  
  credentials: true, // Permitir cookies y headers de autenticación
  
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma',
    'X-API-Key',
    'X-Client-Version'
  ],
  
  exposedHeaders: [
    'X-Total-Count',
    'X-Page-Count',
    'Authorization'
  ],
  
  maxAge: 86400, // 24 horas
  
  optionsSuccessStatus: 200 // Para soporte de navegadores legacy
};

/**
 * CORS específico para desarrollo
 */
const devCorsOptions = {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: '*',
  exposedHeaders: '*'
};

/**
 * Middleware CORS principal
 */
const corsMiddleware = cors(
  process.env.NODE_ENV === 'development' ? devCorsOptions : corsOptions
);

/**
 * Middleware CORS para endpoints específicos de Hacienda
 */
const haciendaCors = cors({
  origin: [
    'https://api.comprobanteselectronicos.go.cr',
    'https://idp.comprobanteselectronicos.go.cr',
    'https://tribunet.hacienda.go.cr'
  ],
  credentials: false,
  methods: ['POST', 'GET'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

/**
 * Middleware para manejar preflight requests manualmente
 */
const handlePreflight = (req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 
      'Content-Type, Authorization, Content-Length, X-Requested-With, X-API-Key');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');
    res.sendStatus(200);
  } else {
    next();
  }
};

module.exports = {
  corsMiddleware,
  haciendaCors,
  handlePreflight,
  corsOptions,
  devCorsOptions
};