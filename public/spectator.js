(function () {
  'use strict';

  const urlParams = new URLSearchParams(window.location.search);
  const customBackendUrl = urlParams.get('server') || localStorage.getItem('dino_backend_url');
  if (urlParams.get('server')) {
    localStorage.setItem('dino_backend_url', urlParams.get('server'));
  }

  const socket = (typeof io !== 'undefined')
    ? (customBackendUrl ? io(customBackendUrl) : io())
    : null;

  // Elementos DOM
  const views = {
    pin: document.getElementById('spec-view-pin'),
    lobby: document.getElementById('spec-view-lobby'),
    countdown: document.getElementById('spec-view-countdown'),
    game: document.getElementById('spec-view-game'),
    podium: document.getElementById('spec-view-podium')
  };

  const specPin = document.getElementById('spec-pin');
  const specMatchBadge = document.getElementById('spec-match-badge');
  const specEventName = document.getElementById('spec-event-name');
  const specMatchName = document.getElementById('spec-match-name');
  const specStatusLabel = document.getElementById('spec-status-label');

  const specPinForm = document.getElementById('spec-pin-form');
  const specInputPin = document.getElementById('spec-input-pin');
  const specPinError = document.getElementById('spec-pin-error');

  const specPlayersCount = document.getElementById('spec-players-count');
  const specCountdownNum = document.getElementById('spec-countdown-num');

  const specActiveNum = document.getElementById('spec-active-num');
  const specCrashedNum = document.getElementById('spec-crashed-num');
  const specTotalNum = document.getElementById('spec-total-num');
  const specLeaderboardList = document.getElementById('spec-leaderboard-list');

  const specPodiumTitle = document.getElementById('spec-podium-title');
  const specPodiumSubtitle = document.getElementById('spec-podium-subtitle');
  const specLeaderboardTableBody = document.getElementById('spec-leaderboard-table-body');
  const specConfettiCanvas = document.getElementById('spec-confetti-canvas');

  let currentPin = '';
  let confettiActive = false;

  function showView(name) {
    Object.keys(views).forEach((key) => {
      if (key === name && views[key]) {
        views[key].classList.add('active');
      } else if (views[key]) {
        views[key].classList.remove('active');
      }
    });
  }

  // Leer PIN desde URL params (ej: /spectator?pin=1234)
  const pinFromUrl = urlParams.get('pin');
  if (pinFromUrl) {
    joinRoomAsSpectator(pinFromUrl);
  } else {
    showView('pin');
  }

  specPinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const pin = specInputPin.value.trim();
    if (pin.length >= 4) {
      joinRoomAsSpectator(pin);
    } else {
      specPinError.textContent = 'Ingresa un PIN válido de 4 dígitos.';
      specPinError.style.display = 'block';
    }
  });

  function joinRoomAsSpectator(pin) {
    currentPin = pin;
    socket.emit('spectator:join_room', { pin });
  }

  socket.on('spectator:joined', (data) => {
    specPin.textContent = data.pin;
    if (data.eventName || data.matchName) {
      specEventName.textContent = data.eventName || 'Torneo';
      specMatchName.textContent = data.matchName || 'Carrera';
      specMatchBadge.style.display = 'inline-flex';
    }

    if (data.status === 'playing') {
      showView('game');
      specStatusLabel.textContent = 'EN VIVO';
    } else if (data.status === 'finished') {
      showView('podium');
      specStatusLabel.textContent = 'FINALIZADO';
    } else {
      showView('lobby');
      specStatusLabel.textContent = 'EN ESPERA';
      specPlayersCount.textContent = data.totalPlayers || 0;
    }
  });

  socket.on('spectator:error', (data) => {
    showView('pin');
    specPinError.textContent = data.message || 'Error al conectar con la sala.';
    specPinError.style.display = 'block';
  });

  socket.on('room:players_update', (data) => {
    specPlayersCount.textContent = data.count || (data.players ? data.players.length : 0);
  });

  socket.on('room:config_updated', (data) => {
    specEventName.textContent = data.eventName || 'Torneo';
    specMatchName.textContent = data.matchName || 'Carrera';
    specMatchBadge.style.display = 'inline-flex';
  });

  socket.on('game:countdown', (data) => {
    showView('countdown');
    specStatusLabel.textContent = 'POR INICIAR';
    specCountdownNum.textContent = data.countdown;
    if (data.eventName) specEventName.textContent = data.eventName;
    if (data.matchName) specMatchName.textContent = data.matchName;
  });

  socket.on('game:start', () => {
    showView('game');
    specStatusLabel.textContent = 'EN VIVO';
    specLeaderboardList.innerHTML = '';
  });

  socket.on('leaderboard:sync', (data) => {
    specActiveNum.textContent = data.activeCount || 0;
    specCrashedNum.textContent = data.crashedCount || 0;
    specTotalNum.textContent = data.totalPlayers || 0;

    const leaderboard = data.leaderboard || [];
    specLeaderboardList.innerHTML = '';

    leaderboard.forEach((player) => {
      const card = document.createElement('div');
      card.className = 'spec-card';
      card.style.setProperty('--p-color', player.color);

      let medal = `#${player.rank}`;
      if (player.rank === 1) medal = '🥇';
      else if (player.rank === 2) medal = '🥈';
      else if (player.rank === 3) medal = '🥉';

      let actLabel = '🏃 Corriendo';
      let actClass = 'running';
      if (player.action === 'jumping') { actLabel = '🦘 Saltando'; actClass = 'jumping'; }
      else if (player.action === 'ducking') { actLabel = '🦆 Agachado'; actClass = 'ducking'; }
      if (player.crashed) { actLabel = '💥 Chocado'; actClass = 'crashed'; }

      card.innerHTML = `
        <div class="spec-card-left">
          <div class="spec-card-rank">${medal}</div>
          <div class="spec-card-avatar">${player.avatar || '🦖'}</div>
          <div>
            <div class="spec-card-name">${escapeHtml(player.name)}</div>
            <div class="spec-card-action ${actClass}">${actLabel}</div>
          </div>
        </div>
        <div class="spec-card-right">
          <div class="spec-card-score">${String(player.score).padStart(5, '0')}</div>
          <div class="spec-card-dist">${Math.round(player.distance || 0)} px</div>
        </div>
      `;

      specLeaderboardList.appendChild(card);
    });
  });

  socket.on('game:ended', (data) => {
    showView('podium');
    specStatusLabel.textContent = 'FINALIZADO';

    const podium = data.podium || [];
    const leaderboard = data.leaderboard || [];

    specPodiumTitle.textContent = `${data.eventName || 'Torneo'} • ${data.matchName || 'Carrera'}`;
    specPodiumSubtitle.textContent = `PIN: ${data.pin || currentPin} • Fecha: ${new Date(data.date || Date.now()).toLocaleString()}`;

    for (let place = 1; place <= 3; place++) {
      const p = podium[place - 1];
      const slot = document.getElementById(`spec-podium-${place}`);
      const nameEl = document.getElementById(`spec-name-${place}`);
      const scoreEl = document.getElementById(`spec-score-${place}`);
      const avatarEl = document.getElementById(`spec-avatar-${place}`);

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

    specLeaderboardTableBody.innerHTML = '';
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
      specLeaderboardTableBody.appendChild(row);
    });

    launchConfetti();
  });

  socket.on('game:reset_to_lobby', () => {
    showView('lobby');
    specStatusLabel.textContent = 'EN ESPERA';
  });

  function launchConfetti() {
    if (confettiActive) return;
    confettiActive = true;

    const ctx = specConfettiCanvas.getContext('2d');
    specConfettiCanvas.width = window.innerWidth;
    specConfettiCanvas.height = window.innerHeight;

    const pieces = [];
    const colors = ['#22c55e', '#38bdf8', '#fbbf24', '#f87171', '#a855f7', '#ec4899', '#ffffff'];

    for (let i = 0; i < 100; i++) {
      pieces.push({
        x: Math.random() * specConfettiCanvas.width,
        y: Math.random() * specConfettiCanvas.height - specConfettiCanvas.height,
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
        ctx.clearRect(0, 0, specConfettiCanvas.width, specConfettiCanvas.height);
        confettiActive = false;
        return;
      }
      frames++;
      ctx.clearRect(0, 0, specConfettiCanvas.width, specConfettiCanvas.height);

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
