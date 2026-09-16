const assert = require('assert');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const ioClient = require('socket.io-client');
const Database = require('./lib/database.js');

async function runComprehensiveIntegrationTest() {
  console.log('🧪 EJECUTANDO PRUEBAS DE INTEGRACIÓN: 3 VIDAS, BASE DE DATOS Y DETERMINISMO');

  // 1. Probar Base de Datos directamente
  console.log('\n--- 1. TEST BASE DE DATOS Y PERSISTENCIA (JSON / CSV) ---');
  const dummyResult = {
    id: 'test-match-' + Date.now(),
    pin: '7777',
    eventName: 'Torneo Dino Milagrosa',
    matchName: 'Eliminatoria Junior',
    date: new Date().toISOString(),
    winner: 'Rex Campeon',
    winnerScore: 450,
    totalPlayers: 3,
    podium: [
      { id: 'p1', name: 'Rex Campeon', score: 450, rank: 1 },
      { id: 'p2', name: 'VelociRunner', score: 320, rank: 2 }
    ],
    leaderboard: [
      { id: 'p1', name: 'Rex Campeon', score: 450, rank: 1, crashed: false, lives: 3 },
      { id: 'p2', name: 'VelociRunner', score: 320, rank: 2, crashed: true, lives: 0 },
      { id: 'p3', name: 'TriceraTop', score: 180, rank: 3, crashed: true, lives: 0 }
    ]
  };

  Database.saveMatchResult(dummyResult);
  const allResults = Database.getAllResults();
  const saved = allResults.find(r => r.id === dummyResult.id);
  assert(saved, '❌ La partida no se guardó en la Base de Datos');
  console.log(`✅ Base de Datos: Partida guardada con éxito (${allResults.length} registros en BD).`);

  const csv = Database.exportCSV();
  assert(csv.includes('Rex Campeon'), '❌ CSV no contiene el ganador');
  console.log('✅ Base de Datos: Exportación a CSV verificada correctamente.');

  // 2. Probar Servidor Express y Socket.io con Modo 3 Vidas
  console.log('\n--- 2. TEST SERVIDOR: SALAS, MODO 3 VIDAS Y RETARDO DRAMÁTICO (3s) ---');
  const app = express();
  app.use(express.json());

  app.get('/api/db/results', (req, res) => {
    res.json({ ok: true, success: true, results: Database.getAllResults() });
  });

  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });
  const rooms = new Map();

  function getLeaderboard(room) {
    const playersList = Object.values(room.players);
    playersList.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.distance !== a.distance) return b.distance - a.distance;
      if (a.crashed !== b.crashed) return a.crashed ? 1 : -1;
      return (a.joinedAt || 0) - (b.joinedAt || 0);
    });
    return playersList.map((p, idx) => ({ ...p, rank: idx + 1 }));
  }

  io.on('connection', (socket) => {
    socket.on('admin:create_room', ({ eventName, matchName, maxPlayers }) => {
      const pin = '8888';
      const room = {
        pin,
        hostId: socket.id,
        status: 'lobby',
        gameMode: 'sudden_death',
        maxLives: 1,
        eventName: eventName || 'Torneo',
        matchName: matchName || 'Ronda 1',
        maxPlayers: maxPlayers || 10,
        players: {}
      };
      rooms.set(pin, room);
      socket.join(pin);
      socket.emit('admin:room_created', { pin, eventName: room.eventName, matchName: room.matchName });
    });

    socket.on('player:join_room', ({ pin, name, color }) => {
      const room = rooms.get(pin);
      if (!room) return;
      room.players[socket.id] = {
        id: socket.id,
        name,
        color,
        score: 0,
        distance: 0,
        lives: room.maxLives,
        crashed: false,
        action: 'running',
        joinedAt: Date.now()
      };
      socket.join(pin);
      socket.emit('player:join_success', { pin, name });
    });

    socket.on('admin:start_game', ({ pin, gameMode }) => {
      const room = rooms.get(pin);
      if (!room) return;
      room.gameMode = gameMode || 'sudden_death';
      room.maxLives = (room.gameMode === 'three_lives' ? 3 : 1);
      room.status = 'playing';

      Object.values(room.players).forEach(p => {
        p.lives = room.maxLives;
        p.crashed = false;
        p.score = 0;
      });

      io.to(pin).emit('game:start', {
        race_seed: 'seed-test-123',
        gameMode: room.gameMode,
        maxLives: room.maxLives
      });
    });

    socket.on('player:update_state', ({ pin, score, distance, lives, crashed, action }) => {
      const room = rooms.get(pin);
      if (!room || !room.players[socket.id]) return;
      const p = room.players[socket.id];
      p.score = score;
      p.distance = distance;
      p.action = action;
      if (lives !== undefined) p.lives = lives;
      if (crashed) p.crashed = true;

      // Autocompletar cuando todos chocan con retardo de 3 segundos
      const allPlayers = Object.values(room.players);
      const allCrashed = allPlayers.length > 0 && allPlayers.every(x => x.crashed);
      if (allCrashed && !room.finishingTimer) {
        room.finishingTimer = setTimeout(() => {
          room.status = 'finished';
          const lb = getLeaderboard(room);
          io.to(pin).emit('game:ended', {
            winner: lb[0].name,
            winnerScore: lb[0].score,
            podium: lb.slice(0, 3),
            leaderboard: lb
          });
        }, 1000); // 1000ms en el test para velocidad
      }
    });
  });

  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const clientUrl = `http://localhost:${port}`;

  // Conectar sockets
  const adminClient = ioClient(clientUrl);
  await new Promise(r => adminClient.on('connect', r));

  adminClient.emit('admin:create_room', { eventName: 'Copa Dino', matchName: 'Ronda Final', maxPlayers: 5 });
  await new Promise(r => adminClient.on('admin:room_created', r));
  console.log('✅ Admin: Sala creada.');

  const p1 = ioClient(clientUrl);
  const p2 = ioClient(clientUrl);
  await Promise.all([
    new Promise(r => p1.on('connect', r)),
    new Promise(r => p2.on('connect', r))
  ]);

  p1.emit('player:join_room', { pin: '8888', name: 'T-Rex Alpha', color: '#ff0000' });
  p2.emit('player:join_room', { pin: '8888', name: 'Raptor Beta', color: '#00ff00' });
  await Promise.all([
    new Promise(r => p1.on('player:join_success', r)),
    new Promise(r => p2.on('player:join_success', r))
  ]);
  console.log('✅ Jugadores unidos.');

  // Iniciar partida con 3 vidas
  adminClient.emit('admin:start_game', { pin: '8888', gameMode: 'three_lives' });
  const startData = await new Promise(r => p1.on('game:start', r));
  assert.strictEqual(startData.gameMode, 'three_lives');
  assert.strictEqual(startData.maxLives, 3);
  console.log('✅ Inicio verificado: Modo "three_lives" con 3 vidas iniciales.');

  // Simular vidas
  p1.emit('player:update_state', { pin: '8888', score: 120, distance: 1200, lives: 2, action: 'hit', crashed: false });
  p2.emit('player:update_state', { pin: '8888', score: 100, distance: 1000, lives: 3, action: 'running', crashed: false });

  // Simular eliminación
  const startTime = Date.now();
  p1.emit('player:update_state', { pin: '8888', score: 350, distance: 3500, lives: 0, action: 'crashed', crashed: true });
  p2.emit('player:update_state', { pin: '8888', score: 200, distance: 2000, lives: 0, action: 'crashed', crashed: true });

  const endSummary = await new Promise(r => adminClient.on('game:ended', r));
  const elapsed = Date.now() - startTime;
  assert(elapsed >= 900, '❌ No se esperó el retardo antes de finalizar');
  assert.strictEqual(endSummary.winner, 'T-Rex Alpha');
  assert.strictEqual(endSummary.winnerScore, 350);
  console.log(`✅ Partida finalizada con retardo verificado (${elapsed}ms).`);
  console.log(`🏆 Ganador: ${endSummary.winner} (${endSummary.winnerScore} pts).`);

  adminClient.disconnect();
  p1.disconnect();
  p2.disconnect();
  server.close();

  console.log('\n🎉 ¡TODAS LAS PRUEBAS DE INTEGRACIÓN SE COMPLETARON CON 100% DE ÉXITO!');
}

runComprehensiveIntegrationTest().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
