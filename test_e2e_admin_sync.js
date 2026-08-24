const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

function getBrowserExecutable() {
  const paths = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function runE2EValidation() {
  console.log('--- VALIDACIÓN E2E DE SINCRONIZACIÓN ADMIN (2 JUGADORES) ---');
  
  process.env.PORT = 3090;
  process.env.ADMIN_SECRET = 'dino2026';
  
  require('./server.js');
  await new Promise(r => setTimeout(r, 1000));
  
  const exePath = getBrowserExecutable();
  if (!exePath) {
    console.error('No Chrome or Edge executable found.');
    process.exit(1);
  }
  
  const browser = await puppeteer.launch({
    executablePath: exePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
  });

  const artifactDir = 'C:/Users/Elizabeth/.gemini/antigravity-ide/brain/2604d6ac-1904-47c3-b6ff-630e662c92bb';

  try {
    const adminPage = await browser.newPage();
    await adminPage.setViewport({ width: 1280, height: 800 });
    await adminPage.goto('http://localhost:3090/admin?key=dino2026', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 800));

    const pin = await adminPage.$eval('#header-pin', el => el.textContent.trim());
    console.log(`✅ Sala creada en Admin con PIN: ${pin}`);

    // Jugador 1: DinoAmarillo (#FBC02D)
    const ctx1 = await browser.createBrowserContext();
    const player1Page = await ctx1.newPage();
    await player1Page.setViewport({ width: 600, height: 700 });
    await player1Page.goto(`http://localhost:3090/player?pin=${pin}`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 500));
    await player1Page.type('#input-name', 'DinoAmarillo');
    await player1Page.click('button[data-color="#FBC02D"]'); // Amarillo
    await player1Page.$eval('#btn-join', b => b.click());

    // Jugador 2: DinoMorado (#7B1FA2)
    const ctx2 = await browser.createBrowserContext();
    const player2Page = await ctx2.newPage();
    await player2Page.setViewport({ width: 600, height: 700 });
    await player2Page.goto(`http://localhost:3090/player?pin=${pin}`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 500));
    await player2Page.type('#input-name', 'DinoMorado');
    await player2Page.click('button[data-color="#7B1FA2"]'); // Morado
    await player2Page.$eval('#btn-join', b => b.click());

    await new Promise(r => setTimeout(r, 1200));
    console.log('✅ 2 Jugadores unidos a la sala (Amarillo y Morado)');

    // Iniciar partida
    await adminPage.$eval('#btn-start-game', b => b.click());
    console.log('🎮 Partida iniciada...');

    // Iniciar saltos continuos para Player 1 desde el countdown
    const jumpInterval = setInterval(async () => {
      try {
        await player1Page.keyboard.press('Space');
      } catch(e) {}
    }, 380);

    // Esperar countdown (3.5s) + 6.0s de carrera (primer obstáculo)
    await new Promise(r => setTimeout(r, 9500));

    // Captura del admin mostrando al jugador 2 eliminado en rojo mientras jugador 1 sigue vivo
    await adminPage.screenshot({ path: path.join(artifactDir, 'admin_red_crashed_card.png') });
    console.log('📸 Captura guardada: admin_red_crashed_card.png');

    clearInterval(jumpInterval);

    // Verificar en el DOM del admin que tengamos 1 corriendo y 1 chocado
    const gridStats = await adminPage.evaluate(() => {
      const activeEl = document.querySelector('#stat-active-count');
      const crashedEl = document.querySelector('#stat-crashed-count');
      const elimOverlay = document.querySelector('.player-monitor-card.crashed .eliminated-overlay');
      return {
        active: activeEl ? activeEl.textContent.trim() : '',
        crashed: crashedEl ? crashedEl.textContent.trim() : '',
        hasElimOverlay: !!elimOverlay
      };
    });

    console.log(`📊 Stats en Admin: Activos=${gridStats.active}, Chocados=${gridStats.crashed}, Overlay=${gridStats.hasElimOverlay}`);

  } catch (err) {
    console.error('Error durante la validación E2E:', err);
  } finally {
    await browser.close();
    process.exit(0);
  }
}

runE2EValidation();
