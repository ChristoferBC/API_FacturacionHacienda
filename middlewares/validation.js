///middlewares/validation.js
const Joi = require('joi');

/**
 * Función helper para crear middleware de validación
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context.value
      }));

      return res.status(400).json({
        success: false,
        error: 'Datos de entrada inválidos',
        code: 'VALIDATION_ERROR',
        details
      });
    }

    // Reemplazar los datos validados y limpiados
    req[property] = value;
    next();
  };
};

// Esquemas de validación para diferentes endpoints

/**
 * Validación para datos de clave
 */
const claveSchema = Joi.object({
  sucursal: Joi.string().pattern(/^\d{1,3}$/).required()
    .messages({
      'string.pattern.base': 'Sucursal debe ser un número de máximo 3 dígitos'
    }),
  terminal: Joi.string().pattern(/^\d{1,5}$/).required()
    .messages({
      'string.pattern.base': 'Terminal debe ser un número de máximo 5 dígitos'
    }),
  tipoDocumento: Joi.string().valid('01', '02', '03', '04', '05', '06', '07', '08', '09').required()
    .messages({
      'any.only': 'Tipo de documento debe ser uno de: 01,02,03,04,05,06,07,08,09'
    }),
  numeroConsecutivo: Joi.string().pattern(/^\d{1,10}$/).required()
    .messages({
      'string.pattern.base': 'Número consecutivo debe ser un número de máximo 10 dígitos'
    })
});

/**
 * Validación para datos de factura electrónica
 */
