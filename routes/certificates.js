//routes/certificates.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

// Importar modelos
const Certificate = require('../models/Certificate');
const User = require('../models/User');

// Importar middlewares
const { authMiddleware, requireRole } = require('../middlewares/auth');
const { validate } = require('../middlewares/validation');
const { createError } = require('../middlewares/errorHandler');

// Importar servicios
const CertificateValidator = require('../services/certificateValidator');

// Importar esquemas de validación
const Joi = require('joi');

// Configuración de multer para upload de certificados
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const userDir = path.join(process.env.CERTIFICATES_PATH || './uploads/certificates', req.user.id);
    try {
      await fs.mkdir(userDir, { recursive: true });
      cb(null, userDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `cert-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Permitir solo archivos de certificado
  const allowedMimes = [
    'application/x-pkcs12',
    'application/pkcs12',
    'application/x-pkcs7-certificates',
    'application/pkcs-signature',
    'application/x-x509-ca-cert',
    'application/octet-stream'
  ];
  
  const allowedExtensions = ['.p12', '.pfx', '.p7b', '.cer', '.crt', '.pem'];
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Use .p12, .pfx, .p7b, .cer, .crt o .pem'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB máximo
  }
});

// Esquemas de validación
const uploadCertificateSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  password: Joi.string().when('certificateType', {
    is: Joi.string().valid('p12', 'pfx'),
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  certificateType: Joi.string().valid('p12', 'pfx', 'p7b', 'cer', 'crt', 'pem').required(),
  description: Joi.string().max(500).optional()
});

const updateCertificateSchema = Joi.object({
  name: Joi.string().min(3).max(100).optional(),
  description: Joi.string().max(500).optional(),
  isActive: Joi.boolean().optional()
});

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Instanciar validador de certificados
const certificateValidator = new CertificateValidator();

// @route   GET /api/certificates
// @desc    Obtener certificados del usuario
// @access  Private
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 10, isActive } = req.query;

    const filter = { userId: req.user.id };
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const certificates = await Certificate.find(filter)
      .select('-filePath -privateKeyPath') // No exponer rutas de archivos
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Certificate.countDocuments(filter);

    res.json({
      success: true,
      certificates,
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

// @route   GET /api/certificates/:id
// @desc    Obtener certificado específico
// @access  Private
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const certificate = await Certificate.findOne({
      _id: id,
      userId: req.user.id
    }).select('-filePath -privateKeyPath -password');

    if (!certificate) {
      throw createError.notFound('Certificado no encontrado');
    }

    res.json({
      success: true,
      certificate
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/certificates/upload
// @desc    Subir nuevo certificado
// @access  Private
router.post('/upload', upload.single('certificate'), validate(uploadCertificateSchema), async (req, res, next) => {
  try {
    if (!req.file) {
      throw createError.badRequest('Archivo de certificado requerido');
    }

    const { name, password, certificateType, description } = req.body;

    // Validar certificado
    const validationResult = await certificateValidator.validateCertificate(
      req.file.path,
      password,
      certificateType
    );

    if (!validationResult.isValid) {
      // Eliminar archivo si la validación falla
      await fs.unlink(req.file.path);
      throw createError.badRequest(`Certificado inválido: ${validationResult.error}`);
    }

    // Verificar que no exista un certificado con el mismo nombre
    const existingCert = await Certificate.findOne({
      userId: req.user.id,
      name
    });

    if (existingCert) {
      await fs.unlink(req.file.path);
      throw createError.conflict('Ya existe un certificado con ese nombre');
    }

    // Encriptar contraseña si existe
    let encryptedPassword = null;
    if (password) {
      const cipher = crypto.createCipher('aes-256-cbc', process.env.CERT_ENCRYPTION_KEY);
      encryptedPassword = cipher.update(password, 'utf8', 'hex') + cipher.final('hex');
    }

    // Crear certificado en base de datos
    const certificate = new Certificate({
      userId: req.user.id,
      name,
      description,
      certificateType,
      filePath: req.file.path,
      originalName: req.file.originalname,
      fileSize: req.file.size,
      password: encryptedPassword,
      issuer: validationResult.details.issuer,
      subject: validationResult.details.subject,
      serialNumber: validationResult.details.serialNumber,
      validFrom: validationResult.details.validFrom,
      validTo: validationResult.details.validTo,
      fingerprint: validationResult.details.fingerprint,
      isActive: true
    });

    await certificate.save();

    // Devolver certificado sin información sensible
    const response = certificate.toObject();
    delete response.filePath;
    delete response.password;

    res.status(201).json({
      success: true,
      message: 'Certificado subido exitosamente',
      certificate: response
    });
  } catch (error) {
    // Limpiar archivo en caso de error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error eliminando archivo:', unlinkError);
      }
    }
    next(error);
  }
});

// @route   PUT /api/certificates/:id
// @desc    Actualizar certificado
// @access  Private
router.put('/:id', validate(updateCertificateSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const certificate = await Certificate.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).select('-filePath -password');

    if (!certificate) {
      throw createError.notFound('Certificado no encontrado');
    }

    res.json({
      success: true,
      message: 'Certificado actualizado exitosamente',
      certificate
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/certificates/:id
// @desc    Eliminar certificado
// @access  Private
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const certificate = await Certificate.findOne({
      _id: id,
      userId: req.user.id
    });

    if (!certificate) {
      throw createError.notFound('Certificado no encontrado');
    }

    // Eliminar archivo físico
    try {
      await fs.unlink(certificate.filePath);
    } catch (fileError) {
      console.error('Error eliminando archivo de certificado:', fileError);
    }

    // Eliminar de base de datos
    await Certificate.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Certificado eliminado exitosamente'
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/certificates/:id/validate
// @desc    Validar certificado
// @access  Private
router.post('/:id/validate', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    const certificate = await Certificate.findOne({
      _id: id,
      userId: req.user.id
    });

    if (!certificate) {
      throw createError.notFound('Certificado no encontrado');
    }

    // Desencriptar contraseña almacenada si existe
    let storedPassword = null;
    if (certificate.password) {
      const decipher = crypto.createDecipher('aes-256-cbc', process.env.CERT_ENCRYPTION_KEY);
      storedPassword = decipher.update(certificate.password, 'hex', 'utf8') + decipher.final('utf8');
    }

    // Usar la contraseña proporcionada o la almacenada
    const certPassword = password || storedPassword;

    // Validar certificado
    const validationResult = await certificateValidator.validateCertificate(
      certificate.filePath,
      certPassword,
      certificate.certificateType
    );

    res.json({
      success: true,
      validation: {
        isValid: validationResult.isValid,
        error: validationResult.error,
        details: validationResult.details
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/certificates/:id/details
// @desc    Obtener detalles completos del certificado
// @access  Private
router.get('/:id/details', async (req, res, next) => {
  try {
    const { id } = req.params;

    const certificate = await Certificate.findOne({
      _id: id,
      userId: req.user.id
    }).select('-filePath -password');

    if (!certificate) {
      throw createError.notFound('Certificado no encontrado');
    }

    // Verificar estado del certificado
    const now = new Date();
    const isExpired = certificate.validTo < now;
    const isExpiringSoon = certificate.validTo < new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 días

    const details = {
      ...certificate.toObject(),
      status: {
        isValid: !isExpired && certificate.isActive,
        isExpired,
        isExpiringSoon,
        daysUntilExpiry: Math.ceil((certificate.validTo - now) / (1000 * 60 * 60 * 24))
      }
    };

    res.json({
      success: true,
      certificate: details
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/certificates/stats
// @desc    Obtener estadísticas de certificados del usuario
// @access  Private
router.get('/stats/overview', async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const totalCerts = await Certificate.countDocuments({ userId });
    const activeCerts = await Certificate.countDocuments({ userId, isActive: true });
    const expiredCerts = await Certificate.countDocuments({ 
      userId, 
      validTo: { $lt: new Date() } 
    });
    
    const expiringSoon = await Certificate.countDocuments({
      userId,
      validTo: { 
        $gte: new Date(),
        $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 días
      }
    });

    res.json({
      success: true,
      stats: {
        total: totalCerts,
        active: activeCerts,
        expired: expiredCerts,
        expiringSoon
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;