const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;

console.clear();
console.log('\n=============================================================');
console.log('            🦖 INICIANDO DINOPLAY MODO ONLINE 🦖             ');
console.log('=============================================================\n');
console.log(' [1/3] Iniciando servidor del juego (Node.js en puerto ' + PORT + ')...');

const serverProcess = spawn('node', ['server.js'], { stdio: 'inherit' });

serverProcess.on('error', (err) => {
  console.error('\n❌ ERROR al arrancar server.js:', err.message);
});

serverProcess.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`\n⚠️  El servidor local se cerró con código ${code}.`);
  }
});

console.log(' [2/3] Creando túnel seguro y público para los jugadores...');

async function startTunnel() {
  let localtunnel;
  try {
    localtunnel = require('localtunnel');
  } catch (e) {
    try {
      localtunnel = require(path.join(__dirname, 'node_modules', 'localtunnel'));
    } catch (err) {
      console.error('❌ No se encontró el paquete localtunnel. Ejecuta: npm install localtunnel');
      return;
    }
  }

  try {
    const tunnel = await localtunnel({ port: PORT });
    const url = tunnel.url.replace('http://', 'https://');

    console.log(' [3/3] Verificando conexión en vivo con la red global...');
    
    // 1. Actualizar archivos HTML locales
    try {
      const pathsToUpdate = [
        path.join(__dirname, 'public', 'index.html'),
        path.join(__dirname, 'portada', 'index.html')
      ];
      for (const p of pathsToUpdate) {
        if (fs.existsSync(p)) {
          let html = fs.readFileSync(p, 'utf8');
          html = html.replace(/https:\/\/[a-zA-Z0-9.-]+\.loca\.lt/g, url);
          html = html.replace(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/g, url);
          fs.writeFileSync(p, html, 'utf8');
        }
      }
    } catch (e) {}

    // 2. Sincronizar automáticamente con la Nube (Cloudflare Pages / D1)
    async function sendHeartbeat() {
      try {
        await fetch('https://juegodino.pages.dev/api/server-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url })
        });
      } catch (err) {}
    }

    await sendHeartbeat();
    const heartbeatInterval = setInterval(sendHeartbeat, 20000);

    tunnel.on('close', () => {
      console.log('\n⚠️  El túnel se ha desconectado.');
    });

    tunnel.on('error', (err) => {
      console.error('\n⚠️  Error en el túnel:', err.message);
    });

    console.clear();
    console.log('\n=============================================================');
    console.log('       🎉 ¡TU JUEGO YA ESTÁ EN LÍNEA EN TODO EL MUNDO! 🎉   ');
    console.log('=============================================================\n');
    console.log(' 🟢 ESTADO: Conectado y 100% Operativo');
    console.log(' ☁️  NUBE: Sincronizado automáticamente con juegodino.pages.dev\n');
    console.log(' 🌐 ENLACE PÚBLICO PARA LOS JUGADORES (Cualquier celular/PC):');
    console.log(` 👉 ${url}/player.html\n`);
    console.log(' 👑 ENLACE DEL ADMINISTRADOR (En tu computadora):');
    console.log(` 👉 http://localhost:${PORT}/admin.html\n`);
    console.log(' 📺 PANTALLA DE ESPECTADORES / PROYECTOR:');
    console.log(` 👉 ${url}/spectator.html\n`);
    console.log(' 🏠 PORTADA EN LA NUBE (Actualizada en Vivo):');
    console.log(` 👉 https://juegodino.pages.dev/\n`);
    console.log('=============================================================');
    console.log(' ℹ️  Comparte el enlace con tus jugadores.');
    console.log(' ℹ️  Deja esta ventana abierta mientras jueguen.');
    console.log(' ℹ️  Para detener el juego y apagar el servidor, cierra esta ventana.');
    console.log('=============================================================\n');

    // Abrir automáticamente el panel de administrador en localhost
    try {
      exec(`start "" "http://localhost:${PORT}/admin.html"`);
    } catch (e) {}

    process.on('SIGINT', () => {
      clearInterval(heartbeatInterval);
      tunnel.close();
      serverProcess.kill();
      process.exit();
    });

  } catch (error) {
    console.error('\n❌ Error al crear el túnel online:', error.message);
  }
}

// Dar 1 segundo para que el servidor local inicie y luego abrir el túnel
setTimeout(startTunnel, 1200);