const facturaSchema = Joi.object({
  clave: Joi.string().length(50).required(),
  codigoActividad: Joi.string().length(6).required(),
  numeroConsecutivo: Joi.string().max(20).required(),
  fechaEmision: Joi.date().iso().required(),
  
  // Emisor
  emisor: Joi.object({
    nombre: Joi.string().max(200).required(),
    tipoId: Joi.string().valid('01', '02', '03', '04').required(),
    numeroId: Joi.string().max(20).required(),
    nombreComercial: Joi.string().max(200).optional(),
    ubicacion: Joi.object({
      provincia: Joi.string().length(1).required(),
      canton: Joi.string().length(2).required(),
      distrito: Joi.string().length(2).required(),
      barrio: Joi.string().length(2).required(),
      otrasSenas: Joi.string().max(300).optional()
    }).required(),
    telefono: Joi.object({
      codigoPais: Joi.string().max(3).required(),
      numTelefono: Joi.string().max(20).required()
    }).optional(),
    fax: Joi.object({
      codigoPais: Joi.string().max(3).required(),
      numTelefono: Joi.string().max(20).required()
    }).optional(),
    correoElectronico: Joi.string().email().max(100).required()
  }).required(),

  // Receptor
  receptor: Joi.object({
    nombre: Joi.string().max(200).required(),
    tipoId: Joi.string().valid('01', '02', '03', '04', '05').required(),
    numeroId: Joi.string().max(20).required(),
    nombreComercial: Joi.string().max(200).optional(),
    ubicacion: Joi.object({
      provincia: Joi.string().length(1).required(),
      canton: Joi.string().length(2).required(),
      distrito: Joi.string().length(2).required(),
      barrio: Joi.string().length(2).required(),
      otrasSenas: Joi.string().max(300).optional()
    }).optional(),
    telefono: Joi.object({
      codigoPais: Joi.string().max(3).required(),
      numTelefono: Joi.string().max(20).required()
    }).optional(),
    correoElectronico: Joi.string().email().max(100).optional()
  }).required(),

  // Condición de venta
  condicionVenta: Joi.string().valid('01', '02', '03', '04', '05', '99').required(),
  plazoCredito: Joi.string().max(10).when('condicionVenta', {
    is: '02',
    then: Joi.required(),
    otherwise: Joi.forbidden()
  }),
  medioPago: Joi.array().items(Joi.string().valid('01', '02', '03', '04', '05', '99')).min(1).required(),

  // Líneas de detalle
  detalleServicio: Joi.array().items(
    Joi.object({
      numeroLinea: Joi.number().integer().min(1).required(),
      codigo: Joi.object({
        tipo: Joi.string().valid('01', '02', '03', '04', '99').required(),
        codigo: Joi.string().max(20).required()
      }).optional(),
      cantidad: Joi.number().precision(3).min(0).required(),
      unidadMedida: Joi.string().valid('Al', 'Alc', 'Cm', 'Gal', 'Kg', 'Km', 'Kw', 'L', 'Lb', 'Lt', 'Mt', 'Oz', 'Tn', 'Ud', 'Otros').required(),
      detalle: Joi.string().max(1000).required(),
      precioUnitario: Joi.number().precision(5).min(0).required(),
      montoTotal: Joi.number().precision(5).min(0).required(),
      subtotal: Joi.number().precision(5).min(0).required(),
      baseImponible: Joi.number().precision(5).min(0).optional(),
      impuesto: Joi.object({
        codigo: Joi.string().valid('01', '02', '03', '04', '05', '06', '07', '08', '12', '99').required(),
        codigoTarifa: Joi.string().valid('01', '02', '03', '04', '05', '06', '07', '08').required(),
        tarifa: Joi.number().precision(2).min(0).required(),
        monto: Joi.number().precision(5).min(0).required()
      }).optional(),
      impuestoNeto: Joi.number().precision(5).min(0).optional(),
      montoTotalLinea: Joi.number().precision(5).min(0).required()
    })
  ).min(1).required(),

  // Resumen
  resumenFactura: Joi.object({
    codigoTipoMoneda: Joi.object({
      codigoMoneda: Joi.string().valid('CRC', 'USD', 'EUR').required(),
      tipoCambio: Joi.number().precision(5).min(0).required()
    }).required(),
    totalServGravados: Joi.number().precision(5).min(0).optional(),
    totalServExentos: Joi.number().precision(5).min(0).optional(),
    totalServExonerado: Joi.number().precision(5).min(0).optional(),
    totalMercanciasGravadas: Joi.number().precision(5).min(0).optional(),
    totalMercanciasExentas: Joi.number().precision(5).min(0).optional(),
    totalMercExonerada: Joi.number().precision(5).min(0).optional(),
    totalGravado: Joi.number().precision(5).min(0).optional(),
    totalExento: Joi.number().precision(5).min(0).optional(),
    totalExonerado: Joi.number().precision(5).min(0).optional(),
    totalVenta: Joi.number().precision(5).min(0).required(),
    totalDescuentos: Joi.number().precision(5).min(0).optional(),
    totalVentaNeta: Joi.number().precision(5).min(0).required(),
    totalImpuesto: Joi.number().precision(5).min(0).optional(),
    totalIVADevuelto: Joi.number().precision(5).min(0).optional(),
    totalOtrosCargos: Joi.number().precision(5).min(0).optional(),
    totalComprobante: Joi.number().precision(5).min(0).required()
  }).required(),

  // Información de referencia (opcional)
  informacionReferencia: Joi.array().items(
    Joi.object({
      tipoDoc: Joi.string().valid('01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '99').required(),
      numero: Joi.string().max(50).required(),
      fechaEmision: Joi.date().iso().required(),
      codigo: Joi.string().valid('01', '02', '03', '04', '05', '99').required(),
      razon: Joi.string().max(180).required()
    })
  ).optional(),

  // Normativa (opcional)
  normativa: Joi.object({
    numeroResolucion: Joi.string().max(50).required(),
    fechaResolucion: Joi.date().iso().required()
  }).optional(),

  // Otros (opcional)
  otros: Joi.array().items(
    Joi.object({
      otroTexto: Joi.string().max(300).required()
    })
  ).optional()
});

/**
 * Validación para nota de crédito
 */
const notaCreditoSchema = Joi.object({
  // Incluir los campos básicos de factura más campos específicos de NC
  ...facturaSchema.describe().keys,
  informacionReferencia: Joi.array().items(
    Joi.object({
      tipoDoc: Joi.string().valid('01', '02', '03', '04').required(),
      numero: Joi.string().max(50).required(),
      fechaEmision: Joi.date().iso().required(),
      codigo: Joi.string().valid('01', '02', '03', '04', '05').required(),
      razon: Joi.string().max(180).required()
    })
  ).required() // Requerido para NC
});

/**
 * Validación para tiquete electrónico
 */
const tiqueteSchema = Joi.object({
  clave: Joi.string().length(50).required(),
  codigoActividad: Joi.string().length(6).required(),
  numeroConsecutivo: Joi.string().max(20).required(),
  fechaEmision: Joi.date().iso().required(),
  
  // Emisor (simplificado para tiquete)
  emisor: Joi.object({
    nombre: Joi.string().max(200).required(),
    tipoId: Joi.string().valid('01', '02', '03', '04').required(),
    numeroId: Joi.string().max(20).required(),
    ubicacion: Joi.object({
      provincia: Joi.string().length(1).required(),
      canton: Joi.string().length(2).required(),
      distrito: Joi.string().length(2).required(),
      barrio: Joi.string().length(2).required(),
      otrasSenas: Joi.string().max(300).optional()
    }).required(),
    correoElectronico: Joi.string().email().max(100).required()
  }).required(),

  // Condición de venta
  condicionVenta: Joi.string().valid('01').required(), // Solo contado para tiquetes

  // Líneas de detalle (simplificado)
  detalleServicio: Joi.array().items(
    Joi.object({
      numeroLinea: Joi.number().integer().min(1).required(),
      cantidad: Joi.number().precision(3).min(0).required(),
      unidadMedida: Joi.string().required(),
      detalle: Joi.string().max(160).required(),
      precioUnitario: Joi.number().precision(5).min(0).required(),
      montoTotal: Joi.number().precision(5).min(0).required(),
      subtotal: Joi.number().precision(5).min(0).required(),
      impuesto: Joi.object({
        codigo: Joi.string().valid('01', '02', '03', '04', '05', '06', '07', '08', '12', '99').required(),
        tarifa: Joi.number().precision(2).min(0).required(),
        monto: Joi.number().precision(5).min(0).required()
      }).optional(),
      montoTotalLinea: Joi.number().precision(5).min(0).required()
    })
  ).min(1).required(),

  // Resumen
  resumenFactura: Joi.object({
    codigoTipoMoneda: Joi.object({
      codigoMoneda: Joi.string().valid('CRC', 'USD', 'EUR').required(),
      tipoCambio: Joi.number().precision(5).min(0).required()
    }).required(),
    totalVenta: Joi.number().precision(5).min(0).required(),
    totalVentaNeta: Joi.number().precision(5).min(0).required(),
    totalImpuesto: Joi.number().precision(5).min(0).optional(),
    totalComprobante: Joi.number().precision(5).min(0).required()
  }).required()
});

/**
 * Validación para firmado de XML
 */
const signSchema = Joi.object({
  xml: Joi.string().required().messages({
    'string.empty': 'XML es requerido'
  }),
  certificateId: Joi.string().required().messages({
    'string.empty': 'ID del certificado es requerido'
  })
});

/**
 * Validación para solicitud de token
 */
const tokenRequestSchema = Joi.object({
  username: Joi.string().required().messages({
    'string.empty': 'Nombre de usuario es requerido'
  }),
  password: Joi.string().required().messages({
    'string.empty': 'Contraseña es requerida'
  })
});

/**
 * Validación para refrescar token
 */
const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'string.empty': 'Refresh token es requerido'
  })
});

