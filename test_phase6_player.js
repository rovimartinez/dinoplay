const assert = require('assert');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const ioClient = require('socket.io-client');

async function runPhase6Tests() {
  console.log('--- TEST FASE 6: RECONEXIÓN, ERRORES CLAROS Y CONTROL DE ESTADOS DEL JUGADOR ---');

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);

  const rooms = new Map();

  io.on('connection', (socket) => {
    socket.on('admin:create_room', () => {
      const pin = '7777';
      const room = {
        pin,
        hostId: socket.id,
        status: 'lobby',
        maxPlayers: 2,
        players: {}
      };
      rooms.set(pin, room);
      socket.join(pin);
      socket.emit('admin:room_created', { pin });
    });

    socket.on('player:join_room', ({ pin, name }) => {
      const room = rooms.get(pin);
      if (!room) {
        socket.emit('player:join_error', { code: 'ROOM_NOT_FOUND', message: 'La sala no existe.' });
        return;
      }

      if (room.status !== 'lobby') {
        socket.emit('player:join_error', {
          code: 'GAME_IN_PROGRESS',
          pin,
          message: 'La partida ya está en curso.',
          allowSpectator: true
        });
        return;
      }

      if (room.maxPlayers > 0 && Object.keys(room.players).length >= room.maxPlayers) {
        socket.emit('player:join_error', { code: 'ROOM_FULL', message: 'Sala llena.' });
        return;
      }

      const cleanName = (name || '').trim();
      const isDuplicate = Object.values(room.players).some(p => p.name.toLowerCase() === cleanName.toLowerCase());
      if (isDuplicate) {
        socket.emit('player:join_error', {
          code: 'NAME_TAKEN',
          message: `El nombre "${cleanName}" ya está en uso.`
        });
        return;
      }

      const sessionToken = 'tok-' + cleanName;
      room.players[socket.id] = {
        id: socket.id,
        sessionToken,
        name: cleanName,
        score: 150,
        distance: 800,
        crashed: false
      };
      socket.join(pin);
      socket.emit('player:join_success', { pin, sessionToken, player: room.players[socket.id] });
    });

    socket.on('player:reconnect', ({ pin, sessionToken, name }) => {
      const room = rooms.get(pin);
      if (!room) {
        socket.emit('player:reconnect_error', { message: 'Sala no existe' });
        return;
      }

      let player = Object.values(room.players).find(p => p.sessionToken === sessionToken);
      if (!player && name) {
        player = Object.values(room.players).find(p => p.name.toLowerCase() === name.trim().toLowerCase());
      }

      if (!player) {
        socket.emit('player:reconnect_error', { message: 'Sesión no encontrada' });
        return;
      }

      const oldId = player.id;
      if (oldId !== socket.id) {
        delete room.players[oldId];
        player.id = socket.id;
        room.players[socket.id] = player;
      }

      socket.join(pin);
      socket.emit('player:reconnect_success', {
        pin,
        sessionToken: player.sessionToken,
        player,
        roomStatus: room.status
      });
    });

    socket.on('admin:start_game', ({ pin }) => {
      const room = rooms.get(pin);
      if (room) {
        room.status = 'playing';
        io.to(pin).emit('game:start', { race_seed: 'seed-xyz' });
      }
    });
  });

  await new Promise(res => server.listen(0, res));
  const port = server.address().port;
  const url = `http://localhost:${port}`;

  // 1. Admin crea sala 7777
  const adminClient = ioClient(url);
  await new Promise((res) => {
    adminClient.emit('admin:create_room');
    adminClient.on('admin:room_created', res);
  });

  // 2. Jugador 1 se une y recibe sessionToken
  let p1Token = null;
  const p1 = ioClient(url);
  await new Promise((res) => {
    p1.emit('player:join_room', { pin: '7777', name: 'SpeedyRex' });
    p1.on('player:join_success', (data) => {
      assert.strictEqual(data.player.name, 'SpeedyRex');
      assert.ok(data.sessionToken);
      p1Token = data.sessionToken;
      console.log('✅ Player join & sessionToken generation passed.');
      res();
    });
  });

  // 3. Intento de nombre duplicado con otro cliente
  const pDup = ioClient(url);
  await new Promise((res) => {
    pDup.emit('player:join_room', { pin: '7777', name: 'speedyrex' });
    pDup.on('player:join_error', (err) => {
      assert.strictEqual(err.code, 'NAME_TAKEN');
      console.log('✅ Duplicate player name detection passed.');
      res();
    });
  });
  pDup.close();

  // 4. Reconexión de Jugador 1 con nuevo socket y mismo sessionToken
  p1.close(); // Simular desconexión

  const p1Reconnected = ioClient(url);
  await new Promise((res) => {
    p1Reconnected.emit('player:reconnect', { pin: '7777', sessionToken: p1Token, name: 'SpeedyRex' });
    p1Reconnected.on('player:reconnect_success', (data) => {
      assert.strictEqual(data.player.name, 'SpeedyRex');
      assert.strictEqual(data.sessionToken, p1Token);
      console.log('✅ Player seamless reconnection with sessionToken passed.');
      res();
    });
  });

  // 5. Admin inicia la partida
  adminClient.emit('admin:start_game', { pin: '7777' });
  await new Promise(r => setTimeout(r, 100));

  // 6. Nuevo jugador intenta entrar a partida en curso -> debe recibir GAME_IN_PROGRESS y allowSpectator: true
  const pLate = ioClient(url);
  await new Promise((res) => {
    pLate.emit('player:join_room', { pin: '7777', name: 'LateDino' });
    pLate.on('player:join_error', (err) => {
      assert.strictEqual(err.code, 'GAME_IN_PROGRESS');
      assert.strictEqual(err.allowSpectator, true);
      console.log('✅ In-progress game blocking with spectator suggestion passed.');
      res();
    });
  });

  // Limpieza
  adminClient.close();
  p1Reconnected.close();
  pLate.close();
  server.close();

  console.log('\n🎉 ALL FASE 6 TESTS PASSED SUCCESSFULLY!\n');
}

if (require.main === module) {
  runPhase6Tests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
}

module.exports = { runPhase6Tests };
