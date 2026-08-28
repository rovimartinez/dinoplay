const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;

console.clear();
console.log('\n=============================================================');
console.log('       INICIANDO DINOPLAY (CLOUDFLARE TUNNEL - ILIMITADO)    ');
console.log('=============================================================\n');
console.log(' [1/2] Iniciando servidor del juego (Node.js en puerto ' + PORT + ')...');

const serverProcess = spawn('node', ['server.js'], { stdio: 'inherit' });

console.log(' [2/2] Creando túnel seguro y estable con Cloudflare...\n');

const cloudflaredPath = path.join(__dirname, 'cloudflared.exe');
const tunnelProcess = spawn(cloudflaredPath, ['tunnel', '--url', `http://localhost:${PORT}`]);

let foundUrl = false;

function handleLine(line) {
  const match = line.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
  if (match && !foundUrl) {
    foundUrl = true;
    const url = match[0];

    // 1. Actualizar automáticamente los archivos HTML locales
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

    // 2. Sincronizar automáticamente con la Base de Datos en la Nube (Cloudflare Pages / D1)
    async function sendHeartbeat() {
      try {
        await fetch('https://juegodino.pages.dev/api/server-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url })
        });
      } catch (err) {
        // Fallback silencioso en caso de conexión intermitente
      }
    }

    sendHeartbeat();
    const heartbeatInterval = setInterval(sendHeartbeat, 30000);

    console.clear();
    console.log('\n=============================================================');
    console.log('       🎉 ¡TU JUEGO YA ESTÁ EN LÍNEA EN TODO EL MUNDO! 🎉   ');
    console.log('=============================================================\n');
    console.log(' 🟢 ESTADO: Conectado a la Red Global de Cloudflare (Sin límites)');
    console.log(' ☁️  NUBE: Sincronizado automáticamente con juegodino.pages.dev\n');
    console.log(' 🌐 ENLACE PARA LOS JUGADORES:');
    console.log(` 👉 ${url}/player.html\n`);
    console.log(' 👑 ENLACE DEL ADMINISTRADOR:');
    console.log(` 👉 ${url}/admin.html\n`);
    console.log(' 📺 PANTALLA DE ESPECTADORES / PROYECTOR:');
    console.log(` 👉 ${url}/spectator.html\n`);
    console.log(' 🏠 PORTADA EN LA NUBE (Actualizada en Vivo):');
    console.log(` 👉 https://juegodino.pages.dev/\n`);
    console.log('=============================================================');
    console.log(' ℹ️  Los jugadores entran DIRECTO (sin pedir contraseñas ni IP).');
    console.log(' ℹ️  Deja esta ventana abierta mientras jueguen.');
    console.log(' ℹ️  Para detener el servidor, solo cierra esta ventana.');
    console.log('=============================================================\n');

    // Abrir automáticamente el panel de admin en el navegador
    try {
      spawn('cmd', ['/c', 'start', `${url}/admin.html`]);
    } catch (e) {}
  }
}

const rlErr = readline.createInterface({ input: tunnelProcess.stderr });
rlErr.on('line', handleLine);

const rlOut = readline.createInterface({ input: tunnelProcess.stdout });
rlOut.on('line', handleLine);

tunnelProcess.on('error', (err) => {
  console.error('Error al iniciar Cloudflare Tunnel:', err.message);
});

process.on('SIGINT', () => {
  tunnelProcess.kill();
  serverProcess.kill();
  process.exit();
});
