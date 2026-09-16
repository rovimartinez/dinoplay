# 🦖 DinoPlay — Guía Completa de Alojamiento, Soluciones y Modo Online

Este documento resume el diagnóstico, las soluciones evaluadas, la arquitectura implementada y la guía de uso para mantener **DinoPlay 100% gratuito, en línea y sin límites de ancho de banda**.

---

## 1. 🔍 Diagnóstico: ¿Qué pasó con Render?

### Causa del error *"This service has been suspended by its owner"*
* **Límite de Ancho de Banda (Bandwidth Limit):** Render actualizó su plan gratuito (*Hobby*) reduciendo el ancho de banda a solo **5 GB al mes**.
* **Naturaleza del Juego:** DinoPlay es un juego multijugador centralizado en tiempo real con **WebSockets (`socket.io`)**. El intercambio continuo de paquetes (posiciones, saltos, obstáculos sincronizados, latidos de red y espectadores) superó los 5 GB, provocando la suspensión automática del servicio por parte de Render.

---

## 2. ⚖️ Comparativa de Alternativas Evaluadas

| Plataforma / Método | Costo | Límite de Datos | ¿Requiere PC encendida? | Estabilidad y Experiencia |
| :--- | :---: | :---: | :---: | :--- |
| **Render (Anterior)** | Gratis | 5 GB / mes | ❌ No | ⚠️ Se suspende al agotar los 5 GB. |
| **Koyeb (Nube)** | Gratis | **55 GB / mes** | ❌ No | ✅ Estable, URL fija (`.koyeb.app`), 24/7. |
| **Localtunnel (`.loca.lt`)** | Gratis | Ilimitado | ✅ Sí | ❌ Inestable, cambia nombres, pide IP al entrar, errores 503. |
| **Cloudflare Tunnel (Elegida)** | **Gratis** | **ILIMITADO** | ✅ Sí | ⭐ **Excelente, rápida, sin contraseñas ni pantallas intermedias.** |

---

## 3. 🚀 Solución Implementada: Servidor en PC + Cloudflare Tunnel

### ¿Cómo funciona la arquitectura?
```
  [ Celulares / PCs de Jugadores ]
               │ (Internet Seguro HTTPS / WSS)
               ▼
   [ Red Global de Cloudflare ]
               │ (Túnel Cifrado de Alta Velocidad)
               ▼
[ Tu Computadora: cloudflared.exe ] ──► [ Servidor Local: Node.js (Puerto 3000) ]
```

### Ventajas:
1. **Cero Límites de Datos:** No vuelves a preocuparte por suspensiones de gigas.
2. **Cero Fricción para Jugadores:** No pide escribir contraseñas ni números de IP; entra directo al juego.
3. **Latencia Ultra Baja:** El servidor corre directamente en tu equipo.

---

## 4. 📁 Archivos Creados y Configurados

| Archivo | Función |
| :--- | :--- |
| **`JUGAR_ONLINE.bat`** | Lanzador en 1 solo clic. Inicia el servidor Node.js y el túnel de Cloudflare. |
| **`iniciar_online.js`** | Script inteligente que detecta la URL pública generada y abre el panel de Admin automáticamente. |
| **`cloudflared.exe`** | Binario oficial standalone de Cloudflare para crear el túnel seguro. |
| **`portada/index.html`** | Portada estática moderna con diseño *dark neón*, reglas del torneo y botón de estado en vivo. |
| **`public/index.html`** | Portada principal servida directamente por el juego. |

---

## 5. 📖 Guía Paso a Paso para Iniciar una Partida

### Paso 1: Abrir el servidor
1. Ve a la carpeta de tu juego (`Juego dino`).
2. Haz doble clic en **`JUGAR_ONLINE.bat`**.

### Paso 2: Obtener los enlaces
En la ventana negra aparecerán claramente tus enlaces activos:

* **🎮 Para los Jugadores:**
  `https://[nombre-temporal].trycloudflare.com/player.html`
  *(Comparte este link a los jugadores por WhatsApp / chat o proyéctalo en un QR).*

* **👑 Para el Organizador (Administrador):**
  `https://[nombre-temporal].trycloudflare.com/admin.html`
  *(Se abre automáticamente en tu navegador para crear salas, definir PIN y arrancar partidas).*

* **📺 Para Pantalla Gigante / Proyector:**
  `https://[nombre-temporal].trycloudflare.com/spectator.html`

* **🏠 Portada Completa con Reglas:**
  `https://[nombre-temporal].trycloudflare.com/`

### Paso 3: Al finalizar el evento
* Simplemente cierra la ventana negra para apagar el servidor.

---

## 6. 🌐 Portada Estática en Cloudflare Pages (`juegodino.pages.dev`)

* Tienes la carpeta **`portada/`** lista para subir a **Cloudflare Pages** si deseas que la portada informativa esté disponible 24/7 en internet con las reglas del concurso y descripción de premios.
* Incluye un indicador de estado dinámico que muestra:
  * 🟢 **Servidor En Línea:** Cuando tu PC tiene el juego abierto.
  * 🔴 **Servidor Desconectado:** Cuando el juego está cerrado.

---

## 7. 💡 Preguntas Frecuentes

### ¿Los jugadores necesitan instalar algo?
No. Entran directamente desde el navegador de su teléfono (Chrome, Safari, etc.) o PC.

### ¿Qué pasa si se cierra la ventana negra?
El juego se desconecta. Para volverlo a poner en línea solo vuelves a abrir `JUGAR_ONLINE.bat`.

### ¿Se puede jugar también en la misma red WiFi sin internet?
Sí. Si todos están conectados a la misma red WiFi local, pueden entrar directamente usando la IP local de tu PC (ejemplo: `http://192.168.1.XX:3000/player.html`).
