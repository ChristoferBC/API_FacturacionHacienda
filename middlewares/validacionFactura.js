const fs = require('fs');
const ATV = require('@facturama/atv');
const path = require('path');
const { document } = require('../models/factura');

const atv = new ATV({}, 'stg');


//llamado para saber como es la estructura de la factura
function enviarEstructuraFactura(req, res, next) {
  res.json(FacturaModel);
}

function _isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}
function _isNumber(v) {
  return typeof v === 'number' && !Number.isNaN(v);
}

/**
 * validarDocumentoCompleto
 * Valida el modelo 'document' nuevo. Soporta recibir { document: {...} } o el objeto directo en body.
 * Al finalizar coloca el objeto validado en req.document
 */
function validarDocumentoCompleto(req, res, next) {
  const payload = req.body && req.body.document ? req.body.document : req.body;
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Body inválido. Se espera un objeto document.' });
  }

  const requiredStrings = [
    'documentName', 'providerId', 'countryCode', 'securityCode',
    'activityCode', 'consecutiveIdentifier', 'ceSituation', 'branch', 'terminal',
    'conditionSale', 'paymentMethod'
  ];
  for (const f of requiredStrings) {
    if (!_isNonEmptyString(payload[f])) {
      return res.status(400).json({ error: `Falta o es inválido el campo '${f}'.` });
    }
  }

  if (!/^\d{8}$/.test(String(payload.securityCode))) {
    return res.status(400).json({ error: 'securityCode debe ser una cadena de 8 dígitos.' });
  }

  // emitter
  if (!payload.emitter || typeof payload.emitter !== 'object') {
    return res.status(400).json({ error: 'Falta el objeto emitter.' });
  }
  const em = payload.emitter;
  if (!_isNonEmptyString(em.fullName)) return res.status(400).json({ error: 'Emitter.fullName es obligatorio.' });
  if (!em.identifier || !_isNonEmptyString(em.identifier.type) || !_isNonEmptyString(em.identifier.id)) {
    return res.status(400).json({ error: 'Emitter.identifier.type y emitter.identifier.id son obligatorios.' });
  }
  if (!_isNonEmptyString(em.activityCode)) return res.status(400).json({ error: 'Emitter.activityCode es obligatorio.' });
  if (!em.location || !_isNonEmptyString(em.location.province) || !_isNonEmptyString(em.location.canton) ||
    !_isNonEmptyString(em.location.district) || !_isNonEmptyString(em.location.neighborhood) || !_isNonEmptyString(em.location.details)) {
    return res.status(400).json({ error: 'Emitter.location incompleta.' });
  }

  // receiver (obligatorio para FacturaElectronica y similares)
  if (payload.documentName && payload.documentName !== 'TiqueteElectronico') {
    if (!payload.receiver || typeof payload.receiver !== 'object') {
      return res.status(400).json({ error: 'Falta el objeto receiver para este tipo de documento.' });
    }
    const rc = payload.receiver;
    if (!_isNonEmptyString(rc.fullName)) return res.status(400).json({ error: 'Receiver.fullName es obligatorio.' });
    if (!rc.identifier || !_isNonEmptyString(rc.identifier.type) || !_isNonEmptyString(rc.identifier.id)) {
      return res.status(400).json({ error: 'Receiver.identifier.type y receiver.identifier.id son obligatorios.' });
    }
    if (!_isNonEmptyString(rc.activityCode)) return res.status(400).json({ error: 'Receiver.activityCode es obligatorio.' });
    if (!rc.location || !_isNonEmptyString(rc.location.province) || !_isNonEmptyString(rc.location.canton) ||
      !_isNonEmptyString(rc.location.district) || !_isNonEmptyString(rc.location.neighborhood) || !_isNonEmptyString(rc.location.details)) {
      return res.status(400).json({ error: 'Receiver.location incompleta.' });
    }
  }

  // orderLines
  if (!Array.isArray(payload.orderLines) || payload.orderLines.length === 0) {
    return res.status(400).json({ error: 'orderLines es obligatorio y debe ser un arreglo con al menos una línea.' });
  }
  for (let i = 0; i < payload.orderLines.length; i++) {
    const line = payload.orderLines[i];
    if (!_isNonEmptyString(line.detail)) return res.status(400).json({ error: `orderLines[${i}].detail es obligatorio.` });
    if (!_isNumber(line.unitaryPrice)) return res.status(400).json({ error: `orderLines[${i}].unitaryPrice debe ser número.` });
    if (line.quantity !== undefined && !_isNumber(line.quantity)) return res.status(400).json({ error: `orderLines[${i}].quantity debe ser número si se provee.` });

    if (line.tax) {
      if (!_isNonEmptyString(line.tax.code) || !_isNonEmptyString(line.tax.rateCode) || !_isNumber(line.tax.rate)) {
        return res.status(400).json({ error: `orderLines[${i}].tax incompleto. 'code', 'rateCode' y 'rate' son obligatorios.` });
      }
    }
  }

  // Optional: validate optional currencyCode and exchangeRate formats if present
  if (payload.currencyCode && !_isNonEmptyString(payload.currencyCode)) {
    return res.status(400).json({ error: 'currencyCode debe ser string si se envía.' });
  }
  if (payload.exchangeRate && !_isNonEmptyString(payload.exchangeRate)) {
    return res.status(400).json({ error: 'exchangeRate debe ser string si se envía.' });
  }

  req.document = payload;
  next();
}

