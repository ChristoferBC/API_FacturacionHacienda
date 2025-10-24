//middlewares/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware de autenticación JWT
 * Verifica que el usuario tenga un token válido
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Obtener el token del header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Token de acceso requerido',
        code: 'NO_TOKEN'
      });
    }

    // Verificar formato "Bearer token"
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Formato de token inválido',
        code: 'INVALID_TOKEN_FORMAT'
      });
    }

    // Verificar y decodificar el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Buscar el usuario en la base de datos
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    // Verificar si el usuario está activo
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Cuenta de usuario desactivada',
        code: 'USER_INACTIVE'
      });
    }

    // Verificar si el token no ha expirado en la base de datos
    if (user.tokenExpiredAt && new Date() > user.tokenExpiredAt) {
      return res.status(401).json({
        success: false,
        error: 'Token expirado',
        code: 'TOKEN_EXPIRED'
      });
    }

    // Agregar usuario a la request
    req.user = user;
    req.token = token;
    
    next();
  } catch (error) {
    console.error('Error en autenticación:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Token inválido',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expirado',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    return res.status(500).json({
      success: false,
      error: 'Error interno de autenticación',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Middleware opcional de autenticación
 * No requiere token pero si existe lo verifica
 */
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return next();
  }
  
  // Si hay token, usar el middleware normal
  return authMiddleware(req, res, next);
};

/**
 * Middleware para verificar roles específicos
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Autenticación requerida',
        code: 'AUTH_REQUIRED'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Permisos insuficientes',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: roles,
        userRole: req.user.role
      });
    }
    
    next();
  };
};

/**
 * Middleware para verificar permisos específicos
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Autenticación requerida',
        code: 'AUTH_REQUIRED'
      });
    }
    
    if (!req.user.permissions || !req.user.permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        error: 'Permiso denegado',
        code: 'PERMISSION_DENIED',
        requiredPermission: permission,
        userPermissions: req.user.permissions || []
      });
    }
    
    next();
  };
};

module.exports = {
  authMiddleware,
  optionalAuth,
  requireRole,
  requirePermission
};