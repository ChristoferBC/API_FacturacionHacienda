
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

module.exports = {
  validarDocumentoCompleto
};