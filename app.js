// server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

// Importar conexión a base de datos
//const connectDB = require('./config/database');

// Importar rutas
const routes = require('./routes');

// Importar middleware de manejo de errores
const errorHandler = require('./src/middlewares/errorHandler');

const app = express();

// Conectar a la base de datos
//connectDB();

// Middleware de seguridad
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));

// Middleware de parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(morgan('combined'));

// Rutas principales
app.use('/api', routes);

// Middleware de manejo de errores
app.use(errorHandler);

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint no encontrado'
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
  console.log(`📚 Documentación API: http://localhost:${PORT}/api`);
});

module.exports = app;

// // ...existing code...
// require('dotenv').config();
// const express = require('express');
// const path = require('path');

// const facturacionRoutes = require('./routes/facturacion');
// // Try to serve Swagger UI if dependency exists
// try {
//   // eslint-disable-next-line global-require
//   const swaggerUi = require('swagger-ui-express');
//   const swaggerDocument = require('./assets/swagger/swagger.json');
//   app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
//   console.log('Swagger UI available at /api-docs');
// } catch (e) {
//   console.log('swagger-ui-express not installed; skip serving API docs.');
// }

// const app = express();
// app.use(express.json({ limit: '5mb' }));
// app.use(express.urlencoded({ extended: true }));

// // Rutas API
// app.use('/api/facturacion', facturacionRoutes);

// // Carpeta assets (pública si se requiere)
// app.use('/assets', express.static(path.join(__dirname, 'assets')));

// // Middleware global de manejo de errores
// app.use((err, req, res, next) => {
//   console.error(err);
//   res.status(err.status || 500).json({
//     success: false,
//     message: err.message || 'Error interno del servidor'
//   });
// });

// const PORT = process.env.PORT || 8080;
// app.listen(PORT, () => {
//   console.log(`Servidor corriendo en puerto ${PORT}`);
// });

//odule.exports = app;

// const express = require('express');
// const dotenv = require('dotenv');
// const facturacionRoutes = require('./routes/facturacion');

// dotenv.config();

// const app = express();
// app.use(express.json());

// app.use('/api/facturacion', facturacionRoutes);


// const PORT = process.env.PORT || 8080;
// app.listen(PORT, () => {
// 	console.log(`Servidor corriendo en puerto ${PORT}`);
// });