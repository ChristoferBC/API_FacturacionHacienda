const express = require('express');
const router = express.Router();
const facturacionController = require('../controllers/facturacionController');
const { validarEmision, validarValidacion, validarEnvio, validarFacturaCompleta, validarConfirmacion,
     enviarFactura, consultarComprobante, enviarEstructuraFactura, validarEmision } = require('../middlewares/validacionFactura');

// Endpoint para obtener la estructura necesaria para emitir facturas usando un middleware
router.get('/estructura-factura', enviarEstructuraFactura);

// Emisión de factura
router.post('/emitir', validarEmision, validarFacturaCompleta, facturacionController.emitirFactura);

// Validación de factura
router.post('/validar', validarConfirmacion, facturacionController.validarFactura);

// Envío de factura
router.post('/enviar', enviarFactura, facturacionController.enviarFactura);

// Consulta de factura
router.get('/consultar/:clave', consultarComprobante,facturacionController.consultarFactura);

// Endpoint para consultar contribuyente en Hacienda
router.get('/contribuyente', facturacionController.consultarContribuyente);

module.exports = router;
