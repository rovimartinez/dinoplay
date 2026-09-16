const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const path = require('path');
const Database = require('./lib/database');

const app = express();
const server = http.createServer(app);

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'dino2026';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['https://juegodino.pages.dev', 'http://localhost:3000', 'http://127.0.0.1:3000'];

const io = new Server(server, {
  maxHttpBufferSize: 65536,
  pingInterval: 10000,
  pingTimeout: 25000,
  transports: ['websocket', 'polling'],
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
const MAX_PLAYER_NAME_LENGTH = 30;
// Middleware CORS para permitir peticiones desde la portada (Cloudflare Pages)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Bypass-Tunnel-Reminder');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/fotos_estudiantes', express.static(path.join(__dirname, 'fotos_estudiantes')));

let currentTunnelUrl = process.env.ONLINE_TUNNEL_URL || null;

// Endpoint para consultar o registrar la URL del túnel activo
app.get('/api/server-url', (req, res) => {
  const isCloudflare = req.headers['cf-connecting-ip'] || req.headers['cf-ray'];
  const hostUrl = `${req.protocol}://${req.get('host')}`;
  
  // Si la petición viene por túnel o tenemos túnel activo registrado
  const activeUrl = currentTunnelUrl || hostUrl;
  
  res.json({
    ok: true,
    active_url: activeUrl,
    wifi_url: hostUrl.includes('localhost') || hostUrl.includes('127.0.0.1') ? null : hostUrl,
    updated_at: new Date().toISOString(),
    is_online: true
  });
});

app.post('/api/register-tunnel', (req, res) => {
  if (req.body && req.body.url) {
    currentTunnelUrl = req.body.url;
  }
  res.json({ ok: true, active_url: currentTunnelUrl });
});

app.get('/api/active-pin', (req, res) => {
  const activeRooms = Array.from(rooms.values());
  if (activeRooms.length > 0) {
    const latest = activeRooms[activeRooms.length - 1];
    return res.json({
      ok: true,
      has_room: true,
      pin: latest.pin,
      status: latest.status,
      eventName: latest.eventName,
      matchName: latest.matchName,
      playersCount: Object.keys(latest.players).length
    });
  }
  return res.json({ ok: true, has_room: false });
});

app.get('/api/db/status', (req, res) => {
  res.json({
    ok: true,
    total_matches: Database.getAllMatches().length,
    total_results: Database.getAllResults().length,
    total_players: Database.getAllPlayers().length
  });
});

app.get('/api/db/live', (req, res) => {
  const pin = req.query.pin;
  if (!pin) return res.status(400).json({ ok: false, error: 'PIN is required' });
  res.json({ ok: true, data: Database.getLiveState(pin) });
});

app.get('/api/db/matches', (req, res) => {
  res.json({ ok: true, success: true, matches: Database.getAllMatches() });
});

app.get('/api/db/results', (req, res) => {
  res.json({ ok: true, success: true, results: Database.getAllResults() });
});

app.get('/api/db/history', (req, res) => {
  res.json({ ok: true, success: true, results: Database.getAllResults() });
});

app.delete('/api/db/results/:id', (req, res) => {
  const id = req.params.id;
  const deleted = Database.deleteResult(id);
  res.json({ ok: true, success: true, deleted, id });
});

app.post('/api/db/results/delete', (req, res) => {
  const { id, pin } = req.body || {};
  const target = id || pin;
  if (!target) return res.status(400).json({ ok: false, error: 'id or pin is required' });
  const deleted = Database.deleteResult(target);
  res.json({ ok: true, success: true, deleted, target });
});

// Endpoint de Emergencia / Respaldo Offline para recepción de puntajes de estudiantes
app.post('/api/player/submit-offline-score', (req, res) => {
  const { pin, sessionToken, name, score, distance, survival_ms } = req.body || {};
  const safePin = cleanRoomPin(pin);
  const room = rooms.get(safePin);

  const cleanScore = clampNumber(score, 0, 999999, 0);
  const cleanDistance = clampNumber(distance, 0, 999999, 0);
  const cleanSurvival = clampNumber(survival_ms, 0, 86400000, 0);

  if (room) {
    let player = Object.values(room.players).find(p => (sessionToken && p.sessionToken === sessionToken) || (name && p.name.toLowerCase() === String(name).trim().toLowerCase()));
    if (player) {
      if (cleanScore >= player.score) player.score = cleanScore;
      if (cleanDistance >= player.distance) player.distance = cleanDistance;
      if (cleanSurvival >= (player.survival_ms || 0)) player.survival_ms = cleanSurvival;
      player.crashed = true;
      player.action = 'crashed';
      player.crashed_at = player.crashed_at || Date.now();
      player.lastUpdateAt = Date.now();

      Database.savePlayerCrash(safePin, player.id, {
        score: player.score,
        distance: player.distance,
        survival_ms: player.survival_ms
      });

      const liveLeaderboard = getLeaderboard(room);
      io.to(safePin).emit('leaderboard:sync', {
        leaderboard: liveLeaderboard,
        totalPlayers: liveLeaderboard.length,
        activeCount: liveLeaderboard.filter(p => !p.crashed).length,
        crashedCount: liveLeaderboard.filter(p => p.crashed).length,
        status: room.status
      });

      return res.json({ ok: true, message: 'Puntaje sincronizado con la sala', player });
    }
  }

  // Si la sala en memoria no estaba activa o el socket no existía, registrar directamente en Database
  Database.updateLiveScore(safePin, sessionToken || name || 'offline_player', {
    score: cleanScore,
    distance: cleanDistance,
    survival_ms: cleanSurvival,
    action: 'crashed',
    crashed: true
  });

  return res.json({ ok: true, message: 'Puntaje offline guardado en base de datos' });
});

app.get('/api/db/export/csv', (req, res) => {
  const csv = Database.exportCSV();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="torneo_dino_resultados.csv"');
  res.send(csv);
});

app.get('/api/db/export/json', (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="torneo_dino_bd.json"');
  res.json(Database.exportJSON());
});

// Rutas amigables
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/player', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'player.html'));
});

