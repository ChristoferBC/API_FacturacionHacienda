//controllers/certificateController.js
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

// Importar modelos
const Certificate = require('../models/Certificate');
const User = require('../models/User');

// Importar servicios
const CertificateValidator = require('../services/certificateValidator');
const FileService = require('../services/fileService');

// Importar errores personalizados
const { createError } = require('../middlewares/errorHandler');

class CertificateController {
  constructor() {
    this.certificateValidator = new CertificateValidator();
    this.fileService = new FileService();
  }

  // Helper para formatear respuesta de certificado
  formatCertificateResponse(certificate, includeDetails = false) {
    const response = {
      id: certificate._id,
      name: certificate.name,
      description: certificate.description,
      certificateType: certificate.certificateType,
      originalName: certificate.originalName,
      fileSize: certificate.fileSize,
      subject: certificate.subject,
      issuer: certificate.issuer,
      validFrom: certificate.validFrom,
      validTo: certificate.validTo,
      serialNumber: certificate.serialNumber,
      isActive: certificate.isActive,
      isValidated: certificate.isValidated,
      haciendaCompatible: certificate.haciendaCompatible,
      lastValidated: certificate.lastValidated,
      validationError: certificate.validationError,
      createdAt: certificate.createdAt,
      updatedAt: certificate.updatedAt,
      // Virtuals
      status: certificate.status,
      isExpired: certificate.isExpired,
      isExpiringSoon: certificate.isExpiringSoon,
      daysUntilExpiry: certificate.daysUntilExpiry
    };

    if (includeDetails) {
      response.keyUsage = certificate.keyUsage;
      response.extendedKeyUsage = certificate.extendedKeyUsage;
      response.fingerprint = certificate.fingerprint;
      response.usageStats = certificate.usageStats;
      response.backupInfo = {
        hasBackup: certificate.backupInfo?.hasBackup || false,
        backupCreatedAt: certificate.backupInfo?.backupCreatedAt
      };
    }

    return response;
  }

  /**
   * @desc    Obtener certificados del usuario
   * @route   GET /api/certificates
   * @access  Private
   */
  async getCertificates(req, res, next) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        isActive, 
        status,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      // Construir filtros
      const filter = { userId: req.user.id };
      
      if (isActive !== undefined) {
        filter.isActive = isActive === 'true';
      }

      if (status) {
        switch (status) {
          case 'active':
            filter.isActive = true;
            filter.validTo = { $gt: new Date() };
            break;
          case 'expired':
            filter.validTo = { $lt: new Date() };
            break;
          case 'expiring_soon':
            filter.isActive = true;
            filter.validTo = {
              $gte: new Date(),
              $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            };
            break;
          case 'inactive':
            filter.isActive = false;
            break;
        }
      }

      // Construir ordenamiento
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Ejecutar consulta
      const certificates = await Certificate.find(filter)
        .sort(sort)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      const total = await Certificate.countDocuments(filter);

