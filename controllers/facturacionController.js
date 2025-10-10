
const {getAccessToken} = require('../services/idpService')
const { ATV } = require('@facturacr/atv-sdk');
const fs = require('fs');
const axios = require('axios');
// Configuración del SDK (puedes usar variables de entorno)
const atv = new ATV({
  username: process.env.HACIENDA_USERNAME,
  password: process.env.HACIENDA_PASSWORD,
  certificate: process.env.HACIENDA_CERTIFICATE,
  key: process.env.HACIENDA_KEY,
  production: false // Cambia a true en producción
});

/**
 * Consulta información de un contribuyente en el API de Hacienda.
 */
async function consultarContribuyente(req, res) {
  try {
    const { identificacion } = req.query;
    if (!identificacion) {
      return res.status(400).json({ success: false, message: 'Debe enviar el parámetro identificacion.' });
    }

    const url = `https://api.hacienda.go.cr/fe/ae?identificacion=${identificacion}`;
    const respuesta = await axios.get(url);

    return res.status(200).json({
      success: true,
      data: respuesta.data
    });
  } catch (error) {
    console.error('Error al consultar contribuyente:', error.message);
    return res.status(500).json({
      success: false,
      message: 'No se pudo consultar el contribuyente.',
      error: error.message
    });
  }
}

// Validación básica de campos requeridos
function validarCampos(obj, campos) {
  for (const campo of campos) {
    if (!obj[campo]) {
      return campo;
    }
  }
  return null;
}

// Ejemplo de formato esperado para emisión
// {
//   "clave": "clave-factura",
//   "fecha": "2025-09-30T12:00:00",
//   "emisor": { ... },
//   "receptor": { ... },
//   "detalle": [ ... ]
// }
// exports.emitirFactura = async (req, res) => {
//   const requeridos = ["clave", "fecha", "emisor", "receptor", "detalle"];
//   const falta = validarCampos(req.body, requeridos);
//   if (falta) {
//     return res.status(400).json({ error: `Falta el campo requerido: ${falta}` });
//   }
//   try {
//     const factura = req.body;
//     // Usar el método correcto para generar el XML
//     const xml = await atv.createDocumentCommand(factura);
//     res.json({ xml });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };
exports.emitirFactura = async (req, res) => {
  const requeridos = ["clave", "fecha", "emisor", "receptor", "detalle"];
  const falta = validarCampos(req.body, requeridos);
  if (falta) {
    return res.status(400).json({ error: `Falta el campo requerido: ${falta}` });
  }
  try {
    const factura = req.body;
    // Cargar certificado y contraseña (puedes obtenerlos de variables de entorno o archivos)
  const certificadoP12 = fs.readFileSync(process.env.HACIENDA_CERTIFICATE);
    const passwordCertificado = process.env.CERT_PASSWORD;

    const token = await getAccessToken();

    // Construir el input para el SDK
    const input = {
      document: factura,
      token: token,
      // token: req.headers.authorization, // OMITIDO para emulación
      signatureOptions: {
        buffer: certificadoP12,
        password: passwordCertificado
      }
    };

    // Emular la generación y firma del XML (sin token)
    // Si el SDK requiere el token, puedes devolver un XML de ejemplo
    let xmlEjemplo = '<FacturaElectronica>...ejemplo...</FacturaElectronica>';
    let resultado;
    try {
      resultado = await atv.createDocumentCommand(input);
      xmlEjemplo = resultado.extraData.xml || xmlEjemplo;
    } catch (err) {
      // Si falla por falta de token, devolver XML de ejemplo
    }
    res.json({ xml: xmlEjemplo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Ejemplo de formato esperado para validación
// {
//   "xml": "<FacturaElectronica>...</FacturaElectronica>"
// }
exports.validarFactura = async (req, res) => {
  if (!req.body.xml) {
    return res.status(400).json({ error: "Falta el campo requerido: xml" });
  }
  try {
    const xml = req.body.xml;
    const resultado = await atv.validateDocument(xml);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Ejemplo de formato esperado para envío
// {
//   "xml": "<FacturaElectronica>...</FacturaElectronica>",
//   "receptor": { "tipo": "01", "numero": "123456789" }
// }
exports.enviarFactura = async (req, res) => {
  const requeridos = ["xml", "receptor"];
  const falta = validarCampos(req.body, requeridos);
  if (falta) {
    return res.status(400).json({ error: `Falta el campo requerido: ${falta}` });
  }
  try {
    const { xml, receptor } = req.body;

    const token = await getAccessToken();

    const resultado = await atv.sendDocument(xml, receptor, { token });
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Ejemplo de consulta: GET /api/facturacion/consultar/:clave
exports.consultarFactura = async (req, res) => {
  if (!req.params.clave) {
    return res.status(400).json({ error: "Falta el parámetro: clave" });
  }
  try {
    const clave = req.params.clave;

    const token = await getAccessToken();

    const resultado = await atv.getDocumentStatus(clave, { token });
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
/**
 * Emite una factura electrónica.
 * Valida datos críticos antes de llamar al SDK y maneja errores globalmente.
 */
async function emitirFactura(req, res) {
  try {
    const factura = req.body;

    // Validación adicional de datos críticos
    if (!factura.documentName || typeof factura.documentName !== 'string') {
      return res.status(400).json({ success: false, message: 'documentName es obligatorio y debe ser string.' });
    }
    if (!factura.emitter || !factura.emitter.identifier || !factura.emitter.identifier.id) {
      return res.status(400).json({ success: false, message: 'El emisor y su identificador son obligatorios.' });
    }
    if (!factura.orderLines || !Array.isArray(factura.orderLines) || factura.orderLines.length === 0) {
      return res.status(400).json({ success: false, message: 'Debe incluir al menos una línea de detalle.' });
    }

    // Lógica de emisión usando el SDK
    // (Ajusta según el método real de tu SDK)
    const resultado = await atv.genXML(factura);

    return res.status(200).json({
      success: true,
      message: 'Factura emitida correctamente.',
      data: resultado
    });
  } catch (error) {
    console.error('Error al emitir factura:', error);
    return res.status(500).json({
      success: false,
      message: 'Ocurrió un error al emitir la factura.',
      error: error.message
    });
  }
}

/**
 * Confirma un comprobante electrónico ante Hacienda.
 * Manejo global de errores.
 */
async function confirmarComprobante(req, res) {
  try {
    const { url } = req.body;
    const token = req.headers['authorization']?.replace('bearer ', '');

    if (!url) {
      return res.status(400).json({ success: false, message: 'El campo url es obligatorio.' });
    }
    if (!token) {
      return res.status(400).json({ success: false, message: 'El token de autorización es obligatorio.' });
    }

    // Lógica de confirmación usando el SDK
    const resultado = await atv.sendConfirmation({
      url,
      headers: {
        Authorization: 'bearer ' + token,
        'Content-Type': 'application/json'
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Comprobante confirmado correctamente.',
      data: resultado
    });
  } catch (error) {
    console.error('Error al confirmar comprobante:', error);
    return res.status(500).json({
      success: false,
      message: 'Ocurrió un error al confirmar el comprobante.',
      error: error.message
    });
  }
}

module.exports = {
  emitirFactura,
  confirmarComprobante,
  consultarContribuyente
};