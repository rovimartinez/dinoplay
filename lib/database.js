const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'tournament_records.json');

// Estructura en memoria respaldada en disco en tiempo real
let db = {
  events: [],
  matches: [],
  players: [],
  live_scores: {}, // Por pin: { playerId: { ... } }
  results: [],
  last_updated: new Date().toISOString()
};

function initDatabase() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      if (data.trim()) {
        db = JSON.parse(data);
        if (!db.live_scores) db.live_scores = {};
        if (!db.matches) db.matches = [];
        if (!db.players) db.players = [];
        if (!db.results) db.results = [];
      }
    } else {
      flushToDisk();
    }
    console.log(`[BASE DE DATOS] Inicializada y conectada en: ${DB_FILE}`);
  } catch (err) {
    console.error('[BASE DE DATOS] Error al inicializar:', err.message);
  }
}

let saveTimeout = null;
function scheduleFlush() {
  if (saveTimeout) return;
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    flushToDisk();
  }, 100);
}

function flushToDisk() {
  try {
    db.last_updated = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('[BASE DE DATOS] Error al persistir en disco:', err.message);
  }
}

const Database = {
  init: initDatabase,

  saveMatch(matchData) {
    const existingIndex = db.matches.findIndex(m => m.pin === matchData.pin);
    const matchRecord = {
      id: matchData.id || Date.now().toString(36),
      pin: matchData.pin,
      eventName: matchData.eventName || 'Torneo Dino',
      matchName: matchData.matchName || 'Ronda 1',
      stage: matchData.stage || 'qualifier',
      status: matchData.status || 'lobby',
      race_seed: matchData.race_seed || null,
      max_players: matchData.max_players || 30,
      started_at: matchData.started_at ? new Date(matchData.started_at).toISOString() : null,
      created_at: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      db.matches[existingIndex] = { ...db.matches[existingIndex], ...matchRecord };
    } else {
      db.matches.unshift(matchRecord);
    }
    scheduleFlush();
    return matchRecord;
  },

  savePlayerJoin(playerData) {
    const playerRecord = {
      id: playerData.id,
      name: playerData.name,
      color: playerData.color,
      avatar: playerData.avatar || '🦖',
      pin: playerData.pin,
      joined_at: new Date().toISOString()
    };

    const existingIndex = db.players.findIndex(p => p.id === playerData.id && p.pin === playerData.pin);
    if (existingIndex >= 0) {
      db.players[existingIndex] = { ...db.players[existingIndex], ...playerRecord };
    } else {
      db.players.unshift(playerRecord);
    }

    if (!db.live_scores[playerData.pin]) db.live_scores[playerData.pin] = {};
    db.live_scores[playerData.pin][playerData.id] = {
      playerId: playerData.id,
      playerName: playerData.name,
      color: playerData.color,
      avatar: playerData.avatar,
      score: 0,
      distance: 0,
      rank: 1,
      status: 'joined',
      crashed: false,
      survival_ms: 0,
      updated_at: new Date().toISOString()
    };

    scheduleFlush();
    return playerRecord;
  },

  updateLiveScore(pin, playerId, scoreData) {
    if (!db.live_scores[pin]) db.live_scores[pin] = {};
    const current = db.live_scores[pin][playerId] || {};

    db.live_scores[pin][playerId] = {
      ...current,
      score: scoreData.score !== undefined ? scoreData.score : current.score || 0,
      distance: scoreData.distance !== undefined ? scoreData.distance : current.distance || 0,
      rank: scoreData.rank !== undefined ? scoreData.rank : current.rank || 1,
      status: scoreData.crashed ? 'crashed' : (scoreData.action || 'running'),
      crashed: !!scoreData.crashed,
      survival_ms: scoreData.survival_ms || current.survival_ms || 0,
      updated_at: new Date().toISOString()
    };

    scheduleFlush();
  },

  savePlayerCrash(pin, playerId, crashData) {
    if (!db.live_scores[pin]) db.live_scores[pin] = {};
    const current = db.live_scores[pin][playerId] || {};

    db.live_scores[pin][playerId] = {
      ...current,
      score: crashData.score !== undefined ? crashData.score : current.score || 0,
      distance: crashData.distance !== undefined ? crashData.distance : current.distance || 0,
      rank: crashData.rank || current.rank || 1,
      status: 'crashed',
      crashed: true,
      crashed_at: new Date().toISOString(),
      survival_ms: crashData.survival_ms || current.survival_ms || 0,
      updated_at: new Date().toISOString()
    };

    // Guardar también inmediatamente en disco
    flushToDisk();
  },

  saveMatchResult(resultSummary) {
    const resultRecord = {
      id: resultSummary.id || Date.now().toString(36),
      pin: resultSummary.pin,
      eventName: resultSummary.eventName || 'Torneo Dino',
      matchName: resultSummary.matchName || 'Ronda 1',
      date: resultSummary.date || new Date().toISOString(),
      winner: resultSummary.winner || 'Nadie',
      winnerScore: resultSummary.winnerScore || 0,
      totalPlayers: resultSummary.totalPlayers || 0,
      podium: resultSummary.podium || [],
      leaderboard: resultSummary.leaderboard || []
    };

    db.results.unshift(resultRecord);

    // Actualizar estado de match en matches
    const match = db.matches.find(m => m.pin === resultSummary.pin);
    if (match) {
      match.status = 'finished';
      match.ended_at = resultRecord.date;
      match.winner = resultRecord.winner;
      match.winnerScore = resultRecord.winnerScore;
    }

    flushToDisk();
    return resultRecord;
  },

  getLiveState(pin) {
    return {
      pin,
      scores: db.live_scores[pin] ? Object.values(db.live_scores[pin]) : [],
      updated_at: db.last_updated
    };
  },

  getAllMatches() {
    return db.matches || [];
  },

  getAllResults() {
    return db.results || [];
  },

  getAllPlayers() {
    return db.players || [];
  },

  exportCSV() {
    const headers = ['Fecha', 'Evento', 'Partida', 'PIN', 'Puesto', 'Jugador', 'Puntaje', 'Distancia (px)', 'Supervivencia (s)', 'Estado'];
    const rows = [headers.join(',')];

    (db.results || []).forEach(r => {
      (r.leaderboard || []).forEach(p => {
        const row = [
          `"${r.date}"`,
          `"${r.eventName}"`,
          `"${r.matchName}"`,
          `"${r.pin}"`,
          p.rank,
          `"${(p.name || '').replace(/"/g, '""')}"`,
          p.score,
          p.distance || 0,
          ((p.survival_ms || 0) / 1000).toFixed(1),
          p.crashed ? '"Eliminado"' : '"Sobreviviente"'
        ];
        rows.push(row.join(','));
      });
    });

    return rows.join('\n');
  },

  exportJSON() {
    return db;
  }
};

Database.init();

module.exports = Database;
