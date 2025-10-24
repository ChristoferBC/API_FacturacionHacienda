//models/Document.js
const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  // Relaciones
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  certificateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Certificate',
    required: false
  },

  // Información básica del documento
  clave: {
    type: String,
    required: true,
    unique: true,
    length: 50,
    index: true
  },

  tipoDocumento: {
    type: String,
    required: true,
    enum: ['01', '02', '03', '04', '05', '06', '07', '08', '09']
  },

  numeroConsecutivo: {
    type: String,
    required: true,
    maxlength: 20
  },

  fechaEmision: {
    type: Date,
    required: true
  },

  // XML del documento
  xml: {
    type: String,
    required: true,
    select: false // No incluir por defecto por tamaño
  },

  xmlFirmado: {
    type: String,
    select: false
  },

  // Estado del documento
  estadoEnvio: {
    type: String,
    enum: ['pendiente', 'enviado', 'aceptado', 'rechazado', 'error'],
    default: 'pendiente'
  },

  estadoActual: {
    type: String,
    default: null
  },

  // Información de envío a Hacienda
  fechaEnvio: {
    type: Date,
    default: null
  },

  respuestaHacienda: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },

  ultimaConsulta: {
    type: Date,
    default: null
  },

  respuestaConsulta: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices
documentSchema.index({ userId: 1, tipoDocumento: 1 });
documentSchema.index({ fechaEmision: -1 });
documentSchema.index({ estadoEnvio: 1 });

module.exports = mongoose.model('Document', documentSchema);