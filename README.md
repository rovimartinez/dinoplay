# Dino Runner Multijugador (DinoPlay) 🦖

Plataforma de carreras multijugador centralizada y en tiempo real estilo Kahoot / Quizizz.

## Características

- 🎮 **Modo Multijugador con Salas:** El anfitrión crea la sala, proyecta la pantalla centralizada y los jugadores se unen mediante código PIN desde PC o celular.
- 🕹️ **Modo Práctica:** Juego en solitario sin necesidad de código ni servidor.
- ⚡ **Soporte Cloudflare:** Preparado para despliegue en Cloudflare Pages / Workers y base de datos D1.
- 📊 **Tabla de posiciones y podio:** Visualización en tiempo real de puntuaciones y distancias.

## Estructura del Proyecto

- `public/`: Archivos web estáticos (HTML, CSS, JavaScript para cliente, anfitrión y modo práctica).
- `src/worker.js`: Cloudflare Worker para API y base de datos.
- `migrations/`: Esquema SQL y migraciones para Cloudflare D1.
- `server.js`: Servidor local Node.js / Express con WebSockets.
- `wrangler.jsonc`: Configuración para Cloudflare Workers / D1.

## Ejecución Local

1. Instala dependencias:
   ```bash
   npm install
   ```
2. Inicia el servidor:
   ```bash
   npm start
   ```
   o ejecuta directamente `INICIAR_JUEGO.bat`.
