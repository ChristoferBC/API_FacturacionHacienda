// src/routes/index.js
const express = require('express');
const router = express.Router();

// Importar todas las rutas
const authRoutes = require('./auth');
const documentRoutes = require('./documents');
const userRoutes = require('./users');
const certificateRoutes = require('./certificates');

// Rutas base
router.get('/', (req, res) => {
  res.json({
    message: 'API Hacienda Costa Rica - Node.js',
    version: '1.0.0',
    status: 'active',
    endpoints: {
      auth: '/api/auth',
      documents: '/api/documents',
      users: '/api/users',
      certificates: '/api/certificates'
    }
  });
});

// Montar las rutas
router.use('/auth', authRoutes);
router.use('/documents', documentRoutes);
router.use('/users', userRoutes);
router.use('/certificates', certificateRoutes);

module.exports = router;