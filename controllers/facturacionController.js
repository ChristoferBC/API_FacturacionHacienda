
const {getAccessToken} = require('../services/idpService')
const fs = require('fs');
const axios = require('axios');
const path = require('path');


let ATV;
try {
  // try require SDK if available
  ATV = require('@facturacr/atv-sdk');
} catch (e) {
  ATV = null;
}

/**
 * emitirFactura
 * Usa req.document (set por validarDocumentoCompleto).
 * Si SDK está presente, intenta generar/firman XML. Si no, simula la generación.
 */
async function emitirFactura(req, res) {
  try {
    const documentObj = req.document || (req.body && req.body.document) || req.body;
    if (!documentObj) {
      return res.status(400).json({ success: false, message: 'No se recibió documento válido.' });
    }

    // Validación crítica extra (redundante pero segura)
    if (!documentObj.documentName || !documentObj.providerId) {
      return res.status(400).json({ success: false, message: 'documentName y providerId son obligatorios.' });
    }

    // Intentar usar SDK si está instalado
    if (ATV && typeof ATV.genXML === 'function') {
      // ejemplo con SDK real (ajustar según API del SDK)
      const atv = new ATV({}, process.env.HACIENDA_PRODUCTION === 'true' ? 'prod' : 'stg');
      const { xml, extra } = await atv.genXML(documentObj); // ajustar si el SDK retorna distinto
      return res.status(200).json({ success: true, xml: xml || extra?.xml || null });
    }

    // SDK no disponible -> generar JSON simulando XML firmado (modo desarrollo)
    const simulatedXml = `<FacturaElectronica><Clave>${documentObj.consecutiveIdentifier}</Clave><Emisor>${documentObj.emitter.fullName}</Emisor><Receptor>${documentObj.receiver?.fullName || ''}</Receptor></FacturaElectronica>`;
    return res.status(200).json({
      success: true,
      message: 'Simulación: XML generado (SDK no instalado).',
      xml: simulatedXml
    });
  } catch (err) {
    console.error('emitirFactura error:', err);
    return res.status(500).json({ success: false, message: 'Error al emitir factura.', error: err.message });
  }
}

/**
 * confirmarComprobante
 * Usa atv.sendConfirmation con body.url y header Authorization.
 */
