const express = require('express');
const router = express.Router();
const facturacionController = require('../controllers/facturacionController');
const { validarEmision, validarValidacion, validarEnvio } = require('../middlewares/validacionFactura');

// Emisión de factura
router.post('/emitir', validarEmision, facturacionController.emitirFactura);

// Validación de factura
router.post('/validar', validarValidacion, facturacionController.validarFactura);

// Envío de factura
router.post('/enviar', validarEnvio, facturacionController.enviarFactura);

// Consulta de factura
router.get('/consultar/:clave', facturacionController.consultarFactura);

module.exports = router;
