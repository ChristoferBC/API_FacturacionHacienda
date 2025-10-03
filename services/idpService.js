// services/idpService.js
const axios = require('axios');
const qs = require('qs');

const IDP_URL = 'https://idp.comprobanteselectronicos.go.cr/auth/realms/rut-stag/protocol/openid-connect';

let tokenInfo = null;

async function obtenerToken() {
  const data = qs.stringify({
    grant_type: 'password',
    client_id: 'api-stag',
    username: process.env.HACIENDA_USERNAME,
    password: process.env.HACIENDA_PASSWORD
  });

  const resp = await axios.post(`${IDP_URL}/token`, data, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' }
  });

  return resp.data;
}

async function refrescarToken(refreshToken) {
  const data = qs.stringify({
    grant_type: 'refresh_token',
    client_id: 'api-stag',
    refresh_token: refreshToken
  });

  const resp = await axios.post(`${IDP_URL}/token`, data, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' }
  });

  return resp.data;
}

async function getAccessToken() {
  const now = Date.now();

  // si no hay token o expiró
  if (!tokenInfo || now > tokenInfo.expiresAt) {
    if (tokenInfo && now < tokenInfo.refreshExpiresAt) {
      // refrescar
      const refreshed = await refrescarToken(tokenInfo.refresh_token);
      tokenInfo = {
        ...refreshed,
        expiresAt: now + refreshed.expires_in * 1000,
        refreshExpiresAt: now + refreshed.refresh_expires_in * 1000
      };
    } else {
      // pedir uno nuevo
      const nuevo = await obtenerToken();
      tokenInfo = {
        ...nuevo,
        expiresAt: now + nuevo.expires_in * 1000,
        refreshExpiresAt: now + nuevo.refresh_expires_in * 1000
      };
    }
  }

  return tokenInfo.access_token;
}

async function logout() {
  if (!tokenInfo) return;
  const data = qs.stringify({
    client_id: 'api-stag',
    refresh_token: tokenInfo.refresh_token
  });
  await axios.post(`${IDP_URL}/logout`, data, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' }
  });
  tokenInfo = null;
}

module.exports = { getAccessToken, logout };