async function confirmarComprobante(req, res) {
  try {
    const { url } = req.body;
    const tokenHeader = req.headers['authorization'] || req.headers['Authorization'];
    const token = tokenHeader.replace(/bearer\s+/i, '');

    if (!ATV || typeof ATV.prototype.sendConfirmation !== 'function') {
      // Simulación si SDK no disponible: hacer una petición simple y devolver resultado
      const resp = await axios.post(url, {}, {
        headers: {
          Authorization: 'bearer ' + token,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });
      return res.status(200).json({ success: true, data: resp.data });
    }

    // Uso real del SDK (ajustar según implementación del SDK)
    const atv = new ATV({}, process.env.HACIENDA_PRODUCTION === 'true' ? 'prod' : 'stg');
    const result = await atv.sendConfirmation({
      url,
      headers: {
        Authorization: 'bearer ' + token,
        'Content-Type': 'application/json'
      }
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error('confirmarComprobante error:', err);
    return res.status(500).json({ success: false, message: 'Error en confirmación.', error: err.message });
  }
}

/**
 * consultarContribuyente
 * Consume endpoint público de Hacienda para consulta AE.
 */
async function consultarContribuyente(req, res) {
  try {
    const { identificacion } = req.query;
    if (!identificacion) {
      return res.status(400).json({ success: false, message: 'Parametro identificacion es obligatorio.' });
    }
    const url = `https://api.hacienda.go.cr/fe/ae?identificacion=${encodeURIComponent(identificacion)}`;
    const respuesta = await axios.get(url, { timeout: 5000 });
    return res.status(200).json({ success: true, data: respuesta.data });
  } catch (err) {
    console.error('consultarContribuyente error:', err);
    return res.status(500).json({ success: false, message: 'No se pudo consultar contribuyente.', error: err.message });
  }
}

/**
 * saveDocumentExample
 * Guarda req.document (validado) en DOCUMENT_EXAMPLE_PATH (env) o assets/ejemplos/document_example.json
 */
async function saveDocumentExample(req, res) {
  try {
    const documentObj = req.document || (req.body && req.body.document) || req.body;
    if (!documentObj || typeof documentObj !== 'object') {
      return res.status(400).json({ success: false, message: 'No se recibió document válido para guardar.' });
    }

    const configuredPath = process.env.DOCUMENT_EXAMPLE_PATH || './assets/ejemplos/document_example.json';
    const targetPath = path.isAbsolute(configuredPath) ? configuredPath : path.join(process.cwd(), configuredPath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, JSON.stringify({ document: documentObj }, null, 2), 'utf8');

    return res.status(200).json({ success: true, message: 'Documento guardado correctamente.', path: targetPath });
  } catch (err) {
    console.error('saveDocumentExample error:', err);
    return res.status(500).json({ success: false, message: 'Error guardando documento de ejemplo.', error: err.message });
  }
}

module.exports = {
  emitirFactura,
  confirmarComprobante,
  consultarContribuyente,
  saveDocumentExample
};

module.exports.sendXmlAttachment = sendXmlAttachment;

/**
 * Descargar XML generado como attachment
 * Se espera recibir { xml: "<FacturaElectronica>...</FacturaElectronica>" }
 */
async function sendXmlAttachment(req, res) {
  try {
    const xml = req.body.xml || (req.body && req.body.document && req.body.document.xml);
    if (!xml) return res.status(400).json({ success: false, message: 'Se requiere campo xml en el body.' });

    const fileName = `factura_${Date.now()}.xml`;
    const tmpPath = path.join(process.cwd(), 'assets', 'ejemplos', fileName);
    fs.writeFileSync(tmpPath, xml, 'utf8');
    res.download(tmpPath, fileName, err => {
      try { fs.unlinkSync(tmpPath); } catch (e) {}
      if (err) console.error('Error download:', err);
    });
  } catch (err) {
    console.error('sendXmlAttachment error:', err);
    return res.status(500).json({ success: false, message: 'Error preparando descarga.', error: err.message });
  }
}




// Configuración del SDK (puedes usar variables de entorno)
// const atv = new ATV({
//   username: process.env.HACIENDA_USERNAME,
//   password: process.env.HACIENDA_PASSWORD,
//   certificate: process.env.HACIENDA_CERTIFICATE,
//   key: process.env.HACIENDA_KEY,
//   production: false // Cambia a true en producción
// });

// /**
//  * Consulta información de un contribuyente en el API de Hacienda.
//  */
// async function consultarContribuyente(req, res) {
//   try {
//     const { identificacion } = req.query;
//     if (!identificacion) {
//       return res.status(400).json({ success: false, message: 'Debe enviar el parámetro identificacion.' });
//     }

//     const url = `https://api.hacienda.go.cr/fe/ae?identificacion=${identificacion}`;
//     const respuesta = await axios.get(url);

//     return res.status(200).json({
//       success: true,
//       data: respuesta.data
//     });
//   } catch (error) {
//     console.error('Error al consultar contribuyente:', error.message);
//     return res.status(500).json({
//       success: false,
//       message: 'No se pudo consultar el contribuyente.',
//       error: error.message
//     });
//   }
// }

// // Validación básica de campos requeridos
// function validarCampos(obj, campos) {
//   for (const campo of campos) {
//     if (!obj[campo]) {
//       return campo;
//     }
//   }
//   return null;
// }

// // Ejemplo de formato esperado para emisión
// // {
// //   "clave": "clave-factura",
// //   "fecha": "2025-09-30T12:00:00",
// //   "emisor": { ... },
// //   "receptor": { ... },
// //   "detalle": [ ... ]
// // }
// // exports.emitirFactura = async (req, res) => {
// //   const requeridos = ["clave", "fecha", "emisor", "receptor", "detalle"];
// //   const falta = validarCampos(req.body, requeridos);
// //   if (falta) {
// //     return res.status(400).json({ error: `Falta el campo requerido: ${falta}` });
// //   }
// //   try {
// //     const factura = req.body;
// //     // Usar el método correcto para generar el XML
// //     const xml = await atv.createDocumentCommand(factura);
// //     res.json({ xml });
// //   } catch (error) {
// //     res.status(500).json({ error: error.message });
// //   }
// // };
// exports.emitirFactura = async (req, res) => {
//   const requeridos = ["clave", "fecha", "emisor", "receptor", "detalle"];
//   const falta = validarCampos(req.body, requeridos);
//   if (falta) {
//     return res.status(400).json({ error: `Falta el campo requerido: ${falta}` });
//   }
//   try {
//     const factura = req.body;
//     // Cargar certificado y contraseña (puedes obtenerlos de variables de entorno o archivos)
//   const certificadoP12 = fs.readFileSync(process.env.HACIENDA_CERTIFICATE);
//     const passwordCertificado = process.env.CERT_PASSWORD;

//     const token = await getAccessToken();

//     // Construir el input para el SDK
//     const input = {
//       document: factura,
//       token: token,
//       // token: req.headers.authorization, // OMITIDO para emulación
//       signatureOptions: {
//         buffer: certificadoP12,
//         password: passwordCertificado
//       }
//     };

//     // Emular la generación y firma del XML (sin token)
//     // Si el SDK requiere el token, puedes devolver un XML de ejemplo
//     let xmlEjemplo = '<FacturaElectronica>...ejemplo...</FacturaElectronica>';
//     let resultado;
//     try {
//       resultado = await atv.createDocumentCommand(input);
//       xmlEjemplo = resultado.extraData.xml || xmlEjemplo;
//     } catch (err) {
//       // Si falla por falta de token, devolver XML de ejemplo
//     }
//     res.json({ xml: xmlEjemplo });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// // Ejemplo de formato esperado para validación
// // {
// //   "xml": "<FacturaElectronica>...</FacturaElectronica>"
// // }
// exports.validarFactura = async (req, res) => {
//   if (!req.body.xml) {
//     return res.status(400).json({ error: "Falta el campo requerido: xml" });
//   }
//   try {
//     const xml = req.body.xml;
//     const resultado = await atv.validateDocument(xml);
//     res.json(resultado);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// // Ejemplo de formato esperado para envío
// // {
// //   "xml": "<FacturaElectronica>...</FacturaElectronica>",
// //   "receptor": { "tipo": "01", "numero": "123456789" }
// // }
// exports.enviarFactura = async (req, res) => {
//   const requeridos = ["xml", "receptor"];
//   const falta = validarCampos(req.body, requeridos);
//   if (falta) {
//     return res.status(400).json({ error: `Falta el campo requerido: ${falta}` });
//   }
//   try {
//     const { xml, receptor } = req.body;

//     const token = await getAccessToken();

//     const resultado = await atv.sendDocument(xml, receptor, { token });
//     res.json(resultado);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// // Ejemplo de consulta: GET /api/facturacion/consultar/:clave
// exports.consultarFactura = async (req, res) => {
//   if (!req.params.clave) {
//     return res.status(400).json({ error: "Falta el parámetro: clave" });
//   }
//   try {
//     const clave = req.params.clave;

//     const token = await getAccessToken();

//     const resultado = await atv.getDocumentStatus(clave, { token });
//     res.json(resultado);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };
// /**
//  * Emite una factura electrónica.
//  * Valida datos críticos antes de llamar al SDK y maneja errores globalmente.
//  */
// async function emitirFactura(req, res) {
//   try {
//     const factura = req.body;

//     // Validación adicional de datos críticos
//     if (!factura.documentName || typeof factura.documentName !== 'string') {
//       return res.status(400).json({ success: false, message: 'documentName es obligatorio y debe ser string.' });
//     }
//     if (!factura.emitter || !factura.emitter.identifier || !factura.emitter.identifier.id) {
//       return res.status(400).json({ success: false, message: 'El emisor y su identificador son obligatorios.' });
//     }
//     if (!factura.orderLines || !Array.isArray(factura.orderLines) || factura.orderLines.length === 0) {
//       return res.status(400).json({ success: false, message: 'Debe incluir al menos una línea de detalle.' });
//     }

//     // Lógica de emisión usando el SDK
//     // (Ajusta según el método real de tu SDK)
//     const resultado = await atv.genXML(factura);

//     return res.status(200).json({
//       success: true,
//       message: 'Factura emitida correctamente.',
//       data: resultado
//     });
//   } catch (error) {
//     console.error('Error al emitir factura:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Ocurrió un error al emitir la factura.',
//       error: error.message
//     });
//   }
// }

// /**
//  * Confirma un comprobante electrónico ante Hacienda.
//  * Manejo global de errores.
//  */
// async function confirmarComprobante(req, res) {
//   try {
//     const { url } = req.body;
//     const token = req.headers['authorization']?.replace('bearer ', '');

//     if (!url) {
//       return res.status(400).json({ success: false, message: 'El campo url es obligatorio.' });
//     }
//     if (!token) {
//       return res.status(400).json({ success: false, message: 'El token de autorización es obligatorio.' });
//     }

//     // Lógica de confirmación usando el SDK
//     const resultado = await atv.sendConfirmation({
//       url,
//       headers: {
//         Authorization: 'bearer ' + token,
//         'Content-Type': 'application/json'
//       }
//     });

//     return res.status(200).json({
//       success: true,
//       message: 'Comprobante confirmado correctamente.',
//       data: resultado
//     });
//   } catch (error) {
//     console.error('Error al confirmar comprobante:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Ocurrió un error al confirmar el comprobante.',
//       error: error.message
//     });
//   }
// }

// module.exports = {
//   emitirFactura,
//   confirmarComprobante,
//   consultarContribuyente
// };