// Valida datos necesarios para sendConfirmation

function validarConfirmacion(req, res, next) {
  const { url } = req.body;
  const tokenHeader = req.headers['authorization'] || req.headers['Authorization'];

  if (!url) {
    return res.status(400).json({ error: 'Falta el campo url en el body.' });
  }
  if (!tokenHeader || !/^bearer\s+/i.test(tokenHeader)) {
    return res.status(400).json({ error: 'Falta el header Authorization con el token (bearer ...).' });
  }
  next();
}

function enviarEstructuraFactura(req, res, next) {
  res.json({ success: true, example: document });
}

module.exports = {
  validarDocumentoCompleto,
  validarConfirmacion,
  enviarEstructuraFactura
};

// Middleware para validar datos de emisión de factura
// function validarEmision(req, res, next) {
//   const factura = req.body;

//   // Validación de tipo de dato principal
//   if (typeof factura !== 'object' || Array.isArray(factura) || factura === null) {
//     return res.status(400).json({ error: 'El body debe ser un objeto de factura válido.' });
//   }

//   // Emisor
//   if (!factura.emitter) return res.status(400).json({ error: 'Falta emitter' });
//   const em = factura.emitter;
//   if (typeof em.fullName !== 'string' || !em.fullName.trim()) return res.status(400).json({ error: 'Falta fullName en emitter' });
//   if (typeof em.activityCode !== 'string' || !em.activityCode.trim()) return res.status(400).json({ error: 'Falta activityCode en emitter' });
//   if (!em.identifier || typeof em.identifier.type !== 'string' || typeof em.identifier.id !== 'string') return res.status(400).json({ error: 'Identificador de emitter incompleto' });
//   if (!em.location || typeof em.location.province !== 'string' || typeof em.location.canton !== 'string' ||
//     typeof em.location.district !== 'string' || typeof em.location.neighborhood !== 'string' || typeof em.location.details !== 'string') {
//     return res.status(400).json({ error: 'Ubicación de emitter incompleta' });
//   }
//   if (typeof em.email !== 'string' || !em.email.includes('@')) return res.status(400).json({ error: 'Email de emitter inválido' });

//   // Campos principales
//   const camposObligatorios = [
//     'branch', 'terminal', 'documentName', 'providerId', 'countryCode',
//     'securityCode', 'activityCode', 'consecutiveIdentifier', 'ceSituation',
//     'conditionSale', 'paymentMethod'
//   ];
//   for (const campo of camposObligatorios) {
//     if (!factura[campo] || typeof factura[campo] !== 'string' || !factura[campo].trim()) {
//       return res.status(400).json({ error: `Falta o es inválido el campo ${campo}` });
//     }
//   }

