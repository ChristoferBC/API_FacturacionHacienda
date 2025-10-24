//routes/users.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

// Importar modelos
const User = require('../models/User');

// Importar middlewares
const { authMiddleware, requireRole, requirePermission } = require('../middlewares/auth');
const { validate } = require('../middlewares/validation');
const { createError } = require('../middlewares/errorHandler');

// Importar esquemas de validación
const Joi = require('joi');

// Esquemas de validación
const createUserSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  role: Joi.string().valid('user', 'admin', 'moderator').default('user'),
  company: Joi.string().max(100).optional(),
  phone: Joi.string().pattern(/^[0-9+\-\s()]+$/).optional(),
  isActive: Joi.boolean().default(true)
});

const updateUserSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).optional(),
  email: Joi.string().email().optional(),
  firstName: Joi.string().min(2).max(50).optional(),
  lastName: Joi.string().min(2).max(50).optional(),
  role: Joi.string().valid('user', 'admin', 'moderator').optional(),
  company: Joi.string().max(100).optional().allow(''),
  phone: Joi.string().pattern(/^[0-9+\-\s()]+$/).optional().allow(''),
  isActive: Joi.boolean().optional()
});

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// @route   GET /api/users
// @desc    Obtener lista de usuarios (solo admin)
// @access  Private (Admin)
router.get('/', requireRole('admin'), async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      role = '', 
      isActive = '' 
    } = req.query;

    // Construir filtros
    const filter = {};
    
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (role) filter.role = role;
    if (isActive !== '') filter.isActive = isActive === 'true';

    // Ejecutar consulta con paginación
    const users = await User.find(filter)
      .select('-password -refreshToken -resetPasswordToken')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/users/:id
// @desc    Obtener usuario por ID
// @access  Private (Admin o el mismo usuario)
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Solo admin o el mismo usuario pueden ver los detalles
    if (req.user.role !== 'admin' && req.user.id !== id) {
      throw createError.forbidden('No tienes permisos para ver este usuario');
    }

    const user = await User.findById(id)
      .select('-password -refreshToken -resetPasswordToken')
      .populate('certificates', 'name expiryDate isActive');

    if (!user) {
      throw createError.notFound('Usuario no encontrado');
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/users
// @desc    Crear nuevo usuario (solo admin)
// @access  Private (Admin)
router.post('/', requireRole('admin'), validate(createUserSchema), async (req, res, next) => {
  try {
    const userData = req.body;

    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({
      $or: [{ username: userData.username }, { email: userData.email }]
    });

    if (existingUser) {
      throw createError.conflict(
        existingUser.username === userData.username 
          ? 'El nombre de usuario ya existe' 
          : 'El email ya está registrado'
      );
    }

    // Hash de la contraseña
    const salt = await bcrypt.genSalt(12);
    userData.password = await bcrypt.hash(userData.password, salt);

    // Crear usuario
    const user = new User(userData);
    await user.save();

    // Devolver usuario sin contraseña
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.refreshToken;

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      user: userResponse
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/users/:id
// @desc    Actualizar usuario
// @access  Private (Admin o el mismo usuario)
router.put('/:id', validate(updateUserSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Solo admin puede actualizar cualquier usuario, otros solo a sí mismos
    if (req.user.role !== 'admin' && req.user.id !== id) {
      throw createError.forbidden('No tienes permisos para actualizar este usuario');
    }

    // Los usuarios normales no pueden cambiar su rol
    if (req.user.role !== 'admin' && updates.role) {
      delete updates.role;
    }

    // Verificar si username/email ya existen (si se están actualizando)
    if (updates.username || updates.email) {
      const existingUser = await User.findOne({
        _id: { $ne: id },
        $or: [
          ...(updates.username ? [{ username: updates.username }] : []),
          ...(updates.email ? [{ email: updates.email }] : [])
        ]
      });

      if (existingUser) {
        throw createError.conflict(
          existingUser.username === updates.username 
            ? 'El nombre de usuario ya existe' 
            : 'El email ya está registrado'
        );
      }
    }

    const user = await User.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).select('-password -refreshToken -resetPasswordToken');

    if (!user) {
      throw createError.notFound('Usuario no encontrado');
    }

    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      user
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/users/:id
// @desc    Eliminar usuario (solo admin)
// @access  Private (Admin)
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // No permitir que un admin se elimine a sí mismo
    if (req.user.id === id) {
      throw createError.badRequest('No puedes eliminarte a ti mismo');
    }

    const user = await User.findById(id);
    if (!user) {
      throw createError.notFound('Usuario no encontrado');
    }

    // Soft delete: marcar como inactivo en lugar de eliminar
    user.isActive = false;
    user.deletedAt = new Date();
    user.deletedBy = req.user.id;
    await user.save();

    res.json({
      success: true,
      message: 'Usuario eliminado exitosamente'
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/users/:id/activate
// @desc    Activar/desactivar usuario (solo admin)
// @access  Private (Admin)
router.put('/:id/activate', requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      throw createError.badRequest('isActive debe ser un valor booleano');
    }

    const user = await User.findByIdAndUpdate(
      id,
      { 
        isActive,
        updatedAt: new Date(),
        ...(isActive && { deletedAt: null, deletedBy: null })
      },
      { new: true }
    ).select('-password -refreshToken -resetPasswordToken');

    if (!user) {
      throw createError.notFound('Usuario no encontrado');
    }

    res.json({
      success: true,
      message: `Usuario ${isActive ? 'activado' : 'desactivado'} exitosamente`,
      user
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/users/:id/reset-password
// @desc    Resetear contraseña de usuario (solo admin)
// @access  Private (Admin)
router.put('/:id/reset-password', requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      throw createError.badRequest('La contraseña debe tener al menos 8 caracteres');
    }

    // Hash nueva contraseña
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const user = await User.findByIdAndUpdate(
      id,
      { 
        password: hashedPassword,
        passwordChangedAt: new Date(),
        refreshToken: null, // Invalidar sesiones actuales
        tokenExpiredAt: null
      },
      { new: true }
    ).select('-password -refreshToken');

    if (!user) {
      throw createError.notFound('Usuario no encontrado');
    }

    res.json({
      success: true,
      message: 'Contraseña reseteada exitosamente',
      user
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/users/stats
// @desc    Obtener estadísticas de usuarios (solo admin)
// @access  Private (Admin)
router.get('/stats/overview', requireRole('admin'), async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const inactiveUsers = await User.countDocuments({ isActive: false });
    
    const usersByRole = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    const recentUsers = await User.find()
      .select('username email createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      stats: {
        total: totalUsers,
        active: activeUsers,
        inactive: inactiveUsers,
        byRole: usersByRole,
        recent: recentUsers
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;