/**
 * Validación para envío de documento
 */
const sendDocumentSchema = Joi.object({
  xml: Joi.string().required(),
  token: Joi.string().required(),
  tipoDocumento: Joi.string().valid('01', '02', '03', '04', '05', '06', '07', '08', '09').required()
});

/**
 * Validación para consulta de documento
 */
const consultaSchema = Joi.object({
  clave: Joi.string().length(50).required()
});

/**
 * Validación para datos de QR
 */
const qrSchema = Joi.object({
  clave: Joi.string().length(50).required(),
  fechaEmision: Joi.date().iso().required(),
  emisorTipoId: Joi.string().valid('01', '02', '03', '04').required(),
  emisorNumeroId: Joi.string().max(20).required(),
  receptorTipoId: Joi.string().valid('01', '02', '03', '04', '05').required(),
  receptorNumeroId: Joi.string().max(20).required(),
  totalComprobante: Joi.number().precision(5).min(0).required()
});

/**
 * Validación para XML genérico
 */
const xmlSchema = Joi.object({
  xml: Joi.string().required().messages({
    'string.empty': 'XML es requerido'
  })
});

// Middlewares específicos
const validateClaveData = validate(claveSchema);
const validateFacturaData = validate(facturaSchema);
const validateNotaCreditoData = validate(notaCreditoSchema);
const validateTiqueteData = validate(tiqueteSchema);
const validateSignData = validate(signSchema);
const validateTokenRequest = validate(tokenRequestSchema);
const validateRefreshToken = validate(refreshTokenSchema);
const validateSendDocument = validate(sendDocumentSchema);
const validateConsulta = validate(consultaSchema, 'params');
const validateQRData = validate(qrSchema);
const validateXMLData = validate(xmlSchema);

module.exports = {
  validate,
  validateClaveData,
  validateFacturaData,
  validateNotaCreditoData,
  validateTiqueteData,
  validateSignData,
  validateTokenRequest,
  validateRefreshToken,
  validateSendDocument,
  validateConsulta,
  validateQRData,
  validateXMLData
};