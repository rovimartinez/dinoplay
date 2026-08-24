const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

function getBrowserExecutable() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  if (fs.existsSync(edgePath)) return edgePath;
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if (fs.existsSync(chromePath)) return chromePath;
  return null;
}

async function runVisualTest() {
  console.log('--- TEST VISUAL TARJETA ROJA CON X EN ADMIN ---');
  process.env.PORT = 3095;
  process.env.ADMIN_SECRET = 'dino2026';
  require('./server.js');
  await new Promise(r => setTimeout(r, 1000));

  const exePath = getBrowserExecutable();
  const browser = await puppeteer.launch({
    executablePath: exePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
  });

  const artifactDir = 'C:/Users/Elizabeth/.gemini/antigravity-ide/brain/2604d6ac-1904-47c3-b6ff-630e662c92bb';

  try {
    const adminPage = await browser.newPage();
    await adminPage.setViewport({ width: 1280, height: 800 });
    await adminPage.goto('http://localhost:3095/admin?key=dino2026', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 800));

    const pin = await adminPage.$eval('#header-pin', el => el.textContent.trim());

    // Jugador 1: DinoAmarillo
    const ctx1 = await browser.createBrowserContext();
    const player1Page = await ctx1.newPage();
    await player1Page.setViewport({ width: 600, height: 700 });
    await player1Page.goto(`http://localhost:3095/player?pin=${pin}`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 400));
    await player1Page.type('#input-name', 'DinoAmarillo');
    await player1Page.click('button[data-color="#FBC02D"]');
    await player1Page.$eval('#btn-join', b => b.click());

    // Jugador 2: DinoMorado
    const ctx2 = await browser.createBrowserContext();
    const player2Page = await ctx2.newPage();
    await player2Page.setViewport({ width: 600, height: 700 });
    await player2Page.goto(`http://localhost:3095/player?pin=${pin}`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 400));
    await player2Page.type('#input-name', 'DinoMorado');
    await player2Page.click('button[data-color="#7B1FA2"]');
    await player2Page.$eval('#btn-join', b => b.click());

    await new Promise(r => setTimeout(r, 1000));

    // Iniciar partida
    await adminPage.$eval('#btn-start-game', b => b.click());
    await new Promise(r => setTimeout(r, 4500)); // countdown terminado, carrera iniciada

    // Forzar choque de DinoMorado
    await player2Page.evaluate(() => {
      if (window.dinoGame) {
        window.dinoGame.gameOver();
      }
    });

    await new Promise(r => setTimeout(r, 1000));

    // Capturar screenshot del admin
    await adminPage.screenshot({ path: path.join(artifactDir, 'admin_crashed_red_card_live.png') });
    console.log('📸 Captura guardada: admin_crashed_red_card_live.png');

  } catch(e) {
    console.error('Error:', e);
  } finally {
    await browser.close();
    process.exit(0);
  }
}

runVisualTest();
