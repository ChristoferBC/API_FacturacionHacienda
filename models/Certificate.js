//models/Certificate.js
const mongoose = require('mongoose');
const crypto = require('crypto');
const path = require('path');

const certificateSchema = new mongoose.Schema({
  // Relación con usuario
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El ID de usuario es requerido'],
    index: true
  },

  // Información básica
  name: {
    type: String,
    required: [true, 'El nombre del certificado es requerido'],
    trim: true,
    minlength: [3, 'El nombre debe tener al menos 3 caracteres'],
    maxlength: [100, 'El nombre no puede tener más de 100 caracteres']
  },

  description: {
    type: String,
    trim: true,
    maxlength: [500, 'La descripción no puede tener más de 500 caracteres'],
    default: null
  },

  // Información del archivo
  originalName: {
    type: String,
    required: [true, 'El nombre original del archivo es requerido'],
    trim: true
  },

  filePath: {
    type: String,
    required: [true, 'La ruta del archivo es requerida'],
    select: false // No exponer la ruta por seguridad
  },

  privateKeyPath: {
    type: String,
    select: false // Para certificados que requieren llave privada separada
  },

  fileSize: {
    type: Number,
    required: [true, 'El tamaño del archivo es requerido'],
    min: [0, 'El tamaño del archivo debe ser positivo']
  },

  certificateType: {
    type: String,
    required: [true, 'El tipo de certificado es requerido'],
    enum: {
      values: ['p12', 'pfx', 'p7b', 'cer', 'crt', 'pem'],
      message: 'El tipo de certificado debe ser: p12, pfx, p7b, cer, crt o pem'
    }
  },

  // Contraseña encriptada (solo para p12/pfx)
  password: {
    type: String,
    select: false // No exponer por seguridad
  },

  // Información del certificado X.509
  subject: {
    commonName: {
      type: String,
      trim: true
    },
    organizationName: {
      type: String,
      trim: true
    },
    organizationalUnit: {
      type: String,
      trim: true
    },
    countryName: {
      type: String,
      trim: true,
      maxlength: 2
    },
    stateOrProvinceName: {
      type: String,
      trim: true
    },
    localityName: {
      type: String,
      trim: true
    },
    emailAddress: {
      type: String,
      trim: true,
      lowercase: true
    }
  },

  issuer: {
    commonName: {
      type: String,
      trim: true
    },
    organizationName: {
      type: String,
      trim: true
    },
    organizationalUnit: {
      type: String,
      trim: true
    },
    countryName: {
      type: String,
      trim: true,
      maxlength: 2
    }
  },

  // Información de validez
  validFrom: {
    type: Date,
    required: [true, 'La fecha de inicio de validez es requerida']
  },

  validTo: {
    type: Date,
    required: [true, 'La fecha de fin de validez es requerida']
  },

  // Información técnica
  serialNumber: {
    type: String,
    trim: true,
    index: true
  },

  fingerprint: {
    sha1: {
      type: String,
      trim: true,
      unique: true // Cada certificado tiene un fingerprint único
    },
    sha256: {
      type: String,
      trim: true,
      unique: true
    }
  },

  keyUsage: [{
    type: String,
    enum: [
      'digitalSignature',
      'nonRepudiation',
      'keyEncipherment',
      'dataEncipherment',
      'keyAgreement',
      'keyCertSign',
      'cRLSign'
    ]
  }],

  extendedKeyUsage: [{
    type: String,
    enum: [
      'serverAuth',
      'clientAuth',
      'codeSigning',
      'emailProtection',
      'timeStamping',
      'OCSPSigning'
    ]
  }],

  // Estado y configuración
  isActive: {
    type: Boolean,
    default: true
  },

  isValidated: {
    type: Boolean,
    default: false
  },

  lastValidated: {
    type: Date,
    default: null
  },

  validationError: {
    type: String,
    default: null
  },

  // Uso específico para Hacienda CR
  useForSigning: {
    type: Boolean,
    default: true
  },

  haciendaCompatible: {
    type: Boolean,
    default: null // null = no verificado, true/false = resultado de verificación
  },

  // Estadísticas de uso
  usageStats: {
    totalSignatures: {
      type: Number,
      default: 0,
      min: 0
    },
    lastUsed: {
      type: Date,
      default: null
    },
    documentsigned: [{
      documentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document'
      },
      documentType: {
        type: String,
        enum: ['01', '02', '03', '04', '05', '06', '07', '08', '09']
      },
      signedAt: {
        type: Date,
        default: Date.now
      }
    }]
  },

  // Backup y recuperación
  backupInfo: {
    hasBackup: {
      type: Boolean,
      default: false
    },
    backupLocation: {
      type: String,
      select: false
    },
    backupCreatedAt: {
      type: Date,
      default: null
    }
  },

  // Auditoría
  uploadedFrom: {
    ip: {
      type: String,
      trim: true
    },
    userAgent: {
      type: String,
      trim: true
    }
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.filePath;
      delete ret.privateKeyPath;
      delete ret.password;
      delete ret.backupInfo.backupLocation;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Índices compuestos
certificateSchema.index({ userId: 1, name: 1 }, { unique: true });
certificateSchema.index({ userId: 1, isActive: 1 });
certificateSchema.index({ userId: 1, validTo: 1 });
certificateSchema.index({ 'fingerprint.sha1': 1 });
certificateSchema.index({ 'fingerprint.sha256': 1 });
certificateSchema.index({ serialNumber: 1 });

// Índices para consultas de expiración
certificateSchema.index({ validTo: 1, isActive: 1 });
certificateSchema.index({ validFrom: 1, validTo: 1 });

// Virtuals
certificateSchema.virtual('isExpired').get(function() {
  return new Date() > this.validTo;
});

certificateSchema.virtual('isExpiringSoon').get(function() {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  return this.validTo <= thirtyDaysFromNow && !this.isExpired;
});

certificateSchema.virtual('daysUntilExpiry').get(function() {
  const now = new Date();
  const diffTime = this.validTo - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

certificateSchema.virtual('status').get(function() {
  if (!this.isActive) return 'inactive';
  if (this.isExpired) return 'expired';
  if (this.isExpiringSoon) return 'expiring_soon';
  if (!this.isValidated) return 'not_validated';
  return 'active';
});

certificateSchema.virtual('fileExtension').get(function() {
  return path.extname(this.originalName).toLowerCase();
});

// Relaciones virtuales
certificateSchema.virtual('owner', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

certificateSchema.virtual('signedDocuments', {
  ref: 'Document',
  localField: '_id',
  foreignField: 'certificateId'
});

// Middleware pre-save para validaciones adicionales
certificateSchema.pre('save', function(next) {
  // Validar que la fecha de fin sea posterior a la de inicio
  if (this.validFrom && this.validTo && this.validTo <= this.validFrom) {
    next(new Error('La fecha de fin debe ser posterior a la fecha de inicio'));
  }
  
  // Validar que el certificado no haya expirado al momento de subirlo
  if (this.isNew && this.validTo < new Date()) {
    next(new Error('No se puede subir un certificado que ya ha expirado'));
  }
  
  next();
});

// Middleware pre-remove para limpiar archivos
certificateSchema.pre('deleteOne', { document: true }, async function(next) {
  try {
    const fs = require('fs').promises;
    
    // Eliminar archivo principal
    if (this.filePath) {
      try {
        await fs.unlink(this.filePath);
      } catch (error) {
        console.error('Error eliminando archivo de certificado:', error);
      }
    }
    
    // Eliminar llave privada si existe
    if (this.privateKeyPath) {
      try {
        await fs.unlink(this.privateKeyPath);
      } catch (error) {
        console.error('Error eliminando llave privada:', error);
      }
    }
    
    // Eliminar backup si existe
    if (this.backupInfo.hasBackup && this.backupInfo.backupLocation) {
      try {
        await fs.unlink(this.backupInfo.backupLocation);
      } catch (error) {
        console.error('Error eliminando backup:', error);
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Métodos de instancia
certificateSchema.methods.incrementUsage = function(documentId, documentType) {
  this.usageStats.totalSignatures += 1;
  this.usageStats.lastUsed = new Date();
  
  if (documentId && documentType) {
    this.usageStats.documentsigned.push({
      documentId,
      documentType,
      signedAt: new Date()
    });
  }
  
  return this.save();
};

certificateSchema.methods.validateCertificate = async function() {
  const CertificateValidator = require('../services/certificateValidator');
  const validator = new CertificateValidator();
  
  try {
    // Desencriptar contraseña si existe
    let password = null;
    if (this.password) {
      const decipher = crypto.createDecipher('aes-256-cbc', process.env.CERT_ENCRYPTION_KEY);
      password = decipher.update(this.password, 'hex', 'utf8') + decipher.final('utf8');
    }
    
    const result = await validator.validateCertificate(this.filePath, password, this.certificateType);
    
    this.isValidated = result.isValid;
    this.lastValidated = new Date();
    this.validationError = result.error;
    
    await this.save();
    return result;
  } catch (error) {
    this.isValidated = false;
    this.validationError = error.message;
    await this.save();
    throw error;
  }
};

certificateSchema.methods.checkHaciendaCompatibility = async function() {
  // Verificaciones específicas para certificados de Hacienda CR
  const checks = {
    isValid: this.isValidated,
    notExpired: !this.isExpired,
    hasDigitalSignature: this.keyUsage.includes('digitalSignature'),
    hasNonRepudiation: this.keyUsage.includes('nonRepudiation'),
    isFromAuthorizedCA: this.checkAuthorizedCA()
  };
  
  this.haciendaCompatible = Object.values(checks).every(check => check === true);
  await this.save();
  
  return {
    compatible: this.haciendaCompatible,
    checks
  };
};

certificateSchema.methods.checkAuthorizedCA = function() {
  // Lista de CAs autorizadas por Hacienda CR
  const authorizedCAs = [
    'Camerfirma',
    'Firma Digital',
    'Gobierno Digital'
  ];
  
  return authorizedCAs.some(ca => 
    this.issuer.organizationName && 
    this.issuer.organizationName.toLowerCase().includes(ca.toLowerCase())
  );
};

certificateSchema.methods.createBackup = async function(backupPath) {
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    // Crear directorio de backup si no existe
    await fs.mkdir(path.dirname(backupPath), { recursive: true });
    
    // Copiar archivo
    await fs.copyFile(this.filePath, backupPath);
    
    // Actualizar información de backup
    this.backupInfo.hasBackup = true;
    this.backupInfo.backupLocation = backupPath;
    this.backupInfo.backupCreatedAt = new Date();
    
    await this.save();
    return true;
  } catch (error) {
    console.error('Error creando backup:', error);
    return false;
  }
};

// Métodos estáticos
certificateSchema.statics.findActiveByUser = function(userId) {
  return this.find({ userId, isActive: true, validTo: { $gt: new Date() } });
};

certificateSchema.statics.findExpiringByUser = function(userId, days = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    userId,
    isActive: true,
    validTo: { $gte: new Date(), $lte: futureDate }
  });
};

certificateSchema.statics.findExpired = function() {
  return this.find({
    isActive: true,
    validTo: { $lt: new Date() }
  });
};

certificateSchema.statics.findByFingerprint = function(fingerprint) {
  return this.findOne({
    $or: [
      { 'fingerprint.sha1': fingerprint },
      { 'fingerprint.sha256': fingerprint }
    ]
  });
};

certificateSchema.statics.getUsageStats = function(userId, startDate, endDate) {
  const match = { userId };
  
  if (startDate || endDate) {
    match['usageStats.documentsigned.signedAt'] = {};
    if (startDate) match['usageStats.documentsigned.signedAt'].$gte = startDate;
    if (endDate) match['usageStats.documentsigned.signedAt'].$lte = endDate;
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$userId',
        totalCertificates: { $sum: 1 },
        totalSignatures: { $sum: '$usageStats.totalSignatures' },
        activeCertificates: {
          $sum: { $cond: [{ $and: ['$isActive', { $gt: ['$validTo', new Date()] }] }, 1, 0] }
        },
        expiredCertificates: {
          $sum: { $cond: [{ $lt: ['$validTo', new Date()] }, 1, 0] }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('Certificate', certificateSchema);