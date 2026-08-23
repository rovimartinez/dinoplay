(function () {
  'use strict';

  const socket = io();
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

  const btnReplaySameRoom = document.getElementById('btn-replay-same-room');
  const btnNewRoom = document.getElementById('btn-new-room');
  const leaderboardTableBody = document.getElementById('leaderboard-table-body');
  const confettiCanvas = document.getElementById('confetti-canvas');

  // Estado del Admin
  let currentPin = '';
  let currentPlayers = [];
  let previousRanks = new Map();
  let confettiActive = false;

  // Mapa de estados de animación para cada jugador
  const playerVisualizers = new Map();

  // Cache de spritesheets coloreados por color hex
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
      colorRegion(86, 134, 0, 20, 66, 165, 245);    // Clouds
      colorRegion(0, 1200, 52, 70, 141, 110, 99);   // Ground
      colorRegion(645, 655, 0, 15, 255, 214, 0);    // Stars
      colorRegion(484, 645, 0, 45, 255, 238, 88);   // Moon

      ctx.putImageData(imgData, 0, 0);
      coloredSpriteCache.set(colorHex, off);
      return off;
    } catch(e) {
      return rawSpriteImg;
    }
  }

  // Cambiar vista activa
  function showView(name) {
    Object.keys(views).forEach((key) => {
      if (key === name && views[key]) {
        views[key].classList.add('active');
      } else if (views[key]) {
        views[key].classList.remove('active');
      }
    });
  }

  // 1. CREAR SALA AL CARGAR
  socket.emit('admin:create_room');

  socket.on('admin:room_created', (data) => {
    currentPin = data.pin;
    headerPin.textContent = data.pin;
    lobbyBigPin.textContent = data.pin;

    const host = window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : '';
    let displayIp = host;

    if (data.localIps && data.localIps.length > 0 && (host === 'localhost' || host === '127.0.0.1')) {
      displayIp = data.localIps[0];
    }

    const joinUrl = `http://${displayIp}${port}/player?pin=${data.pin}`;
    hostUrlText.textContent = joinUrl;
    lobbyJoinUrl.textContent = joinUrl;
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
  btnStartGame.addEventListener('click', () => {
    if (currentPlayers.length < 1) return;
    btnStartGame.disabled = true;
    socket.emit('admin:start_game', { pin: currentPin });
    // NO saltamos a 'game' de inmediato; esperamos la cuenta regresiva sincronizada
  });

  // 4. CUENTA REGRESIVA SINCRONIZADA
  socket.on('game:countdown', (data) => {
    showView('countdown');
    if (adminCountdownNum) {
      adminCountdownNum.textContent = data.countdown;
    }
  });

  // 5. INICIO DE PARTIDA SIMULTÁNEO
  socket.on('game:start', () => {
    showView('game');
    // Limpiar estados de animación de los visualizadores para arrancar limpios
    playerVisualizers.forEach(v => {
      v.jumpY = 0;
      v.jumpVel = 0;
      v.groundX = 0;
    });
  });

  // 6. SINCRONIZACIÓN DE PANTALLA DIVIDIDA / LEADERBOARD EN VIVO
  socket.on('leaderboard:sync', (data) => {
    const leaderboard = data.leaderboard || [];
    statActiveCount.textContent = data.activeCount || 0;
    statCrashedCount.textContent = data.crashedCount || 0;
    statTotalCount.textContent = data.totalPlayers || 0;

    // Ajustar clase de cuadrícula según cantidad de jugadores
    playersMonitoringGrid.className = 'players-grid';
    if (leaderboard.length <= 1) {
      playersMonitoringGrid.classList.add('count-1');
    } else if (leaderboard.length <= 4) {
      playersMonitoringGrid.classList.add('count-3');
    } else if (leaderboard.length <= 12) {
      playersMonitoringGrid.classList.add('count-medium');
    } else {
      playersMonitoringGrid.classList.add('count-large');
    }

    let maxDistance = 500;
    leaderboard.forEach(p => { if (p.distance > maxDistance) maxDistance = p.distance; });

    // Actualizar o crear tarjetas para cada jugador
    const currentIds = new Set(leaderboard.map(p => p.id));

    // Limpiar visualizadores de jugadores que salieron
    playerVisualizers.forEach((v, id) => {
      if (!currentIds.has(id)) {
        if (v.cardEl && v.cardEl.parentNode) v.cardEl.parentNode.removeChild(v.cardEl);
        playerVisualizers.delete(id);
      }
    });

    leaderboard.forEach((player) => {
      let vis = playerVisualizers.get(player.id);

      if (!vis) {
        // Crear tarjeta DOM
        const card = document.createElement('div');
        card.className = 'player-monitor-card';
        card.setAttribute('data-player-id', player.id);

        card.innerHTML = `
          <div class="card-top-row">
            <span class="player-rank-badge">1º</span>
            <span class="player-action-tag running">🏃 Corriendo</span>
          </div>
          <div class="card-main-info">
            <div class="card-avatar">${player.avatar || '🦖'}</div>
            <div class="card-details">
              <div class="card-player-name">${escapeHtml(player.name)}</div>
              <div class="card-score-box">00000 <span style="font-size: 0.75rem; color: var(--text-muted);">pts</span></div>
            </div>
          </div>
          <div class="card-dino-viewport">
            <canvas class="card-dino-canvas" width="600" height="150"></canvas>
          </div>
          <div class="card-track-container">
            <div class="card-track-bar">
              <div class="card-track-fill" style="width: 0%;"></div>
            </div>
          </div>
        `;

        playersMonitoringGrid.appendChild(card);
        const canvas = card.querySelector('.card-dino-canvas');
        const ctx = canvas.getContext('2d');

        vis = {
          cardEl: card,
          canvas: canvas,
          ctx: ctx,
          player: player,
          jumpY: 0,
          jumpVel: 0,
          legFrame: 0,
          legTimer: 0,
          groundX: 0,
          cloudX: 300
        };

        playerVisualizers.set(player.id, vis);
      }

      // Actualizar datos del jugador
      vis.player = player;
      const card = vis.cardEl;
      card.style.setProperty('--p-color', player.color);

      // Clases de rango y choque
      const rankClass = player.rank <= 3 ? `rank-${player.rank}` : '';
      card.className = `player-monitor-card ${rankClass} ${player.crashed ? 'crashed' : ''}`;

      // Destellos
      const prevRank = previousRanks.get(player.id);
      if (prevRank !== undefined) {
        if (player.rank < prevRank) card.classList.add('flash-up');
        else if (player.rank > prevRank) card.classList.add('flash-down');
      }
      previousRanks.set(player.id, player.rank);

      // Etiquetas y medallas
      let medalSymbol = `${player.rank}º`;
      if (player.rank === 1) medalSymbol = '🥇 1º';
      else if (player.rank === 2) medalSymbol = '🥈 2º';
      else if (player.rank === 3) medalSymbol = '🥉 3º';

      let actionLabel = '🏃 Corriendo';
      let actionClass = 'running';
      if (player.action === 'jumping') { actionLabel = '🦘 Saltando'; actionClass = 'jumping'; }
      else if (player.action === 'ducking') { actionLabel = '🦆 Agachado'; actionClass = 'ducking'; }
      if (player.crashed) { actionLabel = '💥 Chocado'; actionClass = 'crashed'; }

      card.querySelector('.player-rank-badge').textContent = medalSymbol;
      const actTag = card.querySelector('.player-action-tag');
      actTag.textContent = actionLabel;
      actTag.className = `player-action-tag ${actionClass}`;

      card.querySelector('.card-player-name').textContent = player.name;
      card.querySelector('.card-score-box').innerHTML = `${String(player.score).padStart(5, '0')} <span style="font-size: 0.75rem; color: var(--text-muted);">pts</span>`;

      const progressPct = Math.min(100, Math.round((player.distance / maxDistance) * 100));
      card.querySelector('.card-track-fill').style.width = progressPct + '%';
    });

    // Ordenar tarjetas en el DOM según el ranking
    leaderboard.forEach((player) => {
      const vis = playerVisualizers.get(player.id);
      if (vis && vis.cardEl) {
        playersMonitoringGrid.appendChild(vis.cardEl);
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

    playerVisualizers.forEach((vis) => {
      const ctx = vis.ctx;
      const canvas = vis.canvas;
      const p = vis.player;
      const sprite = getColoredSprite(p.color);

      const W = canvas.width;
      const H = canvas.height;

      // Limpiar lienzo blanco
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      const horizonY = 127;
      const dinoBaseY = 93;
      const speed = p.crashed ? 0 : 5.5;

      // 1. Nubes de fondo
      vis.cloudX -= (speed * 0.15);
      if (vis.cloudX < -60) vis.cloudX = W + 40;
      // Cloud sprite: x: 86, y: 2, w: 46, h: 14
      ctx.drawImage(sprite, 86, 2, 46, 14, vis.cloudX, 18, 46, 14);

      // 2. Línea de horizonte / suelo desértico
      vis.groundX = (vis.groundX - speed) % 600;
      // Horizon sprite: x: 2, y: 54, w: 600, h: 12
      ctx.drawImage(sprite, 2, 54, 600, 12, vis.groundX, horizonY, 600, 12);
      ctx.drawImage(sprite, 2, 54, 600, 12, vis.groundX + 600, horizonY, 600, 12);

      // 3. Obstáculos reales sincronizados del jugador (Cactus y Pterodáctilos)
      if (p.obstacles && p.obstacles.length > 0) {
        p.obstacles.forEach((obs) => {
          const obsX = Number.isFinite(obs.x) ? obs.x : 0;
          const obsY = Number.isFinite(obs.y) ? obs.y : horizonY - (obs.height || 35);
          if (obsX > -60 && obsX < W + 60) {
            const size = obs.size || 1;
            if (obs.type === 'CACTUS_SMALL') {
              const sx = 228 + (17 * size) * (0.5 * (size - 1));
              ctx.drawImage(sprite, sx, 2, 17 * size, 35, obsX, obsY, 17 * size, 35);
            } else if (obs.type === 'CACTUS_LARGE') {
              const sx = 332 + (25 * size) * (0.5 * (size - 1));
              ctx.drawImage(sprite, sx, 2, 25 * size, 50, obsX, obsY, 25 * size, 50);
            } else if (obs.type === 'PTERODACTYL') {
              ctx.drawImage(sprite, 134, 2, 46, 40, obsX, obsY, 46, 40);
            }
          }
        });
      }

      // 4. Física del Salto del Dino (sincronizado con player.action)
      if (p.action === 'jumping' && !p.crashed) {
        if (vis.jumpY === 0) vis.jumpVel = -11; // Impulso inicial
        vis.jumpY += vis.jumpVel;
        vis.jumpVel += 0.55; // Gravedad
        if (vis.jumpY >= 0) {
          vis.jumpY = 0;
          vis.jumpVel = 0;
        }
      } else {
        if (vis.jumpY < 0) {
          vis.jumpY += 3;
          if (vis.jumpY > 0) vis.jumpY = 0;
        }
      }

      // 5. Animación de patas al correr
      vis.legTimer += dt;
      if (vis.legTimer > 90) {
        vis.legTimer = 0;
        vis.legFrame = (vis.legFrame === 0) ? 1 : 0;
      }

      // 6. Dibujar el Dinosaurio según su acción real
      const dinoX = 50;
      const dinoGroundY = dinoBaseY + vis.jumpY;

      if (p.crashed) {
        // Dibujar el cactus de la colisión justo donde chocó el dino
        ctx.drawImage(sprite, 332, 2, 25, 50, dinoX + 28, 90, 25, 50);

        // Dino chocado (x: 1024, y: 0, w: 44, h: 47)
        ctx.drawImage(sprite, 1024, 0, 44, 47, dinoX, dinoBaseY, 44, 47);

        // Estrellita / efecto de choque
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('💥', dinoX + 34, dinoBaseY - 8);
      } else if (p.action === 'ducking') {
        // Dino agachado (ducking 1: 1112, ducking 2: 1171, w: 59, h: 47)
        const duckSx = vis.legFrame === 0 ? 1112 : 1171;
        ctx.drawImage(sprite, duckSx, 0, 59, 47, dinoX, dinoBaseY, 59, 47);
      } else if (p.action === 'jumping' || vis.jumpY < 0) {
        // Dino saltando en el aire (x: 848, y: 0, w: 44, h: 47)
        ctx.drawImage(sprite, 848, 0, 44, 47, dinoX, dinoGroundY, 44, 47);
      } else {
        // Dino corriendo (running 1: 936, running 2: 980, w: 44, h: 47)
        const runSx = vis.legFrame === 0 ? 936 : 980;
        ctx.drawImage(sprite, runSx, 0, 44, 47, dinoX, dinoGroundY, 44, 47);
      }
    });
  }

  requestAnimationFrame(animateAdminVisualizers);

  // 8. FINALIZAR PARTIDA MANUALMENTE
  btnEndGame.addEventListener('click', () => {
    if (confirm('¿Deseas finalizar la partida actual y mostrar el podio?')) {
      socket.emit('admin:end_game', { pin: currentPin });
    }
  });

  // 9. RESULTADOS / PODIO DE GANADORES
  socket.on('game:ended', (data) => {
    showView('podium');

    const podium = data.podium || [];
    const leaderboard = data.leaderboard || [];

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
        <td><span class="status-chip ${player.crashed ? 'crashed' : 'alive'}">${player.crashed ? '💥 Chocado' : '🏃 Sobreviviente'}</span></td>
      `;
      leaderboardTableBody.appendChild(row);
    });

    launchConfetti();
  });

  // 10. ACCIONES DEL PODIO
  btnReplaySameRoom.addEventListener('click', () => {
    socket.emit('admin:reset_to_lobby', { pin: currentPin });
    showView('lobby');
    btnStartGame.disabled = false;
  });

  btnNewRoom.addEventListener('click', () => {
    window.location.reload();
  });

  // 11. ANIMACIÓN DE CONFETI
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
