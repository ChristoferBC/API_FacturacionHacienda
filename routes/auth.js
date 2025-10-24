//routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');

// Importar modelos
const User = require('../models/User');

// Importar middlewares
const { authMiddleware, optionalAuth } = require('../middlewares/auth');
const { validate } = require('../middlewares/validation');
const { createError } = require('../middlewares/errorHandler');

// Importar esquemas de validación
const Joi = require('joi');

// Esquemas de validación
const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]')).required()
    .messages({
      'string.pattern.base': 'La contraseña debe contener al menos una minúscula, una mayúscula, un número y un carácter especial'
    }),
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  company: Joi.string().max(100).optional(),
  phone: Joi.string().pattern(/^[0-9+\-\s()]+$/).optional()
});

const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required(),
  rememberMe: Joi.boolean().optional()
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]')).required(),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required()
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]')).required(),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
});

// Rate limiting para autenticación
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos por IP
  message: {
    success: false,
    error: 'Demasiados intentos de login. Intenta de nuevo en 15 minutos.',
    code: 'TOO_MANY_ATTEMPTS'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // 3 registros por IP por hora
  message: {
    success: false,
    error: 'Demasiados registros desde esta IP. Intenta de nuevo en 1 hora.',
    code: 'TOO_MANY_REGISTRATIONS'
  }
});

// Helper para generar JWT
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );

  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

  return { accessToken, refreshToken };
};

// @route   POST /api/auth/register
// @desc    Registrar nuevo usuario
// @access  Public
router.post('/register', registerLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const { username, email, password, firstName, lastName, company, phone } = req.body;

    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    });

    if (existingUser) {
      throw createError.conflict(
        existingUser.username === username 
          ? 'El nombre de usuario ya existe' 
          : 'El email ya está registrado',
        'USER_EXISTS'
      );
    }

    // Hash de la contraseña
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Crear nuevo usuario
    const user = new User({
      username,
      email,
      password: hashedPassword,
      firstName,
      lastName,
      company,
      phone,
      role: 'user',
      isActive: true
    });

    await user.save();

    // Generar tokens
    const { accessToken, refreshToken } = generateTokens(user._id);

    // Actualizar usuario con refresh token
    user.refreshToken = refreshToken;
    user.tokenExpiredAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN || '1h'
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/auth/login
// @desc    Autenticar usuario
// @access  Public
router.post('/login', loginLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { username, password, rememberMe } = req.body;

    // Buscar usuario
    const user = await User.findOne({
      $or: [{ username }, { email: username }]
    }).select('+password');

    if (!user) {
      throw createError.unauthorized('Credenciales inválidas', 'INVALID_CREDENTIALS');
    }

    // Verificar si está activo
    if (!user.isActive) {
      throw createError.forbidden('Cuenta desactivada', 'ACCOUNT_DISABLED');
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw createError.unauthorized('Credenciales inválidas', 'INVALID_CREDENTIALS');
    }

    // Generar tokens
    const { accessToken, refreshToken } = generateTokens(user._id);

    // Actualizar último login y refresh token
    const expiresIn = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000; // 30 días o 7 días
    user.lastLogin = new Date();
    user.refreshToken = refreshToken;
    user.tokenExpiredAt = new Date(Date.now() + expiresIn);
    await user.save();

    res.json({
      success: true,
      message: 'Login exitoso',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        lastLogin: user.lastLogin
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN || '1h'
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/auth/refresh
// @desc    Refrescar access token
// @access  Public
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw createError.unauthorized('Refresh token requerido', 'REFRESH_TOKEN_REQUIRED');
    }

    // Verificar refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    // Buscar usuario
    const user = await User.findById(decoded.userId);
    if (!user || user.refreshToken !== refreshToken) {
      throw createError.unauthorized('Refresh token inválido', 'INVALID_REFRESH_TOKEN');
    }

    // Verificar si no ha expirado
    if (user.tokenExpiredAt && new Date() > user.tokenExpiredAt) {
      throw createError.unauthorized('Refresh token expirado', 'REFRESH_TOKEN_EXPIRED');
    }

    // Generar nuevo access token
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id);

    // Actualizar refresh token
    user.refreshToken = newRefreshToken;
    await user.save();

    res.json({
      success: true,
      message: 'Token refrescado exitosamente',
      tokens: {
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN || '1h'
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/auth/logout
// @desc    Cerrar sesión
// @access  Private
router.post('/logout', authMiddleware, async (req, res, next) => {
  try {
    // Limpiar refresh token
    const user = await User.findById(req.user.id);
    if (user) {
      user.refreshToken = null;
      user.tokenExpiredAt = null;
      await user.save();
    }

    res.json({
      success: true,
      message: 'Logout exitoso'
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/auth/change-password
// @desc    Cambiar contraseña
// @access  Private
router.post('/change-password', authMiddleware, validate(changePasswordSchema), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Buscar usuario con contraseña
    const user = await User.findById(req.user.id).select('+password');
    
    // Verificar contraseña actual
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      throw createError.unauthorized('Contraseña actual incorrecta', 'INVALID_CURRENT_PASSWORD');
    }

    // Hash nueva contraseña
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Actualizar contraseña
    user.password = hashedPassword;
    user.passwordChangedAt = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/auth/me
// @desc    Obtener perfil del usuario actual
// @access  Private
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -refreshToken')
      .populate('certificates', 'name expiryDate isActive');

    res.json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/auth/profile
// @desc    Actualizar perfil del usuario
// @access  Private
const updateProfileSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).optional(),
  lastName: Joi.string().min(2).max(50).optional(),
  company: Joi.string().max(100).optional().allow(''),
  phone: Joi.string().pattern(/^[0-9+\-\s()]+$/).optional().allow('')
});

router.put('/profile', authMiddleware, validate(updateProfileSchema), async (req, res, next) => {
  try {
    const updates = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).select('-password -refreshToken');

    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      user
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Solicitar reset de contraseña
// @access  Public
router.post('/forgot-password', validate(forgotPasswordSchema), async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Por seguridad, siempre devolvemos success
      return res.json({
        success: true,
        message: 'Si el email existe, se enviará un enlace de recuperación'
      });
    }

    // Generar token de reset
    const resetToken = jwt.sign(
      { userId: user._id, type: 'reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
    await user.save();

    // TODO: Enviar email con el token
    // await emailService.sendPasswordReset(user.email, resetToken);

    res.json({
      success: true,
      message: 'Si el email existe, se enviará un enlace de recuperación'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;