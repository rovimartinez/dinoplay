const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const ALLOWED_COLORS = new Set(['#2E7D32', '#0288D1', '#7B1FA2', '#E65100', '#C2185B', '#FBC02D']);
const ALLOWED_AVATARS = new Set(['🦖', 'dino']);
const ALLOWED_ACTIONS = new Set(['running', 'jumping', 'ducking', 'crashed']);
const ALLOWED_OBSTACLE_TYPES = new Set(['CACTUS_SMALL', 'CACTUS_LARGE', 'PTERODACTYL']);
const MAX_OBSTACLES_PER_UPDATE = 8;
const MAX_PLAYER_NAME_LENGTH = 16;

// Servir archivos estáticos desde /public
app.use(express.static(path.join(__dirname, 'public')));

// Rutas amigables
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/player', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'player.html'));
});

app.get('/practice', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'practice.html'));
});

// Función para obtener IPs locales (para conectar celulares en la misma red WiFi)
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

// Almacenamiento de salas en memoria
// rooms[pin] = { pin, hostId, status: 'lobby'|'starting'|'playing'|'finished', players: {} }
const rooms = new Map();

function generateRoomPin() {
  let pin;
  do {
    pin = Math.floor(1000 + Math.random() * 9000).toString();
  } while (rooms.has(pin));
  return pin;
}

function getLeaderboard(room) {
  const playersList = Object.values(room.players);
  // Ordenar por puntaje descendente, y en caso de empate por menor tiempo / distancia
  playersList.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.distance - a.distance;
  });

  return playersList.map((player, index) => {
    const newRank = index + 1;
    let rankChange = 'same';
    if (player.prevRank) {
      if (newRank < player.prevRank) rankChange = 'up';
      else if (newRank > player.prevRank) rankChange = 'down';
    }
    player.prevRank = newRank;
    player.rank = newRank;

    return {
      id: player.id,
      name: player.name,
      color: player.color,
      avatar: player.avatar,
      score: player.score,
      distance: player.distance,
      action: player.action, // 'running', 'jumping', 'ducking', 'crashed'
      crashed: player.crashed,
      obstacles: player.obstacles || [],
      rank: newRank,
      rankChange: rankChange
    };
  });
}

function cleanRoomPin(value) {
  const pin = String(value || '').trim();
  return /^\d{4,6}$/.test(pin) ? pin : '';
}

function cleanPlayerName(value) {
  const name = String(value || '').trim().replace(/\s+/g, ' ').slice(0, MAX_PLAYER_NAME_LENGTH);
  return name || 'Dino Anónimo';
}

function cleanColor(value) {
  return ALLOWED_COLORS.has(value) ? value : '#2E7D32';
}

