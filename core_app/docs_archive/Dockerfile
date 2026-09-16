FROM node:20-slim

WORKDIR /app

# Copiar paquetes e instalar dependencias
COPY package*.json ./
RUN npm install --omit=dev

# Copiar el resto del código del juego
COPY . .

# Puerto estandar de Back4App Containers
ENV PORT=8080
ENV NODE_ENV=production
ENV ADMIN_SECRET=dino2026

EXPOSE 8080

# Iniciar servidor DinoPlay
CMD ["node", "server.js"]
