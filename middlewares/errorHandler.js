///middlewares/errorHandler.js
const winston = require('winston');

// Configurar logger
const logger = winston.createLogger({
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * Middleware principal de manejo de errores
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log del error
  logger.error(err);

  // Error de validación de Mongoose
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = {
      success: false,
      error: message,
      code: 'VALIDATION_ERROR',
      statusCode: 400
    };
  }

  // Error de clave duplicada de Mongoose
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field} ya existe`;
    error = {
      success: false,
      error: message,
      code: 'DUPLICATE_FIELD',
      statusCode: 400,
      field
    };
  }

  // Error de cast de Mongoose (ID inválido)
  if (err.name === 'CastError') {
    const message = 'Recurso no encontrado';
    error = {
      success: false,
      error: message,
      code: 'INVALID_ID',
      statusCode: 404
    };
  }

  // Error JWT
  if (err.name === 'JsonWebTokenError') {
    const message = 'Token inválido';
    error = {
      success: false,
      error: message,
      code: 'INVALID_TOKEN',
      statusCode: 401
    };
  }

  // Error JWT expirado
  if (err.name === 'TokenExpiredError') {
    const message = 'Token expirado';
    error = {
      success: false,
      error: message,
      code: 'TOKEN_EXPIRED',
      statusCode: 401
    };
  }

  // Error de multer (upload de archivos)
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = {
      success: false,
      error: 'Archivo demasiado grande',
      code: 'FILE_TOO_LARGE',
      statusCode: 413
    };
  }

  // Error de conexión a base de datos
  if (err.name === 'MongoError' || err.name === 'MongooseError') {
    error = {
      success: false,
      error: 'Error de conexión a base de datos',
      code: 'DATABASE_ERROR',
      statusCode: 500
    };
  }

  // Errores específicos de Hacienda
  if (err.code === 'HACIENDA_ERROR') {
    error = {
      success: false,
      error: err.message || 'Error comunicándose con Hacienda',
      code: 'HACIENDA_ERROR',
      statusCode: err.statusCode || 502,
      haciendaDetails: err.haciendaDetails
    };
  }

  // Errores de firma digital
  if (err.code === 'SIGNATURE_ERROR') {
    error = {
      success: false,
      error: err.message || 'Error en firma digital',
      code: 'SIGNATURE_ERROR',
      statusCode: 400,
      details: err.details
    };
  }

  // Errores de certificado
  if (err.code === 'CERTIFICATE_ERROR') {
    error = {
      success: false,
      error: err.message || 'Error con certificado digital',
      code: 'CERTIFICATE_ERROR',
      statusCode: 400,
      details: err.details
    };
  }

  // Error por defecto
  const statusCode = error.statusCode || err.statusCode || 500;
  const message = error.error || error.message || 'Error interno del servidor';

  res.status(statusCode).json({
    success: false,
    error: message,
    code: error.code || 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: error.details
    })
  });
};

/**
 * Middleware para manejar rutas no encontradas
 */
const notFound = (req, res, next) => {
  const error = new Error(`Ruta no encontrada - ${req.originalUrl}`);
  error.statusCode = 404;
  error.code = 'NOT_FOUND';
  next(error);
};

/**
 * Clase personalizada para errores de la aplicación
 */
class AppError extends Error {
  constructor(message, statusCode, code = 'APP_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Función helper para crear errores específicos
 */
const createError = {
  badRequest: (message = 'Petición inválida', code = 'BAD_REQUEST', details = null) => {
    return new AppError(message, 400, code, details);
  },
  
  unauthorized: (message = 'No autorizado', code = 'UNAUTHORIZED', details = null) => {
    return new AppError(message, 401, code, details);
  },
  
  forbidden: (message = 'Prohibido', code = 'FORBIDDEN', details = null) => {
    return new AppError(message, 403, code, details);
  },
  
  notFound: (message = 'No encontrado', code = 'NOT_FOUND', details = null) => {
    return new AppError(message, 404, code, details);
  },
  
  conflict: (message = 'Conflicto', code = 'CONFLICT', details = null) => {
    return new AppError(message, 409, code, details);
  },
  
  internal: (message = 'Error interno', code = 'INTERNAL_ERROR', details = null) => {
    return new AppError(message, 500, code, details);
  },
  
  hacienda: (message = 'Error de Hacienda', code = 'HACIENDA_ERROR', details = null, statusCode = 502) => {
    return new AppError(message, statusCode, code, details);
  },
  
  certificate: (message = 'Error de certificado', code = 'CERTIFICATE_ERROR', details = null) => {
    return new AppError(message, 400, code, details);
  },
  
  signature: (message = 'Error de firma', code = 'SIGNATURE_ERROR', details = null) => {
    return new AppError(message, 400, code, details);
  }
};

module.exports = {
  errorHandler,
  notFound,
  AppError,
  createError
};