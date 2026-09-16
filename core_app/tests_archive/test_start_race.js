const { io: ioClient } = require('socket.io-client');
const http = require('http');

async function runTest() {
  console.log('--- TEST: Inicio de Carrera y Cuenta Regresiva Sincronizada ---');
  const serverUrl = 'http://localhost:3000';

  // 1. Conectar Admin
  const adminSocket = ioClient(serverUrl);
  let roomPin = null;

  await new Promise((resolve) => {
    adminSocket.on('connect', () => {
      adminSocket.emit('admin:create_room', {
        adminKey: 'none',
        eventName: 'Test Event',
        matchName: 'Ronda Test',
        maxPlayers: 10
      });
    });

    adminSocket.on('admin:room_created', (data) => {
      roomPin = data.pin;
      console.log(`[OK] Sala creada con PIN: ${roomPin}`);
      resolve();
    });
  });

  // 2. Conectar 3 jugadores
  const players = [];
  const playerNames = ['Mateo', 'Sofia', 'Lucas'];

  for (const name of playerNames) {
    const s = ioClient(serverUrl);
    let joined = false;
    await new Promise((resolve) => {
      s.on('connect', () => {
        s.emit('player:join_room', {
          pin: roomPin,
          name: name,
          color: '#2E7D32',
          avatar: '🦖'
        });
      });
      s.on('player:join_success', (data) => {
        console.log(`[OK] Jugador ${name} unido exitosamente.`);
        players.push({ name, socket: s, token: data.sessionToken });
        resolve();
      });
    });
  }

  // 3. Monitorear countdown y start en los 3 clientes
  let countdownCount = 0;
  let startCount = 0;
  let endedPrematurely = false;

  players.forEach(p => {
    p.socket.on('game:countdown', (d) => {
      countdownCount++;
      console.log(`  [Cliente ${p.name}] Recibió game:countdown -> ${d.countdown}`);
    });

    p.socket.on('game:start', (d) => {
      startCount++;
      console.log(`  [Cliente ${p.name}] Recibió game:start -> Carrera activa!`);
    });

    p.socket.on('game:ended', (d) => {
      console.log(`  [ALERTA ${p.name}] Recibió game:ended inesperado!`);
      endedPrematurely = true;
    });
  });

  // 4. Admin inicia la partida
  console.log('[Admin] Presionando INICIAR PARTIDA...');
  adminSocket.emit('admin:start_game', {
    pin: roomPin,
    eventName: 'Test Event',
    matchName: 'Ronda Test',
    maxPlayers: 10,
    gameMode: 'sudden_death'
  });

  // Esperar 4.5 segundos (3s de countdown + 1.5s de carrera)
  await new Promise((r) => setTimeout(r, 4500));

  console.log(`\n--- RESULTADOS DE INICIO ---`);
  console.log(`Jugadores que recibieron inicio: ${startCount}/${players.length}`);
  console.log(`Finalización prematura?: ${endedPrematurely ? 'SI (FALLO)' : 'NO (CORRECTO)'}`);

  if (startCount === 3 && !endedPrematurely) {
    console.log('✅ EXITO: La cuenta regresiva y el arranque funcionaron perfectamente para todos los clientes sin cortar la partida.');
  } else {
    console.log('❌ FALLO: Hubo un problema en el arranque.');
  }

  // Desconectar sockets
  adminSocket.disconnect();
  players.forEach(p => p.socket.disconnect());
  process.exit(0);
}

runTest().catch(console.error);
