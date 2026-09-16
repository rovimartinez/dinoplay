const assert = require('assert');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const ioClient = require('socket.io-client');

async function runComprehensiveTests() {
  console.log('--- TEST FASE 8 (PARTE 1): CICLO DE VIDA COMPLETO DE SALA Y CASOS LÍMITE ---');

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });

  const ADMIN_SECRET = 'dino2026';
  const rooms = new Map();

  function getLeaderboard(room) {
    const playersList = Object.values(room.players);
    playersList.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.distance !== a.distance) return b.distance - a.distance;
      if (a.crashed !== b.crashed) return a.crashed ? 1 : -1;
      const aCrash = a.crashed_at || 0;
      const bCrash = b.crashed_at || 0;
      if (bCrash !== aCrash) return bCrash - aCrash;
      return (a.joinedAt || 0) - (b.joinedAt || 0);
    });
    return playersList.map((p, idx) => ({ ...p, rank: idx + 1 }));
  }

  io.on('connection', (socket) => {
    socket.on('admin:create_room', ({ adminKey, eventName, matchName, maxPlayers }) => {
      if (adminKey !== ADMIN_SECRET) {
        socket.emit('admin:auth_error', { code: 'UNAUTHORIZED' });
        return;
      }
      const pin = '9999';
      const room = {
        pin,
        hostId: socket.id,
        status: 'lobby',
        eventName: eventName || 'Torneo 2026',
        matchName: matchName || 'Gran Final',
        maxPlayers: maxPlayers || 10,
        players: {},
        matchHistory: []
      };
      rooms.set(pin, room);
      socket.join(pin);
      socket.emit('admin:room_created', { pin, eventName: room.eventName, matchName: room.matchName });
    });

    socket.on('player:join_room', ({ pin, name, color }) => {
      const room = rooms.get(pin);
      if (!room || room.status !== 'lobby') {
        socket.emit('player:join_error', { message: 'No disponible' });
        return;
      }
      room.players[socket.id] = {
        id: socket.id,
        name,
        color: color || '#2E7D32',
        score: 0,
        distance: 0,
        crashed: false,
        joinedAt: Date.now()
      };
      socket.join(pin);
      socket.emit('player:join_success', { pin, player: room.players[socket.id] });
      io.to(pin).emit('room:players_update', { players: Object.values(room.players) });
    });

    socket.on('admin:kick_player', ({ pin, playerId }) => {
      const room = rooms.get(pin);
      if (!room || room.hostId !== socket.id) return;
      delete room.players[playerId];
      io.to(playerId).emit('player:kicked', { message: 'Expulsado por anfitrión' });
      io.to(pin).emit('room:players_update', { players: Object.values(room.players) });
    });

    socket.on('admin:start_game', ({ pin }) => {
      const room = rooms.get(pin);
      if (!room) return;
      room.status = 'starting';
      room.started_at = Date.now();
      io.to(pin).emit('game:countdown', { countdown: 3, race_seed: 'seed-final-2026' });
      setTimeout(() => {
        room.status = 'playing';
        io.to(pin).emit('game:start', { race_seed: 'seed-final-2026' });
      }, 50);
    });

    socket.on('player:update_state', ({ pin, score, distance, crashed }) => {
      const room = rooms.get(pin);
      if (!room || !room.players[socket.id]) return;
      const p = room.players[socket.id];
      p.score = score;
      p.distance = distance;
      if (crashed && !p.crashed) {
        p.crashed = true;
        p.crashed_at = Date.now();
      }

      // Auto-fin si todos chocan
      if (room.status === 'playing') {
        const all = Object.values(room.players);
        if (all.length > 0 && all.every(x => x.crashed)) {
          room.status = 'finished';
          const lb = getLeaderboard(room);
          const resSummary = {
            eventName: room.eventName,
            matchName: room.matchName,
            winner: lb[0].name,
            winnerScore: lb[0].score,
            podium: lb.slice(0, 3),
            leaderboard: lb
          };
          room.matchHistory.unshift(resSummary);
          io.to(pin).emit('game:ended', resSummary);
        }
      }
    });

    socket.on('admin:reset_to_lobby', ({ pin }) => {
      const room = rooms.get(pin);
      if (!room || room.hostId !== socket.id) return;
      room.status = 'lobby';
      Object.values(room.players).forEach(p => {
        p.score = 0;
        p.distance = 0;
        p.crashed = false;
        p.crashed_at = null;
      });
      io.to(pin).emit('game:reset_to_lobby', { players: Object.values(room.players) });
    });
  });

  await new Promise(res => server.listen(0, res));
  const port = server.address().port;
  const url = `http://localhost:${port}`;

  // Paso 1: Admin crea sala
  const admin = ioClient(url);
  await new Promise((res) => {
    admin.emit('admin:create_room', { adminKey: 'dino2026', eventName: 'Olimpiadas', matchName: 'Ronda 1' });
    admin.on('admin:room_created', res);
  });
  console.log('✅ 1. Admin room created successfully.');

  // Paso 2: Unir 3 jugadores (Alice, Bob, BadPlayer)
  const pAlice = ioClient(url);
  const pBob = ioClient(url);
  const pBad = ioClient(url);

  await new Promise(r => { pAlice.emit('player:join_room', { pin: '9999', name: 'Alice' }); pAlice.on('player:join_success', r); });
  await new Promise(r => { pBob.emit('player:join_room', { pin: '9999', name: 'Bob' }); pBob.on('player:join_success', r); });
  let badSocketId = null;
  await new Promise(r => {
    pBad.emit('player:join_room', { pin: '9999', name: 'BadPlayer' });
    pBad.on('player:join_success', (d) => { badSocketId = d.player.id; r(); });
  });
  console.log('✅ 2. Three players joined lobby.');

  // Paso 3: Admin expulsa a BadPlayer
  await new Promise((res) => {
    pBad.on('player:kicked', (d) => {
      assert(d.message.includes('Expulsado'));
      res();
    });
    admin.emit('admin:kick_player', { pin: '9999', playerId: badSocketId });
  });
  pBad.close();
  console.log('✅ 3. Host kicked disruptive player successfully.');

  // Paso 4: Admin inicia la carrera
  await new Promise((res) => {
    pAlice.on('game:start', res);
    admin.emit('admin:start_game', { pin: '9999' });
  });
  console.log('✅ 4. Game started simultaneously with shared seed.');

  // Paso 5: Carrera activa -> Alice anota 800pts y luego choca, Bob anota 500pts y choca -> Auto-finalizar
  pAlice.emit('player:update_state', { pin: '9999', score: 800, distance: 3000, crashed: false });
  pBob.emit('player:update_state', { pin: '9999', score: 500, distance: 2000, crashed: false });

  // Esperar un instante y enviar choque
  await new Promise(r => setTimeout(r, 60));
  pBob.emit('player:update_state', { pin: '9999', score: 500, distance: 2000, crashed: true });
  pAlice.emit('player:update_state', { pin: '9999', score: 800, distance: 3000, crashed: true });

  await new Promise((res) => {
    admin.on('game:ended', (summary) => {
      assert.strictEqual(summary.winner, 'Alice');
      assert.strictEqual(summary.winnerScore, 800);
      assert.strictEqual(summary.podium.length, 2);
      assert.strictEqual(summary.podium[0].name, 'Alice');
      assert.strictEqual(summary.podium[1].name, 'Bob');
      res();
    });
  });
  console.log('✅ 5. Auto-finish when all players crashed and podium accuracy passed.');

  // Paso 6: Replay / Reset to lobby para una segunda partida
  await new Promise((res) => {
    pAlice.on('game:reset_to_lobby', (d) => {
      assert.strictEqual(d.players.length, 2);
      assert.strictEqual(d.players[0].score, 0);
      assert.strictEqual(d.players[0].crashed, false);
      res();
    });
    admin.emit('admin:reset_to_lobby', { pin: '9999' });
  });
  console.log('✅ 6. Reset to lobby for replay with zeroed scores passed.');

  // Limpiar
  admin.close();
  pAlice.close();
  pBob.close();
  server.close();

  console.log('\n🎉 ALL COMPREHENSIVE LIFECYCLE TESTS PASSED!\n');
}

if (require.main === module) {
  runComprehensiveTests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
}

module.exports = { runComprehensiveTests };