//   // orderLines
//   if (!factura.orderLines || !Array.isArray(factura.orderLines) || factura.orderLines.length === 0) {
//     return res.status(400).json({ error: 'Falta orderLines o está vacío' });
//   }
//   for (const [i, line] of factura.orderLines.entries()) {
//     if (!line.detail || typeof line.detail !== 'string') return res.status(400).json({ error: `Falta detail en orderLines[${i}]` });
//     if (typeof line.unitaryPrice !== 'number' || isNaN(line.unitaryPrice)) return res.status(400).json({ error: `unitaryPrice inválido en orderLines[${i}]` });
//     if (line.tax) {
//       if (typeof line.tax.code !== 'string' || typeof line.tax.rateCode !== 'string' || typeof line.tax.rate !== 'number') {
//         return res.status(400).json({ error: `Información incompleta en tax de orderLines[${i}]` });
//       }
//     }
//   }

//   // receiver (obligatorio excepto para tiquete)
//   if (factura.documentName !== 'TiqueteElectronico') {
//     if (!factura.receiver) return res.status(400).json({ error: 'Falta receiver' });
//     const rc = factura.receiver;
//     if (typeof rc.fullName !== 'string' || !rc.fullName.trim()) return res.status(400).json({ error: 'Falta fullName en receiver' });
//     if (typeof rc.activityCode !== 'string' || !rc.activityCode.trim()) return res.status(400).json({ error: 'Falta activityCode en receiver' });
//     if (!rc.identifier || typeof rc.identifier.type !== 'string' || typeof rc.identifier.id !== 'string') return res.status(400).json({ error: 'Identificador de receiver incompleto' });
//     if (!rc.location || typeof rc.location.province !== 'string' || typeof rc.location.canton !== 'string' ||
//       typeof rc.location.district !== 'string' || typeof rc.location.neighborhood !== 'string' || typeof rc.location.details !== 'string') {
//       return res.status(400).json({ error: 'Ubicación de receiver incompleta' });
//     }
//     if (typeof rc.email !== 'string' || !rc.email.includes('@')) return res.status(400).json({ error: 'Email de receiver inválido' });
//   }

//   // Validación opcional de currencyCode y exchangeRate si existen
//   if (factura.currencyCode && typeof factura.currencyCode !== 'string') {
//     return res.status(400).json({ error: 'currencyCode debe ser string' });
//   }
//   if (factura.exchangeRate && typeof factura.exchangeRate !== 'string') {
//     return res.status(400).json({ error: 'exchangeRate debe ser string' });
//   }

//   // Validación opcional de referenceInfo si existe
//   if (factura.referenceInfo && typeof factura.referenceInfo !== 'object') {
//     return res.status(400).json({ error: 'referenceInfo debe ser un objeto' });
//   }

//   next();
// }


// // function validarEmision(req, res, next) {
// //   const { clave, fecha, emisor, receptor, detalle } = req.body;
// //   if (!clave || typeof clave !== 'string') {
// //     return res.status(400).json({ error: 'Falta o es inválido el campo: clave' });
// //   }
// //   if (!fecha || isNaN(Date.parse(fecha))) {
// //     return res.status(400).json({ error: 'Falta o es inválido el campo: fecha' });
// //   }
// //   if (!emisor || typeof emisor !== 'object') {
// //     return res.status(400).json({ error: 'Falta o es inválido el campo: emisor' });
// //   }
// //   if (!receptor || typeof receptor !== 'object') {
// //     return res.status(400).json({ error: 'Falta o es inválido el campo: receptor' });
// //   }
// //   if (!Array.isArray(detalle) || detalle.length === 0) {
// //     return res.status(400).json({ error: 'Falta o es inválido el campo: detalle' });
// //   }
// //   next();
// // }
// async function enviarFactura(req, res) {
//   try {
//     // 1. Recibe y valida los datos del cliente
//     const datosFactura = req.body; // Debe cumplir con la estructura del SDK

//     // 2. Obtén el token
//     const tokenData = await atv.getToken({
//       username: 'USUARIO', //obtenerlo de variables de entorno
//       password: 'CONTRASEÑA' //obtenerlo de variables de entorno
//     });

//     // 3. Crea el comprobante firmado
//     const { command } = await atv.createDocumentCommand({
//       document: datosFactura,
//       token: tokenData.accessToken,
//       signatureOptions: {
//         buffer: fs.readFileSync('ruta/certificado.p12', 'binary'),
//         password: 'CONTRASEÑA_CERTIFICADO'
//       }
//     });

