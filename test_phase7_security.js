const assert = require('assert');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const ioClient = require('socket.io-client');

async function runPhase7Tests() {
  console.log('--- TEST FASE 7: SEGURIDAD, AUTENTICACIÓN ADMIN Y RATE LIMITING ---');

  const app = express();
  const server = http.createServer(app);

  const ADMIN_SECRET = 'supersecret2026';
  const ipRateLimitStore = new Map();

  function checkIpRateLimit(ip, action, limit, windowMs) {
    if (!ip) return true;
    const key = `${ip}:${action}`;
    const now = Date.now();
    let entry = ipRateLimitStore.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 1, resetAt: now + windowMs };
      ipRateLimitStore.set(key, entry);
      return true;
    }
    entry.count++;
    if (entry.count > limit) {
      return false;
    }
    return true;
  }

  const io = new Server(server, {
    maxHttpBufferSize: 65536,
    cors: { origin: '*' }
  });

  const rooms = new Map();

  io.on('connection', (socket) => {
    socket.on('admin:create_room', (data) => {
      const adminKey = data && data.adminKey;
      if (adminKey !== ADMIN_SECRET) {
        socket.emit('admin:auth_error', {
          code: 'UNAUTHORIZED',
          message: 'Clave de anfitrión incorrecta.'
        });
        return;
      }

      const pin = '8888';
      rooms.set(pin, { pin, hostId: socket.id, players: {} });
      socket.join(pin);
      socket.emit('admin:room_created', { pin });
    });

    socket.on('player:join_room', ({ pin, name }) => {
      const clientIp = socket.handshake.address || '127.0.0.1';
      if (!checkIpRateLimit(clientIp, 'join_room', 3, 10000)) {
        socket.emit('player:join_error', {
          code: 'RATE_LIMITED',
          message: 'Demasiados intentos de conexión.'
        });
        return;
      }

      const room = rooms.get(pin);
      if (!room) {
        socket.emit('player:join_error', { code: 'ROOM_NOT_FOUND', message: 'No existe la sala' });
        return;
      }

      room.players[socket.id] = { name };
      socket.emit('player:join_success', { pin });
    });
  });

  await new Promise(res => server.listen(0, res));
  const port = server.address().port;
  const url = `http://localhost:${port}`;

  // 1. Intento no autorizado de crear sala admin
  const rogueAdmin = ioClient(url);
  await new Promise((res) => {
    rogueAdmin.emit('admin:create_room', { adminKey: 'wrongpassword' });
    rogueAdmin.on('admin:auth_error', (err) => {
      assert.strictEqual(err.code, 'UNAUTHORIZED');
      console.log('✅ Unauthorized admin access correctly blocked with UNAUTHORIZED code.');
      res();
    });
  });
  rogueAdmin.close();

  // 2. Intento autorizado de crear sala admin
  const legitAdmin = ioClient(url);
  await new Promise((res) => {
    legitAdmin.emit('admin:create_room', { adminKey: 'supersecret2026' });
    legitAdmin.on('admin:room_created', (data) => {
      assert.strictEqual(data.pin, '8888');
      console.log('✅ Authorized admin access successfully created tournament room.');
      res();
    });
  });

  // 3. Test de Rate Limiting por IP para join_room
  const p1 = ioClient(url);
  const p2 = ioClient(url);
  const p3 = ioClient(url);
  const p4 = ioClient(url);

  await new Promise(r => { p1.emit('player:join_room', { pin: '8888', name: 'P1' }); p1.on('player:join_success', r); });
  await new Promise(r => { p2.emit('player:join_room', { pin: '8888', name: 'P2' }); p2.on('player:join_success', r); });
  await new Promise(r => { p3.emit('player:join_room', { pin: '8888', name: 'P3' }); p3.on('player:join_success', r); });

  // 4to intento debe ser bloqueado por Rate Limiting (límite 3 por 10s)
  await new Promise((res) => {
    p4.emit('player:join_room', { pin: '8888', name: 'P4' });
    p4.on('player:join_error', (err) => {
      assert.strictEqual(err.code, 'RATE_LIMITED');
      console.log('✅ IP Rate Limiter actively blocked rapid connection burst.');
      res();
    });
  });

  // Limpieza
  legitAdmin.close();
  p1.close();
  p2.close();
  p3.close();
  p4.close();
  server.close();

  console.log('\n🎉 ALL FASE 7 TESTS PASSED SUCCESSFULLY!\n');
}

if (require.main === module) {
  runPhase7Tests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
}

module.exports = { runPhase7Tests };
