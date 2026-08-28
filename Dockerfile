FROM node:20-slim

WORKDIR /app

# Copiar paquetes e instalar dependencias
COPY package*.json ./
RUN npm install --omit=dev

# Copiar el resto del código del juego
COPY . .

# Hugging Face Spaces utiliza el puerto 7860 por defecto
ENV PORT=7860
ENV NODE_ENV=production
ENV ADMIN_SECRET=dino2026

EXPOSE 7860

# Iniciar servidor DinoPlay
CMD ["node", "server.js"]
