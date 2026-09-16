const { spawn, exec, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PORT = process.env.PORT || 3000;

// Liberar puerto 3000 y matar instancias previas de cloudflared
try {
  if (process.platform === 'win32') {
    execSync('taskkill /F /IM cloudflared.exe 2>nul || exit 0', { stdio: 'ignore' });
  }
} catch (e) {}

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const localIp = getLocalIp();
const wifiUrl = `http://${localIp}:${PORT}`;
const localAdminUrl = `http://localhost:${PORT}/admin.html`;

console.clear();
console.log('\n=============================================================');
console.log('            🦖 INICIANDO DINOPLAY SERVIDOR 🦖               ');
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

console.log(' [2/3] Conectando túnel público y red local Wi-Fi/LAN...');

async function startTunnel() {
  let onlineUrl = null;
  let cfProcess = null;
  let ltInstance = null;

  const cloudflaredPath = path.join(__dirname, 'cloudflared.exe');

  if (fs.existsSync(cloudflaredPath)) {
    console.log(' 🌐 Conectando túnel seguro Cloudflare...');
    onlineUrl = await new Promise((resolve) => {
      let resolved = false;
      try {
        cfProcess = spawn(cloudflaredPath, [
          'tunnel',
          '--protocol', 'http2',
          '--url', `http://127.0.0.1:${PORT}`
        ]);

        const urlRegex = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/;

        const onData = async (data) => {
          const text = data.toString();
          const match = text.match(urlRegex);
          if (match && !resolved) {
            resolved = true;
            const detectedUrl = match[0];
            
            // Verificación y calentamiento del túnel (espera hasta 5s a que Cloudflare termine de propagar la ruta)
            let ready = false;
            for (let i = 0; i < 10; i++) {
              try {
                const check = await fetch(detectedUrl + '/api/server-url', { signal: AbortSignal.timeout(1500) });
                if (check.ok) {
                  ready = true;
                  break;
                }
              } catch (e) {}
              await new Promise(r => setTimeout(r, 600));
            }
            resolve(detectedUrl);
          }
        };

        cfProcess.stdout.on('data', onData);
        cfProcess.stderr.on('data', onData);

        cfProcess.on('error', (err) => {
          console.error('⚠️  Error al iniciar cloudflared:', err.message);
          if (!resolved) {
            resolved = true;
            resolve(null);
          }
        });

        cfProcess.on('exit', (code) => {
          console.log('\n⚠️  El túnel de Cloudflare se cerró.');
          if (!resolved) {
            resolved = true;
            resolve(null);
          }
        });

        // Timeout de seguridad de 18 segundos para obtener URL
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve(null);
          }
        }, 18000);
      } catch (err) {
        console.error('⚠️  Fallo al ejecutar cloudflared:', err.message);
        resolve(null);
      }
    });
  }

  // Fallback a localtunnel si cloudflared no produjo URL
  if (!onlineUrl) {
    console.log(' 🌐 Intentando túnel alternativo...');
    let localtunnel;
    try {
      localtunnel = require('localtunnel');
    } catch (e) {
      try {
        localtunnel = require(path.join(__dirname, 'node_modules', 'localtunnel'));
      } catch (err) {}
    }

    if (localtunnel) {
      try {
        ltInstance = await localtunnel({ port: PORT });
        onlineUrl = ltInstance.url.replace('http://', 'https://');
        ltInstance.on('close', () => console.log('\n⚠️  El túnel alternativo se desconectó.'));
      } catch (err) {
        console.log('⚠️  Túnel externo no disponible, operando en modo Wi-Fi/LAN local.');
      }
    }
  }

  // Notificar al servidor local la URL del túnel
  if (onlineUrl) {
    try {
      await fetch(`http://127.0.0.1:${PORT}/api/register-tunnel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: onlineUrl })
      });
    } catch (e) {}
  }

  // 1. Actualizar archivos HTML locales y portadas con los enlaces de LAN y Online
  try {
    const pathsToUpdate = [
      path.join(__dirname, 'public', 'index.html'),
      path.join(__dirname, 'portada', 'index.html')
    ];
    for (const p of pathsToUpdate) {
      if (fs.existsSync(p)) {
        let html = fs.readFileSync(p, 'utf8');
        if (onlineUrl) {
          html = html.replace(/https:\/\/[a-zA-Z0-9.-]+\.loca\.lt/g, onlineUrl);
          html = html.replace(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/g, onlineUrl);
        }
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
        body: JSON.stringify({ 
          url: onlineUrl || wifiUrl,
          wifi_url: wifiUrl
        })
      });
    } catch (err) {}
  }

  await sendHeartbeat();
  const heartbeatInterval = setInterval(sendHeartbeat, 15000);

  console.clear();
  console.log('\n=============================================================');
  console.log('        🎉 ¡TU SERVIDOR DINOPLAY YA ESTÁ ACTIVO! 🎉         ');
  console.log('=============================================================\n');

  console.log(' 👑 ADMIN:');
  console.log(`   📍 Local:  ${localAdminUrl}`);
  if (onlineUrl) {
    console.log(`   🌐 Online: ${onlineUrl}/admin.html`);
  }
  console.log('');

  console.log(' 🦖 JUGADORES:');
  console.log(`   📍 Local:  ${wifiUrl}/player.html`);
  if (onlineUrl) {
    console.log(`   🌐 Online: ${onlineUrl}/player.html`);
  }
  console.log('');

  console.log(' 👁️ ESPECTADORES / PROYECTOR:');
  console.log(`   📍 Local:  ${wifiUrl}/spectator.html`);
  if (onlineUrl) {
    console.log(`   🌐 Online: ${onlineUrl}/spectator.html`);
  }
  console.log('');

  console.log(' 🏠 PORTAL:');
  console.log('   🔗 https://juegodino.pages.dev/\n');
  console.log('=============================================================\n');

  // Abrir automáticamente la página de portada en tu navegador
  try {
    const homeUrlToOpen = `http://localhost:${PORT}/`;
    exec(`start "" "${homeUrlToOpen}"`);
  } catch (e) {}

  process.on('SIGINT', () => {
    clearInterval(heartbeatInterval);
    if (cfProcess) {
      try { cfProcess.kill(); } catch (e) {}
    }
    if (ltInstance) {
      try { ltInstance.close(); } catch (e) {}
    }
    serverProcess.kill();
    process.exit();
  });
}

setTimeout(startTunnel, 1200);
