const express = require('express');
const dotenv = require('dotenv');
const facturacionRoutes = require('./routes/facturacion');

dotenv.config();

const app = express();
app.use(express.json());

app.use('/api/facturacion', facturacionRoutes);


const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
	console.log(`Servidor corriendo en puerto ${PORT}`);
});