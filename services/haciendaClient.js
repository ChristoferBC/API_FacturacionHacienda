const axios = require('axios');

class HaciendaClient {
  constructor() {
    this.baseURL = process.env.HACIENDA_API_URL;
    this.tokenURL = process.env.HACIENDA_TOKEN_URL;
  }

  async getAuthToken(username, password) {
    try {
      const response = await axios.post(`${this.tokenURL}/token`, {
        grant_type: 'password',
        client_id: process.env.HACIENDA_CLIENT_ID,
        username,
        password
      });
      
      return response.data.access_token;
    } catch (error) {
      throw new Error(`Error obteniendo token: ${error.message}`);
    }
  }

  async sendDocument(xmlContent, token, documentType) {
    try {
      const response = await axios.post(
        `${this.baseURL}/recepcion/${documentType}`,
        {
          clave: this.extractClaveFromXML(xmlContent),
          fecha: new Date().toISOString(),
          emisor: this.extractEmisorFromXML(xmlContent),
          comprobanteXml: Buffer.from(xmlContent).toString('base64')
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      throw new Error(`Error enviando documento: ${error.message}`);
    }
  }

  async consultarEstado(clave, token) {
    try {
      const response = await axios.get(
        `${this.baseURL}/consulta/${clave}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      return response.data;
    } catch (error) {
      throw new Error(`Error consultando estado: ${error.message}`);
    }
  }
}