app.get('/spectator', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'spectator.html'));
});

app.get('/eliminatorias', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'eliminatorias.html'));
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

  // Modo Contrarreloj (Time Attack / Temporizador):
  // Se clasifica directamente por el Puntaje Récord Máximo (maxScore) y Distancia Máxima alcanzada
  if (room.gameMode === 'time_attack') {
    playersList.sort((a, b) => {
      const aBestScore = Math.max(a.maxScore || 0, a.score || 0);
      const bBestScore = Math.max(b.maxScore || 0, b.score || 0);
      if (bBestScore !== aBestScore) return bBestScore - aBestScore;

      const aBestDist = Math.max(a.maxDistance || 0, a.distance || 0);
      const bBestDist = Math.max(b.maxDistance || 0, b.distance || 0);
      if (bBestDist !== aBestDist) return bBestDist - aBestDist;

      return (a.joinedAt || 0) - (b.joinedAt || 0);
    });
  } else {
    // Reglas clásicas para Muerte Súbita y 3 Vidas:
    // 1. Jugador VIVO (!crashed) SIEMPRE antes que jugador ELIMINADO (crashed)
    // 2. Entre jugadores VIVOS: Mayor puntaje, luego mayor distancia
    // 3. Entre jugadores ELIMINADOS: Quien sobrevivió más tiempo (crashed_at o survival_ms más alto), luego mayor puntaje
    // 4. Orden de ingreso (joinedAt)
    playersList.sort((a, b) => {
      if (a.crashed !== b.crashed) {
        return a.crashed ? 1 : -1;
      }

      if (!a.crashed && !b.crashed) {
        if (b.score !== a.score) return b.score - a.score;
        if (b.distance !== a.distance) return b.distance - a.distance;
        return (a.joinedAt || 0) - (b.joinedAt || 0);
      }

      const aCrashTime = a.crashed_at || 0;
      const bCrashTime = b.crashed_at || 0;
      if (bCrashTime !== aCrashTime) return bCrashTime - aCrashTime;

      const aSurvival = a.survival_ms || 0;
      const bSurvival = b.survival_ms || 0;
      if (bSurvival !== aSurvival) return bSurvival - aSurvival;

      if (b.score !== a.score) return b.score - a.score;
      if (b.distance !== a.distance) return b.distance - a.distance;

      return (a.joinedAt || 0) - (b.joinedAt || 0);
    });
  }

  return playersList.map((player, index) => {
    const newRank = index + 1;
    let rankChange = 'same';
    if (player.prevRank) {
      if (newRank < player.prevRank) rankChange = 'up';
      else if (newRank > player.prevRank) rankChange = 'down';
    }
    player.prevRank = newRank;
    player.rank = newRank;

    const bestScore = Math.max(player.maxScore || 0, player.score || 0);
    const bestDistance = Math.max(player.maxDistance || 0, player.distance || 0);

    return {
      id: player.id,
      name: player.name,
      color: player.color,
      avatar: player.avatar,
      score: room.gameMode === 'time_attack' ? bestScore : player.score,
      currentScore: player.score,
      maxScore: bestScore,
      distance: room.gameMode === 'time_attack' ? bestDistance : player.distance,
      action: player.action,
      crashed: room.gameMode === 'time_attack' ? false : player.crashed,
      isAttemptCrashed: !!player.crashed,
      crashed_at: player.crashed_at || null,
      survival_ms: player.survival_ms || 0,
      obstacles: player.obstacles || [],
      dinoY: player.dinoY !== undefined ? player.dinoY : 93,
      speed: player.speed !== undefined ? player.speed : 6,
      lives: player.lives !== undefined ? player.lives : (player.crashed ? 0 : (room.gameMode === 'three_lives' ? 3 : 1)),
      rank: newRank,
      rankChange: rankChange
    };
  });
}

