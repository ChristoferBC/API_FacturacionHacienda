//controllers/authController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Importar modelos
const User = require('../models/User');

// Importar servicios
const EmailService = require('../services/emailService');
const TokenService = require('../services/tokenService');

// Importar errores personalizados
const { createError } = require('../middlewares/errorHandler');

class AuthController {
  // Helper para generar tokens JWT
  generateTokens(userId) {
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
  }

  // Helper para formatear respuesta de usuario
  formatUserResponse(user) {
    return {
      id: user._id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      company: user.company,
      role: user.role,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      preferences: user.preferences,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt
    };
  }

  /**
   * @desc    Registrar nuevo usuario
   * @route   POST /api/auth/register
   * @access  Public
   */
  async register(req, res, next) {
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

      // Crear nuevo usuario
      const user = new User({
        username,
        email,
        password, // Se hasheará automáticamente en el middleware pre-save
        firstName,
        lastName,
        company,
        phone,
        role: 'user',
        isActive: true,
        preferences: {
          language: 'es',
          timezone: 'America/Costa_Rica',
          emailNotifications: true
        }
      });

      await user.save();

      // Generar tokens
      const { accessToken, refreshToken } = this.generateTokens(user._id);

      // Actualizar usuario con refresh token
      user.refreshToken = refreshToken;
      user.tokenExpiredAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días
      await user.save();

      // Generar token de verificación de email
      const emailVerifyToken = user.createEmailVerificationToken();
      await user.save({ validateBeforeSave: false });

      // Enviar email de verificación (async, no bloquear respuesta)
      if (process.env.NODE_ENV === 'production') {
        EmailService.sendVerificationEmail(user.email, emailVerifyToken)
          .catch(err => console.error('Error enviando email de verificación:', err));
      }

      res.status(201).json({
        success: true,
        message: 'Usuario registrado exitosamente. Revisa tu email para verificar tu cuenta.',
        user: this.formatUserResponse(user),
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: process.env.JWT_EXPIRES_IN || '1h'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Autenticar usuario (login)
   * @route   POST /api/auth/login
   * @access  Public
   */
  async login(req, res, next) {
    try {
      const { username, password, rememberMe = false } = req.body;

      // Buscar usuario por username o email
      const user = await User.findByCredentials(username, password);

      // Generar tokens
      const { accessToken, refreshToken } = this.generateTokens(user._id);

      // Calcular expiración basada en "Remember Me"
      const expiresIn = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000; // 30 días o 7 días

      // Actualizar último login y refresh token
      user.lastLogin = new Date();
      user.refreshToken = refreshToken;
      user.tokenExpiredAt = new Date(Date.now() + expiresIn);
      await user.save({ validateBeforeSave: false });

      res.json({
        success: true,
        message: 'Login exitoso',
        user: this.formatUserResponse(user),
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: process.env.JWT_EXPIRES_IN || '1h'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Refrescar access token
   * @route   POST /api/auth/refresh
   * @access  Public
   */
  async refreshToken(req, res, next) {
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

      // Generar nuevos tokens
      const tokens = this.generateTokens(user._id);

      // Actualizar refresh token en base de datos
      user.refreshToken = tokens.refreshToken;
      await user.save({ validateBeforeSave: false });

      res.json({
        success: true,
        message: 'Token refrescado exitosamente',
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: process.env.JWT_EXPIRES_IN || '1h'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Cerrar sesión
   * @route   POST /api/auth/logout
   * @access  Private
   */
  async logout(req, res, next) {
    try {
      // Limpiar refresh token
      const user = await User.findById(req.user.id);
      if (user) {
        user.refreshToken = null;
        user.tokenExpiredAt = null;
        await user.save({ validateBeforeSave: false });
      }

      res.json({
        success: true,
        message: 'Logout exitoso'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Cambiar contraseña
   * @route   POST /api/auth/change-password
   * @access  Private
   */
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;

      // Buscar usuario con contraseña
      const user = await User.findById(req.user.id).select('+password');
      
      // Verificar contraseña actual
      const isValidPassword = await user.comparePassword(currentPassword);
      if (!isValidPassword) {
        throw createError.unauthorized('Contraseña actual incorrecta', 'INVALID_CURRENT_PASSWORD');
      }

      // Actualizar contraseña (se hasheará automáticamente)
      user.password = newPassword;
      user.passwordChangedAt = new Date();
      
      // Invalidar todas las sesiones actuales
      user.refreshToken = null;
      user.tokenExpiredAt = null;
      
      await user.save();

      res.json({
        success: true,
        message: 'Contraseña actualizada exitosamente. Por favor, inicia sesión nuevamente.'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Obtener perfil del usuario actual
   * @route   GET /api/auth/me
   * @access  Private
   */
  async getMe(req, res, next) {
    try {
      const user = await User.findById(req.user.id)
        .populate('certificates', 'name certificateType validTo isActive status');

      res.json({
        success: true,
        user: {
          ...this.formatUserResponse(user),
          certificates: user.certificates || [],
          companyInfo: user.companyInfo,
          haciendaCredentials: {
            isConfigured: user.haciendaCredentials?.isConfigured || false,
            username: user.haciendaCredentials?.username || null
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Actualizar perfil del usuario
   * @route   PUT /api/auth/profile
   * @access  Private
   */
  async updateProfile(req, res, next) {
    try {
      const updates = req.body;
      const allowedUpdates = [
        'firstName', 'lastName', 'company', 'phone', 
        'preferences', 'companyInfo', 'haciendaCredentials'
      ];

      // Filtrar solo campos permitidos
      const filteredUpdates = {};
      Object.keys(updates).forEach(key => {
        if (allowedUpdates.includes(key)) {
          filteredUpdates[key] = updates[key];
        }
      });

      const user = await User.findByIdAndUpdate(
        req.user.id,
        { ...filteredUpdates, updatedAt: new Date() },
        { new: true, runValidators: true }
      );

      res.json({
        success: true,
        message: 'Perfil actualizado exitosamente',
        user: this.formatUserResponse(user)
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Solicitar reset de contraseña
   * @route   POST /api/auth/forgot-password
   * @access  Public
   */
  async forgotPassword(req, res, next) {
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
      const resetToken = user.createPasswordResetToken();
      await user.save({ validateBeforeSave: false });

      // Enviar email con el token (async, no bloquear respuesta)
      if (process.env.NODE_ENV === 'production') {
        EmailService.sendPasswordResetEmail(user.email, resetToken)
          .catch(err => console.error('Error enviando email de reset:', err));
      }

      res.json({
        success: true,
        message: 'Si el email existe, se enviará un enlace de recuperación',
        ...(process.env.NODE_ENV === 'development' && { resetToken }) // Solo en desarrollo
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Resetear contraseña con token
   * @route   POST /api/auth/reset-password
   * @access  Public
   */
  async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;

      // Hash del token para comparar
      const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

      // Buscar usuario con token válido y no expirado
      const user = await User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: Date.now() }
      });

      if (!user) {
        throw createError.badRequest('Token inválido o expirado', 'INVALID_RESET_TOKEN');
      }

      // Actualizar contraseña
      user.password = newPassword;
      user.passwordChangedAt = new Date();
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      user.refreshToken = null; // Invalidar sesiones actuales
      user.tokenExpiredAt = null;

      await user.save();

      res.json({
        success: true,
        message: 'Contraseña reseteada exitosamente. Por favor, inicia sesión.'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Verificar email con token
   * @route   GET /api/auth/verify-email/:token
   * @access  Public
   */
  async verifyEmail(req, res, next) {
    try {
      const { token } = req.params;

      // Hash del token para comparar
      const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

      // Buscar usuario con token válido y no expirado
      const user = await User.findOne({
        emailVerificationToken: hashedToken,
        emailVerificationExpires: { $gt: Date.now() }
      });

      if (!user) {
        throw createError.badRequest('Token de verificación inválido o expirado', 'INVALID_VERIFICATION_TOKEN');
      }

      // Marcar email como verificado
      user.isEmailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;

      await user.save({ validateBeforeSave: false });

      res.json({
        success: true,
        message: 'Email verificado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Reenviar email de verificación
   * @route   POST /api/auth/resend-verification
   * @access  Private
   */
  async resendVerification(req, res, next) {
    try {
      const user = await User.findById(req.user.id);

      if (user.isEmailVerified) {
        throw createError.badRequest('El email ya está verificado', 'EMAIL_ALREADY_VERIFIED');
      }

      // Generar nuevo token de verificación
      const verifyToken = user.createEmailVerificationToken();
      await user.save({ validateBeforeSave: false });

      // Enviar email
      if (process.env.NODE_ENV === 'production') {
        EmailService.sendVerificationEmail(user.email, verifyToken)
          .catch(err => console.error('Error enviando email de verificación:', err));
      }

      res.json({
        success: true,
        message: 'Email de verificación reenviado'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();