      res.json({
        success: true,
        certificates: certificates.map(cert => this.formatCertificateResponse(cert)),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Obtener certificado específico
   * @route   GET /api/certificates/:id
   * @access  Private
   */
  async getCertificateById(req, res, next) {
    try {
      const { id } = req.params;

      const certificate = await Certificate.findOne({
        _id: id,
        userId: req.user.id
      }).lean();

      if (!certificate) {
        throw createError.notFound('Certificado no encontrado');
      }

      res.json({
        success: true,
        certificate: this.formatCertificateResponse(certificate, true)
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Subir nuevo certificado
   * @route   POST /api/certificates/upload
   * @access  Private
   */
  async uploadCertificate(req, res, next) {
    try {
      if (!req.file) {
        throw createError.badRequest('Archivo de certificado requerido');
      }

      const { name, password, certificateType, description } = req.body;

      // Validar certificado
      const validationResult = await this.certificateValidator.validateCertificate(
        req.file.path,
        password,
        certificateType
      );

      if (!validationResult.isValid) {
        // Eliminar archivo si la validación falla
        await this.fileService.deleteFile(req.file.path);
        throw createError.badRequest(`Certificado inválido: ${validationResult.error}`);
      }

      // Verificar que no exista un certificado con el mismo nombre
      const existingCert = await Certificate.findOne({
        userId: req.user.id,
        name
      });

      if (existingCert) {
        await this.fileService.deleteFile(req.file.path);
        throw createError.conflict('Ya existe un certificado con ese nombre');
      }

      // Verificar que no exista el mismo certificado (por fingerprint)
      if (validationResult.details.fingerprint?.sha1) {
        const duplicateCert = await Certificate.findByFingerprint(
          validationResult.details.fingerprint.sha1
        );

        if (duplicateCert) {
          await this.fileService.deleteFile(req.file.path);
          throw createError.conflict('Este certificado ya está registrado en el sistema');
        }
      }

      // Encriptar contraseña si existe
      let encryptedPassword = null;
      if (password) {
        encryptedPassword = this.fileService.encryptText(password);
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
        subject: validationResult.details.subject,
        issuer: validationResult.details.issuer,
        serialNumber: validationResult.details.serialNumber,
        validFrom: validationResult.details.validFrom,
        validTo: validationResult.details.validTo,
        fingerprint: validationResult.details.fingerprint,
        keyUsage: validationResult.details.keyUsage || [],
        extendedKeyUsage: validationResult.details.extendedKeyUsage || [],
        isActive: true,
        isValidated: true,
        lastValidated: new Date(),
        uploadedFrom: {
          ip: req.ip,
          userAgent: req.get('User-Agent')
        }
      });

      await certificate.save();

      // Verificar compatibilidad con Hacienda (async)
      certificate.checkHaciendaCompatibility()
        .catch(err => console.error('Error verificando compatibilidad con Hacienda:', err));

      res.status(201).json({
        success: true,
        message: 'Certificado subido y validado exitosamente',
        certificate: this.formatCertificateResponse(certificate, true)
      });
    } catch (error) {
      // Limpiar archivo en caso de error
      if (req.file) {
        this.fileService.deleteFile(req.file.path)
          .catch(err => console.error('Error eliminando archivo:', err));
      }
      next(error);
    }
  }

  /**
   * @desc    Actualizar certificado
   * @route   PUT /api/certificates/:id
   * @access  Private
   */
  async updateCertificate(req, res, next) {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Solo permitir actualizar ciertos campos
      const allowedUpdates = ['name', 'description', 'isActive', 'useForSigning'];
      const filteredUpdates = {};

      Object.keys(updates).forEach(key => {
        if (allowedUpdates.includes(key)) {
          filteredUpdates[key] = updates[key];
        }
      });

      // Verificar nombre duplicado si se está actualizando
      if (filteredUpdates.name) {
        const existingCert = await Certificate.findOne({
          _id: { $ne: id },
          userId: req.user.id,
          name: filteredUpdates.name
        });

        if (existingCert) {
          throw createError.conflict('Ya existe un certificado con ese nombre');
        }
      }

      const certificate = await Certificate.findOneAndUpdate(
        { _id: id, userId: req.user.id },
        { ...filteredUpdates, updatedAt: new Date() },
        { new: true, runValidators: true }
      );

      if (!certificate) {
        throw createError.notFound('Certificado no encontrado');
      }

      res.json({
        success: true,
        message: 'Certificado actualizado exitosamente',
        certificate: this.formatCertificateResponse(certificate, true)
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Eliminar certificado
   * @route   DELETE /api/certificates/:id
   * @access  Private
   */
  async deleteCertificate(req, res, next) {
    try {
      const { id } = req.params;

      const certificate = await Certificate.findOne({
        _id: id,
        userId: req.user.id
      });

      if (!certificate) {
        throw createError.notFound('Certificado no encontrado');
      }

      // Verificar si el certificado está siendo usado
      const Document = require('../models/Document');
      const documentsCount = await Document.countDocuments({
        certificateId: id,
        estadoEnvio: { $in: ['pendiente', 'enviado'] }
      });

      if (documentsCount > 0) {
        throw createError.badRequest(
          'No se puede eliminar un certificado que tiene documentos pendientes o enviados'
        );
      }

      // Crear backup antes de eliminar (opcional)
      if (process.env.CREATE_BACKUP_ON_DELETE === 'true') {
        const backupPath = path.join(
          process.env.BACKUP_PATH || './backups',
          `deleted-${certificate._id}-${Date.now()}.bak`
        );
        await certificate.createBackup(backupPath);
      }

      // Eliminar certificado (esto triggerea el middleware pre-remove)
      await certificate.deleteOne();

      res.json({
        success: true,
        message: 'Certificado eliminado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Validar certificado
   * @route   POST /api/certificates/:id/validate
   * @access  Private
   */
  async validateCertificate(req, res, next) {
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

      // Usar la contraseña proporcionada o la almacenada
      let certPassword = password;
      if (!certPassword && certificate.password) {
        certPassword = this.fileService.decryptText(certificate.password);
      }

      // Validar certificado
      const validationResult = await certificate.validateCertificate();

      res.json({
        success: true,
        message: validationResult.isValid ? 'Certificado válido' : 'Certificado inválido',
        validation: {
          isValid: validationResult.isValid,
          error: validationResult.error,
          lastValidated: certificate.lastValidated,
          details: validationResult.details
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Obtener detalles completos del certificado
   * @route   GET /api/certificates/:id/details
   * @access  Private
   */
  async getCertificateDetails(req, res, next) {
    try {
      const { id } = req.params;

      const certificate = await Certificate.findOne({
        _id: id,
        userId: req.user.id
      }).lean();

      if (!certificate) {
        throw createError.notFound('Certificado no encontrado');
      }

      // Verificar compatibilidad con Hacienda si no se ha verificado
      if (certificate.haciendaCompatible === null) {
        const certModel = await Certificate.findById(id);
        await certModel.checkHaciendaCompatibility();
        certificate.haciendaCompatible = certModel.haciendaCompatible;
      }

      // Obtener estadísticas de uso
      const Document = require('../models/Document');
      const usageStats = await Document.aggregate([
        { $match: { certificateId: certificate._id } },
        {
          $group: {
            _id: '$tipoDocumento',
            count: { $sum: 1 },
            lastUsed: { $max: '$createdAt' }
          }
        }
      ]);

      const response = {
        ...this.formatCertificateResponse(certificate, true),
        usageStatsByDocType: usageStats,
        securityInfo: {
          uploadedFrom: certificate.uploadedFrom,
          hasBackup: certificate.backupInfo?.hasBackup || false,
          backupCreatedAt: certificate.backupInfo?.backupCreatedAt
        }
      };

      res.json({
        success: true,
        certificate: response
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Obtener estadísticas de certificados del usuario
   * @route   GET /api/certificates/stats/overview
   * @access  Private
   */
  async getCertificateStats(req, res, next) {
    try {
      const userId = req.user.id;
      
      const [
        totalCerts,
        activeCerts,
        expiredCerts,
        expiringSoon,
        byType,
        recentActivity
      ] = await Promise.all([
        Certificate.countDocuments({ userId }),
        Certificate.countDocuments({ 
          userId, 
          isActive: true, 
          validTo: { $gt: new Date() } 
        }),
        Certificate.countDocuments({ 
          userId, 
          validTo: { $lt: new Date() } 
        }),
        Certificate.countDocuments({
          userId,
          isActive: true,
          validTo: { 
            $gte: new Date(),
            $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }
        }),
        Certificate.aggregate([
          { $match: { userId } },
          { $group: { _id: '$certificateType', count: { $sum: 1 } } }
        ]),
        Certificate.find({ userId })
          .select('name validTo usageStats.lastUsed')
          .sort({ 'usageStats.lastUsed': -1 })
          .limit(5)
          .lean()
      ]);

      res.json({
        success: true,
        stats: {
          overview: {
            total: totalCerts,
            active: activeCerts,
            expired: expiredCerts,
            expiringSoon
          },
          byType: byType.reduce((acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
          }, {}),
          recentActivity: recentActivity.map(cert => ({
            id: cert._id,
            name: cert.name,
            validTo: cert.validTo,
            lastUsed: cert.usageStats?.lastUsed,
            status: cert.validTo < new Date() ? 'expired' : 'active'
          }))
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Crear backup de certificado
   * @route   POST /api/certificates/:id/backup
   * @access  Private
   */
  async createBackup(req, res, next) {
    try {
      const { id } = req.params;

      const certificate = await Certificate.findOne({
        _id: id,
        userId: req.user.id
      });

      if (!certificate) {
        throw createError.notFound('Certificado no encontrado');
      }

      const backupPath = path.join(
        process.env.BACKUP_PATH || './backups',
        req.user.id,
        `${certificate.name}-${Date.now()}.bak`
      );

      const success = await certificate.createBackup(backupPath);

      if (!success) {
        throw createError.internal('Error creando backup del certificado');
      }

      res.json({
        success: true,
        message: 'Backup creado exitosamente',
        backup: {
          created: certificate.backupInfo.backupCreatedAt,
          hasBackup: certificate.backupInfo.hasBackup
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CertificateController();