//     // 4. Envía el comprobante a Hacienda
//     const respuesta = await atv.sendDocument(command);

//     // 5. Devuelve la respuesta al cliente
//     res.json(respuesta);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// }
// // // Middleware para validar datos de validación de factura
// // function validarValidacion(req, res, next) {
// //   const { xml } = req.body;
// //   if (!xml || typeof xml !== 'string' || !xml.startsWith('<')) {
// //     return res.status(400).json({ error: 'Falta o es inválido el campo: xml' });
// //   }
// //   next();
// // }


// // Middleware para validar los datos necesarios para sendConfirmation
// function validarConfirmacion(req, res, next) {
//   const { url } = req.body;
//   const token = req.headers['authorization'];

//   if (!url) {
//     return res.status(400).json({ error: 'Falta el campo url en el body.' });
//   }
//   if (!token || !token.startsWith('bearer ')) {
//     return res.status(400).json({ error: 'Falta el header Authorization con el token.' });
//   }
//   next();
// }

// async function consultarComprobante(req, res, next) {
//   try {
//     // 1. Recibe el token y la URL de consulta (location) desde el request
//     const { token, location } = req.body;

//     if (!token || !location) {
//       return res.status(400).json({ error: 'Faltan token o location' });
//     }

//     // 2. Llama al método de consulta del SDK
//     const respuesta = await atv.sendConfirmation({
//       url: location,
//       headers: {
//         Authorization: 'bearer ' + token,
//         'Content-Type': 'application/json'
//       }
//     });

//     // 3. Devuelve la respuesta de Hacienda al cliente
//     res.json(respuesta);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// }

// // // Middleware para validar datos de envío de factura
// // function validarEnvio(req, res, next) {
// //   const { xml, receptor } = req.body;
// //   if (!xml || typeof xml !== 'string' || !xml.startsWith('<')) {
// //     return res.status(400).json({ error: 'Falta o es inválido el campo: xml' });
// //   }
// //   if (!receptor || typeof receptor !== 'object' || !receptor.tipo || !receptor.numero) {
// //     return res.status(400).json({ error: 'Falta o es inválido el campo: receptor' });
// //   }
// //   next();
// // }

// // function validarFacturaCompleta(req, res, next) {
// //   const factura = req.body;

// //   // Emisor
// //   if (!factura.emitter) return res.status(400).json({ error: 'Falta emitter' });
// //   const em = factura.emitter;
// //   if (!em.fullName || !em.activityCode || !em.identifier || !em.identifier.type || !em.identifier.id || !em.location || !em.location.province || !em.location.canton || !em.location.district || !em.location.neighborhood || !em.location.details || !em.email) {
// //     return res.status(400).json({ error: 'Información incompleta en emitter' });
// //   }

// //   // Campos principales
// //   if (!factura.branch) return res.status(400).json({ error: 'Falta branch' });
// //   if (!factura.terminal) return res.status(400).json({ error: 'Falta terminal' });
// //   if (!factura.documentName) return res.status(400).json({ error: 'Falta documentName' });
// //   if (!factura.providerId) return res.status(400).json({ error: 'Falta providerId' });
// //   if (!factura.countryCode) return res.status(400).json({ error: 'Falta countryCode' });
// //   if (!factura.securityCode) return res.status(400).json({ error: 'Falta securityCode' });
// //   if (!factura.activityCode) return res.status(400).json({ error: 'Falta activityCode' });
// //   if (!factura.consecutiveIdentifier) return res.status(400).json({ error: 'Falta consecutiveIdentifier' });
// //   if (!factura.ceSituation) return res.status(400).json({ error: 'Falta ceSituation' });

// //   // orderLines
// //   if (!factura.orderLines || !Array.isArray(factura.orderLines) || factura.orderLines.length === 0) {
// //     return res.status(400).json({ error: 'Falta orderLines' });
// //   }
// //   for (const line of factura.orderLines) {
// //     if (!line.detail || typeof line.unitaryPrice !== 'number') {
// //       return res.status(400).json({ error: 'Información incompleta en orderLines' });
// //     }
// //     if (line.tax) {
// //       if (!line.tax.code || !line.tax.rateCode || typeof line.tax.rate !== 'number') {
// //         return res.status(400).json({ error: 'Información incompleta en tax de orderLines' });
// //       }
// //     }
// //   }

