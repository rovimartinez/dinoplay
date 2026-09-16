const http = require('http');
const { Server } = require('socket.io');
const ioClient = require('socket.io-client');
const Database = require('./lib/database');

async function runTest() {
  console.log('--- TEST INTEGRACIÓN: OBSTÁCULOS, VIDAS Y ESTADO DE CHOQUE ---');

  // Load server
  const express = require('express');
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);

  // We can test against the running server or initialize a test port
  const TEST_PORT = 3599;
  process.env.PORT = TEST_PORT;
  process.env.ADMIN_SECRET = 'dino2026';

  delete require.cache[require.resolve('./server.js')];
  const mainServer = require('./server.js');

  const serverUrl = `http://localhost:${TEST_PORT}`;
  
  await new Promise(r => setTimeout(r, 1000));

  // 1. Admin socket
  const adminSocket = ioClient(serverUrl, { transports: ['websocket'] });
  let adminRoomPin = null;

  await new Promise((resolve) => {
    adminSocket.on('connect', () => {
      adminSocket.emit('admin:create_room', {
        adminKey: 'dino2026',
        eventName: 'Torneo Test',
        matchName: 'Ronda 1'
      });
    });

    adminSocket.on('admin:room_created', (data) => {
      adminRoomPin = data.pin;
      console.log('✅ Admin room created with PIN:', adminRoomPin);
      resolve();
    });
  });

  // 2. Players mary, mia, vale
  const playerNames = ['mary', 'mia', 'vale'];
  const playerSockets = [];

  for (const name of playerNames) {
    const pSock = ioClient(serverUrl, { transports: ['websocket'] });
    await new Promise((resolve) => {
      pSock.on('connect', () => {
        pSock.emit('player:join_room', {
          pin: adminRoomPin,
          name: name,
          color: '#2E7D32',
          avatar: '🦖'
        });
      });
      pSock.on('player:join_success', (data) => {
        console.log(`✅ Jugador unido: ${name}`);
        resolve();
      });
    });
    playerSockets.push(pSock);
  }

  // 3. Start game
  await new Promise((resolve) => {
    adminSocket.emit('admin:start_game', {
      pin: adminRoomPin,
      gameMode: 'sudden_death'
    });

    playerSockets[0].on('game:start', (data) => {
      console.log('✅ Partida iniciada para los jugadores');
      resolve();
    });
  });

  // 4. Send player state with obstacles
  const sampleObstacles = [
    { type: 'CACTUS_SMALL', x: 450, y: 105, width: 17, height: 35, size: 1 },
    { type: 'CACTUS_LARGE', x: 750, y: 90, width: 25, height: 50, size: 1 }
  ];

  playerSockets[0].emit('player:update_state', {
    pin: adminRoomPin,
    score: 120,
    distance: 4800,
    action: 'running',
    crashed: false,
    lives: 1,
    obstacles: sampleObstacles,
    dinoY: 93,
    speed: 7.5
  });

  // 5. Verify admin receives obstacles and score in leaderboard:sync
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout waiting for leaderboard:sync with obstacles')), 3000);
    adminSocket.on('leaderboard:sync', (data) => {
      const mary = data.leaderboard.find(p => p.name === 'mary');
      if (mary && mary.obstacles && mary.obstacles.length > 0) {
        console.log('✅ Admin recibió obstáculos sincronizados:', mary.obstacles.length, 'obstáculo(s)');
        console.log('✅ Puntaje de Mary en Admin:', mary.score, 'pts');
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  // 6. Test crash state sync
  playerSockets[0].emit('player:update_state', {
    pin: adminRoomPin,
    score: 150,
    distance: 6000,
    action: 'crashed',
    crashed: true,
    lives: 0,
    obstacles: [],
    dinoY: 93,
    speed: 0
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout waiting for crash sync')), 3000);
    adminSocket.on('leaderboard:sync', (data) => {
      const mary = data.leaderboard.find(p => p.name === 'mary');
      if (mary && mary.crashed) {
        console.log('✅ Admin recibió estado de choque para Mary: crashed = true, action =', mary.action);
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  console.log('🎉 TODOS LOS TESTS DE SINCRONIZACIÓN PASARON AL 100%');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
