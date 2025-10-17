const { document } = require('../models/factura');

function enviarEstructuraFactura(req, res, next) {
  res.json({ success: true, example: document });
}

module.exports = { enviarEstructuraFactura };