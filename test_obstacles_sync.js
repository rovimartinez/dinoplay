const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

async function testObstaclesSync() {
  console.log('--- TESTING REAL-TIME OBSTACLES SYNCHRONIZATION ---');
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const adminPage = await browser.newPage();
    await adminPage.goto('http://localhost:3000/admin?key=dino2026', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));
    const pin = await adminPage.$eval('#header-pin', el => el.textContent.trim());

    const playerPage = await browser.newPage();
    await playerPage.goto('http://localhost:3000/player', { waitUntil: 'networkidle0' });
    await playerPage.type('#input-pin', pin);
    await playerPage.type('#input-name', 'CactusHunter');
    await playerPage.click('button[data-color="#E65100"]'); // Orange
    await playerPage.$eval('#btn-join', b => b.click());

    await new Promise(r => setTimeout(r, 1000));
    await adminPage.$eval('#btn-start-game', b => b.click());
    console.log('Game started, waiting 8 seconds for obstacles to spawn and approach...');

    // Wait 4s countdown + 4s running (obstacles spawn around 4-6s)
    await new Promise(r => setTimeout(r, 8500));

    // Player jumps over cactus!
    await playerPage.keyboard.press('Space');
    await new Promise(r => setTimeout(r, 300));

    const artifactDir = path.join(__dirname, 'test-results');
    fs.mkdirSync(artifactDir, { recursive: true });
    const adminShot = path.join(artifactDir, 'admin_obstacles_sync.png');
    const playerShot = path.join(artifactDir, 'player_obstacles_sync.png');

    await adminPage.screenshot({ path: adminShot });
    await playerPage.screenshot({ path: playerShot });

    console.log('Screenshots saved: admin_obstacles_sync.png and player_obstacles_sync.png');
  } catch (err) {
    console.error('Obstacles sync test error:', err);
  } finally {
    await browser.close();
  }
}

testObstaclesSync();