// //   // conditionSale y paymentMethod
// //   if (!factura.conditionSale) return res.status(400).json({ error: 'Falta conditionSale' });
// //   if (!factura.paymentMethod) return res.status(400).json({ error: 'Falta paymentMethod' });

// //   // receiver (obligatorio excepto para tiquete)
// //   if (factura.documentName !== 'TiqueteElectronico') {
// //     if (!factura.receiver) return res.status(400).json({ error: 'Falta receiver' });
// //     const rc = factura.receiver;
// //     if (!rc.fullName || !rc.activityCode || !rc.identifier || !rc.identifier.type || !rc.identifier.id || !rc.location || !rc.location.province || !rc.location.canton || !rc.location.district || !rc.location.neighborhood || !rc.location.details || !rc.email) {
// //       return res.status(400).json({ error: 'Información incompleta en receiver' });
// //     }
// //   }

// //   next();
// // }

// function _isNonEmptyString(v) {
//   return typeof v === 'string' && v.trim().length > 0;
// }
// function _isNumber(v) {
//   return typeof v === 'number' && !Number.isNaN(v);
// }

// /**
//  * Valida la estructura del nuevo modelo 'document'.
//  * Acepta que el cliente envíe directamente el objeto document en el body
//  * o envíe { document: { ... } }.
//  */
// function validarDocumentoCompleto(req, res, next) {
//   const payload = req.body && req.body.document ? req.body.document : req.body;
//   if (!payload || typeof payload !== 'object') {
//     return res.status(400).json({ error: 'Body inválido. Se espera un objeto document.' });
//   }

//   // Campos string obligatorios de primer nivel
//   const requiredStrings = [
//     'documentName', 'providerId', 'countryCode', 'securityCode',
//     'activityCode', 'consecutiveIdentifier', 'ceSituation', 'branch', 'terminal',
//     'conditionSale', 'paymentMethod'
//   ];
//   for (const f of requiredStrings) {
//     if (!_isNonEmptyString(payload[f])) {
//       return res.status(400).json({ error: `Falta o es inválido el campo '${f}'.` });
//     }
//   }

//   // securityCode: validar longitud (8 dígitos)
//   if (!/^\d{8}$/.test(String(payload.securityCode))) {
//     return res.status(400).json({ error: 'securityCode debe ser una cadena de 8 dígitos.' });
//   }

//   // emitter
//   if (!payload.emitter || typeof payload.emitter !== 'object') {
//     return res.status(400).json({ error: 'Falta el objeto emitter.' });
//   }
//   const em = payload.emitter;
//   if (!_isNonEmptyString(em.fullName)) return res.status(400).json({ error: 'Emitter.fullName es obligatorio.' });
//   if (!em.identifier || !_isNonEmptyString(em.identifier.type) || !_isNonEmptyString(em.identifier.id)) {
//     return res.status(400).json({ error: 'Emitter.identifier.type y emitter.identifier.id son obligatorios.' });
//   }
//   if (!_isNonEmptyString(em.activityCode)) return res.status(400).json({ error: 'Emitter.activityCode es obligatorio.' });
//   if (!em.location || !_isNonEmptyString(em.location.province) || !_isNonEmptyString(em.location.canton) ||
//     !_isNonEmptyString(em.location.district) || !_isNonEmptyString(em.location.neighborhood) || !_isNonEmptyString(em.location.details)) {
//     return res.status(400).json({ error: 'Emitter.location incompleta.' });
//   }

