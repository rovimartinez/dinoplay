(function () {
  'use strict';

  const urlParams = new URLSearchParams(window.location.search);
  const customBackendUrl = urlParams.get('server') || localStorage.getItem('dino_backend_url');
  if (urlParams.get('server')) {
    localStorage.setItem('dino_backend_url', urlParams.get('server'));
  }

  const socket = (typeof io !== 'undefined')
    ? (customBackendUrl
        ? io(customBackendUrl, { transports: ['websocket', 'polling'], reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000 })
        : io({ transports: ['websocket', 'polling'], reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000 }))
    : null;
  const SPRITE_1X_SRC = 'data:image/png;base64,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';

  // Elementos DOM
  const views = {
    lobby: document.getElementById('admin-view-lobby'),
    countdown: document.getElementById('admin-view-countdown'),
    game: document.getElementById('admin-view-game'),
    podium: document.getElementById('admin-view-podium')
  };

  const headerPin = document.getElementById('header-pin');
  const hostUrlText = document.getElementById('host-url-text');
  const headerMatchBadge = document.getElementById('header-match-badge');
  const headerEventName = document.getElementById('header-event-name');
  const headerMatchName = document.getElementById('header-match-name');
  const btnOpenSpectator = document.getElementById('btn-open-spectator');
  const btnOpenHistory = document.getElementById('btn-open-history');
  const btnSoundToggle = document.getElementById('btn-sound-toggle');

  const inputEventName = document.getElementById('input-event-name');
  const inputMatchName = document.getElementById('input-match-name');
  const selectGameMode = document.getElementById('select-game-mode');
  const selectMaxPlayers = document.getElementById('select-max-players');
  const maxPlayersLabel = document.getElementById('max-players-label');
  const btnOpenBrackets = document.getElementById('btn-open-brackets');

  const lobbyBigPin = document.getElementById('lobby-big-pin');
  const lobbyJoinUrl = document.getElementById('lobby-join-url');
  const lobbyCount = document.getElementById('lobby-count');
  const lobbyPlayersGrid = document.getElementById('lobby-players-grid');
  const btnStartGame = document.getElementById('btn-start-game');
  const startHint = document.getElementById('start-hint');
  const adminCountdownNum = document.getElementById('admin-countdown-num');

  const statActiveCount = document.getElementById('stat-active-count');
  const statCrashedCount = document.getElementById('stat-crashed-count');
  const statTotalCount = document.getElementById('stat-total-count');
  const btnEndGame = document.getElementById('btn-end-game');
  const playersMonitoringGrid = document.getElementById('players-monitoring-grid');

  const podiumMatchTitle = document.getElementById('podium-match-title');
  const podiumMatchSubtitle = document.getElementById('podium-match-subtitle');
  const btnExportCsv = document.getElementById('btn-export-csv');
  const btnExportJson = document.getElementById('btn-export-json');
  const btnPrintResults = document.getElementById('btn-print-results');

  const historyModal = document.getElementById('history-modal');
  const btnCloseHistory = document.getElementById('btn-close-history');
  const historyList = document.getElementById('history-list');
  const historyEmpty = document.getElementById('history-empty');

  const btnReplaySameRoom = document.getElementById('btn-replay-same-room');
  const btnNewRoom = document.getElementById('btn-new-room');
  const leaderboardTableBody = document.getElementById('leaderboard-table-body');
  const confettiCanvas = document.getElementById('confetti-canvas');

  // Estado del Admin
  let currentPin = '';
  let currentPlayers = [];
  const playerVisualizers = new Map();
  let previousRanks = new Map();
  let confettiActive = false;
  let soundEnabled = true;
  let audioCtx = null;
  let lastGameResult = null;
  let sessionHistory = [];

  // Audio FX con Web Audio API
  function initAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playTone(freq, duration, type = 'sine') {
    if (!soundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  }

  function playBeep(num) {
    if (!soundEnabled) return;
    if (num > 0) {
      playTone(440, 0.15, 'triangle');
    } else {
      playTone(880, 0.4, 'sine');
    }
  }

  function playFanfare() {
    if (!soundEnabled) return;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      setTimeout(() => playTone(freq, 0.25, 'triangle'), idx * 120);
    });
  }

  if (btnSoundToggle) {
    btnSoundToggle.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      btnSoundToggle.textContent = soundEnabled ? '🔊 Sonido: ON' : '🔇 Sonido: OFF';
      btnSoundToggle.style.opacity = soundEnabled ? '1' : '0.6';
    });
  }

  // Cambio de vistas en SPA
  function showView(name) {
    Object.keys(views).forEach((key) => {
      if (key === name) {
        views[key].classList.add('active');
      } else {
        views[key].classList.remove('active');
      }
    });
  }

  // Cache de Sprites con coloreado dinámico
  const coloredSpriteCache = new Map();

  // Cargar imagen base del sprite
  const rawSpriteImg = new Image();
  rawSpriteImg.src = SPRITE_1X_SRC;

  function hexToRgb(hex) {
    if (!hex) return { r: 46, g: 125, b: 50 };
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 46, g: 125, b: 50 };
  }

  function getColoredSprite(colorHex) {
    if (coloredSpriteCache.has(colorHex)) {
      return coloredSpriteCache.get(colorHex);
    }
    if (!rawSpriteImg.complete || !rawSpriteImg.naturalWidth) {
      return rawSpriteImg;
    }

    try {
      const off = document.createElement('canvas');
      const w = rawSpriteImg.naturalWidth;
      const h = rawSpriteImg.naturalHeight;
      off.width = w;
      off.height = h;
      const ctx = off.getContext('2d');
      ctx.drawImage(rawSpriteImg, 0, 0);

      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;
      const rgb = hexToRgb(colorHex);

      function colorRegion(x0, x1, y0, y1, rT, gT, bT) {
        for (let y = y0; y < y1 && y < h; y++) {
          for (let x = x0; x < x1 && x < w; x++) {
            const idx = (y * w + x) * 4;
            const a = data[idx + 3];
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            if (a > 80 && (r < 180 || g < 180 || b < 180)) {
              data[idx] = rT;
              data[idx + 1] = gT;
              data[idx + 2] = bT;
            }
          }
        }
      }

      // Colorear Dino con el color del jugador
      colorRegion(848, 1233, 0, 50, rgb.r, rgb.g, rgb.b);

      // Elementos del mundo
      colorRegion(228, 332, 0, 42, 67, 160, 71);    // Small Cactus
      colorRegion(332, 484, 0, 55, 27, 94, 32);     // Large Cactus
      colorRegion(134, 228, 0, 45, 229, 57, 53);    // Pterodactyl

      ctx.putImageData(imgData, 0, 0);
      coloredSpriteCache.set(colorHex, off);
      return off;
    } catch (e) {
      return rawSpriteImg;
    }
  }

  // Pre-generar cache de colores estándar
  ['#2E7D32', '#0288D1', '#7B1FA2', '#E65100', '#C2185B', '#FBC02D'].forEach((col) => {
    if (rawSpriteImg.complete) {
      getColoredSprite(col);
    } else {
      rawSpriteImg.onload = () => getColoredSprite(col);
    }
  });

  const STORAGE_KEY_ADMIN = 'dino_admin_key';
  const adminAuthModal = document.getElementById('admin-auth-modal');
  const adminAuthForm = document.getElementById('admin-auth-form');
  const inputAdminKey = document.getElementById('input-admin-key');
  const adminAuthError = document.getElementById('admin-auth-error');
  const adminConnectionBanner = document.getElementById('admin-connection-banner');
  const adminConnectionBannerText = document.getElementById('admin-connection-banner-text');

  function showConnectionAlert(message) {
    if (adminConnectionBanner) {
      if (message && adminConnectionBannerText) adminConnectionBannerText.innerHTML = message;
      adminConnectionBanner.style.display = 'flex';
    }
  }

  function hideConnectionAlert() {
    if (adminConnectionBanner) {
      adminConnectionBanner.style.display = 'none';
    }
  }

  // Obtener clave de anfitrión
  let currentAdminKey = urlParams.get('key') || sessionStorage.getItem(STORAGE_KEY_ADMIN) || '';
  const STORAGE_KEY_ADMIN_PIN = 'dino_admin_room_pin';

  function requestAdminRoomCreation() {
    if (!currentAdminKey) {
      if (adminAuthModal) {
        adminAuthModal.style.display = 'flex';
        if (inputAdminKey) inputAdminKey.focus();
      }
      return;
    }
    const savedPin = sessionStorage.getItem(STORAGE_KEY_ADMIN_PIN) || '';
    socket.emit('admin:create_room', {
      adminKey: currentAdminKey,
      existingPin: currentPin || savedPin || '',
      eventName: inputEventName ? inputEventName.value : 'Torneo Dino',
      matchName: inputMatchName ? inputMatchName.value : 'Ronda 1',
      maxPlayers: selectMaxPlayers ? parseInt(selectMaxPlayers.value, 10) : 30
    });
  }

  // Manejo de eventos de conexión del socket
  socket.on('connect', () => {
    hideConnectionAlert();
    if (currentAdminKey) {
      requestAdminRoomCreation();
    } else {
      if (adminAuthModal) {
        adminAuthModal.style.display = 'flex';
        if (inputAdminKey) inputAdminKey.focus();
      }
    }
  });

  socket.on('connect_error', () => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) {
      showConnectionAlert('⚠️ No se pudo conectar con el servidor local. Ejecuta <code>INICIAR_JUEGO.bat</code> y accede a <a href="http://localhost:3000/admin" style="color:#6ee7b7; font-weight:bold; text-decoration:underline;">http://localhost:3000/admin</a>');
    } else {
      showConnectionAlert('⚠️ Conectando con el servidor en la nube... Espera un momento.');
    }
  });

  socket.on('disconnect', (reason) => {
    showConnectionAlert('⚠️ Reconectando con el servidor de juego en tiempo real...');
  });

  // 1. SOLICITAR CLAVE O CREAR SALA AL CARGAR
  if (currentAdminKey) {
    requestAdminRoomCreation();
  } else {
    if (adminAuthModal) {
      adminAuthModal.style.display = 'flex';
      if (inputAdminKey) inputAdminKey.focus();
    }
  }

  socket.on('admin:auth_error', (data) => {
    if (adminAuthModal) {
      adminAuthModal.style.display = 'flex';
      if (adminAuthError) {
        adminAuthError.textContent = data.message || 'Clave de anfitrión incorrecta.';
        adminAuthError.style.display = 'block';
      }
      if (inputAdminKey) {
        inputAdminKey.value = '';
        inputAdminKey.focus();
      }
    }
    sessionStorage.removeItem(STORAGE_KEY_ADMIN);
    sessionStorage.removeItem(STORAGE_KEY_ADMIN_PIN);
  });

  if (adminAuthForm) {
    adminAuthForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const enteredKey = inputAdminKey.value.trim();
      if (!enteredKey) return;
      currentAdminKey = enteredKey;
      sessionStorage.setItem(STORAGE_KEY_ADMIN, enteredKey);
      if (adminAuthError) adminAuthError.style.display = 'none';
      requestAdminRoomCreation();
    });
  }

  socket.on('admin:room_created', (data) => {
    adminAuthModal.style.display = 'none';
    currentPin = data.pin;
    sessionStorage.setItem(STORAGE_KEY_ADMIN, currentAdminKey);
    sessionStorage.setItem(STORAGE_KEY_ADMIN_PIN, data.pin);

    headerPin.textContent = data.pin;
    lobbyBigPin.textContent = data.pin;

    if (data.eventName) inputEventName.value = data.eventName;
    if (data.matchName) inputMatchName.value = data.matchName;
    if (data.maxPlayers !== undefined) selectMaxPlayers.value = String(data.maxPlayers);

    headerEventName.textContent = data.eventName || 'Torneo';
    headerMatchName.textContent = data.matchName || 'Ronda 1';
    headerMatchBadge.style.display = 'inline-flex';
    maxPlayersLabel.textContent = data.maxPlayers > 0 ? `(Límite: ${data.maxPlayers})` : '';

    const protocol = window.location.protocol;
    const host = window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : '';
    let displayIp = host;

    if (data.localIps && data.localIps.length > 0 && (host === 'localhost' || host === '127.0.0.1')) {
      displayIp = data.localIps[0];
    }

    const joinUrl = `${protocol}//${displayIp}${port}/player?pin=${data.pin}`;
    hostUrlText.textContent = joinUrl;
    lobbyJoinUrl.textContent = joinUrl;

    if (data.status === 'playing') {
      showView('game');
      if (data.players && data.players.length > 0) {
        currentPlayers = data.players;
        currentPlayers.forEach((player) => {
          createPlayerVisualizerCard(player);
        });
      }
    } else if (data.status === 'finished') {
      showView('podium');
    } else if (data.status === 'starting') {
      showView('countdown');
    } else {
      showView('lobby');
    }
  });

  socket.on('room:config_updated', (data) => {
    headerEventName.textContent = data.eventName;
    headerMatchName.textContent = data.matchName;
    headerMatchBadge.style.display = 'inline-flex';
    maxPlayersLabel.textContent = data.maxPlayers > 0 ? `(Límite: ${data.maxPlayers})` : '';
  });

  // 2. ACTUALIZACIÓN DE JUGADORES EN EL LOBBY
  socket.on('room:players_update', (data) => {
    currentPlayers = data.players || [];
    lobbyCount.textContent = currentPlayers.length;

    if (currentPlayers.length >= 1) {
      btnStartGame.disabled = false;
      startHint.textContent = `¡Todo listo! Hay ${currentPlayers.length} jugador(es) en la sala.`;
      startHint.style.color = '#4ade80';
    } else {
      btnStartGame.disabled = true;
      startHint.textContent = 'Esperando que se una al menos 1 jugador...';
      startHint.style.color = 'var(--text-muted)';
    }

    lobbyPlayersGrid.innerHTML = '';
    currentPlayers.forEach((player) => {
      const card = document.createElement('div');
      card.className = 'lobby-player-card';
      card.style.setProperty('--p-color', player.color);
      card.innerHTML = `
        <div class="player-avatar-circle">${player.avatar || '🦖'}</div>
        <div class="player-name-text">${escapeHtml(player.name)}</div>
        <button class="btn-kick" title="Expulsar" data-id="${player.id}">✕</button>
      `;

      const kickBtn = card.querySelector('.btn-kick');
      kickBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`¿Expulsar a ${player.name}?`)) {
          socket.emit('admin:kick_player', { pin: currentPin, playerId: player.id });
        }
      });

      lobbyPlayersGrid.appendChild(card);
    });
  });

  // 3. INICIAR PARTIDA
  if (btnOpenBrackets) {
    btnOpenBrackets.addEventListener('click', () => {
      window.open('/eliminatorias.html', '_blank');
    });
  }

  btnStartGame.addEventListener('click', () => {
    if (currentPlayers.length < 1) return;
    btnStartGame.disabled = true;
    const eventName = inputEventName.value.trim() || 'Torneo Dino';
    const matchName = inputMatchName.value.trim() || 'Ronda 1';
    const maxPlayers = parseInt(selectMaxPlayers.value, 10) || 0;
    const gameMode = selectGameMode ? selectGameMode.value : 'sudden_death';

    socket.emit('admin:start_game', {
      pin: currentPin,
      eventName,
      matchName,
      maxPlayers,
      gameMode
    });
  });

  socket.on('admin:start_error', (data) => {
    btnStartGame.disabled = true;
    if (startHint) {
      startHint.textContent = data.message || 'La partida ya fue iniciada.';
      startHint.style.color = '#f87171';
    }
  });

  // 4. CUENTA REGRESIVA SINCRONIZADA
  socket.on('game:countdown', (data) => {
    showView('countdown');
    adminCountdownNum.textContent = data.countdown;
    playBeep(data.countdown);
  });

  // 5. INICIO DE LA CARRERA EN VIVO
  socket.on('game:start', () => {
    showView('game');
    playTone(880, 0.4, 'square');
    playerVisualizers.clear();
    playersMonitoringGrid.innerHTML = '';

    currentPlayers.forEach((player) => {
      createPlayerVisualizerCard(player);
    });
  });

  function getOptimalGridColumns(count) {
    if (count <= 1) return 1;
    if (count === 2) return 2;
    if (count === 3) return 3;
    if (count === 4) return 2; // 2x2
    if (count === 5 || count === 6) return 3; // 5 -> 3+2, 6 -> 3+3
    if (count === 7 || count === 8) return 4; // 7 -> 4+3, 8 -> 4+4 (parejo 4 arriba, 3 abajo)
    if (count === 9 || count === 10) return 5; // 9 -> 5+4, 10 -> 5+5
    if (count === 11 || count === 12) return 6; // 11 -> 6+5, 12 -> 6+6
    if (count <= 15) return 5; // 13-15 -> 3 filas de 5
    if (count <= 18) return 6; // 16-18 -> 3 filas de 6
    if (count <= 24) return 6; // 4 filas de 6
    return 7;
  }

  function updateGridClass(count) {
    const cols = getOptimalGridColumns(count);
    playersMonitoringGrid.style.setProperty('--grid-cols', cols);
    playersMonitoringGrid.className = `players-grid count-${count} cols-${cols}`;
  }

  function createPlayerVisualizerCard(player) {
    let existing = document.getElementById(`admin-player-card-${player.id}`);
    if (existing) return;

    const card = document.createElement('div');
    card.className = 'player-monitor-card player-card';
    card.id = `admin-player-card-${player.id}`;
    card.style.setProperty('--p-color', player.color);

    card.innerHTML = `
      <div class="card-top-row">
        <div class="card-player-info" style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
          <span class="card-avatar" style="width: 28px; height: 28px; font-size: 1rem; border-radius: 50%; background: ${player.color}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">${player.avatar || '🦖'}</span>
          <span class="card-player-name" style="font-weight: 800; font-size: 1.05rem; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(player.name)}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
          <span class="player-lives-badge" style="display: none;">❤️❤️❤️</span>
          <span class="player-rank-badge">#--</span>
          <span class="player-action-tag running">🏃 Corriendo</span>
        </div>
      </div>
      <div class="card-dino-viewport">
        <canvas id="card-canvas-${player.id}" class="card-dino-canvas" width="600" height="150"></canvas>
        <div class="eliminated-overlay" id="elim-overlay-${player.id}">
          <div class="elim-stamp-box">
            <div class="elim-giant-x">✕</div>
            <div class="elim-player-name">${escapeHtml(player.name)}</div>
            <div class="elim-badge-text">ELIMINADO</div>
            <div class="elim-sub-stats">Puntaje: <span class="elim-score-val">0</span> pts</div>
          </div>
        </div>
      </div>
      <div class="card-track-container" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 4px;">
        <div class="card-track-bar" style="flex: 1;">
          <div class="card-track-fill" style="width: 0%;"></div>
        </div>
        <div class="card-score-box" style="font-size: 1.15rem; font-weight: 900; color: #4ade80; font-family: monospace;">
          00000 <span style="font-size: 0.75rem; color: var(--text-muted);">pts</span>
        </div>
      </div>
    `;

    playersMonitoringGrid.appendChild(card);

    const canvas = card.querySelector('.card-dino-canvas');
    const ctx = canvas.getContext('2d');

    playerVisualizers.set(player.id, {
      cardEl: card,
      canvas: canvas,
      ctx: ctx,
      color: player.color,
      legFrame: 0,
      legTimer: 0,
      pteroFrame: 0,
      pteroTimer: 0,
      dinoY: 93,
      targetDinoY: 93,
      jumpY: 0,
      jumpVel: 0,
      groundX: 0,
      speed: 6,
      obstacles: [],
      playerState: player
    });
  }

  // 6. SINCRONIZACIÓN DE ESTADOS EN TIEMPO REAL
  socket.on('leaderboard:sync', (data) => {
    if (data.status === 'playing' && !views.game.classList.contains('active') && !views.podium.classList.contains('active')) {
      showView('game');
    }

    const leaderboard = data.leaderboard || [];
    currentPlayers = leaderboard;
    statActiveCount.textContent = data.activeCount || 0;
    statCrashedCount.textContent = data.crashedCount || 0;
    statTotalCount.textContent = data.totalPlayers || 0;

    updateGridClass(leaderboard.length);

    let maxDistance = 1000;
    leaderboard.forEach((p) => {
      if (p.distance > maxDistance) maxDistance = p.distance;
    });

    leaderboard.forEach((player) => {
      let vis = playerVisualizers.get(player.id);
      if (!vis) {
        createPlayerVisualizerCard(player);
        vis = playerVisualizers.get(player.id);
      }
      if (!vis) return;

      vis.playerState = player;
      vis.obstacles = (player.obstacles || []).map((o) => ({ ...o }));
      vis.targetDinoY = (player.dinoY !== undefined) ? player.dinoY : 93;
      vis.speed = (player.speed !== undefined) ? player.speed : 6;

      const card = vis.cardEl;
      let medalSymbol = `#${player.rank}`;
      if (player.rank === 1) medalSymbol = '🥇 1º';
      else if (player.rank === 2) medalSymbol = '🥈 2º';
      else if (player.rank === 3) medalSymbol = '🥉 3º';

      let actionLabel = '🏃 Corriendo';
      let actionClass = 'running';
      if (player.action === 'jumping') { actionLabel = '🦘 Saltando'; actionClass = 'jumping'; }
      else if (player.action === 'ducking') { actionLabel = '🦆 Agachado'; actionClass = 'ducking'; }
      if (player.crashed) { actionLabel = '❌ ELIMINADO'; actionClass = 'crashed'; }

      card.querySelector('.player-rank-badge').textContent = medalSymbol;
      const actTag = card.querySelector('.player-action-tag');
      actTag.textContent = actionLabel;
      actTag.className = `player-action-tag ${actionClass}`;

      card.querySelector('.card-score-box').innerHTML = `${String(player.score).padStart(5, '0')} <span style="font-size: 0.75rem; color: var(--text-muted);">pts</span>`;

      const elimScore = card.querySelector('.elim-score-val');
      if (elimScore) elimScore.textContent = player.score;

      const progressPct = Math.min(100, Math.round((player.distance / maxDistance) * 100));
      card.querySelector('.card-track-fill').style.width = progressPct + '%';

      // Efecto de adelantamiento
      const prevRank = previousRanks.get(player.id);
      if (prevRank && prevRank !== player.rank) {
        if (player.rank < prevRank) {
          card.classList.add('flash-up');
          setTimeout(() => card.classList.remove('flash-up'), 600);
        } else {
          card.classList.add('flash-down');
          setTimeout(() => card.classList.remove('flash-down'), 600);
        }
      }
      previousRanks.set(player.id, player.rank);

      // Actualizar badge de vidas (solo en modo 3 vidas)
      const livesBadge = card.querySelector('.player-lives-badge');
      if (livesBadge) {
        if (data.gameMode === 'three_lives') {
          const l = (player.lives !== undefined) ? player.lives : (player.crashed ? 0 : 3);
          livesBadge.style.display = 'inline-flex';
          if (l >= 3) livesBadge.textContent = '❤️❤️❤️';
          else if (l === 2) livesBadge.textContent = '❤️❤️🤍';
          else if (l === 1) livesBadge.textContent = '❤️🤍🤍';
          else livesBadge.textContent = '💀';
        } else {
          livesBadge.style.display = 'none';
        }
      }

      if (player.crashed) {
        card.classList.add('crashed');
      } else {
        card.classList.remove('crashed', 'card-hidden-eliminated');
      }
    });
  });

  // 7. BUCLE DE ANIMACIÓN 60 FPS PARA LOS DINOS EN LAS TARJETAS DEL ADMIN
  let lastFrameTime = performance.now();

  function animateAdminVisualizers(now) {
    requestAnimationFrame(animateAdminVisualizers);
    const dt = Math.min(50, now - lastFrameTime);
    lastFrameTime = now;

    if (!views.game.classList.contains('active')) return;

    playerVisualizers.forEach((vis, playerId) => {
      const ctx = vis.ctx;
      const p = vis.playerState || currentPlayers.find((x) => x.id === playerId);
      if (!p) return;

      const canvasW = 600;
      const canvasH = 150;
      const groundY = 127;
      const dinoBaseY = 93;
      const dinoX = 50;

      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, canvasW, canvasH);

      // Línea base de pista
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(0, 137, canvasW, 2);

      const sprite = getColoredSprite(vis.color || '#2E7D32');
      const speed = p.speed || vis.speed || 6;

      // 1. Suelo animado
      if (!p.crashed) {
        vis.groundX = (vis.groundX - speed * (dt / 16.6)) % 600;
      }
      ctx.drawImage(sprite, 2, 54, 600, 16, vis.groundX, groundY, 600, 16);
      ctx.drawImage(sprite, 2, 54, 600, 16, vis.groundX + 600, groundY, 600, 16);

      // 2. Obstáculos (animados con interpolación fluida)
      const obstacles = (vis.obstacles && vis.obstacles.length > 0) ? vis.obstacles : (p.obstacles || []);
      if (obstacles && obstacles.length > 0) {
        obstacles.forEach((obs) => {
          if (!p.crashed) {
            obs.x -= speed * (dt / 16.6);
          }

          const obsX = obs.x;
          if (obsX > -120 && obsX < canvasW + 120) {
            if (obs.type === 'CACTUS_SMALL') {
              const size = Math.min(3, Math.max(1, obs.size || 1));
              const w = 17 * size;
              const sx = 228 + (17 * size) * (0.5 * (size - 1));
              ctx.drawImage(sprite, sx, 2, w, 35, obsX, obs.y || 105, w, 35);
            } else if (obs.type === 'CACTUS_LARGE') {
              const size = Math.min(3, Math.max(1, obs.size || 1));
              const w = 25 * size;
              const sx = 332 + (25 * size) * (0.5 * (size - 1));
              ctx.drawImage(sprite, sx, 2, w, 50, obsX, obs.y || 90, w, 50);
            } else if (obs.type === 'PTERODACTYL') {
              const sx = (vis.pteroFrame === 0) ? 134 : 180;
              ctx.drawImage(sprite, sx, 2, 46, 40, obsX, Math.min(100, Math.max(45, obs.y || 75)), 46, 40);
            }
          }
        });
      }

      // Animación de pterodáctilo
      vis.pteroTimer = (vis.pteroTimer || 0) + dt;
      if (vis.pteroTimer > 150) {
        vis.pteroTimer = 0;
        vis.pteroFrame = (vis.pteroFrame === 0) ? 1 : 0;
      }

      // 3. Posición Y del Dino (Salto seguro y acotado)
      if (p.crashed) {
        vis.dinoY = dinoBaseY;
        vis.jumpY = 0;
        vis.jumpVel = 0;
      } else if (p.action === 'jumping') {
        if (vis.targetDinoY !== undefined && vis.targetDinoY < dinoBaseY) {
          const clampedTarget = Math.max(40, Math.min(dinoBaseY, vis.targetDinoY));
          vis.dinoY += (clampedTarget - vis.dinoY) * 0.4;
        } else {
          if (vis.jumpY === 0) vis.jumpVel = -6.5;
          vis.jumpY += vis.jumpVel;
          vis.jumpVel += 0.42;
          if (vis.jumpY >= 0) {
            vis.jumpY = 0;
            vis.jumpVel = 0;
          }
          vis.dinoY = dinoBaseY + vis.jumpY;
        }
      } else {
        vis.jumpY = 0;
        vis.jumpVel = 0;
        vis.dinoY += (dinoBaseY - vis.dinoY) * 0.4;
        if (Math.abs(vis.dinoY - dinoBaseY) < 1) vis.dinoY = dinoBaseY;
      }
      vis.dinoY = Math.max(40, Math.min(dinoBaseY, vis.dinoY));

      // 4. Animación de patas
      if (!p.crashed) {
        vis.legTimer += dt;
        if (vis.legTimer > 80) {
          vis.legTimer = 0;
          vis.legFrame = (vis.legFrame === 0) ? 1 : 0;
        }
      }

      // 5. Dibujar Dino según estado
      const currentDinoY = Math.round(vis.dinoY);

      if (p.crashed) {
        // Dino chocado (ojos en X con frame 1068)
        ctx.drawImage(sprite, 1068, 2, 44, 47, dinoX, dinoBaseY, 44, 47);
      } else if (p.action === 'jumping' || currentDinoY < (dinoBaseY - 3)) {
        // Dino saltando
        ctx.drawImage(sprite, 848, 2, 44, 47, dinoX, currentDinoY, 44, 47);
      } else if (p.action === 'ducking') {
        // Dino agachado
        const duckSx = (vis.legFrame === 0) ? 1112 : 1171;
        ctx.drawImage(sprite, duckSx, 19, 59, 30, dinoX, dinoBaseY + 17, 59, 30);
      } else {
        // Dino corriendo
        const runSx = (vis.legFrame === 0) ? 936 : 980;
        ctx.drawImage(sprite, runSx, 2, 44, 47, dinoX, dinoBaseY, 44, 47);
      }
    });
  }

  requestAnimationFrame(animateAdminVisualizers);

  socket.on('game:reset_to_lobby', () => {
    playerVisualizers.clear();
    playersMonitoringGrid.innerHTML = '';
    previousRanks.clear();
    showView('lobby');
    btnStartGame.disabled = false;
  });

  // 8. FINALIZAR PARTIDA MANUALMENTE
  btnEndGame.addEventListener('click', () => {
    if (confirm('¿Deseas finalizar la partida actual y mostrar el podio?')) {
      socket.emit('admin:end_game', { pin: currentPin });
    }
  });

  // 9. RESULTADOS / PODIO DE GANADORES
  socket.on('game:ended', (data) => {
    showView('podium');
    lastGameResult = data;
    sessionHistory.unshift(data);

    playFanfare();

    const podium = data.podium || [];
    const leaderboard = data.leaderboard || [];

    podiumMatchTitle.textContent = `${data.eventName || 'Torneo'} • ${data.matchName || 'Carrera'}`;
    podiumMatchSubtitle.textContent = `PIN: ${data.pin || currentPin} • Fecha: ${new Date(data.date || Date.now()).toLocaleString()}`;

    for (let place = 1; place <= 3; place++) {
      const p = podium[place - 1];
      const slot = document.getElementById(`podium-slot-${place}`);
      const nameEl = document.getElementById(`winner-name-${place}`);
      const scoreEl = document.getElementById(`winner-score-${place}`);
      const avatarEl = document.getElementById(`winner-avatar-${place}`);

      if (p) {
        slot.style.display = 'flex';
        nameEl.textContent = p.name;
        scoreEl.textContent = `${p.score} pts`;
        avatarEl.textContent = p.avatar || '🦖';
        avatarEl.style.background = p.color;
        avatarEl.style.boxShadow = `0 0 16px ${p.color}`;
      } else {
        slot.style.display = 'none';
      }
    }

    leaderboardTableBody.innerHTML = '';
    leaderboard.forEach((player) => {
      const row = document.createElement('tr');
      const survivalSec = player.survival_ms ? (player.survival_ms / 1000).toFixed(1) + 's' : '-';
      row.innerHTML = `
        <td><strong>#${player.rank}</strong></td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:${player.color};"></span>
            <strong>${escapeHtml(player.name)}</strong>
          </div>
        </td>
        <td><strong style="color: #4ade80; font-family: monospace;">${player.score}</strong></td>
        <td>${Math.round(Number(player.distance) || 0)}</td>
        <td>${survivalSec}</td>
        <td><span class="status-chip ${player.crashed ? 'crashed' : 'alive'}">${player.crashed ? '💥 Chocado' : '🏃 Sobreviviente'}</span></td>
      `;
      leaderboardTableBody.appendChild(row);
    });

    launchConfetti();
  });

  // 10. EXPORTACIÓN DE RESULTADOS
  function exportCSV(resultData) {
    const data = resultData || lastGameResult;
    if (!data || !data.leaderboard || data.leaderboard.length === 0) {
      alert('No hay resultados disponibles para exportar.');
      return;
    }

    let csv = '\uFEFF';
    csv += 'Posicion,Jugador,Puntaje,Distancia,Supervivencia_Segundos,Estado,Evento,Partida,PIN,Fecha\n';

    data.leaderboard.forEach((p) => {
      const survivalSec = p.survival_ms ? (p.survival_ms / 1000).toFixed(1) : '0';
      const status = p.crashed ? 'Chocado' : 'Sobreviviente';
      const safeName = `"${(p.name || '').replace(/"/g, '""')}"`;
      const safeEvent = `"${(data.eventName || 'Torneo').replace(/"/g, '""')}"`;
      const safeMatch = `"${(data.matchName || 'Carrera').replace(/"/g, '""')}"`;
      csv += `${p.rank},${safeName},${p.score},${Math.round(p.distance || 0)},${survivalSec},${status},${safeEvent},${safeMatch},${data.pin || currentPin},${data.date || new Date().toISOString()}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = `resultados_${(data.matchName || 'carrera').replace(/[^a-zA-Z0-9_-]/g, '_')}_PIN${data.pin || currentPin}.csv`;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportJSON(resultData) {
    const data = resultData || lastGameResult;
    if (!data || !data.leaderboard || data.leaderboard.length === 0) {
      alert('No hay resultados disponibles para exportar.');
      return;
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = `resultados_${(data.matchName || 'carrera').replace(/[^a-zA-Z0-9_-]/g, '_')}_PIN${data.pin || currentPin}.json`;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  btnExportCsv.addEventListener('click', () => exportCSV());
  btnExportJson.addEventListener('click', () => exportJSON());
  btnPrintResults.addEventListener('click', () => window.print());

  // 11. MODAL DE HISTORIAL DE PARTIDAS (Carga en vivo desde la Base de Datos)
  async function renderHistoryList() {
    try {
      historyEmpty.textContent = 'Cargando historial desde la Base de Datos...';
      historyEmpty.style.display = 'block';
      historyList.innerHTML = '';

      const res = await fetch('/api/db/results');
      const data = await res.json();
      const results = (data && data.results && data.results.length > 0) ? data.results : sessionHistory;

      if (!results || results.length === 0) {
        historyEmpty.textContent = 'No hay partidas registradas en la Base de Datos todavía.';
        historyEmpty.style.display = 'block';
        return;
      }

      historyEmpty.style.display = 'none';
      historyList.innerHTML = '';

      results.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'history-item';
        const dateObj = new Date(item.date);
        const timeStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString();
        div.innerHTML = `
          <div class="history-item-info">
            <strong>${escapeHtml(item.matchName || 'Carrera')} (${escapeHtml(item.eventName || 'Torneo')})</strong>
            <div class="history-item-meta">
              PIN: ${item.pin || '--'} • Fecha: ${timeStr} • Jugadores: ${item.totalPlayers || 0}
            </div>
            <div class="history-item-winner">
              👑 Ganador: ${escapeHtml(item.winner)} (${item.winnerScore} pts)
            </div>
          </div>
          <button class="btn-export btn-hist-dl" data-idx="${idx}">📥 CSV</button>
        `;

        div.querySelector('.btn-hist-dl').addEventListener('click', () => {
          exportCSV(results[idx]);
        });

        historyList.appendChild(div);
      });
    } catch (err) {
      console.error('Error al cargar historial:', err);
      if (sessionHistory.length === 0) {
        historyEmpty.textContent = 'No hay partidas registradas todavía.';
        historyEmpty.style.display = 'block';
      }
    }
  }

  btnOpenHistory.addEventListener('click', () => {
    renderHistoryList();
    historyModal.style.display = 'flex';
  });

  btnCloseHistory.addEventListener('click', () => {
    historyModal.style.display = 'none';
  });

  historyModal.addEventListener('click', (e) => {
    if (e.target === historyModal) {
      historyModal.style.display = 'none';
    }
  });

  btnOpenSpectator.addEventListener('click', () => {
    if (currentPin) {
      window.open(`/spectator?pin=${currentPin}`, '_blank');
    } else {
      window.open('/spectator', '_blank');
    }
  });

  // 12. ACCIONES DEL PODIO
  btnReplaySameRoom.addEventListener('click', () => {
    socket.emit('admin:reset_to_lobby', { pin: currentPin });
    showView('lobby');
    btnStartGame.disabled = false;
  });

  btnNewRoom.addEventListener('click', () => {
    sessionStorage.removeItem(STORAGE_KEY_ADMIN_PIN);
    window.location.reload();
  });

  // 13. ANIMACIÓN DE CONFETI
  function launchConfetti() {
    if (confettiActive) return;
    confettiActive = true;

    const ctx = confettiCanvas.getContext('2d');
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;

    const pieces = [];
    const colors = ['#22c55e', '#38bdf8', '#fbbf24', '#f87171', '#a855f7', '#ec4899', '#ffffff'];

    for (let i = 0; i < 120; i++) {
      pieces.push({
        x: Math.random() * confettiCanvas.width,
        y: Math.random() * confettiCanvas.height - confettiCanvas.height,
        w: Math.random() * 10 + 6,
        h: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vy: Math.random() * 3 + 2,
        vx: Math.random() * 2 - 1,
        rot: Math.random() * 360,
        vrot: Math.random() * 6 - 3
      });
    }

    let frames = 0;
    function renderConfetti() {
      if (frames > 220) {
        ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        confettiActive = false;
        return;
      }
      frames++;
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

      pieces.forEach((p) => {
        p.y += p.vy;
        p.x += p.vx;
        p.rot += p.vrot;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });

      requestAnimationFrame(renderConfetti);
    }

    renderConfetti();
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
})();
