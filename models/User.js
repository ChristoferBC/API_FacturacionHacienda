//models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Información básica
  username: {
    type: String,
    required: [true, 'El nombre de usuario es requerido'],
    unique: true,
    trim: true,
    minlength: [3, 'El nombre de usuario debe tener al menos 3 caracteres'],
    maxlength: [30, 'El nombre de usuario no puede tener más de 30 caracteres'],
    match: [/^[a-zA-Z0-9_]+$/, 'El nombre de usuario solo puede contener letras, números y guiones bajos']
  },

  email: {
    type: String,
    required: [true, 'El email es requerido'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Por favor ingrese un email válido']
  },

  password: {
    type: String,
    required: [true, 'La contraseña es requerida'],
    minlength: [8, 'La contraseña debe tener al menos 8 caracteres'],
    select: false // Por defecto no incluir en las consultas
  },

  // Información personal
  firstName: {
    type: String,
    required: [true, 'El nombre es requerido'],
    trim: true,
    minlength: [2, 'El nombre debe tener al menos 2 caracteres'],
    maxlength: [50, 'El nombre no puede tener más de 50 caracteres']
  },

  lastName: {
    type: String,
    required: [true, 'El apellido es requerido'],
    trim: true,
    minlength: [2, 'El apellido debe tener al menos 2 caracteres'],
    maxlength: [50, 'El apellido no puede tener más de 50 caracteres']
  },

  company: {
    type: String,
    trim: true,
    maxlength: [100, 'El nombre de la empresa no puede tener más de 100 caracteres'],
    default: null
  },

  phone: {
    type: String,
    trim: true,
    match: [/^[0-9+\-\s()]+$/, 'Por favor ingrese un número de teléfono válido'],
    default: null
  },

  // Configuración de cuenta
  role: {
    type: String,
    enum: {
      values: ['user', 'admin', 'moderator'],
      message: 'El rol debe ser: user, admin o moderator'
    },
    default: 'user'
  },

  isActive: {
    type: Boolean,
    default: true
  },

  isEmailVerified: {
    type: Boolean,
    default: false
  },

  // Configuración de Hacienda
  haciendaCredentials: {
    username: {
      type: String,
      trim: true,
      default: null
    },
    isConfigured: {
      type: Boolean,
      default: false
    }
  },

  // Configuración de empresa para facturación
  companyInfo: {
    legalName: {
      type: String,
      trim: true,
      maxlength: [200, 'El nombre legal no puede tener más de 200 caracteres']
    },
    comercialName: {
      type: String,
      trim: true,
      maxlength: [200, 'El nombre comercial no puede tener más de 200 caracteres']
    },
    identificationType: {
      type: String,
      enum: ['01', '02', '03', '04'], // Físico, Jurídico, DIMEX, NITE
      default: null
    },
    identificationNumber: {
      type: String,
      trim: true,
      maxlength: [20, 'El número de identificación no puede tener más de 20 caracteres']
    },
    activityCode: {
      type: String,
      trim: true,
      length: [6, 'El código de actividad debe tener exactamente 6 dígitos']
    },
    address: {
      province: {
        type: String,
        length: [1, 'La provincia debe ser de 1 dígito']
      },
      canton: {
        type: String,
        length: [2, 'El cantón debe ser de 2 dígitos']
      },
      district: {
        type: String,
        length: [2, 'El distrito debe ser de 2 dígitos']
      },
      neighborhood: {
        type: String,
        length: [2, 'El barrio debe ser de 2 dígitos']
      },
      otherSigns: {
        type: String,
        maxlength: [300, 'Otras señas no pueden tener más de 300 caracteres']
      }
    },
    contactInfo: {
      phoneCountryCode: {
        type: String,
        maxlength: [3, 'El código de país no puede tener más de 3 caracteres'],
        default: '506'
      },
      phoneNumber: {
        type: String,
        maxlength: [20, 'El número de teléfono no puede tener más de 20 caracteres']
      },
      faxCountryCode: {
        type: String,
        maxlength: [3, 'El código de país del fax no puede tener más de 3 caracteres']
      },
      faxNumber: {
        type: String,
        maxlength: [20, 'El número de fax no puede tener más de 20 caracteres']
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: [100, 'El email no puede tener más de 100 caracteres'],
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Por favor ingrese un email válido']
      }
    }
  },

  // Permisos específicos
  permissions: [{
    type: String,
    enum: [
      'create_invoice',
      'create_credit_note',
      'create_debit_note',
      'create_ticket',
      'send_documents',
      'manage_certificates',
      'view_reports',
      'manage_users'
    ]
  }],

  // Configuración de usuario
  preferences: {
    language: {
      type: String,
      enum: ['es', 'en'],
      default: 'es'
    },
    timezone: {
      type: String,
      default: 'America/Costa_Rica'
    },
    emailNotifications: {
      type: Boolean,
      default: true
    },
    documentAutoSend: {
      type: Boolean,
      default: false
    }
  },

  // Autenticación y seguridad
  refreshToken: {
    type: String,
    select: false
  },

  tokenExpiredAt: {
    type: Date,
    select: false
  },

  resetPasswordToken: {
    type: String,
    select: false
  },

  resetPasswordExpires: {
    type: Date,
    select: false
  },

  emailVerificationToken: {
    type: String,
    select: false
  },

  emailVerificationExpires: {
    type: Date,
    select: false
  },

  // Auditoría
  lastLogin: {
    type: Date,
    default: null
  },

  loginAttempts: {
    type: Number,
    default: 0
  },

  lockUntil: {
    type: Date,
    default: null
  },

  passwordChangedAt: {
    type: Date,
    default: null
  },

  // Soft delete
  deletedAt: {
    type: Date,
    default: null
  },

  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.refreshToken;
      delete ret.resetPasswordToken;
      delete ret.emailVerificationToken;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Índices
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ 'companyInfo.identificationNumber': 1 });