function cleanAvatar(value) {
  return ALLOWED_AVATARS.has(value) ? value : '🦖';
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function cleanAction(value, fallback) {
  return ALLOWED_ACTIONS.has(value) ? value : fallback;
}

function cleanObstacles(value) {
  if (!Array.isArray(value)) return [];

  return value.slice(0, MAX_OBSTACLES_PER_UPDATE).flatMap((obstacle) => {
    if (!obstacle || typeof obstacle !== 'object') return [];
    if (!ALLOWED_OBSTACLE_TYPES.has(obstacle.type)) return [];

    return [{
      type: obstacle.type,
      x: clampNumber(obstacle.x, -100, 900, 0),
      y: clampNumber(obstacle.y, 0, 200, 0),
      width: clampNumber(obstacle.width, 0, 120, 0),
      height: clampNumber(obstacle.height, 0, 120, 0),
      size: clampNumber(obstacle.size, 1, 4, 1)
    }];
  });
}

io.on('connection', (socket) => {
  let currentRole = null; // 'admin' o 'player'
  let currentPin = null;

  // ==========================================
  // 1. EVENTOS DE ANFITRIÓN (ADMIN)
  // ==========================================

  socket.on('admin:create_room', () => {
    const pin = generateRoomPin();
    const room = {
      pin,
      hostId: socket.id,
      status: 'lobby',
      createdAt: Date.now(),
      players: {}
    };

    rooms.set(pin, room);
    currentRole = 'admin';
    currentPin = pin;
    socket.join(pin);

    const ips = getLocalIpAddresses();
    socket.emit('admin:room_created', {
      pin,
      localIps: ips,
      port: PORT
    });

    console.log(`[SALA CREADA] PIN: ${pin} | Host: ${socket.id}`);
  });

  socket.on('admin:start_game', ({ pin }) => {
    const safePin = cleanRoomPin(pin);
    const room = rooms.get(safePin);
    if (!room || room.hostId !== socket.id) return;
    if (room.status !== 'lobby') {
      socket.emit('admin:start_error', { message: 'La sala ya fue iniciada o finalizada.' });
      return;
    }

    room.status = 'starting';
    // Reiniciar puntuaciones para todos los jugadores de la sala
    Object.values(room.players).forEach(p => {
      p.score = 0;
      p.distance = 0;
      p.action = 'running';
      p.crashed = false;
      p.prevRank = null;
    });

    console.log(`[INICIANDO PARTIDA] Sala: ${safePin}`);

    let countdown = 3;
    io.to(safePin).emit('game:countdown', { countdown });

    const interval = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        io.to(safePin).emit('game:countdown', { countdown });
      } else {
        clearInterval(interval);
        room.status = 'playing';
        io.to(safePin).emit('game:start');
        console.log(`[PARTIDA EN VIVO] Sala: ${safePin}`);
      }
    }, 1000);
  });

  socket.on('admin:end_game', ({ pin }) => {
    const room = rooms.get(cleanRoomPin(pin));
    if (!room || room.hostId !== socket.id) return;

    room.status = 'finished';
    const leaderboard = getLeaderboard(room);
    io.to(pin).emit('game:ended', {
      podium: leaderboard.slice(0, 3),
      leaderboard: leaderboard
    });
    console.log(`[PARTIDA FINALIZADA] Sala: ${pin}`);
  });

  socket.on('admin:reset_to_lobby', ({ pin }) => {
    const room = rooms.get(cleanRoomPin(pin));
    if (!room || room.hostId !== socket.id) return;

    room.status = 'lobby';
    Object.values(room.players).forEach(p => {
      p.score = 0;
      p.distance = 0;
      p.action = 'running';
      p.crashed = false;
      p.prevRank = null;
    });

    io.to(pin).emit('game:reset_to_lobby', {
      players: Object.values(room.players)
    });
  });

  socket.on('admin:kick_player', ({ pin, playerId }) => {
    const room = rooms.get(cleanRoomPin(pin));
    if (!room || room.hostId !== socket.id) return;

    if (room.players[playerId]) {
      const playerName = room.players[playerId].name;
      delete room.players[playerId];
      io.to(playerId).emit('player:kicked', { message: 'Has sido expulsado de la sala' });
      io.to(pin).emit('room:players_update', {
        players: Object.values(room.players)
      });
      console.log(`[JUGADOR EXPULSADO] ${playerName} de la sala ${pin}`);
    }
  });

  // ==========================================
  // 2. EVENTOS DEL JUGADOR (PLAYER)
  // ==========================================

  socket.on('player:join_room', ({ pin, name, color, avatar }) => {
    const safePin = cleanRoomPin(pin);
    const room = rooms.get(safePin);

    if (!room) {
      socket.emit('player:join_error', { message: 'La sala con el PIN indicado no existe.' });
      return;
    }

    if (room.status !== 'lobby') {
      socket.emit('player:join_error', { message: 'La partida ya no acepta jugadores. Espera a la siguiente ronda.' });
      return;
    }

    const cleanName = cleanPlayerName(name);
    const validColor = cleanColor(color);
    const validAvatar = cleanAvatar(avatar);

    room.players[socket.id] = {
      id: socket.id,
      name: cleanName,
      color: validColor,
      avatar: validAvatar,
      score: 0,
      distance: 0,
      action: 'running',
      crashed: false,
      rank: Object.keys(room.players).length + 1,
      prevRank: null,
      joinedAt: Date.now()
    };

    currentRole = 'player';
    currentPin = safePin;
    socket.join(safePin);

    socket.emit('player:join_success', {
      pin: safePin,
      player: room.players[socket.id],
      roomStatus: room.status
    });

    // Notificar al admin y a la sala
    io.to(safePin).emit('room:players_update', {
      players: Object.values(room.players),
      count: Object.keys(room.players).length
    });

    console.log(`[JUGADOR UNIDO] ${cleanName} (${socket.id}) a sala ${safePin}`);
  });

  socket.on('player:update_state', ({ pin, score, distance, action, crashed, obstacles }) => {
    const safePin = cleanRoomPin(pin);
    const room = rooms.get(safePin);
    if (!room || !room.players[socket.id]) return;

    const player = room.players[socket.id];
    player.score = clampNumber(score, 0, 999999, player.score);
    player.distance = clampNumber(distance, 0, 999999, player.distance);
    player.action = cleanAction(action, player.action);
    player.crashed = !!crashed;
    player.obstacles = cleanObstacles(obstacles);

    // Si todos los jugadores han chocado en partida activa, podemos autocompletar la partida
    if (room.status === 'playing') {
      const allPlayers = Object.values(room.players);
      const allCrashed = allPlayers.length > 0 && allPlayers.every(p => p.crashed);
      if (allCrashed) {
        room.status = 'finished';
        const leaderboard = getLeaderboard(room);
        io.to(safePin).emit('game:ended', {
          podium: leaderboard.slice(0, 3),
          leaderboard: leaderboard
        });
      }
    }
  });

  // ==========================================
  // 3. DESCONEXIÓN
  // ==========================================

  socket.on('disconnect', () => {
    if (currentPin && rooms.has(currentPin)) {
      const room = rooms.get(currentPin);
      if (currentRole === 'admin' && room.hostId === socket.id) {
        // El anfitrión se desconectó
        io.to(currentPin).emit('room:closed', { message: 'El anfitrión ha cerrado la sala.' });
        rooms.delete(currentPin);
        console.log(`[SALA CERRADA] PIN ${currentPin} porque el admin se desconectó.`);
      } else if (currentRole === 'player') {
        if (room.players[socket.id]) {
          const playerName = room.players[socket.id].name;
          delete room.players[socket.id];
          io.to(currentPin).emit('room:players_update', {
            players: Object.values(room.players),
            count: Object.keys(room.players).length
          });
          console.log(`[JUGADOR DESCONECTADO] ${playerName} de sala ${currentPin}`);
        }
      }
    }
  });
});