function cleanPlayerName(name) {
  if (typeof name !== 'string') return 'Dino';
  const clean = name.trim().slice(0, MAX_PLAYER_NAME_LENGTH).replace(/[^a-zA-Z0-9_\-\s]/g, '');
  return clean || 'Dino';
}

function cleanRoomPin(pin) {
  if (pin === undefined || pin === null) return '';
  return String(pin).trim().slice(0, 10);
}

function cleanColor(color) {
  if (typeof color === 'string' && ALLOWED_COLORS.has(color.toUpperCase())) {
    return color.toUpperCase();
  }
  return '#2E7D32';
}

function cleanAvatar(avatar) {
  if (typeof avatar === 'string' && ALLOWED_AVATARS.has(avatar)) {
    return avatar;
  }
  return '🦖';
}

function cleanAction(action, fallback = 'running') {
  if (typeof action === 'string' && ALLOWED_ACTIONS.has(action)) {
    return action;
  }
  return fallback;
}

function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(Math.max(num, min), max);
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
  let currentRole = null; // 'admin' | 'player' | 'spectator'
  let currentPin = null;

  // ==========================================
  // 1. EVENTOS DE ANFITRIÓN (ADMIN)
  // ==========================================

  socket.on('admin:create_room', (data) => {
    const adminKey = data && data.adminKey ? String(data.adminKey).trim() : '';
    if (ADMIN_SECRET && ADMIN_SECRET !== 'none') {
      if (adminKey !== ADMIN_SECRET) {
        socket.emit('admin:auth_error', {
          code: 'UNAUTHORIZED',
          message: 'Clave de anfitrión incorrecta.'
        });
        return;
      }
    }

    const existingPin = data && data.existingPin ? cleanRoomPin(data.existingPin) : '';
    let room = existingPin ? rooms.get(existingPin) : null;
    let pin = existingPin;

    if (room) {
      if (room.hostDisconnectTimer) {
        clearTimeout(room.hostDisconnectTimer);
        room.hostDisconnectTimer = null;
      }
      room.hostId = socket.id;
      if (data && data.eventName) room.eventName = data.eventName;
      if (data && data.matchName) room.matchName = data.matchName;
      if (data && data.maxPlayers !== undefined) room.maxPlayers = data.maxPlayers;
    } else {
      // Si el admin traía un PIN previo válido (4 dígitos) y no está en conflicto, mantenerlo
      if (!pin || pin.length < 4 || rooms.has(pin)) {
        pin = generateRoomPin();
      }
      room = {
        pin,
        hostId: socket.id,
        adminAuthenticated: true,
        status: 'lobby',
        createdAt: Date.now(),
        eventName: (data && data.eventName) || 'Torneo Dino',
        matchName: (data && data.matchName) || 'Ronda 1',
        maxPlayers: (data && data.maxPlayers !== undefined) ? Number(data.maxPlayers) : 30,
        matchHistory: [],
        players: {}
      };
      rooms.set(pin, room);
    }

    currentRole = 'admin';
    currentPin = pin;
    socket.join(pin);

    // Guardar sala en Base de Datos
    Database.saveMatch({
      pin,
      eventName: room.eventName,
      matchName: room.matchName,
      max_players: room.maxPlayers,
      status: room.status || 'lobby'
    });

    const ips = getLocalIpAddresses();
    socket.emit('admin:room_created', {
      pin,
      localIps: ips,
      port: PORT,
      eventName: room.eventName,
      matchName: room.matchName,
      maxPlayers: room.maxPlayers,
      status: room.status,
      players: Object.values(room.players)
    });

    console.log(`[SALA CREADA/RECONECTADA AUTORIZADA] PIN: ${pin} | Host: ${socket.id}`);
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

  socket.on('admin:start_game', (data) => {
    const { pin, eventName, matchName, maxPlayers, gameMode, durationSeconds } = data || {};
    const safePin = cleanRoomPin(pin);
    const room = rooms.get(safePin);
    if (!room || room.hostId !== socket.id) return;

    if (room.status !== 'lobby') {
      socket.emit('admin:start_error', { message: 'La sala ya fue iniciada o finalizada.' });
      return;
    }

    const raceSeed = Math.floor(Math.random() * 900000) + 100000;

    room.status = 'starting';
    room.countdown = 3;
    room.countdownStartedAt = Date.now();
    room.eventName = (typeof eventName === 'string' && eventName.trim()) ? eventName.trim().slice(0, 50) : (room.eventName || 'Dino Fest Tech');
    room.matchName = (typeof matchName === 'string' && matchName.trim()) ? matchName.trim().slice(0, 50) : (room.matchName || 'Práctica');
    if (maxPlayers !== undefined) room.maxPlayers = Math.max(0, parseInt(maxPlayers, 10) || 0);
    room.gameMode = (typeof gameMode === 'string' && (gameMode === 'three_lives' || gameMode === 'time_attack')) ? gameMode : 'sudden_death';
    room.maxLives = (room.gameMode === 'three_lives') ? 3 : (room.gameMode === 'time_attack' ? 999 : 1);
    room.durationSeconds = (room.gameMode === 'time_attack') ? (parseInt(durationSeconds, 10) || 120) : 0;
    room.race_seed = raceSeed;
    room.raceConfig = {
      race_seed: raceSeed,
      started_at: null,
      initial_speed: 6,
      acceleration: 0.001,
      max_speed: 13,
      gameMode: room.gameMode,
      maxLives: room.maxLives,
      durationSeconds: room.durationSeconds,
      eventName: room.eventName,
      matchName: room.matchName
    };
    room.suspiciousEvents = [];

    // Reiniciar puntuaciones, récords y vidas para todos los jugadores de la sala
    Object.values(room.players).forEach(p => {
      p.score = 0;
      p.distance = 0;
      p.maxScore = 0;
      p.maxDistance = 0;
      p.attemptsCount = 0;
      p.lives = room.maxLives;
      p.action = 'running';
      p.crashed = false;
      p.crashed_at = null;
      p.survival_ms = 0;
      p.prevRank = null;
      p.lastUpdateAt = Date.now();
      p.obstacles = [];
      p.dinoY = 93;
      p.speed = 6;
      p.disconnected = false;
      p.disconnectedAt = null;
    });

    console.log(`[INICIANDO PARTIDA] Sala: ${safePin} | Modo: ${room.gameMode} | Duración: ${room.durationSeconds}s | Evento: ${room.eventName} | Partida: ${room.matchName} | Semilla: ${raceSeed}`);

    let countdown = 3;
    io.to(safePin).emit('game:countdown', {
      countdown,
      race_seed: raceSeed,
      gameMode: room.gameMode,
      maxLives: room.maxLives,
      durationSeconds: room.durationSeconds,
      eventName: room.eventName,
      matchName: room.matchName
    });

    const interval = setInterval(() => {
      countdown--;
      room.countdown = Math.max(0, countdown);
      if (countdown > 0) {
        io.to(safePin).emit('game:countdown', {
          countdown,
          race_seed: raceSeed,
          gameMode: room.gameMode,
          maxLives: room.maxLives,
          durationSeconds: room.durationSeconds,
          eventName: room.eventName,
          matchName: room.matchName
        });
      } else {
        clearInterval(interval);
        room.status = 'playing';
        room.started_at = Date.now();
        room.raceConfig.started_at = room.started_at;
        room.countdown = 0;
        if (room.finishingTimer) {
          clearTimeout(room.finishingTimer);
          room.finishingTimer = null;
        }

        // Si es Contrarreloj (time_attack), iniciar temporizador de sala
        if (room.gameTimerInterval) {
          clearInterval(room.gameTimerInterval);
          room.gameTimerInterval = null;
        }

        if (room.gameMode === 'time_attack' && room.durationSeconds > 0) {
          let remaining = room.durationSeconds;
          room.gameTimerInterval = setInterval(() => {
            if (room.status !== 'playing') {
              clearInterval(room.gameTimerInterval);
              room.gameTimerInterval = null;
              return;
            }

            remaining--;
            io.to(safePin).emit('game:timer_tick', {
              remainingSeconds: Math.max(0, remaining),
              remaining: Math.max(0, remaining),
              total: room.durationSeconds
            });

            if (remaining <= 0) {
              clearInterval(room.gameTimerInterval);
              room.gameTimerInterval = null;
              finishMatchAutomatically(safePin);
            }
          }, 1000);
        }

        // Actualizar inicio en Base de Datos
        Database.saveMatch({
          pin: safePin,
          eventName: room.eventName,
          matchName: room.matchName,
          race_seed: raceSeed,
          gameMode: room.gameMode,
          maxLives: room.maxLives,
          durationSeconds: room.durationSeconds,
          started_at: room.started_at,
          status: 'playing'
        });

        io.to(safePin).emit('game:start', {
          race_seed: raceSeed,
          speed: 6,
          acceleration: 0.001,
          gameMode: room.gameMode,
          maxLives: room.maxLives,
          durationSeconds: room.durationSeconds,
          eventName: room.eventName,
          matchName: room.matchName
        });
        console.log(`[PARTIDA EN VIVO] Sala: ${safePin} | Modo: ${room.gameMode} | Semilla: ${raceSeed}`);
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

    // Guardar resultados en Base de Datos
    Database.saveMatchResult(resultSummary);

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
      p.obstacles = [];
      p.dinoY = 93;
      p.speed = 6;
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

  socket.on('player:join_room', ({ pin, name, color, avatar, sessionToken: clientSessionToken }) => {
    const safePin = cleanRoomPin(pin);
    const room = rooms.get(safePin);

    if (!room) {
      const activeRooms = Array.from(rooms.values());
      const currentActive = activeRooms.length > 0 ? activeRooms[activeRooms.length - 1].pin : null;
      let msg = 'La sala con el PIN indicado no existe o fue cerrada.';
      if (currentActive && currentActive !== safePin) {
        msg += ` (La sala activa actual es: ${currentActive})`;
      }
      socket.emit('player:join_error', {
        code: 'ROOM_NOT_FOUND',
        message: msg,
        activePin: currentActive
      });
      return;
    }

    const cleanName = cleanPlayerName(name);

    // Si ya existe un jugador con este token o nombre, permitir reasociación en vez de rechazar con NAME_TAKEN
    let existingPlayer = Object.values(room.players).find(p => (clientSessionToken && p.sessionToken === clientSessionToken) || p.name.toLowerCase() === cleanName.toLowerCase());
    if (existingPlayer) {
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

      socket.emit('player:join_success', {
        pin: safePin,
        sessionToken: existingPlayer.sessionToken,
        player: existingPlayer,
        roomStatus: room.status,
        eventName: room.eventName,
        matchName: room.matchName
      });

      io.to(safePin).emit('room:players_update', {
        players: Object.values(room.players),
        count: Object.keys(room.players).length
      });

      console.log(`[JUGADOR REINCORPORADO/ACTUALIZADO] ${cleanName} a la sala ${safePin}`);
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

    const validColor = cleanColor(color);
    const validAvatar = cleanAvatar(avatar);
    const sessionToken = clientSessionToken || (Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36));

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

    // Guardar jugador en Base de Datos en tiempo real
    Database.savePlayerJoin({
      id: socket.id,
      name: cleanName,
      color: validColor,
      avatar: validAvatar,
      pin: safePin
    });

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

    const effectiveStatus = (room.status === 'starting' && (room.countdown || 0) <= 0)
      ? (room.race_seed ? 'playing' : 'lobby')
      : room.status;

    socket.emit('player:reconnect_success', {
      pin: safePin,
      sessionToken: existingPlayer.sessionToken,
      player: existingPlayer,
      roomStatus: effectiveStatus,
      eventName: room.eventName,
      matchName: room.matchName,
      race_seed: room.race_seed,
      countdown: room.countdown || 0,
      gameMode: room.gameMode || 'sudden_death',
      maxLives: room.maxLives || (room.gameMode === 'three_lives' ? 3 : 1),
      raceConfig: room.raceConfig || null,
      started_at: room.started_at || null
    });

    io.to(safePin).emit('room:players_update', {
      players: Object.values(room.players),
      count: Object.keys(room.players).length
    });

    console.log(`[JUGADOR RECONECTADO] ${existingPlayer.name} a sala ${safePin} (Status: ${room.status})`);
  });

  socket.on('player:update_state', ({ pin, score, distance, action, crashed, obstacles, dinoY, speed, lives, survival_ms }) => {
    const safePin = cleanRoomPin(pin);
    const room = rooms.get(safePin);
    if (!room || !room.players[socket.id]) return;

    const player = room.players[socket.id];
    const now = Date.now();
    const isCrashed = !!crashed || action === 'crashed';

    // 1. Rate limiting por socket (NUNCA descartar paquetes de choque)
    if (player.lastUpdateAt && (now - player.lastUpdateAt) < 25 && !isCrashed) {
      return;
    }
    player.lastUpdateAt = now;

    // 2. Anti-Trampa: cálculo de límites físicos según tiempo de partida
    let safeDistance = clampNumber(distance, 0, 999999, player.distance);
    let safeScore = clampNumber(score, 0, 999999, player.score);
    const effectiveSurvival = (room.started_at)
      ? Math.max(0, now - room.started_at)
      : Math.max(0, parseInt(survival_ms, 10) || 0);

    if (room.status === 'playing' && room.started_at) {
      const elapsedSeconds = Math.max(0.1, (now - room.started_at) / 1000);
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

    // Actualizar récord personal si supera el anterior
    player.maxScore = Math.max(player.maxScore || 0, safeScore);
    player.maxDistance = Math.max(player.maxDistance || 0, safeDistance);

    // En modo Contrarreloj (time_attack), permitir reinicios continuos y actualización del intento actual
    if (room.gameMode === 'time_attack') {
      player.score = safeScore;
      player.distance = safeDistance;
      player.crashed = isCrashed;
      player.action = cleanAction(action, isCrashed ? 'crashed' : 'running');
      player.survival_ms = effectiveSurvival;

      Database.updateLiveScore(safePin, socket.id, {
        score: player.maxScore,
        distance: player.maxDistance,
        action: player.action,
        crashed: false,
        survival_ms: player.survival_ms
      });
    } else {
      // Modos clásicos (Muerte Súbita y 3 Vidas):
      if (safeDistance >= player.distance) {
        player.distance = safeDistance;
      }
      if (safeScore >= player.score) {
        player.score = safeScore;
      }
      player.action = cleanAction(action, player.action);

      // 3. Manejo de choque y tiempo de supervivencia
      if (!player.crashed && isCrashed) {
        player.crashed = true;
        player.action = 'crashed';
        player.speed = 0;
        player.crashed_at = now;
        player.survival_ms = effectiveSurvival;

        Database.savePlayerCrash(safePin, socket.id, {
          score: player.score,
          distance: player.distance,
          survival_ms: player.survival_ms
        });

        const liveLeaderboard = getLeaderboard(room);
        io.to(safePin).emit('leaderboard:sync', {
          leaderboard: liveLeaderboard,
          totalPlayers: liveLeaderboard.length,
          activeCount: liveLeaderboard.filter(p => !p.crashed).length,
          crashedCount: liveLeaderboard.filter(p => p.crashed).length,
          status: room.status
        });
      } else if (!player.crashed) {
        player.survival_ms = effectiveSurvival;

        Database.updateLiveScore(safePin, socket.id, {
          score: player.score,
          distance: player.distance,
          action: player.action,
          crashed: false,
          survival_ms: player.survival_ms
        });
      }
    }

    // Actualizar vidas del jugador
    if (lives !== undefined) {
      player.lives = clampNumber(lives, 0, 999, player.lives || 1);
    }

    player.obstacles = cleanObstacles(obstacles);
    player.dinoY = clampNumber(dinoY, 0, 160, 93);
    player.speed = isCrashed ? 0 : clampNumber(speed, 0, 20, 6);

    // Si todos los jugadores han chocado en partida activa (solo en modos no-time_attack), autocompletar la partida
    if (room.status === 'playing' && room.gameMode !== 'time_attack' && room.started_at && (now - room.started_at) > 3500) {
      const allPlayers = Object.values(room.players);
      const allCrashed = allPlayers.length > 0 && allPlayers.every(p => p.crashed);
      if (allCrashed && !room.finishingTimer) {
        room.finishingTimer = setTimeout(() => {
          room.finishingTimer = null;
          finishMatchAutomatically(safePin);
        }, 3000);
      }
    }
  });

function finishMatchAutomatically(safePin) {
  const room = rooms.get(safePin);
  if (!room || room.status !== 'playing') return;

  if (room.gameTimerInterval) {
    clearInterval(room.gameTimerInterval);
    room.gameTimerInterval = null;
  }
  if (room.finishingTimer) {
    clearTimeout(room.finishingTimer);
    room.finishingTimer = null;
  }

  room.status = 'finished';
  const leaderboard = getLeaderboard(room);
  const resultSummary = {
    id: Date.now().toString(36),
    pin: room.pin,
    eventName: room.eventName || 'Dino Fest Tech',
    matchName: room.matchName || 'Práctica',
    gameMode: room.gameMode || 'sudden_death',
    date: new Date().toISOString(),
    winner: leaderboard[0] ? leaderboard[0].name : 'Nadie',
    winnerScore: leaderboard[0] ? leaderboard[0].score : 0,
    totalPlayers: leaderboard.length,
    podium: leaderboard.slice(0, 3),
    leaderboard: leaderboard
  };
  if (!room.matchHistory) room.matchHistory = [];
  room.matchHistory.unshift(resultSummary);

  Database.saveMatchResult(resultSummary);
  io.to(safePin).emit('game:ended', resultSummary);
  console.log(`[PARTIDA FINALIZADA AUTOMÁTICAMENTE] Sala: ${safePin} | Modo: ${room.gameMode} | Ganador: ${resultSummary.winner}`);
}

  // ==========================================
  // 4. DESCONEXIÓN CON BUFFER EXTENDIDO (120s)
  // ==========================================

  socket.on('disconnect', () => {
    if (currentPin && rooms.has(currentPin)) {
      const room = rooms.get(currentPin);
      if (currentRole === 'admin' && room.hostId === socket.id) {
        console.log(`[HOST DESCONECTADO TEMPORALMENTE] Sala ${currentPin}. Esperando reconexión (120s)...`);
        room.hostDisconnectTimer = setTimeout(() => {
          if (rooms.has(currentPin) && rooms.get(currentPin).hostId === socket.id) {
            io.to(currentPin).emit('room:closed', { message: 'El anfitrión ha cerrado la sala.' });
            rooms.delete(currentPin);
            console.log(`[SALA CERRADA] PIN ${currentPin} porque el anfitrión no se reconectó.`);
          }
        }, 120000);
      } else if (currentRole === 'player') {
        const player = room.players[socket.id];
        if (player) {
          const playerName = player.name;
          player.disconnected = true;
          player.disconnectedAt = Date.now();

          // NO borrar al jugador inmediatamente. Notificar estado al admin
          io.to(currentPin).emit('room:players_update', {
            players: Object.values(room.players),
            count: Object.keys(room.players).length
          });

          console.log(`[JUGADOR DESCONECTADO (CONSERVADO EN MEMORIA)] ${playerName} de sala ${currentPin}`);

          // Dar 120 segundos de gracia antes de limpiar el socket si no reconecta
          setTimeout(() => {
            if (room.players[socket.id] && room.players[socket.id].disconnected && (Date.now() - room.players[socket.id].disconnectedAt >= 115000)) {
              if (room.status === 'lobby') {
                delete room.players[socket.id];
                io.to(currentPin).emit('room:players_update', {
                  players: Object.values(room.players),
                  count: Object.keys(room.players).length
                });
                console.log(`[JUGADOR EXPIRADO EN LOBBY] ${playerName} removido tras 120s.`);
              }
            }
          }, 120000);
        }
      }
    }
  });
});

// Bucle de sincronización de Leaderboard en tiempo real (10 veces por segundo = 100ms)
setInterval(() => {
  const now = Date.now();
  for (const [pin, room] of rooms.entries()) {
    if (room.status === 'playing') {
      // Tolerancia: Watchdog pasivo de 12s para no expulsar a celulares con lag
      for (const p of Object.values(room.players)) {
        if (!p.crashed && p.disconnected) {
          const lastActive = p.disconnectedAt || p.lastUpdateAt || now;
          if (now - lastActive > 12000) {
            p.crashed = true;
            p.action = 'crashed';
            p.crashed_at = p.crashed_at || lastActive;
            p.speed = 0;
            p.survival_ms = p.survival_ms || Math.max(0, lastActive - (room.started_at || lastActive));
            Database.savePlayerCrash(pin, p.id, {
              score: p.score,
              distance: p.distance,
              survival_ms: p.survival_ms
            });
          }
        }
      }

      // Si todos los jugadores de la partida chocaron, autocompletar la carrera
      // Salvaguarda: solo si la partida lleva más de 3.5 segundos en curso
      if (room.started_at && (now - room.started_at) > 3500) {
        const allPlayers = Object.values(room.players);
        const allCrashed = allPlayers.length > 0 && allPlayers.every(p => p.crashed);
        if (allCrashed && !room.finishingTimer) {
          room.finishingTimer = setTimeout(() => {
            room.finishingTimer = null;
            if (room.status !== 'playing') return;
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
            Database.saveMatchResult(resultSummary);
            io.to(pin).emit('game:ended', resultSummary);
          }, 2500);
        }
      }
    }

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
        gameMode: room.gameMode || 'sudden_death',
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
server.listen(PORT, '0.0.0.0', () => {
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
