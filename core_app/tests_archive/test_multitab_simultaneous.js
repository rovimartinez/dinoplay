const assert = require('assert');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const ioClient = require('socket.io-client');

async function testSimultaneousMultiPlayers() {
  console.log('--- TEST: SIMULTANEOUS RUNNING OF ALL PLAYERS (NO FREEZE) ---');
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);

  const rooms = new Map();
  function cleanRoomPin(pin) {
    if (pin === undefined || pin === null) return '';
    return String(pin).trim().slice(0, 10);
  }

  io.on('connection', (socket) => {
    socket.on('admin:create_room', () => {
      const pin = '5555';
      const room = { pin, hostId: socket.id, status: 'lobby', players: {} };
      rooms.set(pin, room);
      socket.join(pin);
      socket.emit('admin:room_created', { pin });
    });

    socket.on('player:join_room', ({ pin, name, color }) => {
      const safePin = cleanRoomPin(pin);
      const room = rooms.get(safePin);
      if (!room) {
        socket.emit('player:join_error', { message: 'Sala no existe' });
        return;
      }
      room.players[socket.id] = { id: socket.id, name, color, score: 0, distance: 0, crashed: false };
      socket.join(safePin);
      socket.emit('player:join_success', { pin: safePin, player: room.players[socket.id] });
      io.to(safePin).emit('room:players_update', { count: Object.keys(room.players).length });
    });

    socket.on('admin:start_game', ({ pin }) => {
      const safePin = cleanRoomPin(pin);
      const room = rooms.get(safePin);
      if (room) {
        room.status = 'playing';
        io.to(safePin).emit('game:start', { race_seed: 'seed123' });
      }
    });

    socket.on('player:update_state', ({ pin, score, distance, action, crashed }) => {
      const safePin = cleanRoomPin(pin);
      const room = rooms.get(safePin);
      if (room && room.players[socket.id]) {
        room.players[socket.id].score = score;
        room.players[socket.id].distance = distance;
        room.players[socket.id].action = action;
        room.players[socket.id].crashed = !!crashed;
      }
    });
  });

  await new Promise(res => server.listen(3456, res));
  const serverUrl = 'http://localhost:3456';

  // 1. Crear Admin
  const adminSocket = ioClient(serverUrl);
  await new Promise(res => adminSocket.on('connect', res));
  adminSocket.emit('admin:create_room');
  await new Promise(res => adminSocket.on('admin:room_created', res));

  // 2. Conectar 6 jugadores (simulando 6 clientes)
  const playerSockets = [];
  const playerNames = ['San', 'Esteban', 'Monica', 'Mendoza', 'Camila', 'Roberto'];

  for (let i = 0; i < 6; i++) {
    const pSock = ioClient(serverUrl);
    await new Promise(res => pSock.on('connect', res));
    // Test with number and string PIN
    const testPin = (i % 2 === 0) ? 5555 : '5555';
    pSock.emit('player:join_room', { pin: testPin, name: playerNames[i], color: '#2E7D32' });
    await new Promise(res => pSock.on('player:join_success', res));
    playerSockets.push(pSock);
  }

  console.log(`✅ 6 jugadores unidos exitosamente con PIN numérico y string.`);

  // 3. Iniciar juego
  adminSocket.emit('admin:start_game', { pin: 5555 });
  await Promise.all(playerSockets.map(s => new Promise(res => s.on('game:start', res))));

  // 4. Simular que los 6 jugadores corren en paralelo (incluso si no tienen foco)
  for (let step = 1; step <= 10; step++) {
    playerSockets.forEach((s, idx) => {
      const dist = step * 100 + idx * 10;
      const score = Math.floor(dist * 0.025);
      s.emit('player:update_state', {
        pin: '5555',
        distance: dist,
        score: score,
        action: 'running',
        crashed: false
      });
    });
    await new Promise(res => setTimeout(res, 20));
  }

  // 5. Verificar que TODOS los 6 jugadores avanzaron y ninguno quedó en 0
  const room = rooms.get('5555');
  const allScores = Object.values(room.players).map(p => p.score);
  console.log('Puntajes de todos los jugadores:', allScores);

  assert.strictEqual(allScores.length, 6, 'Deben haber 6 jugadores');
  allScores.forEach((sc, idx) => {
    assert(sc > 0, `El jugador ${playerNames[idx]} debe tener puntaje > 0 pero tiene ${sc}`);
  });

  console.log('✅ TODOS los 6 jugadores avanzaron simultáneamente sin quedarse en 0.');

  // Cleanup
  adminSocket.disconnect();
  playerSockets.forEach(s => s.disconnect());
  server.close();
  console.log('🎉 TEST SIMULTÁNEO COMPLETADO CON ÉXITO.\n');
}

testSimultaneousMultiPlayers().catch(err => {
  console.error('Test falló:', err);
  process.exit(1);
});
