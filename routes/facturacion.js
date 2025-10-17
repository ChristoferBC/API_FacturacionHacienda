const express = require('express');
const router = express.Router();

const facturacionController = require('../controllers/facturacionController');
const { validarDocumentoCompleto } = require('../middlewares/validarDocumentoCompleto');
const { validarConfirmacion } = require('../middlewares/validarConfirmacion');
const { enviarEstructuraFactura } = require('../middlewares/enviarEstructuraFactura');
const { sendXmlAttachment } = require('../controllers/facturacionController');

// Obtener estructura de factura (middleware que responde)
router.get('/estructura-factura', enviarEstructuraFactura);

// Emitir factura (valida y procesa)
router.post('/emitir', validarDocumentoCompleto, facturacionController.emitirFactura);

// Guardar ejemplo de document validado en assets
router.post('/guardar-ejemplo', validarDocumentoCompleto, facturacionController.saveDocumentExample);

// Descargar XML generado como attachment
router.post('/download-xml', sendXmlAttachment);

// Confirmar comprobante (sendConfirmation)
router.post('/confirmar', validarConfirmacion, facturacionController.confirmarComprobante);

// Consultar contribuyente (Hacienda AE)
router.get('/contribuyente', facturacionController.consultarContribuyente);

module.exports = router;

// const express = require('express');
// const router = express.Router();
// const facturacionController = require('../controllers/facturacionController');
// const { validarEmision, validarValidacion, validarEnvio, validarFacturaCompleta, validarConfirmacion,
//      enviarFactura, consultarComprobante, enviarEstructuraFactura, validarEmision, validarDocumentoCompleto } = require('../middlewares/validacionFactura');

// // Endpoint para obtener la estructura necesaria para emitir facturas usando un middleware
// router.get('/estructura-factura', enviarEstructuraFactura);

// // Emisión de factura
// router.post('/emitir', validarEmision, validarDocumentoCompleto, facturacionController.emitirFactura);

// // Validación de factura
// router.post('/validar', validarConfirmacion, facturacionController.validarFactura);

// // Envío de factura
// router.post('/enviar', enviarFactura, facturacionController.enviarFactura);

// // Consulta de factura
// router.get('/consultar/:clave', consultarComprobante,facturacionController.consultarFactura);

// // Endpoint para consultar contribuyente en Hacienda
// router.get('/contribuyente', facturacionController.consultarContribuyente);

// module.exports = router;
