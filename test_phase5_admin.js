const assert = require('assert');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const ioClient = require('socket.io-client');

async function runPhase5Tests() {
  console.log('--- TEST FASE 5: PANEL ADMIN, NOMBRES DE PARTIDA, LÍMITES, ESPECTADOR Y RESULTADOS ---');

  // Configurar servidor de prueba temporal
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);

  const rooms = new Map();

  function getLeaderboard(room) {
    return Object.values(room.players).sort((a, b) => b.score - a.score).map((p, i) => ({
      ...p,
      rank: i + 1
    }));
  }

  io.on('connection', (socket) => {
    socket.on('admin:create_room', () => {
      const pin = '5555';
      const room = {
        pin,
        hostId: socket.id,
        status: 'lobby',
        createdAt: Date.now(),
        eventName: 'Torneo Dino 2026',
        matchName: 'Semifinal A',
        maxPlayers: 2, // Límite de 2 para probar rechazo en el 3ero
        matchHistory: [],
        players: {}
      };
      rooms.set(pin, room);
      socket.join(pin);
      socket.emit('admin:room_created', {
        pin,
        eventName: room.eventName,
        matchName: room.matchName,
        maxPlayers: room.maxPlayers
      });
    });

    socket.on('admin:update_config', ({ pin, eventName, matchName, maxPlayers }) => {
      const room = rooms.get(pin);
      if (!room) return;
      if (eventName !== undefined) room.eventName = eventName;
      if (matchName !== undefined) room.matchName = matchName;
      if (maxPlayers !== undefined) room.maxPlayers = maxPlayers;
      io.to(pin).emit('room:config_updated', {
        eventName: room.eventName,
        matchName: room.matchName,
        maxPlayers: room.maxPlayers
      });
    });

    socket.on('player:join_room', ({ pin, name }) => {
      const room = rooms.get(pin);
      if (!room) {
        socket.emit('player:join_error', { message: 'Sala no existe' });
        return;
      }
      if (room.maxPlayers > 0 && Object.keys(room.players).length >= room.maxPlayers) {
        socket.emit('player:join_error', { message: `La sala ha alcanzado el límite máximo de ${room.maxPlayers} jugadores.` });
        return;
      }
      room.players[socket.id] = {
        id: socket.id,
        name,
        score: 100,
        distance: 500,
        crashed: false,
        survival_ms: 5000
      };
      socket.join(pin);
      socket.emit('player:join_success', { pin, player: room.players[socket.id] });
    });

    socket.on('spectator:join_room', ({ pin }) => {
      const room = rooms.get(pin);
      if (!room) {
        socket.emit('spectator:error', { message: 'Sala no existe' });
        return;
      }
      socket.join(pin);
      socket.emit('spectator:joined', {
        pin,
        status: room.status,
        eventName: room.eventName,
        matchName: room.matchName,
        totalPlayers: Object.keys(room.players).length
      });
    });

    socket.on('admin:end_game', ({ pin }) => {
      const room = rooms.get(pin);
      if (!room) return;
      room.status = 'finished';
      const leaderboard = getLeaderboard(room);
      const resultSummary = {
        id: 'res-1',
        pin: room.pin,
        eventName: room.eventName,
        matchName: room.matchName,
        date: new Date().toISOString(),
        winner: leaderboard[0] ? leaderboard[0].name : 'Nadie',
        winnerScore: leaderboard[0] ? leaderboard[0].score : 0,
        totalPlayers: leaderboard.length,
        podium: leaderboard.slice(0, 3),
        leaderboard
      };
      room.matchHistory.unshift(resultSummary);
      io.to(pin).emit('game:ended', resultSummary);
    });
  });

  await new Promise(res => server.listen(0, res));
  const port = server.address().port;
  const url = `http://localhost:${port}`;

  // 1. Conectar Admin y verificar creación con nombres configurados
  const adminClient = ioClient(url);
  await new Promise((res) => {
    adminClient.on('connect', () => {
      adminClient.emit('admin:create_room');
    });
    adminClient.on('admin:room_created', (data) => {
      assert.strictEqual(data.pin, '5555');
      assert.strictEqual(data.eventName, 'Torneo Dino 2026');
      assert.strictEqual(data.matchName, 'Semifinal A');
      assert.strictEqual(data.maxPlayers, 2);
      console.log('✅ Admin room creation with custom event & match names passed.');
      res();
    });
  });

  // 2. Conectar Jugador 1 y Jugador 2 (llega al límite de 2)
  const p1 = ioClient(url);
  const p2 = ioClient(url);
  const p3 = ioClient(url);

  await new Promise((res) => {
    p1.emit('player:join_room', { pin: '5555', name: 'Rex1' });
    p1.on('player:join_success', res);
  });

  await new Promise((res) => {
    p2.emit('player:join_room', { pin: '5555', name: 'Rex2' });
    p2.on('player:join_success', res);
  });

  // 3. Jugador 3 debe ser rechazado por límite de jugadores
  await new Promise((res) => {
    p3.emit('player:join_room', { pin: '5555', name: 'Rex3' });
    p3.on('player:join_error', (data) => {
      assert(data.message.includes('límite'));
      console.log('✅ Player limit enforcement passed (Player 3 was rejected when max was 2).');
      res();
    });
  });

  // 4. Conectar Espectador
  const specClient = ioClient(url);
  await new Promise((res) => {
    specClient.emit('spectator:join_room', { pin: '5555' });
    specClient.on('spectator:joined', (data) => {
      assert.strictEqual(data.pin, '5555');
      assert.strictEqual(data.eventName, 'Torneo Dino 2026');
      assert.strictEqual(data.matchName, 'Semifinal A');
      assert.strictEqual(data.totalPlayers, 2);
      console.log('✅ Spectator connection with live tournament metadata passed.');
      res();
    });
  });

  // 5. Finalizar partida y verificar resumen y exportación
  await new Promise((res) => {
    adminClient.emit('admin:end_game', { pin: '5555' });
    specClient.on('game:ended', (summary) => {
      assert.strictEqual(summary.eventName, 'Torneo Dino 2026');
      assert.strictEqual(summary.matchName, 'Semifinal A');
      assert.strictEqual(summary.totalPlayers, 2);
      assert.strictEqual(summary.podium.length, 2);
      console.log('✅ Match termination, structured results and podium broadcast passed.');
      res();
    });
  });

  // Limpiar clientes y servidor
  adminClient.close();
  p1.close();
  p2.close();
  p3.close();
  specClient.close();
  server.close();

  console.log('\n🎉 ALL FASE 5 TESTS PASSED SUCCESSFULLY!\n');
}

if (require.main === module) {
  runPhase5Tests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
}

module.exports = { runPhase5Tests };
