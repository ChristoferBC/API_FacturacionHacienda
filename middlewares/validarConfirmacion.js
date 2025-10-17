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

module.exports = { validarConfirmacion };