// Middleware para validar datos de emisión de factura
function validarEmision(req, res, next) {
  const { clave, fecha, emisor, receptor, detalle } = req.body;
  if (!clave || typeof clave !== 'string') {
    return res.status(400).json({ error: 'Falta o es inválido el campo: clave' });
  }
  if (!fecha || isNaN(Date.parse(fecha))) {
    return res.status(400).json({ error: 'Falta o es inválido el campo: fecha' });
  }
  if (!emisor || typeof emisor !== 'object') {
    return res.status(400).json({ error: 'Falta o es inválido el campo: emisor' });
  }
  if (!receptor || typeof receptor !== 'object') {
    return res.status(400).json({ error: 'Falta o es inválido el campo: receptor' });
  }
  if (!Array.isArray(detalle) || detalle.length === 0) {
    return res.status(400).json({ error: 'Falta o es inválido el campo: detalle' });
  }
  next();
}

// Middleware para validar datos de validación de factura
function validarValidacion(req, res, next) {
  const { xml } = req.body;
  if (!xml || typeof xml !== 'string' || !xml.startsWith('<')) {
    return res.status(400).json({ error: 'Falta o es inválido el campo: xml' });
  }
  next();
}

// Middleware para validar datos de envío de factura
function validarEnvio(req, res, next) {
  const { xml, receptor } = req.body;
  if (!xml || typeof xml !== 'string' || !xml.startsWith('<')) {
    return res.status(400).json({ error: 'Falta o es inválido el campo: xml' });
  }
  if (!receptor || typeof receptor !== 'object' || !receptor.tipo || !receptor.numero) {
    return res.status(400).json({ error: 'Falta o es inválido el campo: receptor' });
  }
  next();
}

module.exports = {
  validarEmision,
  validarValidacion,
  validarEnvio
};
