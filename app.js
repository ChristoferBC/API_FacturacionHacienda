const express = require('express');
const dotenv = require('dotenv');
const facturacionRoutes = require('./routes/facturacion');

dotenv.config();

const app = express();
app.use(express.json());

app.use('/api/facturacion', facturacionRoutes);

// Ruta de prueba para mostrar una factura de ejemplo
app.get('/factura-ejemplo', (req, res) => {
	const facturaEjemplo = {
		clave: "50601102025000000000000100000000000000000100000001",
		fecha: "2025-10-02T10:00:00",
		emisor: {
			nombre: "Empresa S.A.",
			identificacion: "3101123456",
			tipo: "01",
			telefono: "22223333",
			correo: "info@empresa.com"
		},
		receptor: {
			nombre: "Cliente Ejemplo",
			identificacion: "0101010101",
			tipo: "01",
			telefono: "88889999",
			correo: "cliente@correo.com"
		},
		detalle: [
			{
				descripcion: "Producto A",
				cantidad: 2,
				precio: 1500,
				total: 3000
			},
			{
				descripcion: "Servicio B",
				cantidad: 1,
				precio: 5000,
				total: 5000
			}
		],
		total: 8000
	};
	res.json(facturaEjemplo);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
	console.log(`Servidor corriendo en puerto ${PORT}`);
});