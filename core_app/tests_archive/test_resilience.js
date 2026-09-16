const io = require('socket.io-client');

async function testResilience() {
  console.log('Iniciando prueba de resiliencia y reconexión...');

  const serverUrl = 'http://localhost:3000';

  // 1. Crear sala admin
  const adminSocket = io(serverUrl);
  let pin = '';

  await new Promise((resolve) => {
    adminSocket.on('connect', () => {
      adminSocket.emit('admin:create_room', { adminKey: 'dino2026', eventName: 'Test Event', matchName: 'Ronda Resiliencia' });
    });
    adminSocket.on('admin:room_created', (data) => {
      pin = data.pin;
      console.log('Sala creada con PIN:', pin);
      resolve();
    });
  });

  // 2. Unir jugador 1
  let playerSocket = io(serverUrl);
  let sessionToken = '';
  await new Promise((resolve) => {
    playerSocket.emit('player:join_room', { pin, name: 'Estudiante1', color: '#2E7D32', avatar: '🦖' });
    playerSocket.on('player:join_success', (data) => {
      sessionToken = data.sessionToken;
      console.log('Estudiante1 unido con sessionToken:', sessionToken);
      resolve();
    });
  });

  // 3. Simular desconexión por F5/recarga del jugador en el lobby
  console.log('Simulando F5 (desconexión) en lobby...');
  playerSocket.disconnect();

  await new Promise(r => setTimeout(r, 1000));

  // 4. Reconectar con nuevo socket pero mismo sessionToken
  playerSocket = io(serverUrl);
  await new Promise((resolve) => {
    playerSocket.on('connect', () => {
      playerSocket.emit('player:reconnect', { pin, sessionToken, name: 'Estudiante1' });
    });
    playerSocket.on('player:reconnect_success', (data) => {
      console.log('Reconexión exitosa en lobby para:', data.player.name);
      resolve();
    });
  });

  // 5. Iniciar juego
  adminSocket.emit('admin:start_game', { pin });
  await new Promise(r => setTimeout(r, 4500)); // Esperar countdown

  // 6. Simular corte de red total durante la partida y finalización offline vía HTTP REST
  console.log('Simulando caída de WebSocket durante carrera y envío offline...');
  playerSocket.disconnect();

  const reqData = JSON.stringify({
    pin,
    sessionToken,
    name: 'Estudiante1',
    score: 1450,
    distance: 2800,
    survival_ms: 12500
  });

  const res = await fetch(`${serverUrl}/api/player/submit-offline-score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: reqData
  });
  const resJson = await res.json();
  console.log('Respuesta endpoint offline:', resJson);

  // 7. Finalizar partida y verificar leaderboard
  adminSocket.emit('admin:end_game', { pin });
  await new Promise((resolve) => {
    adminSocket.on('game:ended', (summary) => {
      console.log('Resumen de fin de partida recibido:');
      console.log('Ganador:', summary.winner, '| Puntos:', summary.winnerScore);
      console.log('Total de jugadores:', summary.totalPlayers);
      console.log('Leaderboard:', summary.leaderboard);
      if (summary.totalPlayers > 0 && summary.leaderboard[0].score === 1450) {
        console.log('✅ PRUEBA EXITOSA: Datos de estudiante conservados al 100%.');
      } else {
        console.error('❌ Error: El estudiante no conservó los datos.');
      }
      resolve();
    });
  });

  adminSocket.disconnect();
  process.exit(0);
}

testResilience().catch(err => {
  console.error('Error en prueba:', err);
  process.exit(1);
});