//   // receiver (obligatorio para FacturaElectronica y similares)
//   if (payload.documentName && payload.documentName !== 'TiqueteElectronico') {
//     if (!payload.receiver || typeof payload.receiver !== 'object') {
//       return res.status(400).json({ error: 'Falta el objeto receiver para este tipo de documento.' });
//     }
//     const rc = payload.receiver;
//     if (!_isNonEmptyString(rc.fullName)) return res.status(400).json({ error: 'Receiver.fullName es obligatorio.' });
//     if (!rc.identifier || !_isNonEmptyString(rc.identifier.type) || !_isNonEmptyString(rc.identifier.id)) {
//       return res.status(400).json({ error: 'Receiver.identifier.type y receiver.identifier.id son obligatorios.' });
//     }
//     if (!_isNonEmptyString(rc.activityCode)) return res.status(400).json({ error: 'Receiver.activityCode es obligatorio.' });
//     if (!rc.location || !_isNonEmptyString(rc.location.province) || !_isNonEmptyString(rc.location.canton) ||
//       !_isNonEmptyString(rc.location.district) || !_isNonEmptyString(rc.location.neighborhood) || !_isNonEmptyString(rc.location.details)) {
//       return res.status(400).json({ error: 'Receiver.location incompleta.' });
//     }
//   }

//   // orderLines
//   if (!Array.isArray(payload.orderLines) || payload.orderLines.length === 0) {
//     return res.status(400).json({ error: 'orderLines es obligatorio y debe ser un arreglo con al menos una línea.' });
//   }
//   for (let i = 0; i < payload.orderLines.length; i++) {
//     const line = payload.orderLines[i];
//     if (!_isNonEmptyString(line.detail)) return res.status(400).json({ error: `orderLines[${i}].detail es obligatorio.` });
//     if (!_isNumber(line.unitaryPrice)) return res.status(400).json({ error: `orderLines[${i}].unitaryPrice debe ser número.` });
//     if (!_isNumber(line.quantity) && line.quantity !== undefined) return res.status(400).json({ error: `orderLines[${i}].quantity debe ser número si se provee.` });

//     if (line.tax) {
//       if (!_isNonEmptyString(line.tax.code) || !_isNonEmptyString(line.tax.rateCode) || !_isNumber(line.tax.rate)) {
//         return res.status(400).json({ error: `orderLines[${i}].tax incompleto. 'code', 'rateCode' y 'rate' son obligatorios.` });
//       }
//     }
//   }

//   // Optional: validate optional currencyCode and exchangeRate formats if present
//   if (payload.currencyCode && !_isNonEmptyString(payload.currencyCode)) {
//     return res.status(400).json({ error: 'currencyCode debe ser string si se envía.' });
//   }
//   if (payload.exchangeRate && !_isNonEmptyString(payload.exchangeRate)) {
//     return res.status(400).json({ error: 'exchangeRate debe ser string si se envía.' });
//   }

//   // Si pasa todas las validaciones, dejar avanzar y adjuntar el document validado
//   req.document = payload;
//   next();
// }


// // Middleware para validar que la información de la factura esté completa
// // function validarFacturaCompleta(req, res, next) {
// //   const factura = req.body;

// //   // Validaciones principales
// //   if (!factura.Clave) return res.status(400).json({ error: 'Falta Clave' });
// //   if (!factura.CodigoActividad) return res.status(400).json({ error: 'Falta CodigoActividad' });
// //   if (!factura.NumeroConsecutivo) return res.status(400).json({ error: 'Falta NumeroConsecutivo' });
// //   if (!factura.FechaEmision) return res.status(400).json({ error: 'Falta FechaEmision' });

// //   // Emisor
// //   if (!factura.Emisor || !factura.Emisor.Nombre || !factura.Emisor.Identificacion || !factura.Emisor.Identificacion.Tipo || !factura.Emisor.Identificacion.Numero) {
// //     return res.status(400).json({ error: 'Información de Emisor incompleta' });
// //   }
// //   if (!factura.Emisor.Ubicacion || !factura.Emisor.Ubicacion.Provincia || !factura.Emisor.Ubicacion.Canton || !factura.Emisor.Ubicacion.Distrito || !factura.Emisor.Ubicacion.OtrasSenas) {
// //     return res.status(400).json({ error: 'Ubicación de Emisor incompleta' });
// //   }
// //   if (!factura.Emisor.CorreoElectronico) return res.status(400).json({ error: 'Falta CorreoElectronico de Emisor' });
// //   if (!factura.Emisor.Telefono || !factura.Emisor.Telefono.CodigoPais || !factura.Emisor.Telefono.NumTelefono) {
// //     return res.status(400).json({ error: 'Teléfono de Emisor incompleto' });
// //   }

