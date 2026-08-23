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

app.get('/spectator', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'spectator.html'));
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
  // Reglas de desempate ordenadas estrictamente:
  // 1. Mayor puntaje
  // 2. Mayor distancia
  // 3. Jugador sobreviviente (!crashed) antes que chocado (crashed)
  // 4. Mayor tiempo de supervivencia / momento de choque más tardío (crashed_at o survival_ms)
  // 5. Orden de ingreso (joinedAt)
  playersList.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.distance !== a.distance) return b.distance - a.distance;
    if (a.crashed !== b.crashed) {
      return a.crashed ? 1 : -1;
    }
    const aCrashTime = a.crashed_at || 0;
    const bCrashTime = b.crashed_at || 0;
    if (bCrashTime !== aCrashTime) return bCrashTime - aCrashTime;

    const aSurvival = a.survival_ms || 0;
    const bSurvival = b.survival_ms || 0;
    if (bSurvival !== aSurvival) return bSurvival - aSurvival;

    return (a.joinedAt || 0) - (b.joinedAt || 0);
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
      crashed_at: player.crashed_at || null,
      survival_ms: player.survival_ms || 0,
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
      eventName: 'Torneo Dino',
      matchName: 'Ronda 1',
      maxPlayers: 30,
      matchHistory: [],
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
      port: PORT,
      eventName: room.eventName,
      matchName: room.matchName,
      maxPlayers: room.maxPlayers
    });

    console.log(`[SALA CREADA] PIN: ${pin} | Host: ${socket.id}`);
  });

  socket.on('admin:update_config', ({ pin, eventName, matchName, maxPlayers }) => {
    const safePin = cleanRoomPin(pin);
    const room = rooms.get(safePin);
    if (!room || room.hostId !== socket.id) return;

    if (eventName !== undefined) room.eventName = String(eventName).trim().slice(0, 50) || 'Torneo';
    if (matchName !== undefined) room.matchName = String(matchName).trim().slice(0, 50) || 'Ronda 1';
    if (maxPlayers !== undefined) room.maxPlayers = Math.max(0, parseInt(maxPlayers, 10) || 0);

    io.to(safePin).emit('room:config_updated', {
      eventName: room.eventName,
      matchName: room.matchName,
      maxPlayers: room.maxPlayers
    });
  });

  socket.on('admin:start_game', ({ pin, eventName, matchName, maxPlayers }) => {
    const safePin = cleanRoomPin(pin);
    const room = rooms.get(safePin);
    if (!room || room.hostId !== socket.id) return;
    if (room.status !== 'lobby') {
      socket.emit('admin:start_error', { message: 'La sala ya fue iniciada o finalizada.' });
      return;
    }

    if (eventName) room.eventName = String(eventName).trim().slice(0, 50);
    if (matchName) room.matchName = String(matchName).trim().slice(0, 50);
    if (maxPlayers !== undefined) room.maxPlayers = Math.max(0, parseInt(maxPlayers, 10) || 0);

    room.status = 'starting';
    const raceSeed = Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36);
    room.race_seed = raceSeed;
    room.raceConfig = {
      race_seed: raceSeed,
      started_at: null,
      initial_speed: 6,
      acceleration: 0.001,
      max_speed: 13,
      eventName: room.eventName,
      matchName: room.matchName
    };
    room.suspiciousEvents = [];

    // Reiniciar puntuaciones para todos los jugadores de la sala
    Object.values(room.players).forEach(p => {
      p.score = 0;
      p.distance = 0;
      p.action = 'running';
      p.crashed = false;
      p.crashed_at = null;
      p.survival_ms = 0;
      p.prevRank = null;
      p.lastUpdateAt = 0;
    });

    console.log(`[INICIANDO PARTIDA] Sala: ${safePin} | Evento: ${room.eventName} | Partida: ${room.matchName} | Semilla: ${raceSeed}`);

    let countdown = 3;
    io.to(safePin).emit('game:countdown', {
      countdown,
      race_seed: raceSeed,
      eventName: room.eventName,
      matchName: room.matchName
    });

    const interval = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        io.to(safePin).emit('game:countdown', {
          countdown,
          race_seed: raceSeed,
          eventName: room.eventName,
          matchName: room.matchName
        });
      } else {
        clearInterval(interval);
        room.status = 'playing';
        room.started_at = Date.now();
        room.raceConfig.started_at = room.started_at;
        io.to(safePin).emit('game:start', {
          race_seed: raceSeed,
          speed: 6,
          acceleration: 0.001,
          eventName: room.eventName,
          matchName: room.matchName
        });
        console.log(`[PARTIDA EN VIVO] Sala: ${safePin} | Semilla: ${raceSeed}`);
      }
    }, 1000);
  });

  socket.on('admin:end_game', ({ pin }) => {
    const room = rooms.get(cleanRoomPin(pin));
    if (!room || room.hostId !== socket.id) return;

    room.status = 'finished';
    const leaderboard = getLeaderboard(room);
    const resultSummary = {
      id: Date.now().toString(36),
      pin: room.pin,
      eventName: room.eventName || 'Torneo',
      matchName: room.matchName || 'Carrera',
      date: new Date().toISOString(),
      winner: leaderboard[0] ? leaderboard[0].name : 'Nadie',
      winnerScore: leaderboard[0] ? leaderboard[0].score : 0,
      totalPlayers: leaderboard.length,
      podium: leaderboard.slice(0, 3),
      leaderboard: leaderboard
    };

    if (!room.matchHistory) room.matchHistory = [];
    room.matchHistory.unshift(resultSummary);

    io.to(pin).emit('game:ended', resultSummary);
    console.log(`[PARTIDA FINALIZADA] Sala: ${pin} | Ganador: ${resultSummary.winner}`);
  });

  socket.on('admin:reset_to_lobby', ({ pin }) => {
    const room = rooms.get(cleanRoomPin(pin));
    if (!room || room.hostId !== socket.id) return;

    room.status = 'lobby';
    room.race_seed = null;
    room.started_at = null;
    room.raceConfig = null;
    Object.values(room.players).forEach(p => {
      p.score = 0;
      p.distance = 0;
      p.action = 'running';
      p.crashed = false;
      p.crashed_at = null;
      p.survival_ms = 0;
      p.prevRank = null;
      p.lastUpdateAt = 0;
    });

    io.to(pin).emit('game:reset_to_lobby', {
      players: Object.values(room.players),
      eventName: room.eventName,
      matchName: room.matchName,
      maxPlayers: room.maxPlayers
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
        players: Object.values(room.players),
        count: Object.keys(room.players).length
      });
      console.log(`[JUGADOR EXPULSADO] ${playerName} de la sala ${pin}`);
    }
  });

  // ==========================================
  // 2. EVENTOS DEL ESPECTADOR (SPECTATOR)
  // ==========================================

  socket.on('spectator:join_room', ({ pin }) => {
    const safePin = cleanRoomPin(pin);
    const room = rooms.get(safePin);
    if (!room) {
      socket.emit('spectator:error', { message: 'La sala con el PIN indicado no existe.' });
      return;
    }

    currentRole = 'spectator';
    currentPin = safePin;
    socket.join(safePin);

    const leaderboard = getLeaderboard(room);
    socket.emit('spectator:joined', {
      pin: safePin,
      status: room.status,
      eventName: room.eventName || 'Torneo',
      matchName: room.matchName || 'Carrera',
      leaderboard: leaderboard,
      totalPlayers: leaderboard.length
    });
    console.log(`[ESPECTADOR CONECTADO] a sala ${safePin}`);
  });

  // ==========================================
  // 3. EVENTOS DEL JUGADOR (PLAYER)
  // ==========================================

  socket.on('player:join_room', ({ pin, name, color, avatar }) => {
    const safePin = cleanRoomPin(pin);
    const room = rooms.get(safePin);

    if (!room) {
      socket.emit('player:join_error', {
        code: 'ROOM_NOT_FOUND',
        message: 'La sala con el PIN indicado no existe o fue cerrada.'
      });
      return;
    }

    if (room.status !== 'lobby') {
      socket.emit('player:join_error', {
        code: 'GAME_IN_PROGRESS',
        pin: safePin,
        message: 'La partida ya está en curso. Puedes ver las posiciones en vivo en modo espectador.',
        allowSpectator: true
      });
      return;
    }

    if (room.maxPlayers > 0 && Object.keys(room.players).length >= room.maxPlayers) {
      socket.emit('player:join_error', {
        code: 'ROOM_FULL',
        message: `La sala ha alcanzado el límite máximo de ${room.maxPlayers} jugadores.`
      });
      return;
    }

    const cleanName = cleanPlayerName(name);
    const isDuplicate = Object.values(room.players).some(p => p.name.toLowerCase() === cleanName.toLowerCase());
    if (isDuplicate) {
      socket.emit('player:join_error', {
        code: 'NAME_TAKEN',
        message: `El nombre "${cleanName}" ya está en uso en esta sala. Elige otro nombre.`
      });
      return;
    }

    const validColor = cleanColor(color);
    const validAvatar = cleanAvatar(avatar);
    const sessionToken = Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36);

    room.players[socket.id] = {
      id: socket.id,
      sessionToken,
      name: cleanName,
      color: validColor,
      avatar: validAvatar,
      score: 0,
      distance: 0,
      action: 'running',
      crashed: false,
      crashed_at: null,
      survival_ms: 0,
      rank: Object.keys(room.players).length + 1,
      prevRank: null,
      joinedAt: Date.now(),
      disconnected: false,
      disconnectedAt: null
    };

    currentRole = 'player';
    currentPin = safePin;
    socket.join(safePin);

    socket.emit('player:join_success', {
      pin: safePin,
      sessionToken,
      player: room.players[socket.id],
      roomStatus: room.status,
      eventName: room.eventName,
      matchName: room.matchName
    });

    // Notificar al admin y a la sala
    io.to(safePin).emit('room:players_update', {
      players: Object.values(room.players),
      count: Object.keys(room.players).length
    });

    console.log(`[JUGADOR UNIDO] ${cleanName} a la sala ${safePin}`);
  });

  socket.on('player:reconnect', ({ pin, sessionToken, name }) => {
    const safePin = cleanRoomPin(pin);
    const room = rooms.get(safePin);
    if (!room) {
      socket.emit('player:reconnect_error', {
        code: 'ROOM_NOT_FOUND',
        message: 'La sala ya no existe o fue cerrada.'
      });
      return;
    }

    let existingPlayer = Object.values(room.players).find(p => p.sessionToken && p.sessionToken === sessionToken);
    if (!existingPlayer && name) {
      existingPlayer = Object.values(room.players).find(p => p.name.toLowerCase() === String(name).trim().toLowerCase());
    }

    if (!existingPlayer) {
      socket.emit('player:reconnect_error', {
        code: 'SESSION_NOT_FOUND',
        message: 'No se encontró la sesión previa en esta sala.'
      });
      return;
    }

    const oldId = existingPlayer.id;
    if (oldId !== socket.id) {
      delete room.players[oldId];
      existingPlayer.id = socket.id;
      room.players[socket.id] = existingPlayer;
    }

    existingPlayer.disconnected = false;
    existingPlayer.disconnectedAt = null;

    currentRole = 'player';
    currentPin = safePin;
    socket.join(safePin);

    socket.emit('player:reconnect_success', {
      pin: safePin,
      sessionToken: existingPlayer.sessionToken,
      player: existingPlayer,
      roomStatus: room.status,
      eventName: room.eventName,
      matchName: room.matchName,
      race_seed: room.race_seed
    });

    io.to(safePin).emit('room:players_update', {
      players: Object.values(room.players),
      count: Object.keys(room.players).length
    });

    console.log(`[JUGADOR RECONECTADO] ${existingPlayer.name} a sala ${safePin} (Status: ${room.status})`);
  });

  socket.on('player:update_state', ({ pin, score, distance, action, crashed, obstacles }) => {
    const safePin = cleanRoomPin(pin);
    const room = rooms.get(safePin);
    if (!room || !room.players[socket.id]) return;

    const player = room.players[socket.id];
    const now = Date.now();

    // 1. Rate limiting por socket (máximo 40 updates/seg / mínimo 25ms de intervalo)
    if (player.lastUpdateAt && (now - player.lastUpdateAt) < 25) {
      return;
    }
    player.lastUpdateAt = now;

    // 2. Anti-Trampa: cálculo de límites físicos según tiempo de partida
    let safeDistance = clampNumber(distance, 0, 999999, player.distance);
    let safeScore = clampNumber(score, 0, 999999, player.score);

    if (room.status === 'playing' && room.started_at) {
      const elapsedSeconds = Math.max(0.1, (now - room.started_at) / 1000);
      // Velocidad máxima: 13 px/frame * 60 fps = 780 px/s. Con margen de latencia y aceleración:
      const maxPossibleDistance = Math.ceil(elapsedSeconds * 13 * 60 * 1.5) + 300;
      const maxPossibleScore = Math.ceil(maxPossibleDistance * 0.025 * 1.5) + 100;

      if (safeDistance > maxPossibleDistance || safeScore > maxPossibleScore) {
        if (!room.suspiciousEvents) room.suspiciousEvents = [];
        room.suspiciousEvents.push({
          playerId: socket.id,
          playerName: player.name,
          attemptedDistance: safeDistance,
          maxPossibleDistance,
          timestamp: now
        });
        safeDistance = Math.min(safeDistance, maxPossibleDistance);
        safeScore = Math.min(safeScore, maxPossibleScore);
      }
    }

    // Asegurar que puntaje y distancia sean monótonamente crecientes mientras está vivo
    if (safeDistance >= player.distance) {
      player.distance = safeDistance;
    }
    if (safeScore >= player.score) {
      player.score = safeScore;
    }

    player.action = cleanAction(action, player.action);

    // 3. Manejo de choque y tiempo de supervivencia
    const isCrashed = !!crashed;
    if (!player.crashed && isCrashed) {
      player.crashed = true;
      player.crashed_at = now;
      player.survival_ms = Math.max(0, now - (room.started_at || now));
    } else if (!player.crashed) {
      player.survival_ms = Math.max(0, now - (room.started_at || now));
    }

    player.obstacles = cleanObstacles(obstacles);

    // Si todos los jugadores han chocado en partida activa, autocompletar la partida
    if (room.status === 'playing') {
      const allPlayers = Object.values(room.players);
      const allCrashed = allPlayers.length > 0 && allPlayers.every(p => p.crashed);
      if (allCrashed) {
        room.status = 'finished';
        const leaderboard = getLeaderboard(room);
        const resultSummary = {
          id: Date.now().toString(36),
          pin: room.pin,
          eventName: room.eventName || 'Torneo',
          matchName: room.matchName || 'Carrera',
          date: new Date().toISOString(),
          winner: leaderboard[0] ? leaderboard[0].name : 'Nadie',
          winnerScore: leaderboard[0] ? leaderboard[0].score : 0,
          totalPlayers: leaderboard.length,
          podium: leaderboard.slice(0, 3),
          leaderboard: leaderboard
        };
        if (!room.matchHistory) room.matchHistory = [];
        room.matchHistory.unshift(resultSummary);
        io.to(safePin).emit('game:ended', resultSummary);
      }
    }
  });

  // ==========================================
  // 4. DESCONEXIÓN
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
        const player = room.players[socket.id];
        if (player) {
          const playerName = player.name;
          if (room.status === 'playing' || room.status === 'starting') {
            // Mantener jugador durante ventana de gracia de reconexión
            player.disconnected = true;
            player.disconnectedAt = Date.now();
            console.log(`[JUGADOR DESCONECTADO TEMPORALMENTE] ${playerName} de sala ${currentPin} (puede reconectarse)`);
            setTimeout(() => {
              if (room.players[socket.id] && room.players[socket.id].disconnected) {
                delete room.players[socket.id];
                io.to(currentPin).emit('room:players_update', {
                  players: Object.values(room.players),
                  count: Object.keys(room.players).length
                });
                console.log(`[JUGADOR EXPIRADO] ${playerName} removido tras tiempo de gracia.`);
              }
            }, 45000);
          } else {
            delete room.players[socket.id];
            io.to(currentPin).emit('room:players_update', {
              players: Object.values(room.players),
              count: Object.keys(room.players).length
            });
            console.log(`[JUGADOR DESCONECTADO] ${playerName} de sala ${currentPin}`);
          }
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
