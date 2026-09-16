(function () {
  'use strict';

  const urlParams = new URLSearchParams(window.location.search);
  const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname) ||
                  window.location.hostname.startsWith('192.168.') ||
                  window.location.hostname.startsWith('10.');

  let customBackendUrl = urlParams.get('server');
  if (urlParams.get('server')) {
    localStorage.setItem('dino_backend_url', urlParams.get('server'));
  } else if (!isLocal) {
    customBackendUrl = localStorage.getItem('dino_backend_url');
  } else {
    localStorage.removeItem('dino_backend_url');
    customBackendUrl = null;
  }

  // Si se abre directamente en Cloudflare Pages, redirigir automáticamente al túnel activo
  if (window.location.hostname.includes('pages.dev') && !urlParams.get('server')) {
    fetch('/api/server-url?t=' + Date.now())
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.is_online && data.active_url) {
          const targetUrl = data.active_url.replace(/\/+$/, '') + '/spectator.html' + window.location.search;
          window.location.replace(targetUrl);
        }
      })
      .catch(() => {});
  }

  // Helper para renderizar el dinosaurio pixel art SVG
  function getDinoSvg(color = '#00ff66', size = 20) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 462 462" width="${size}" height="${size}" style="display:inline-block; vertical-align:middle;">
      <path fill="${color}" stroke="${color}" stroke-width="0" d="M 250 20 L 404 20 L 404 39 L 422.5 39 L 423 39.5 L 423 129 L 327.5 129 L 327 129.5 L 327 148 L 384.5 148 L 385 148.5 L 385 167 L 308 167 L 308 205 L 346 205 L 346 244 L 327 244 L 327 225 L 308 225 L 308 295 L 289 295 L 289 327 L 269 327 L 269 346 L 250.5 346 L 250 346.5 L 250 423 L 269 423 L 269 442 L 225 442 L 225 385 L 205 385 L 205 365 L 186 365 L 186 385 L 167 385 L 167 404 L 148 404 L 148 423 L 167 423 L 167 442 L 129 442 L 129 365 L 109 365 L 109 346 L 90 346 L 90 327 L 71 327 L 71 301 L 52 301 L 52 282 L 33 282 L 33 167 L 52 167 L 52 205 L 71 205 L 71 225 L 90 225 L 90 244 L 129 244 L 129 225 L 148 225 L 148 205 L 180 205 L 180 186 L 205 186 L 205 167 L 225 167 L 225 39.5 L 225.5 39 L 250 39 L 250 20 Z M 269 52 L 269 71 L 289 71 L 289 52 L 269 52 Z "/>
    </svg>`;
  }

  const socket = (typeof io !== 'undefined')
    ? (customBackendUrl
        ? io(customBackendUrl, { transports: ['websocket', 'polling'], reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000 })
        : io({ transports: ['websocket', 'polling'], reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000 }))
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

  const specCountdownStages = {
    3: { title: '¡PREPARADOS! ⚡', desc: 'Ajusten sus controles y concéntrense...', color: '#00e5ff', glow: 'rgba(0, 229, 255, 0.6)' },
    2: { title: '¡LISTOS! 🔥', desc: 'Los dinosaurios están en la línea de partida...', color: '#ffea00', glow: 'rgba(255, 234, 0, 0.6)' },
    1: { title: '¡A SUS MARCAS! 🎯', desc: 'Iniciando carrera en 3, 2, 1...', color: '#ff0055', glow: 'rgba(255, 0, 85, 0.6)' },
    0: { title: '¡¡¡A CORRER!!! 💨', desc: '¡Que gane el más rápido!', color: '#00ff66', glow: 'rgba(0, 255, 102, 0.7)' }
  };

  socket.on('game:countdown', (data) => {
    showView('countdown');
    specStatusLabel.textContent = 'POR INICIAR';
    const num = data.countdown;
    specCountdownNum.textContent = num;

    const conf = specCountdownStages[num] || specCountdownStages[1];
    const countdownCircle = document.querySelector('#spec-view-countdown .countdown-circle');
    const countdownTitle = document.querySelector('#spec-view-countdown .countdown-hero-title');
    const countdownDesc = document.querySelector('#spec-view-countdown .countdown-hero-desc');

    if (countdownTitle) {
      countdownTitle.textContent = conf.title;
      countdownTitle.style.color = conf.color;
      countdownTitle.style.textShadow = `2px 2px 0 #000, 0 0 15px ${conf.glow}`;
    }
    if (countdownDesc) countdownDesc.textContent = conf.desc;

    if (countdownCircle) {
      countdownCircle.style.borderColor = conf.color;
      countdownCircle.style.boxShadow = `8px 8px 0 #000, 0 0 40px ${conf.glow}`;
      countdownCircle.classList.remove('pop-trigger');
      void countdownCircle.offsetWidth;
      countdownCircle.classList.add('pop-trigger');
    }

    specCountdownNum.style.color = conf.color;
    specCountdownNum.style.textShadow = `0 0 20px ${conf.glow}, 4px 4px 0 #000`;

    if (data.eventName) specEventName.textContent = data.eventName;
    if (data.matchName) specMatchName.textContent = data.matchName;
  });

  const specTimerBox = document.getElementById('spec-timer-box');
  const specTimerVal = document.getElementById('spec-timer-val');

  socket.on('game:start', (data) => {
    showView('game');
    specStatusLabel.textContent = 'EN VIVO';
    specLeaderboardList.innerHTML = '';
    const isTimeAttack = data && data.gameMode === 'time_attack';
    if (specTimerBox) {
      specTimerBox.style.display = isTimeAttack ? 'inline-block' : 'none';
      if (specTimerVal && data && data.durationSeconds) {
        const m = Math.floor(data.durationSeconds / 60);
        const s = data.durationSeconds % 60;
        specTimerVal.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      }
    }
  });

  socket.on('game:timer_tick', (data) => {
    if (specTimerBox) specTimerBox.style.display = 'inline-block';
    if (specTimerVal && data && typeof data.remainingSeconds === 'number') {
      const rem = Math.max(0, data.remainingSeconds);
      const m = Math.floor(rem / 60);
      const s = rem % 60;
      specTimerVal.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      if (rem <= 10) {
        specTimerVal.style.color = '#ff0055';
        specTimerVal.style.textShadow = '0 0 10px #ff0055';
      } else {
        specTimerVal.style.color = '#00e5ff';
        specTimerVal.style.textShadow = 'none';
      }
    }
  });

  // Mapeo inteligente de fotos de estudiantes
  const studentPhotos = [
    { keys: ['mariana', 'ortiz'], url: '/fotos_estudiantes/3A - ORTIZ CAVIEDES MARIANA.jpg' },
    { keys: ['luis david', 'carrillo'], url: '/fotos_estudiantes/3A - CARRILLO OROZCO LUIS DAVID.jpg' },
    { keys: ['luciana', 'santodomingo'], url: '/fotos_estudiantes/3A - SANTODOMINGO BARROS LUCIANA.jpg' },
    { keys: ['emiliano', 'osorio'], url: '/fotos_estudiantes/3B - OSORIO BERMUDEZ EMILIANO JOSE.jpg' },
    { keys: ['alejandro', 'cuisman'], url: '/fotos_estudiantes/3B - CUISMAN OSORIO ALEJANDRO DE JESUS.jpg' },
    { keys: ['matias', 'campo'], url: '/fotos_estudiantes/3B - CAMPO MAZENET MATIAS.jpg' },
    { keys: ['nataly', 'serrano'], url: '/fotos_estudiantes/4A - SERRANO TAPIAS NATALY SOFIA.jpg' },
    { keys: ['ivan', 'perez'], url: '/fotos_estudiantes/4A - PEREZ GAMEZ IVAN EDUARDO.jpg' },
    { keys: ['salome', 'ospina'], url: '/fotos_estudiantes/4A - OSPINA LOBO SALOME.jpg' },
    { keys: ['victoria', 'posada'], url: '/fotos_estudiantes/5A - POSADA RODRIGUEZ VICTORIA ISABELL.jpg' },
    { keys: ['maria paula', 'aponte', 'maria p'], url: '/fotos_estudiantes/5A - APONTE CHACUTO MARIA PAULA.jpg' },
    { keys: ['elena', 'elenita', 'corredor'], url: '/fotos_estudiantes/5A - CORREDOR DIAZ ELENA.jpg' },
    { keys: ['fiorella', 'becerra'], url: '/fotos_estudiantes/5B - BECERRA QUINTERO FIORELLA.jpg' },
    { keys: ['valery', 'martinez'], url: '/fotos_estudiantes/5B - MARTINEZ MONTENEGRO VALERY MISHELL.jpg' },
    { keys: ['yhirliz', 'yepes'], url: '/fotos_estudiantes/5B - YEPES VILLERO YHIRLIZ SOFIA.jpg' },
    { keys: ['mariangel', 'arenillas'], url: '/fotos_estudiantes/6A - ARENILLAS CAMARGO MARIANGEL.jpg' },
    { keys: ['samanta', 'sami', 'linero'], url: '/fotos_estudiantes/6A - LINERO SALCEDO SAMANTA.jpg' },
    { keys: ['maria jose', 'bermudez', 'maria uni'], url: '/fotos_estudiantes/6A - BERMUDEZ GOMEZ MARIA JOSE.jpg' },
    { keys: ['dania', 'marin'], url: '/fotos_estudiantes/7A - MARIN YANET DANIA MICHELLE.jpg' },
    { keys: ['gabriela', 'salcedo'], url: '/fotos_estudiantes/7A - SALCEDO ACEVEDO GABRIELA.jpg' },
    { keys: ['juanita', 'ariza'], url: '/fotos_estudiantes/7A - ARIZA LESMES JUANITA KALAME.jpg' },
    { keys: ['antonella', 'antoneli', 'ramos'], url: '/fotos_estudiantes/8A - RAMOS CASTRO ANTONELLA DE JESUS.jpg' },
    { keys: ['alison', 'de la rosa'], url: '/fotos_estudiantes/8A - DE LA ROSA SANCHEZ ALISON SOPHIA.jpg' },
    { keys: ['sofia', 'rodriguez'], url: '/fotos_estudiantes/8A - RODRIGUEZ MACIAS SOFIA ALEJANDRA.jpg' }
  ];

  function getStudentPhoto(name) {
    if (!name || typeof name !== 'string') return null;
    const clean = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    for (const item of studentPhotos) {
      for (const key of item.keys) {
        if (clean.includes(key) || key.includes(clean)) {
          return item.url;
        }
      }
    }
    return null;
  }

  // Manejo de Columnas para Espectador
  let specSelectedCols = localStorage.getItem('dino_spec_cols') || 'auto';

  function getOptimalSpecColumns(count) {
    if (count <= 1) return 1;
    if (count <= 4) return 2;
    if (count <= 9) return 3;
    if (count <= 16) return 4;
    return 5;
  }

  function setSpecColumns(cols) {
    specSelectedCols = String(cols || 'auto').toLowerCase();
    localStorage.setItem('dino_spec_cols', specSelectedCols);

    document.querySelectorAll('.btn-spec-col').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cols === specSelectedCols);
    });

    updateSpecGridClass();
  }

  function updateSpecGridClass() {
    if (!specLeaderboardList) return;
    const count = specLeaderboardList.children.length;
    if (specSelectedCols && specSelectedCols !== 'auto') {
      const cols = parseInt(specSelectedCols, 10) || 2;
      specLeaderboardList.style.setProperty('--spec-cols', cols);
      specLeaderboardList.className = `spec-leaderboard-list custom-cols-${cols}`;
    } else {
      const cols = getOptimalSpecColumns(count);
      specLeaderboardList.style.setProperty('--spec-cols', cols);
      specLeaderboardList.className = `spec-leaderboard-list cols-${cols}`;
    }
  }

  document.querySelectorAll('.btn-spec-col').forEach(btn => {
    btn.addEventListener('click', () => {
      setSpecColumns(btn.dataset.cols);
    });
  });

  setSpecColumns(specSelectedCols);

  socket.on('leaderboard:sync', (data) => {
    specActiveNum.textContent = data.activeCount || 0;
    specCrashedNum.textContent = data.crashedCount || 0;
    specTotalNum.textContent = data.totalPlayers || 0;

    const leaderboard = data.leaderboard || [];
    specLeaderboardList.innerHTML = '';

    leaderboard.forEach((player) => {
      const card = document.createElement('div');
      const isCrashed = !!player.crashed;
      card.className = `spec-card ${isCrashed ? 'crashed-card' : ''}`;
      card.style.setProperty('--p-color', player.color || '#00ff66');

      let medal = `#${player.rank}`;
      if (player.rank === 1) medal = '🥇 1º';
      else if (player.rank === 2) medal = '🥈 2º';
      else if (player.rank === 3) medal = '🥉 3º';

      const photoUrl = getStudentPhoto(player.name);

      card.innerHTML = `
        <div class="spec-card-left">
          <div class="spec-card-rank-badge ${player.rank <= 3 ? 'rank-' + player.rank : ''}">${medal}</div>
          
          <div class="spec-photo-frame" style="border-color: ${player.color || '#00ff66'};">
            ${photoUrl 
              ? `<img src="${encodeURI(photoUrl)}" class="spec-student-img" alt="${escapeHtml(player.name)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                 <div class="spec-fallback-avatar" style="display: none; background: ${player.color}25;">
                   ${getDinoSvg(player.color || '#00ff66', 32)}
                 </div>`
              : `<div class="spec-fallback-avatar" style="display: flex; background: ${player.color}25;">
                   ${getDinoSvg(player.color || '#00ff66', 32)}
                 </div>`
            }
            <span class="spec-dino-mini-tag" style="background: ${player.color || '#00ff66'};">${getDinoSvg('#000000', 12)}</span>
          </div>

          <div class="spec-card-details">
            <div class="spec-card-name" title="${escapeHtml(player.name)}">${escapeHtml(player.name)}</div>
            <div class="spec-card-subinfo">
              ${isCrashed 
                ? '<span class="spec-status-chip crashed">💥 ELIMINADO</span>' 
                : '<span class="spec-status-chip running"><span class="spec-live-dot"></span> EN CARRERA</span>'}
            </div>
          </div>
        </div>

        <div class="spec-card-right">
          <div class="spec-card-score">${String(player.score).padStart(5, '0')} <span class="spec-pts-tag">pts</span></div>
          <div class="spec-card-dist">${Math.round(player.distance || 0)} px</div>
        </div>
      `;

      specLeaderboardList.appendChild(card);
    });

    updateSpecGridClass();
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

        const pPhoto = getStudentPhoto(p.name);
        if (pPhoto) {
          avatarEl.innerHTML = `
            <img src="${encodeURI(pPhoto)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="${escapeHtml(p.name)}" onerror="this.parentElement.innerHTML='${getDinoSvg(p.color || '#00ff66', 36)}';">
          `;
        } else {
          avatarEl.innerHTML = getDinoSvg(p.color || '#00ff66', 36);
        }
        avatarEl.style.background = `${p.color}22`;
        avatarEl.style.border = `2px solid ${p.color}`;
        avatarEl.style.boxShadow = `0 0 18px ${p.color}`;
      } else {
        slot.style.display = 'none';
      }
    }

    specLeaderboardTableBody.innerHTML = '';
    leaderboard.forEach((player) => {
      const row = document.createElement('tr');
      const survivalSec = player.survival_ms ? (player.survival_ms / 1000).toFixed(1) + 's' : '-';
      const rPhoto = getStudentPhoto(player.name);
      row.innerHTML = `
        <td><strong>#${player.rank}</strong></td>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            ${rPhoto 
              ? `<img src="${encodeURI(rPhoto)}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;border:1px solid ${player.color};" alt="${escapeHtml(player.name)}" onerror="this.style.display='none';">`
              : `<span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:${player.color};"></span>`
            }
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
