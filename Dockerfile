# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copiar archivos de dependencias primero (para cache de Docker)
COPY package*.json ./
RUN npm ci --only=production

# Copiar el resto del código
COPY . .

# Exponer el puerto (usar 8080 como está en .env, o 3000 si prefieres)
EXPOSE 8080

# Comando para iniciar la aplicación (usar app.js como archivo principal)
CMD ["node", "app.js"]