// //   // Receptor
// //   if (!factura.Receptor || !factura.Receptor.Nombre || !factura.Receptor.Identificacion || !factura.Receptor.Identificacion.Tipo || !factura.Receptor.Identificacion.Numero) {
// //     return res.status(400).json({ error: 'Información de Receptor incompleta' });
// //   }
// //   if (!factura.Receptor.CorreoElectronico) return res.status(400).json({ error: 'Falta CorreoElectronico de Receptor' });

// //   // Condición de venta y medio de pago
// //   if (!factura.CondicionVenta) return res.status(400).json({ error: 'Falta CondicionVenta' });
// //   if (!factura.MedioPago || !Array.isArray(factura.MedioPago) || factura.MedioPago.length === 0) {
// //     return res.status(400).json({ error: 'Falta MedioPago' });
// //   }

// //   // DetalleServicio
// //   if (!factura.DetalleServicio || !factura.DetalleServicio.LineaDetalle || !Array.isArray(factura.DetalleServicio.LineaDetalle) || factura.DetalleServicio.LineaDetalle.length === 0) {
// //     return res.status(400).json({ error: 'Falta DetalleServicio o LineaDetalle' });
// //   }
// //   for (const linea of factura.DetalleServicio.LineaDetalle) {
// //     if (!linea.NumeroLinea || !linea.Cantidad || !linea.UnidadMedida || !linea.Detalle || !linea.Codigo || !linea.PrecioUnitario || !linea.MontoTotal || !linea.SubTotal || !linea.BaseImponible || !linea.MontoTotalLinea) {
// //       return res.status(400).json({ error: 'Información incompleta en LineaDetalle' });
// //     }
// //     if (!linea.Impuesto || !Array.isArray(linea.Impuesto) || linea.Impuesto.length === 0) {
// //       return res.status(400).json({ error: 'Falta Impuesto en LineaDetalle' });
// //     }
// //     for (const imp of linea.Impuesto) {
// //       if (!imp.Codigo || !imp.Tarifa || !imp.Monto) {
// //         return res.status(400).json({ error: 'Información incompleta en Impuesto de LineaDetalle' });
// //       }
// //     }
// //   }

// //   // ResumenFactura
// //   if (!factura.ResumenFactura || !factura.ResumenFactura.CodigoMoneda || !factura.ResumenFactura.TotalServGravados || !factura.ResumenFactura.TotalVenta || !factura.ResumenFactura.TotalImpuesto || !factura.ResumenFactura.TotalComprobante) {
// //     return res.status(400).json({ error: 'Información de ResumenFactura incompleta' });
// //   }

// //   next();
// // }

// /**
//  * Valida los campos mínimos que debe tener un comprobante electrónico
//  * según la versión 4.4 de la factura electrónica de Costa Rica.
//  *
//  * @param {Object} factura - Objeto JSON de la factura.
//  * @returns {string[]} - Lista de errores encontrados (vacía si todo está correcto).
//  */
// // function validarFactura(factura) {
// //   const errores = [];

// //   // -------- 🔹 Nivel raíz --------
// //   if (!factura.Clave || factura.Clave.length !== 50)
// //     errores.push(" 'Clave' obligatoria y debe tener 50 dígitos.");

// //   if (!factura.NumeroConsecutivo || factura.NumeroConsecutivo.length !== 20)
// //     errores.push(" 'NumeroConsecutivo' obligatorio y debe tener 20 dígitos.");

// //   if (!factura.CodigoActividad)
// //     errores.push(" 'CodigoActividad' obligatorio (6 dígitos).");

// //   if (!factura.FechaEmision)
// //     errores.push(" 'FechaEmision' obligatoria (formato ISO8601).");