// Virtuals
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.virtual('certificates', {
  ref: 'Certificate',
  localField: '_id',
  foreignField: 'userId'
});

userSchema.virtual('documents', {
  ref: 'Document',
  localField: '_id',
  foreignField: 'userId'
});

// Virtual para verificar si la cuenta está bloqueada
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Middleware pre-save para hash de contraseña
userSchema.pre('save', async function(next) {
  // Solo hashear la contraseña si ha sido modificada
  if (!this.isModified('password')) return next();

  try {
    // Hash password con cost de 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Middleware pre-save para actualizar passwordChangedAt
userSchema.pre('save', function(next) {
  if (!this.isModified('password') || this.isNew) return next();
  
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// Métodos de instancia
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  this.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutos
  
  return resetToken;
};

userSchema.methods.createEmailVerificationToken = function() {
  const verifyToken = crypto.randomBytes(32).toString('hex');
  
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verifyToken)
    .digest('hex');
  
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 horas
  
  return verifyToken;
};

// Método para incrementar intentos de login
userSchema.methods.incLoginAttempts = function() {
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000; // 2 horas

  // Si tenemos un bloqueo previo y ha expirado, reiniciar
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };
  
  // Si llegamos al máximo de intentos y no estamos bloqueados, bloquear
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + lockTime };
  }

  return this.updateOne(updates);
};

// Método para reiniciar intentos de login
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Método para verificar permisos
userSchema.methods.hasPermission = function(permission) {
  if (this.role === 'admin') return true;
  return this.permissions.includes(permission);
};

// Método para verificar si puede acceder a recurso
userSchema.methods.canAccess = function(resource, resourceUserId) {
  if (this.role === 'admin') return true;
  return this._id.toString() === resourceUserId.toString();
};

// Métodos estáticos
userSchema.statics.findByCredentials = async function(identifier, password) {
  const user = await this.findOne({
    $or: [{ email: identifier }, { username: identifier }],
    isActive: true
  }).select('+password');

  if (!user) {
    throw new Error('Credenciales inválidas');
  }

  if (user.isLocked) {
    throw new Error('Cuenta bloqueada por múltiples intentos fallidos');
  }

  const isMatch = await user.comparePassword(password);
  
  if (!isMatch) {
    await user.incLoginAttempts();
    throw new Error('Credenciales inválidas');
  }

  // Reiniciar intentos si el login es exitoso
  if (user.loginAttempts > 0) {
    await user.resetLoginAttempts();
  }

  return user;
};

userSchema.statics.findActiveUsers = function() {
  return this.find({ isActive: true, deletedAt: null });
};

userSchema.statics.findByRole = function(role) {
  return this.find({ role, isActive: true, deletedAt: null });
};

module.exports = mongoose.model('User', userSchema);