// Bucle de sincronización de Leaderboard en tiempo real (10 veces por segundo = 100ms)
setInterval(() => {
  for (const [pin, room] of rooms.entries()) {
    if (room.status === 'playing' || room.status === 'starting' || room.status === 'finished') {
      const leaderboard = getLeaderboard(room);
      const totalPlayers = leaderboard.length;
      const crashedCount = leaderboard.filter(p => p.crashed).length;
      const activeCount = totalPlayers - crashedCount;

      // Enviar leaderboard completo al admin y a la sala
      io.to(pin).emit('leaderboard:sync', {
        leaderboard,
        totalPlayers,
        activeCount,
        crashedCount,
        status: room.status
      });

      // Enviar posición individual a cada jugador
      for (const p of leaderboard) {
        io.to(p.id).emit('player:rank_sync', {
          rank: p.rank,
          totalPlayers: totalPlayers,
          leaderName: leaderboard[0] ? leaderboard[0].name : '',
          leaderScore: leaderboard[0] ? leaderboard[0].score : 0,
          rankChange: p.rankChange
        });
      }
    }
  }
}, 100);

// Iniciar servidor
server.listen(PORT, () => {
  const ips = getLocalIpAddresses();
  console.log(`=================================================`);
  console.log(`🦖 DINO RUNNER MULTIJUGADOR INICIADO`);
  console.log(`👉 Servidor Local:    http://localhost:${PORT}`);
  ips.forEach(ip => {
    console.log(`👉 En red WiFi/LAN:   http://${ip}:${PORT}`);
  });
  console.log(`👉 Vista Anfitrión:   http://localhost:${PORT}/admin`);
  console.log(`👉 Vista Jugador:     http://localhost:${PORT}/player`);
  console.log(`=================================================`);
});