// //   // -------- 🔹 Emisor --------
// //   if (!factura.Emisor) {
// //     errores.push(" Falta el nodo 'Emisor'.");
// //   } else {
// //     const e = factura.Emisor;
// //     if (!e.Nombre) errores.push(" 'Emisor.Nombre' es obligatorio.");
// //     if (!e.Identificacion?.Tipo || !e.Identificacion?.Numero)
// //       errores.push(" 'Emisor.Identificacion' (Tipo y Numero) son obligatorios.");
// //     if (!e.Ubicacion)
// //       errores.push(" 'Emisor.Ubicacion' obligatoria (Provincia, Cantón, Distrito, OtrasSenas).");
// //     if (!e.CorreoElectronico)
// //       errores.push(" 'Emisor.CorreoElectronico' obligatorio.");
// //   }

// //   // -------- 🔹 Receptor --------
// //   if (!factura.Receptor) {
// //     errores.push(" Falta el nodo 'Receptor'.");
// //   } else {
// //     const r = factura.Receptor;
// //     if (!r.Nombre) errores.push(" 'Receptor.Nombre' es obligatorio.");
// //     if (!r.Identificacion?.Tipo || !r.Identificacion?.Numero)
// //       errores.push(" 'Receptor.Identificacion' (Tipo y Numero) son obligatorios.");
// //   }

// //   // -------- 🔹 Condición y pago --------
// //   if (!factura.CondicionVenta)
// //     errores.push(" 'CondicionVenta' obligatoria ('01' contado, '02' crédito, etc.).");

// //   if (!factura.MedioPago || factura.MedioPago.length === 0)
// //     errores.push(" 'MedioPago' obligatorio (mínimo un método).");

// //   // -------- 🔹 Detalle de servicio --------
// //   if (!factura.DetalleServicio?.LineaDetalle?.length) {
// //     errores.push(" Debe existir al menos una 'LineaDetalle'.");
// //   } else {
// //     factura.DetalleServicio.LineaDetalle.forEach((linea, i) => {
// //       const num = i + 1;
// //       if (!linea.Detalle) errores.push(` Linea ${num}: falta 'Detalle'.`);
// //       if (!linea.PrecioUnitario) errores.push(` Linea ${num}: falta 'PrecioUnitario'.`);
// //       if (!linea.MontoTotal) errores.push(` Linea ${num}: falta 'MontoTotal'.`);
// //       if (!linea.MontoTotalLinea) errores.push(` Linea ${num}: falta 'MontoTotalLinea'.`);
// //       if (!linea.Impuesto || !linea.Impuesto[0]?.Tarifa)
// //         errores.push(` Linea ${num}: no tiene 'Impuesto' definido (si aplica).`);
// //     });
// //   }

// //   // -------- 🔹 ResumenFactura --------
// //   if (!factura.ResumenFactura) {
// //     errores.push(" Falta el nodo 'ResumenFactura'.");
// //   } else {
// //     const r = factura.ResumenFactura;
// //     if (!r.CodigoMoneda) errores.push(" 'ResumenFactura.CodigoMoneda' obligatorio.");
// //     if (!r.TotalComprobante) errores.push(" 'ResumenFactura.TotalComprobante' obligatorio.");
// //   }

// //   // -------- 🔹 Firma digital (verificación previa al envío) --------
// //   if (!factura.Firma && !factura['ds:Signature']) {
// //     errores.push(" No se encontró firma digital. Recuerda firmar antes de enviar a Hacienda.");
// //   }

// //   return errores;
// // }

// // // === Si se ejecuta directamente desde la terminal ===
// // if (require.main === module) {
// //   const path = process.argv[2];
// //   if (!path) {
// //     console.error("Uso: node validarFactura.js ruta/al/archivo.json");
// //     process.exit(1);
// //   }

// //   const data = JSON.parse(fs.readFileSync(path, "utf8"));
// //   const errores = validarFactura(data);

// //   if (errores.length === 0) {
// //     console.log(" La factura cumple con los requisitos mínimos antes del envío.");
// //   } else {
// //     console.warn(" Se encontraron los siguientes problemas:\n");
// //     errores.forEach(e => console.warn(e));
// //   }
// // }

// module.exports = {
//   validarEmision,
//   validarValidacion,
//   validarEnvio,
//  // validarFacturaCompleta,
//   validarConfirmacion,
//   enviarFactura,
//   consultarComprobante,
//   enviarEstructuraFactura,
//   validarEmision,
//   validarDocumentoCompleto
//   //validarFactura
// };
