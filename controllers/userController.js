const bcrypt = require('bcryptjs');

// Importar modelos
const User = require('../models/User');
const Certificate = require('../models/Certificate');
const Document = require('../models/Document');

// Importar errores personalizados
const { createError } = require('../middlewares/errorHandler');

class UserController {
  // Helper para formatear respuesta de usuario
  formatUserResponse(user, includeStats = false) {
    const response = {
      id: user._id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      company: user.company,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      permissions: user.permissions,
      preferences: user.preferences,
      companyInfo: user.companyInfo,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    if (includeStats && user.stats) {
      response.stats = user.stats;
    }

    return response;
  }

  /**
   * @desc    Obtener lista de usuarios con filtros y paginación
   * @route   GET /api/users
   * @access  Private (Admin)
   */
  async getUsers(req, res, next) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search = '', 
        role = '', 
        isActive = '',
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      // Construir filtros
      const filter = {};
      
      if (search) {
        filter.$or = [
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { company: { $regex: search, $options: 'i' } }
        ];
      }
      
      if (role) filter.role = role;
      if (isActive !== '') filter.isActive = isActive === 'true';

      // Construir ordenamiento
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Ejecutar consulta con paginación
      const users = await User.find(filter)
        .select('-password -refreshToken -resetPasswordToken -emailVerificationToken')
        .sort(sort)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .populate('certificates', 'name certificateType validTo isActive')
        .lean();

      const total = await User.countDocuments(filter);

      // Agregar estadísticas básicas para cada usuario
      const usersWithStats = await Promise.all(
        users.map(async (user) => {
          const [certificateCount, documentCount] = await Promise.all([
            Certificate.countDocuments({ userId: user._id }),
            Document.countDocuments({ userId: user._id })
          ]);

          return {
            ...user,
            stats: {
              certificates: certificateCount,
              documents: documentCount
            }
          };
        })
      );

      res.json({
        success: true,
        users: usersWithStats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        },
        filters: {
          search,
          role,
          isActive,
          sortBy,
          sortOrder
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Obtener usuario por ID
   * @route   GET /api/users/:id
   * @access  Private (Admin o el mismo usuario)
   */
  async getUserById(req, res, next) {
    try {
      const { id } = req.params;

      // Verificar permisos
      if (req.user.role !== 'admin' && req.user.id !== id) {
        throw createError.forbidden('No tienes permisos para ver este usuario');
      }

      const user = await User.findById(id)
        .select('-password -refreshToken -resetPasswordToken -emailVerificationToken')
        .populate('certificates', 'name certificateType validTo isActive status')
        .lean();

      if (!user) {
        throw createError.notFound('Usuario no encontrado');
      }

      // Obtener estadísticas detalladas
      const [certificateStats, documentStats] = await Promise.all([
        Certificate.aggregate([
          { $match: { userId: user._id } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              active: { $sum: { $cond: [{ $and: ['$isActive', { $gt: ['$validTo', new Date()] }] }, 1, 0] } },
              expired: { $sum: { $cond: [{ $lt: ['$validTo', new Date()] }, 1, 0] } },
              expiringSoon: {
                $sum: {
                  $cond: [{
                    $and: [
                      '$isActive',
                      { $gt: ['$validTo', new Date()] },
                      { $lt: ['$validTo', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)] }
                    ]
                  }, 1, 0]
                }
              }
            }
          }
        ]),
        Document.aggregate([
          { $match: { userId: user._id } },
          {
            $group: {
              _id: '$estadoEnvio',
              count: { $sum: 1 }
            }
          }
        ])
      ]);

      const stats = {
        certificates: certificateStats[0] || { total: 0, active: 0, expired: 0, expiringSoon: 0 },
        documents: documentStats.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, { total: documentStats.reduce((sum, curr) => sum + curr.count, 0) })
      };

      res.json({
        success: true,
        user: {
          ...user,
          stats
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Crear nuevo usuario
   * @route   POST /api/users
   * @access  Private (Admin)
   */
  async createUser(req, res, next) {
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
            : 'El email ya está registrado',
          'USER_EXISTS'
        );
      }

      // Crear usuario
      const user = new User({
        ...userData,
        isActive: userData.isActive !== undefined ? userData.isActive : true,
        preferences: {
          language: 'es',
          timezone: 'America/Costa_Rica',
          emailNotifications: true,
          ...userData.preferences
        }
      });

      await user.save();

      res.status(201).json({
        success: true,
        message: 'Usuario creado exitosamente',
        user: this.formatUserResponse(user)
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Actualizar usuario
   * @route   PUT /api/users/:id
   * @access  Private (Admin o el mismo usuario)
   */
  async updateUser(req, res, next) {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Verificar permisos
      if (req.user.role !== 'admin' && req.user.id !== id) {
        throw createError.forbidden('No tienes permisos para actualizar este usuario');
      }

      // Los usuarios normales no pueden cambiar ciertos campos
      if (req.user.role !== 'admin') {
        const restrictedFields = ['role', 'permissions', 'isActive'];
        restrictedFields.forEach(field => {
          if (updates[field] !== undefined) {
            delete updates[field];
          }
        });
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
      ).select('-password -refreshToken -resetPasswordToken -emailVerificationToken');

      if (!user) {
        throw createError.notFound('Usuario no encontrado');
      }

      res.json({
        success: true,
        message: 'Usuario actualizado exitosamente',
        user: this.formatUserResponse(user)
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Eliminar usuario (soft delete)
   * @route   DELETE /api/users/:id
   * @access  Private (Admin)
   */
  async deleteUser(req, res, next) {
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

      // Soft delete: marcar como inactivo
      user.isActive = false;
      user.deletedAt = new Date();
      user.deletedBy = req.user.id;
      user.refreshToken = null; // Invalidar sesiones
      user.tokenExpiredAt = null;
      
      await user.save({ validateBeforeSave: false });

      res.json({
        success: true,
        message: 'Usuario eliminado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Activar/desactivar usuario
   * @route   PUT /api/users/:id/activate
   * @access  Private (Admin)
   */
  async toggleUserStatus(req, res, next) {
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
      ).select('-password -refreshToken -resetPasswordToken -emailVerificationToken');

      if (!user) {
        throw createError.notFound('Usuario no encontrado');
      }

      // Si se desactiva, invalidar sesiones
      if (!isActive) {
        user.refreshToken = null;
        user.tokenExpiredAt = null;
        await user.save({ validateBeforeSave: false });
      }

      res.json({
        success: true,
        message: `Usuario ${isActive ? 'activado' : 'desactivado'} exitosamente`,
        user: this.formatUserResponse(user)
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Resetear contraseña de usuario
   * @route   PUT /api/users/:id/reset-password
   * @access  Private (Admin)
   */
  async resetUserPassword(req, res, next) {
    try {
      const { id } = req.params;
      const { newPassword, sendEmail = true } = req.body;

      if (!newPassword || newPassword.length < 8) {
        throw createError.badRequest('La contraseña debe tener al menos 8 caracteres');
      }

      const user = await User.findByIdAndUpdate(
        id,
        { 
          password: newPassword, // Se hasheará automáticamente
          passwordChangedAt: new Date(),
          refreshToken: null, // Invalidar sesiones actuales
          tokenExpiredAt: null
        },
        { new: true }
      ).select('-password -refreshToken');

      if (!user) {
        throw createError.notFound('Usuario no encontrado');
      }

      // Enviar notificación por email (opcional)
      if (sendEmail && process.env.NODE_ENV === 'production') {
        const EmailService = require('../services/emailService');
        EmailService.sendPasswordResetNotification(user.email, user.firstName)
          .catch(err => console.error('Error enviando notificación:', err));
      }

      res.json({
        success: true,
        message: 'Contraseña reseteada exitosamente',
        user: this.formatUserResponse(user)
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Obtener estadísticas generales de usuarios
   * @route   GET /api/users/stats/overview
   * @access  Private (Admin)
   */
  async getUserStats(req, res, next) {
    try {
      // Estadísticas básicas
      const [
        totalUsers,
        activeUsers,
        inactiveUsers,
        usersByRole,
        recentUsers,
        loginStats
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ isActive: true }),
        User.countDocuments({ isActive: false }),
        User.aggregate([
          { $group: { _id: '$role', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        User.find({ isActive: true })
          .select('username email firstName lastName createdAt lastLogin')
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),
        User.aggregate([
          {
            $match: {
              lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Últimos 30 días
            }
          },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$lastLogin' }
              },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } },
          { $limit: 30 }
        ])
      ]);

      // Estadísticas de crecimiento
      const growthStats = await User.aggregate([
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
        { $limit: 12 }
      ]);

      res.json({
        success: true,
        stats: {
          overview: {
            total: totalUsers,
            active: activeUsers,
            inactive: inactiveUsers
          },
          byRole: usersByRole,
          recent: recentUsers,
          growth: growthStats,
          loginActivity: loginStats
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Buscar usuarios
   * @route   GET /api/users/search
   * @access  Private (Admin)
   */
  async searchUsers(req, res, next) {
    try {
      const { q, limit = 10 } = req.query;

      if (!q || q.length < 2) {
        throw createError.badRequest('Query de búsqueda debe tener al menos 2 caracteres');
      }

      const users = await User.find({
        $or: [
          { username: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
          { firstName: { $regex: q, $options: 'i' } },
          { lastName: { $regex: q, $options: 'i' } },
          { company: { $regex: q, $options: 'i' } }
        ],
        isActive: true
      })
      .select('username email firstName lastName company role')
      .limit(parseInt(limit))
      .lean();

      res.json({
        success: true,
        users: users.map(user => ({
          id: user._id,
          username: user.username,
          email: user.email,
          fullName: `${user.firstName} ${user.lastName}`,
          company: user.company,
          role: user.role
        })),
        total: users.length
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserController();