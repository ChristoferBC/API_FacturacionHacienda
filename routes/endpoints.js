// Ejemplo de cómo usar los controladores en las rutas
// src/routes/auth.js (versión simplificada)
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middlewares/auth');
const { validate } = require('../middlewares/validation');

// Rutas públicas
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', loginLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);

// Rutas privadas
router.post('/logout', authMiddleware, authController.logout);
router.get('/me', authMiddleware, authController.getMe);
router.put('/profile', authMiddleware, validate(updateProfileSchema), authController.updateProfile);

module.exports = router;


// // src/routes/documents.js
// const express = require('express');
// const router = express.Router();

// // Importar las clases de servicios
// const FacturaXMLGenerator = require('../services/xmlGenerator');
// const XMLSigner = require('../services/xmlSigner');
// const HaciendaClient = require('../services/haciendaClient');
// const ClaveGenerator = require('../services/claveGenerator');
// const QRGenerator = require('../services/qrGenerator');

// // Importar middlewares
// const authMiddleware = require('../middlewares/auth');
// const validationMiddleware = require('../middlewares/validation');

// // Instanciar las clases de servicios
// const xmlGenerator = new FacturaXMLGenerator();
// const claveGenerator = new ClaveGenerator();
// const haciendaClient = new HaciendaClient();
// const qrGenerator = new QRGenerator();

// // XMLSigner se instancia dinámicamente porque requiere certificado del usuario

// // Middleware de autenticación para todas las rutas
// router.use(authMiddleware);

// // Generar clave
// router.post('/clave', validationMiddleware.validateClaveData, async (req, res) => {
//   try {
//     const { sucursal, terminal, tipoDocumento, numeroConsecutivo } = req.body;
//     const clave = claveGenerator.generateClave(sucursal, terminal, tipoDocumento, numeroConsecutivo);
    
//     res.json({ 
//       success: true,
//       clave,
//       message: 'Clave generada exitosamente'
//     });
//   } catch (error) {
//     console.error('Error generando clave:', error);
//     res.status(500).json({ 
//       success: false,
//       error: error.message 
//     });
//   }
// });

// // Generar XML de factura electrónica
// router.post('/factura/xml', validationMiddleware.validateFacturaData, async (req, res) => {
//   try {
//     const xml = xmlGenerator.generateFacturaElectronica(req.body);
    
//     res.json({ 
//       success: true,
//       xml,
//       message: 'XML de factura generado exitosamente'
//     });
//   } catch (error) {
//     console.error('Error generando XML:', error);
//     res.status(500).json({ 
//       success: false,
//       error: error.message 
//     });
//   }
// });

// // Generar XML de nota de crédito
// router.post('/nota-credito/xml', validationMiddleware.validateNotaCreditoData, async (req, res) => {
//   try {
//     const xml = xmlGenerator.generateNotaCredito(req.body);
    
//     res.json({ 
//       success: true,
//       xml,
//       message: 'XML de nota de crédito generado exitosamente'
//     });
//   } catch (error) {
//     console.error('Error generando XML de nota de crédito:', error);
//     res.status(500).json({ 
//       success: false,
//       error: error.message 
//     });
//   }
// });

// // Generar XML de tiquete electrónico
// router.post('/tiquete/xml', validationMiddleware.validateTiqueteData, async (req, res) => {
//   try {
//     const xml = xmlGenerator.generateTiqueteElectronico(req.body);
    
//     res.json({ 
//       success: true,
//       xml,
//       message: 'XML de tiquete electrónico generado exitosamente'
//     });
//   } catch (error) {
//     console.error('Error generando XML de tiquete:', error);
//     res.status(500).json({ 
//       success: false,
//       error: error.message 
//     });
//   }
// });

// // Firmar XML
// router.post('/firmar', validationMiddleware.validateSignData, async (req, res) => {
//   try {
//     const { xml, certificateId } = req.body;
//     const userId = req.user.id;
    
//     // Obtener el certificado del usuario desde la base de datos
//     const Certificate = require('../models/Certificate');
//     const certificate = await Certificate.findOne({ 
//       _id: certificateId, 
//       userId: userId 
//     });
    
//     if (!certificate) {
//       return res.status(404).json({ 
//         success: false,
//         error: 'Certificado no encontrado' 
//       });
//     }
    
//     // Instanciar XMLSigner con el certificado específico
//     const xmlSigner = new XMLSigner(
//       certificate.certificatePath,
//       certificate.privateKeyPath,
//       certificate.password
//     );
    
//     const signedXml = await xmlSigner.signXML(xml);
    
//     res.json({ 
//       success: true,
//       signedXml,
//       message: 'XML firmado exitosamente'
//     });
//   } catch (error) {
//     console.error('Error firmando XML:', error);
//     res.status(500).json({ 
//       success: false,
//       error: error.message 
//     });
//   }
// });

// // Obtener token de Hacienda
// router.post('/token', validationMiddleware.validateTokenRequest, async (req, res) => {
//   try {
//     const { username, password } = req.body;
//     const token = await haciendaClient.getAuthToken(username, password);
    
//     res.json({ 
//       success: true,
//       token,
//       expiresIn: 3600, // 1 hora
//       message: 'Token obtenido exitosamente'
//     });
//   } catch (error) {
//     console.error('Error obteniendo token:', error);
//     res.status(500).json({ 
//       success: false,
//       error: error.message 
//     });
//   }
// });

// // Refrescar token de Hacienda
// router.post('/token/refresh', validationMiddleware.validateRefreshToken, async (req, res) => {
//   try {
//     const { refreshToken } = req.body;
//     const newToken = await haciendaClient.refreshAuthToken(refreshToken);
    
//     res.json({ 
//       success: true,
//       token: newToken,
//       expiresIn: 3600,
//       message: 'Token refrescado exitosamente'
//     });
//   } catch (error) {
//     console.error('Error refrescando token:', error);
//     res.status(500).json({ 
//       success: false,
//       error: error.message 
//     });
//   }
// });

// // Enviar documento a Hacienda
// router.post('/enviar', validationMiddleware.validateSendDocument, async (req, res) => {
//   try {
//     const { xml, token, tipoDocumento } = req.body;
//     const result = await haciendaClient.sendDocument(xml, token, tipoDocumento);
    
//     // Guardar el resultado en la base de datos para tracking
//     const Document = require('../models/Document');
//     await Document.create({
//       userId: req.user.id,
//       clave: haciendaClient.extractClaveFromXML(xml),
//       tipoDocumento,
//       xml,
//       estadoEnvio: result.status,
//       respuestaHacienda: result,
//       fechaEnvio: new Date()
//     });
    
//     res.json({ 
//       success: true,
//       result,
//       message: 'Documento enviado exitosamente a Hacienda'
//     });
//   } catch (error) {
//     console.error('Error enviando documento:', error);
//     res.status(500).json({ 
//       success: false,
//       error: error.message 
//     });
//   }
// });

// // Consultar estado de documento en Hacienda
// router.get('/consultar/:clave', validationMiddleware.validateConsulta, async (req, res) => {
//   try {
//     const { clave } = req.params;
//     const token = req.headers.authorization?.replace('Bearer ', '');
    
//     if (!token) {
//       return res.status(401).json({ 
//         success: false,
//         error: 'Token de autorización requerido' 
//       });
//     }
    
//     const result = await haciendaClient.consultarEstado(clave, token);
    
//     // Actualizar el estado en la base de datos
//     const Document = require('../models/Document');
//     await Document.updateOne(
//       { clave, userId: req.user.id },
//       { 
//         estadoActual: result.estado,
//         ultimaConsulta: new Date(),
//         respuestaConsulta: result
//       }
//     );
    
//     res.json({ 
//       success: true,
//       result,
//       message: 'Estado consultado exitosamente'
//     });
//   } catch (error) {
//     console.error('Error consultando estado:', error);
//     res.status(500).json({ 
//       success: false,
//       error: error.message 
//     });
//   }
// });

// // Generar código QR para documento
// router.post('/qr', validationMiddleware.validateQRData, async (req, res) => {
//   try {
//     const { clave, fechaEmision, emisorTipoId, emisorNumeroId, receptorTipoId, receptorNumeroId, totalComprobante } = req.body;
    
//     const qrData = {
//       clave,
//       fechaEmision,
//       emisorTipoId,
//       emisorNumeroId,
//       receptorTipoId,
//       receptorNumeroId,
//       totalComprobante
//     };
    
//     const qrCode = await qrGenerator.generateQR(qrData);
    
//     res.json({ 
//       success: true,
//       qrCode,
//       qrString: qrGenerator.generateQRString(qrData),
//       message: 'Código QR generado exitosamente'
//     });
//   } catch (error) {
//     console.error('Error generando QR:', error);
//     res.status(500).json({ 
//       success: false,
//       error: error.message 
//     });
//   }
// });

// // Convertir XML a Base64
// router.post('/xml-to-base64', validationMiddleware.validateXMLData, async (req, res) => {
//   try {
//     const { xml } = req.body;
//     const XmlToBase64 = require('../services/xmlToBase64');
//     const xmlToBase64Service = new XmlToBase64();
    
//     const base64 = xmlToBase64Service.convert(xml);
    
//     res.json({ 
//       success: true,
//       base64,
//       message: 'XML convertido a Base64 exitosamente'
//     });
//   } catch (error) {
//     console.error('Error convirtiendo XML a Base64:', error);
//     res.status(500).json({ 
//       success: false,
//       error: error.message 
//     });
//   }
// });

// // Obtener historial de documentos del usuario
// router.get('/historial', async (req, res) => {
//   try {
//     const { page = 1, limit = 10, tipoDocumento, estado } = req.query;
//     const Document = require('../models/Document');
    
//     const filter = { userId: req.user.id };
//     if (tipoDocumento) filter.tipoDocumento = tipoDocumento;
//     if (estado) filter.estadoActual = estado;
    
//     const documents = await Document.find(filter)
//       .select('-xml') // Excluir XML del listado por performance
//       .sort({ fechaEnvio: -1 })
//       .limit(limit * 1)
//       .skip((page - 1) * limit)
//       .exec();
    
//     const total = await Document.countDocuments(filter);
    
//     res.json({
//       success: true,
//       documents,
//       pagination: {
//         page: parseInt(page),
//         limit: parseInt(limit),
//         total,
//         pages: Math.ceil(total / limit)
//       },
//       message: 'Historial obtenido exitosamente'
//     });
//   } catch (error) {
//     console.error('Error obteniendo historial:', error);
//     res.status(500).json({ 
//       success: false,
//       error: error.message 
//     });
//   }
// });

// // Obtener documento específico por clave
// router.get('/documento/:clave', async (req, res) => {
//   try {
//     const { clave } = req.params;
//     const Document = require('../models/Document');
    
//     const document = await Document.findOne({ 
//       clave, 
//       userId: req.user.id 
//     });
    
//     if (!document) {
//       return res.status(404).json({ 
//         success: false,
//         error: 'Documento no encontrado' 
//       });
//     }
    
//     res.json({ 
//       success: true,
//       document,
//       message: 'Documento obtenido exitosamente'
//     });
//   } catch (error) {
//     console.error('Error obteniendo documento:', error);
//     res.status(500).json({ 
//       success: false,
//       error: error.message 
//     });
//   }
// });

// module.exports = router;