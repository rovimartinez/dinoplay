const assert = require('assert');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const ioClient = require('socket.io-client');

async function runStressTests() {
  console.log('--- TEST FASE 8 (PARTE 2): PRUEBA DE ESTRÉS Y CARGA CONCURRENTE (30 JUGADORES) ---');

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    maxHttpBufferSize: 65536,
    cors: { origin: '*' }
  });

  const NUM_PLAYERS = 30;
  const PIN = '5555';
  let totalUpdatesReceived = 0;

  const room = {
    pin: PIN,
    status: 'lobby',
    players: {}
  };

  io.on('connection', (socket) => {
    socket.on('player:join', ({ name, color }) => {
      room.players[socket.id] = {
        id: socket.id,
        name,
        color,
        score: 0,
        distance: 0,
        crashed: false
      };
      socket.join(PIN);
      socket.emit('player:joined', { ok: true, id: socket.id });
    });

    socket.on('player:update', ({ score, distance, crashed }) => {
      totalUpdatesReceived++;
      if (room.players[socket.id]) {
        const p = room.players[socket.id];
        // monotonic update
        if (score >= p.score) p.score = score;
        if (distance >= p.distance) p.distance = distance;
        p.crashed = !!crashed;
      }
    });
  });

  await new Promise(res => server.listen(0, res));
  const port = server.address().port;
  const url = `http://localhost:${port}`;

  const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(`📊 Memoria inicial: ${initialMemory.toFixed(2)} MB`);

  // Conectar 30 clientes simultáneos
  const clients = [];
  const startTime = Date.now();

  for (let i = 1; i <= NUM_PLAYERS; i++) {
    const client = ioClient(url, { transports: ['websocket'], forceNew: true });
    clients.push(client);
  }

  // Unir a todos a la sala
  await Promise.all(clients.map((client, idx) => {
    return new Promise((resolve) => {
      client.emit('player:join', { name: `DinoRunner_${idx + 1}`, color: '#2E7D32' });
      client.on('player:joined', resolve);
    });
  }));

  assert.strictEqual(Object.keys(room.players).length, NUM_PLAYERS);
  console.log(`✅ ${NUM_PLAYERS} jugadores conectados y unidos a la sala con éxito.`);

  // Simulación de partida activa con actualizaciones continuas a 30Hz durante 2.5 segundos con jitter simulado
  const DURATION_MS = 2500;
  const INTERVAL_MS = 33; // ~30 fps
  let simulatedScore = 0;

  const updateIntervals = clients.map((client, idx) => {
    let myScore = 0;
    let myDist = 0;
    return setInterval(() => {
      myScore += Math.floor(Math.random() * 5) + 1;
      myDist += 15;
      const simulatedJitter = Math.random() * 30; // 0-30ms jitter
      setTimeout(() => {
        if (client.connected) {
          client.emit('player:update', {
            score: myScore,
            distance: myDist,
            crashed: idx === 0 && myScore > 100 // provocar choque simulado en player 0
          });
        }
      }, simulatedJitter);
    }, INTERVAL_MS);
  });

  await new Promise(res => setTimeout(res, DURATION_MS));

  // Detener envío
  updateIntervals.forEach(clearInterval);

  const elapsedSec = (Date.now() - startTime) / 1000;
  const msgsPerSec = (totalUpdatesReceived / elapsedSec).toFixed(0);
  const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024;

  console.log(`\n📈 MÉTRICAS DE RENDIMIENTO BAJO ESTRÉS:`);
  console.log(`   - Jugadores simultáneos:  ${NUM_PLAYERS}`);
  console.log(`   - Total updates recibidos: ${totalUpdatesReceived}`);
  console.log(`   - Throughput medido:      ${msgsPerSec} updates/seg`);
  console.log(`   - Memoria final:          ${finalMemory.toFixed(2)} MB (Delta: +${(finalMemory - initialMemory).toFixed(2)} MB)`);

  assert(totalUpdatesReceived >= 1500, `Esperado al menos 1500 updates, recibidos: ${totalUpdatesReceived}`);

  // Cerrar todos los clientes
  clients.forEach(c => c.close());
  server.close();

  console.log('\n🎉 ALL STRESS AND CONCURRENCY TESTS PASSED!\n');
}

if (require.main === module) {
  runStressTests().catch(err => {
    console.error('❌ Stress test failed:', err);
    process.exit(1);
  });
}

module.exports = { runStressTests };
