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
    const fetchActiveTunnel = () => {
      fetch('/api/server-url?t=' + Date.now())
        .then(r => r.json())
        .then(data => {
          if (data.ok && data.is_online && data.active_url) {
            const targetUrl = data.active_url.replace(/\/+$/, '') + '/player.html' + window.location.search;
            window.location.replace(targetUrl);
          } else {
            const banner = document.getElementById('reconnect-banner');
            const bannerText = document.getElementById('reconnect-banner-text');
            if (banner && bannerText) {
              banner.style.display = 'flex';
              banner.style.background = '#1e293b';
              banner.style.border = '2px solid #ef4444';
              bannerText.textContent = '⚡ BUSCANDO SERVIDOR ACTIVO...';
            }
          }
        })
        .catch(() => {});
    };
    fetchActiveTunnel();
    setInterval(fetchActiveTunnel, 3000);
  }

  const socket = (typeof io !== 'undefined')
    ? (customBackendUrl
        ? io(customBackendUrl, { transports: ['websocket', 'polling'], reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000 })
        : io({ transports: ['websocket', 'polling'], reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000 }))
    : null;

  const STORAGE_KEY_NAME = 'dino_player_name';
  const STORAGE_KEY_COLOR = 'dino_player_color';
  const STORAGE_KEY_PIN = 'dino_player_pin';
  const STORAGE_KEY_TOKEN = 'dino_session_token';

  // Elementos DOM
  const screens = {
    login: document.getElementById('screen-login'),
    lobby: document.getElementById('screen-lobby'),
    countdown: document.getElementById('screen-countdown'),
    game: document.getElementById('screen-game'),
    crashed: document.getElementById('screen-crashed'),
    podium: document.getElementById('screen-podium')
  };

  const reconnectBanner = document.getElementById('reconnect-banner');
  const reconnectBannerText = document.getElementById('reconnect-banner-text');

  const joinForm = document.getElementById('join-form');
  const inputPin = document.getElementById('input-pin');
  const inputName = document.getElementById('input-name');
  const btnJoin = document.getElementById('btn-join');
  const btnJoinText = btnJoin ? btnJoin.querySelector('span') : null;
  const colorBtns = document.querySelectorAll('.color-btn');
  const joinErrorBox = document.getElementById('join-error-box');
  const joinErrorMsg = document.getElementById('join-error-msg');
  const joinErrorActions = document.getElementById('join-error-actions');
  const btnErrorSpectator = document.getElementById('btn-error-spectator');

  const lobbyPin = document.getElementById('lobby-pin');
  const lobbyPlayerName = document.getElementById('lobby-player-name');
  const lobbyPlayerCount = document.getElementById('lobby-player-count');
  const lobbyAvatarPreview = document.getElementById('lobby-avatar-preview');

  const btnTogglePractice = document.getElementById('btn-toggle-practice');
  const lobbyPracticeViewport = document.getElementById('lobby-practice-viewport');
  const lobbyMiniCanvasContainer = document.getElementById('lobby-mini-canvas-container');

  const countdownNum = document.getElementById('countdown-num');

  const hudRank = document.getElementById('hud-rank');
  const hudLivesBox = document.getElementById('hud-lives-box');
  const hudLives = document.getElementById('hud-lives');
  const hudTimerBox = document.getElementById('hud-timer-box');
  const hudTimer = document.getElementById('hud-timer');
  const hudBestBox = document.getElementById('hud-best-box');
  const hudBest = document.getElementById('hud-best');
  const timeAttackCrashBanner = document.getElementById('time-attack-crash-banner');
  const hudLeader = document.getElementById('hud-leader');
  const hudScore = document.getElementById('hud-score');
  const rankToast = document.getElementById('rank-toast');
  const gameViewportWrapper = document.getElementById('game-viewport-wrapper');

  const crashScore = document.getElementById('crash-score');
  const crashRank = document.getElementById('crash-rank');

  const podiumTop3List = document.getElementById('podium-top3-list');
  const yourFinalRank = document.getElementById('your-final-rank');
  const yourFinalScore = document.getElementById('your-final-score');

  const touchDuck = document.getElementById('touch-duck');
  const touchJump = document.getElementById('touch-jump');
  const practiceTouchDuck = document.getElementById('practice-touch-duck');
  const practiceTouchJump = document.getElementById('practice-touch-jump');

  // Estado local del jugador
  let selectedColor = '#2E7D32';
  let myPlayerInfo = null;
  let currentPin = '';
  let dinoGame = null;
  let miniPracticeGame = null;
  let currentRank = 1;
  let lastScore = 0;
  let myPersonalBest = 0;
  let toastTimeout = null;
  let lastRaceSeed = null;
  let currentGameMode = 'sudden_death';
  let currentMaxLives = 1;
  let currentDurationSeconds = 120;

  // Cambiar pantalla activa
  function showScreen(name) {
    Object.keys(screens).forEach((key) => {
      if (key === name) {
        screens[key].classList.add('active');
      } else {
        screens[key].classList.remove('active');
      }
    });

    // Desenfocar inputs/botones y asegurar foco en la ventana al entrar al lobby o juego
    if (name === 'lobby' || name === 'countdown' || name === 'game') {
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
      try { window.focus(); } catch (e) {}
    }
  }

  // Prellenar datos desde localStorage
  const savedName = localStorage.getItem(STORAGE_KEY_NAME);
  if (savedName) inputName.value = savedName;

  const savedColor = localStorage.getItem(STORAGE_KEY_COLOR);
  if (savedColor) {
    selectedColor = savedColor;
    colorBtns.forEach((b) => {
      if (b.getAttribute('data-color') === savedColor) b.classList.add('active');
      else b.classList.remove('active');
    });
  }

  // Prellenar PIN solo si viene expresamente en la URL (?pin=1234, como al escanear QR)
  const pinFromUrl = urlParams.get('pin');
  if (pinFromUrl) {
    inputPin.value = pinFromUrl;
  } else {
    inputPin.value = '';
  }

  // Monitoreo de estado de conexión del socket
  if (socket) {
    socket.on('connect', () => {
      console.log('✅ Conectado al servidor de Dino Runner');
      if (reconnectBanner) reconnectBanner.style.display = 'none';
      if (btnJoin) {
        btnJoin.disabled = false;
        if (btnJoinText) btnJoinText.textContent = 'ENTRAR A LA SALA';
      }
    });

    socket.on('connect_error', (err) => {
      console.warn('⚠️ Error conectando al servidor:', err.message);
      if (reconnectBanner && reconnectBannerText) {
        reconnectBanner.style.display = 'flex';
        reconnectBanner.style.background = '#1e293b';
        reconnectBanner.style.border = '2px solid #eab308';
        reconnectBanner.style.color = '#fde047';
        reconnectBannerText.textContent = '⚡ RECONECTANDO CON EL SERVIDOR...';
      }
      if (btnJoin) {
        btnJoin.disabled = true;
        if (btnJoinText) btnJoinText.textContent = 'RECONECTANDO...';
      }
    });

    socket.on('disconnect', (reason) => {
      console.warn('⚠️ Socket desconectado:', reason);
      if (reconnectBanner && reconnectBannerText) {
        reconnectBanner.style.display = 'flex';
        reconnectBanner.style.background = '#1e293b';
        reconnectBanner.style.border = '2px solid #eab308';
        reconnectBanner.style.color = '#fde047';
        reconnectBannerText.textContent = '⚡ RECONECTANDO CON LA SALA...';
      }
      if (btnJoin) {
        btnJoin.disabled = true;
        if (btnJoinText) btnJoinText.textContent = 'RECONECTANDO...';
      }
    });
  }

  // Intentar reconexión automática si existe token guardado
  const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
  const targetPin = pinFromUrl || localStorage.getItem(STORAGE_KEY_PIN);
  if (savedToken && targetPin && socket) {
    socket.emit('player:reconnect', {
      pin: targetPin,
      sessionToken: savedToken,
      name: savedName || ''
    });
  }

  // Helper para generar SVG del dinosaurio con color personalizado
  function getDinoSvg(color = '#00ff66', size = 20) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 462 462" width="${size}" height="${size}" style="display:inline-block; vertical-align:middle;">
      <path fill="${color}" stroke="${color}" stroke-width="0" d="M 250 20 L 404 20 L 404 39 L 422.5 39 L 423 39.5 L 423 129 L 327.5 129 L 327 129.5 L 327 148 L 384.5 148 L 385 148.5 L 385 167 L 308 167 L 308 205 L 346 205 L 346 244 L 327 244 L 327 225 L 308 225 L 308 295 L 289 295 L 289 327 L 269 327 L 269 346 L 250.5 346 L 250 346.5 L 250 423 L 269 423 L 269 442 L 225 442 L 225 385 L 205 385 L 205 365 L 186 365 L 186 385 L 167 385 L 167 404 L 148 404 L 148 423 L 167 423 L 167 442 L 129 442 L 129 365 L 109 365 L 109 346 L 90 346 L 90 327 L 71 327 L 71 301 L 52 301 L 52 282 L 33 282 L 33 167 L 52 167 L 52 205 L 71 205 L 71 225 L 90 225 L 90 244 L 129 244 L 129 225 L 148 225 L 148 205 L 180 205 L 180 186 L 205 186 L 205 167 L 225 167 L 225 39.5 L 225.5 39 L 250 39 L 250 20 Z M 269 52 L 269 71 L 289 71 L 289 52 L 269 52 Z "/>
    </svg>`;
  }

  function updateLobbyDinoColor(color) {
    const dinoPath = document.getElementById('lobby-dino-path');
    if (dinoPath) {
      dinoPath.setAttribute('fill', color);
      dinoPath.setAttribute('stroke', color);
    }
  }

  // Selector de colores
  colorBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      colorBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectedColor = btn.getAttribute('data-color');
      localStorage.setItem(STORAGE_KEY_COLOR, selectedColor);
      updateLobbyDinoColor(selectedColor);
    });
  });

  // Mostrar notificación de cambio de rango
  function showRankToast(msg, isUp) {
    if (toastTimeout) clearTimeout(toastTimeout);
    rankToast.textContent = msg;
    rankToast.className = 'rank-toast show ' + (isUp ? 'up' : 'down');
    toastTimeout = setTimeout(() => {
      rankToast.classList.remove('show');
    }, 2000);
  }

  // Formulario de unirse
  joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    hideError();
    const pin = inputPin.value.trim();
    const name = inputName.value.trim();

    if (!pin || !name) {
      showError('Por favor ingresa el PIN y tu nombre.');
      return;
    }

    if (!socket || !socket.connected) {
      showError('⚠️ No hay conexión con el servidor. Verifica que esté iniciado y recarga la página.');
      return;
    }

    if (btnJoin) {
      btnJoin.disabled = true;
      if (btnJoinText) btnJoinText.textContent = 'ENTRANDO...';
    }

    clearTimeout(window.__joinTimeout);
    window.__joinTimeout = setTimeout(() => {
      if (btnJoin) {
        btnJoin.disabled = false;
        if (btnJoinText) btnJoinText.textContent = 'ENTRAR A LA SALA';
      }
      showError('El servidor tardó en responder. Comprueba que el PIN sea el correcto.');
    }, 4000);

    currentPin = pin;
    localStorage.setItem(STORAGE_KEY_NAME, name);
    localStorage.setItem(STORAGE_KEY_PIN, pin);
    localStorage.setItem(STORAGE_KEY_COLOR, selectedColor);

    socket.emit('player:join_room', {
      pin: pin,
      name: name,
      color: selectedColor,
      avatar: '🦖'
    });
  });

  function showError(msg, allowSpectator = false, errorPin = '') {
    joinErrorMsg.textContent = msg;
    joinErrorBox.style.display = 'block';
    if (allowSpectator) {
      joinErrorActions.style.display = 'block';
      btnErrorSpectator.onclick = () => {
        const specPin = errorPin || currentPin || inputPin.value.trim();
        window.location.href = `/spectator?pin=${specPin}`;
      };
    } else {
      joinErrorActions.style.display = 'none';
    }
  }

  function hideError() {
    joinErrorBox.style.display = 'none';
    joinErrorActions.style.display = 'none';
  }

  if (!socket) {
    showError('No se pudo cargar Socket.IO. Verifica tu conexion o abre el enlace directo del servidor del juego.');
    return;
  }

  // Respuesta de unión exitosa
  socket.on('player:join_success', (data) => {
    clearTimeout(window.__joinTimeout);
    if (btnJoin) {
      btnJoin.disabled = false;
      if (btnJoinText) btnJoinText.textContent = 'ENTRAR A LA SALA';
    }
    myPlayerInfo = data.player;
    currentPin = data.pin;
    selectedColor = data.player.color || selectedColor;
    lobbyPin.textContent = data.pin;
    lobbyPlayerName.textContent = data.player.name;

    if (data.sessionToken) {
      localStorage.setItem(STORAGE_KEY_TOKEN, data.sessionToken);
    }
    localStorage.setItem(STORAGE_KEY_PIN, data.pin);

    // Actualizar anillo y dinosaurio en el lobby
    updateLobbyDinoColor(selectedColor);
    const ring = lobbyAvatarPreview.querySelector('.avatar-ring');
    if (ring) {
      ring.style.borderColor = data.player.color;
      ring.style.boxShadow = `0 0 20px ${data.player.color}88`;
    }

    showScreen('lobby');
  });

  // Respuesta de reconexión exitosa
  socket.on('player:reconnect_success', (data) => {
    myPlayerInfo = data.player;
    currentPin = data.pin;
    selectedColor = data.player.color;
    updateLobbyDinoColor(selectedColor);
    lastRaceSeed = data.race_seed;
    currentGameMode = data.gameMode || currentGameMode;
    currentMaxLives = data.maxLives || currentMaxLives;
    lobbyPin.textContent = data.pin;
    lobbyPlayerName.textContent = data.player.name;

    if (data.sessionToken) {
      localStorage.setItem(STORAGE_KEY_TOKEN, data.sessionToken);
    }
    localStorage.setItem(STORAGE_KEY_PIN, data.pin);

    reconnectBanner.style.display = 'none';

    if (data.roomStatus === 'playing') {
      showScreen('game');
      if (!dinoGame && data.race_seed) {
        startLiveGame(data.race_seed);
      }
    } else if (data.roomStatus === 'finished') {
      showScreen('podium');
    } else if (data.roomStatus === 'starting') {
      // Si la cuenta ya terminó (countdown=0) e hay semilla, iniciar juego
      if ((data.countdown || 0) <= 0 && data.race_seed) {
        showScreen('game');
        if (!dinoGame) startLiveGame(data.race_seed);
      } else if ((data.countdown || 0) <= 0) {
        // Cuenta terminó pero no hay semilla aún — volver al lobby
        showScreen('lobby');
      } else {
        showScreen('countdown');
        if (countdownNum) countdownNum.textContent = data.countdown;
      }
    } else {
      showScreen('lobby');
    }
  });

  socket.on('player:reconnect_error', () => {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_PIN);
    if (reconnectBanner) reconnectBanner.style.display = 'none';
    showScreen('login');
  });

  socket.on('player:join_error', (data) => {
    clearTimeout(window.__joinTimeout);
    if (btnJoin) {
      btnJoin.disabled = false;
      if (btnJoinText) btnJoinText.textContent = 'ENTRAR A LA SALA';
    }
    showError(data.message || 'Error al unirse a la sala.', data.allowSpectator, data.pin);

    // Si el servidor informó una sala activa diferente, añadir botón rápido para unirse
    if (data.activePin && inputPin && data.activePin !== inputPin.value.trim()) {
      const activeBtn = document.createElement('button');
      activeBtn.type = 'button';
      activeBtn.className = 'btn-secondary-sm';
      activeBtn.style.cssText = 'display: block; width: 100%; margin-top: 10px; background: rgba(34, 197, 94, 0.2); border: 1px solid #22c55e; color: #4ade80; font-weight: bold; cursor: pointer; padding: 10px; border-radius: 8px;';
      activeBtn.textContent = `🚀 Entrar a la sala activa (PIN: ${data.activePin})`;
      activeBtn.onclick = () => {
        inputPin.value = data.activePin;
        joinForm.requestSubmit ? joinForm.requestSubmit() : joinForm.dispatchEvent(new Event('submit', { cancelable: true }));
      };
      joinErrorMsg.appendChild(activeBtn);
    }
  });

  socket.on('room:players_update', (data) => {
    if (lobbyPlayerCount) {
      lobbyPlayerCount.textContent = data.count || (data.players ? data.players.length : 1);
    }
  });

  // Práctica en el Lobby
  if (btnTogglePractice) {
    btnTogglePractice.addEventListener('click', () => {
      if (lobbyPracticeViewport.style.display === 'none') {
        lobbyPracticeViewport.style.display = 'block';
        btnTogglePractice.textContent = '⏹ Cerrar Práctica';
        startMiniPractice();
      } else {
        stopMiniPractice();
        lobbyPracticeViewport.style.display = 'none';
        btnTogglePractice.textContent = '▶ Practicar Salto y Agache';
      }
    });
  }

  function startMiniPractice() {
    stopMiniPractice();
    lobbyMiniCanvasContainer.innerHTML = '';
    miniPracticeGame = window.createDinoGame('#lobby-mini-canvas-container', {
      dinoColor: selectedColor,
      onEngineReady: () => {
        if (miniPracticeGame) {
          miniPracticeGame.startGame();
          miniPracticeGame.update();
        }
      },
      onCrash: () => {
        // En modo práctica del lobby, si choca, reiniciar automáticamente después de 1 segundo
        setTimeout(() => {
          if (miniPracticeGame && miniPracticeGame.crashed && screens.lobby.classList.contains('active')) {
            miniPracticeGame.restart();
          }
        }, 1000);
      }
    });
    if (miniPracticeGame && miniPracticeGame.canvas) {
      miniPracticeGame.startGame();
      miniPracticeGame.update();
    }
  }

  function stopMiniPractice() {
    if (miniPracticeGame) {
      try {
        miniPracticeGame.stopListening();
        miniPracticeGame.stop();
      } catch (e) {}
      miniPracticeGame = null;
    }
  }

  // Cuenta regresiva
  let countdownFallbackTimer = null;
  const playerCountdownColors = {
    3: { color: '#00e5ff', glow: 'rgba(0, 229, 255, 0.7)', text: '¡PREPARADOS! ⚡' },
    2: { color: '#ffea00', glow: 'rgba(255, 234, 0, 0.7)', text: '¡LISTOS! 🔥' },
    1: { color: '#ff0055', glow: 'rgba(255, 0, 85, 0.7)', text: '¡A SUS MARCAS! 🎯' },
    0: { color: '#00ff66', glow: 'rgba(0, 255, 102, 0.8)', text: '¡¡¡A CORRER!!! 💨' }
  };

  socket.on('game:countdown', (data) => {
    stopMiniPractice();
    if (lobbyPracticeViewport) lobbyPracticeViewport.style.display = 'none';
    showScreen('countdown');
    const num = data.countdown;
    countdownNum.textContent = num;

    const conf = playerCountdownColors[num] || playerCountdownColors[1];
    countdownNum.style.color = conf.color;
    countdownNum.style.borderColor = conf.color;
    countdownNum.style.boxShadow = `8px 8px 0 #000, 0 0 35px ${conf.glow}, inset 0 0 20px ${conf.glow}`;
    countdownNum.style.textShadow = `0 0 20px ${conf.glow}, 4px 4px 0 #000`;

    const countdownTextEl = document.querySelector('#screen-countdown .countdown-text');
    if (countdownTextEl) {
      countdownTextEl.textContent = conf.text;
      countdownTextEl.style.color = conf.color;
      countdownTextEl.style.textShadow = `0 0 15px ${conf.glow}, 2px 2px 0 #000`;
    }

    // Reiniciar animación con reflow limpio (un solo pop por número)
    countdownNum.classList.remove('pop-trigger');
    void countdownNum.offsetWidth;
    countdownNum.classList.add('pop-trigger');

    lastRaceSeed = data.race_seed;
    currentGameMode = data.gameMode || 'sudden_death';
    currentMaxLives = data.maxLives || (currentGameMode === 'three_lives' ? 3 : 1);
    currentDurationSeconds = data.durationSeconds || 120;

    // Fallback de seguridad: si pasados 3.8s desde el conteo no ha llegado game:start, forzar arranque
    if (countdownFallbackTimer) clearTimeout(countdownFallbackTimer);
    countdownFallbackTimer = setTimeout(() => {
      if (screens.countdown.classList.contains('active')) {
        console.log('⚡ Iniciando juego por fallback de cuenta regresiva...');
        startLiveGame(lastRaceSeed, currentDurationSeconds);
      }
    }, (data.countdown * 1000) + 900);
  });

  // Inicio de partida
  socket.on('game:start', (data) => {
    if (countdownFallbackTimer) {
      clearTimeout(countdownFallbackTimer);
      countdownFallbackTimer = null;
    }
    stopMiniPractice();
    if (data && data.gameMode) currentGameMode = data.gameMode;
    if (data && data.maxLives) currentMaxLives = data.maxLives;
    if (data && data.durationSeconds) currentDurationSeconds = data.durationSeconds;
    startLiveGame(data && data.race_seed ? data.race_seed : lastRaceSeed, currentDurationSeconds);
  });

  function startLiveGame(seed, durationSeconds) {
    showScreen('game');

    const container = document.getElementById('dino-game-container');
    container.innerHTML = '';

    if (dinoGame) {
      try { dinoGame.stop(); } catch(e) {}
      dinoGame = null;
    }

    const startRunning = (runner) => {
      const active = runner || dinoGame;
      if (active && active.canvas) {
        active.startGame();
        active.update();
      }
    };

    // Configurar visualización según modo de juego
    if (hudLivesBox && hudLives) {
      if (currentGameMode === 'three_lives' || currentMaxLives === 3) {
        hudLivesBox.style.display = 'flex';
        hudLives.textContent = '❤️❤️❤️';
      } else {
        hudLivesBox.style.display = 'none';
      }
    }

    if (hudTimerBox) {
      hudTimerBox.style.display = (currentGameMode === 'time_attack') ? 'flex' : 'none';
      if (hudTimer && durationSeconds) {
        const m = Math.floor(durationSeconds / 60);
        const s = durationSeconds % 60;
        hudTimer.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      }
    }

    if (hudBestBox) {
      hudBestBox.style.display = (currentGameMode === 'time_attack') ? 'flex' : 'none';
      myPersonalBest = 0;
      if (hudBest) hudBest.textContent = '00000';
    }

    if (hudScore) {
      hudScore.textContent = '00000';
    }

    if (timeAttackCrashBanner) {
      timeAttackCrashBanner.style.display = 'none';
    }

    const sendCrashResultToServer = (validScore, distance, survivalMs) => {
      const payload = {
        pin: currentPin,
        sessionToken: localStorage.getItem(STORAGE_KEY_TOKEN),
        name: localStorage.getItem(STORAGE_KEY_NAME) || (myPlayerInfo ? myPlayerInfo.name : 'Dino'),
        score: validScore,
        distance: distance || 0,
        survival_ms: survivalMs || 0,
        action: 'crashed',
        crashed: true,
        obstacles: [],
        dinoY: 93,
        speed: 0
      };

      // 1. Guardar en localStorage para máxima persistencia
      localStorage.setItem('dino_last_score', String(validScore));
      localStorage.setItem('dino_last_survival', String(survivalMs || 0));

      // 2. Enviar por Socket.IO
      if (socket && socket.connected) {
        socket.emit('player:update_state', payload);
      }

      // 3. Respaldo por HTTP fetch (garantiza entrega incluso con microcortes de websocket)
      try {
        fetch('/api/player/submit-offline-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).catch(() => {});
      } catch (e) {}
    };

    let gameStartTime = Date.now();

    dinoGame = window.createDinoGame('#dino-game-container', {
      dinoColor: selectedColor,
      seed: seed || null,
      maxLives: (currentGameMode === 'time_attack') ? 1 : currentMaxLives,
      onEngineReady: function () {
        gameStartTime = Date.now();
        startRunning(this);
      },
      onStateUpdate: (state) => {
        const validScore = Number.isFinite(state.score) ? state.score : 0;
        lastScore = validScore;
        hudScore.textContent = String(validScore).padStart(5, '0');

        if (currentGameMode === 'time_attack') {
          if (validScore > myPersonalBest) {
            myPersonalBest = validScore;
            if (hudBest) hudBest.textContent = String(myPersonalBest).padStart(5, '0');
          }
        }

        if (hudLives && state.lives !== undefined && (currentGameMode === 'three_lives' || currentMaxLives === 3)) {
          if (state.lives >= 3) hudLives.textContent = '❤️❤️❤️';
          else if (state.lives === 2) hudLives.textContent = '❤️❤️🤍';
          else if (state.lives === 1) hudLives.textContent = '❤️🤍🤍';
          else hudLives.textContent = '💀';
        }

        const survivalMs = Math.max(0, Date.now() - gameStartTime);

        if (socket && socket.connected) {
          socket.emit('player:update_state', {
            pin: currentPin,
            score: validScore,
            distance: Number.isFinite(state.distance) ? state.distance : 0,
            action: state.action,
            crashed: (currentGameMode === 'time_attack') ? false : state.crashed,
            lives: (state.lives !== undefined) ? state.lives : (state.crashed ? 0 : currentMaxLives),
            obstacles: state.obstacles || [],
            dinoY: Number.isFinite(state.dinoY) ? state.dinoY : 93,
            speed: Number.isFinite(state.speed) ? state.speed : 6,
            survival_ms: survivalMs
          });
        }
      },
      onCrash: (state) => {
        const validScore = Number.isFinite(state.score) ? state.score : 0;
        const validDistance = Number.isFinite(state.distance) ? state.distance : 0;
        const survivalMs = Math.max(0, Date.now() - gameStartTime);
        lastScore = validScore;

        if (validScore > myPersonalBest) {
          myPersonalBest = validScore;
          if (hudBest) hudBest.textContent = String(myPersonalBest).padStart(5, '0');
        }

        // Feedback háptico (Vibración)
        if (navigator.vibrate) {
          try { navigator.vibrate([120, 60, 120]); } catch (e) {}
        }

        // Sacudida visual de pantalla
        if (gameViewportWrapper) {
          gameViewportWrapper.classList.add('screen-shake');
          setTimeout(() => gameViewportWrapper.classList.remove('screen-shake'), 450);
        }

        // En MODO CONTRARRELOJ: ¡No eliminar ni sacar de pantalla! Permitir reintento inmediato continuo
        if (currentGameMode === 'time_attack') {
          if (socket && socket.connected) {
            socket.emit('player:update_state', {
              pin: currentPin,
              score: validScore,
              distance: validDistance,
              action: 'crashed',
              crashed: false,
              obstacles: [],
              dinoY: 93,
              speed: 0,
              survival_ms: survivalMs
            });
          }

          if (timeAttackCrashBanner) {
            timeAttackCrashBanner.style.display = 'block';
          }

          // Permitir reiniciar de inmediato con cualquier tecla de salto, toque en pantalla o botón touch
          let hasRestarted = false;
          const doQuickRestart = () => {
            if (hasRestarted) return;
            hasRestarted = true;
            if (timeAttackCrashBanner) timeAttackCrashBanner.style.display = 'none';
            document.removeEventListener('keydown', keyListener, true);
            document.removeEventListener('touchstart', touchListener, true);
            document.removeEventListener('pointerdown', touchListener, true);
            if (touchJump) touchJump.removeEventListener('click', doQuickRestart);
            if (touchDuck) touchDuck.removeEventListener('click', doQuickRestart);

            if (hudScore) hudScore.textContent = '00000';

            if (dinoGame && typeof dinoGame.restart === 'function') {
              dinoGame.restart();
            }
          };

          const keyListener = (e) => {
            if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === ' ' || e.keyCode === 32 || e.keyCode === 38 || e.key === 'w' || e.key === 'W') {
              e.preventDefault();
              doQuickRestart();
            }
          };

          const touchListener = (e) => {
            doQuickRestart();
          };

          if (touchJump) touchJump.addEventListener('click', doQuickRestart, { once: true });
          if (touchDuck) touchDuck.addEventListener('click', doQuickRestart, { once: true });

          // Pequeño retardo de 60ms para no consumir la misma pulsación que causó el choque
          setTimeout(() => {
            document.addEventListener('keydown', keyListener, true);
            document.addEventListener('touchstart', touchListener, true);
            document.addEventListener('pointerdown', touchListener, true);
          }, 60);
          return;
        }

        // Modos Estándar (Muerte Súbita / 3 Vidas)
        sendCrashResultToServer(validScore, validDistance, survivalMs);

        setTimeout(() => {
          crashScore.textContent = validScore;
          crashRank.textContent = '#' + currentRank;
          showScreen('crashed');
        }, 1200);
      }
    });

    window.dinoGame = dinoGame;
    startRunning(dinoGame);
  }

  socket.on('game:timer_tick', (data) => {
    if (hudTimerBox) hudTimerBox.style.display = 'flex';
    const seconds = (data && (typeof data.remainingSeconds === 'number' ? data.remainingSeconds : data.remaining));
    if (hudTimer && typeof seconds === 'number') {
      const rem = Math.max(0, seconds);
      const m = Math.floor(rem / 60);
      const s = rem % 60;
      hudTimer.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      if (rem <= 10) {
        hudTimer.style.color = '#ff0055';
        hudTimer.style.textShadow = '0 0 10px #ff0055';
      } else {
        hudTimer.style.color = '#00e5ff';
        hudTimer.style.textShadow = 'none';
      }
    }
  });

  // Sincronización de posición / ranking individual (no invasivo)
  const hudRankBox = document.getElementById('hud-rank-box');
  socket.on('player:rank_sync', (data) => {
    const prev = currentRank;
    currentRank = data.rank;

    let medalPrefix = '';
    if (data.rank === 1) medalPrefix = '🥇 ';
    else if (data.rank === 2) medalPrefix = '🥈 ';
    else if (data.rank === 3) medalPrefix = '🥉 ';

    hudRank.textContent = `${medalPrefix}${data.rank}º`;
    if (data.rank === 1) {
      hudRank.style.color = '#ffd700';
    } else if (data.rank === 2) {
      hudRank.style.color = '#c0c0c0';
    } else if (data.rank === 3) {
      hudRank.style.color = '#cd7f32';
    } else {
      hudRank.style.color = '#38bdf8';
    }

    if (data.leaderName) {
      hudLeader.textContent = `${data.leaderName} (${data.leaderScore})`;
    }

    if (screens.crashed.classList.contains('active')) {
      crashRank.textContent = '#' + currentRank;
    }

    // Micro-animación suave en el pill de posición sin tapar la pantalla
    if (hudRankBox && prev && prev !== data.rank) {
      hudRankBox.classList.remove('rank-up', 'rank-down');
      void hudRankBox.offsetWidth; // trigger reflow
      if (data.rank < prev) {
        hudRankBox.classList.add('rank-up');
      } else {
        hudRankBox.classList.add('rank-down');
      }
      setTimeout(() => {
        if (hudRankBox) hudRankBox.classList.remove('rank-up', 'rank-down');
      }, 600);
    }
  });

  // Fin de partida / Podio
  socket.on('game:ended', (data) => {
    if (timeAttackCrashBanner) {
      timeAttackCrashBanner.style.display = 'none';
    }
    if (dinoGame) {
      try {
        dinoGame.stop();
        dinoGame.stopListening();
      } catch (e) {}
    }

    showScreen('podium');

    podiumTop3List.innerHTML = '';
    const medals = ['🥇 1º Lugar', '🥈 2º Lugar', '🥉 3º Lugar'];

    (data.podium || []).forEach((player, idx) => {
      const item = document.createElement('div');
      item.className = `top3-item rank-${idx + 1}`;

      const playerWrap = document.createElement('div');
      playerWrap.style.display = 'flex';
      playerWrap.style.alignItems = 'center';
      playerWrap.style.gap = '8px';

      const medal = document.createElement('span');
      medal.style.fontSize = '1.2rem';
      medal.textContent = medals[idx];

      const dinoSpan = document.createElement('span');
      dinoSpan.innerHTML = getDinoSvg(player.color || '#00ff66', 22);

      const name = document.createElement('strong');
      name.style.color = player.color;
      name.textContent = player.name || 'Dino';

      const score = document.createElement('strong');
      score.style.fontFamily = 'monospace';
      score.style.color = '#4ade80';
      score.textContent = `${player.score} pts`;

      playerWrap.append(medal, dinoSpan, name);
      item.append(playerWrap, score);
      podiumTop3List.appendChild(item);
    });

    yourFinalRank.textContent = '#' + currentRank;
    yourFinalScore.textContent = (currentGameMode === 'time_attack' && myPersonalBest > 0 ? myPersonalBest : lastScore) + ' pts';
  });

  // Reiniciar a la sala de espera
  socket.on('game:reset_to_lobby', () => {
    if (dinoGame) {
      dinoGame.stop();
      dinoGame = null;
    }
    showScreen('lobby');
  });

  // Expulsión o sala cerrada
  socket.on('player:kicked', (data) => {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    alert(data.message || 'Has sido expulsado de la sala.');
    window.location.reload();
  });

  socket.on('room:closed', (data) => {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    alert(data.message || 'La sala ha sido cerrada por el anfitrión.');
    window.location.reload();
  });

  // Monitoreo de desconexión de red
  socket.on('disconnect', () => {
    reconnectBanner.style.display = 'flex';
    reconnectBannerText.textContent = 'Conexión perdida. Reconectando...';
  });

  socket.on('connect', () => {
    reconnectBanner.style.display = 'none';
    const activeToken = localStorage.getItem(STORAGE_KEY_TOKEN);
    if (activeToken && currentPin) {
      socket.emit('player:reconnect', {
        pin: currentPin,
        sessionToken: activeToken,
        name: localStorage.getItem(STORAGE_KEY_NAME) || ''
      });
    }
  });

  // Controles táctiles virtuales y teclado para móviles y PC
  const triggerGameJump = () => {
    const activeGame = dinoGame || miniPracticeGame;
    if (activeGame) {
      if (activeGame.crashed) {
        if (activeGame === miniPracticeGame) {
          activeGame.restart();
        }
      } else if (activeGame.playing && !activeGame.tRex.jumping && !activeGame.tRex.ducking) {
        activeGame.playSound(activeGame.soundFx.BUTTON_PRESS);
        activeGame.tRex.startJump(activeGame.currentSpeed);
      }
    }
  };

  const triggerGameDuckStart = () => {
    const activeGame = dinoGame || miniPracticeGame;
    if (activeGame && activeGame.playing && !activeGame.crashed) {
      if (activeGame.tRex.jumping) {
        activeGame.tRex.setSpeedDrop();
      } else {
        activeGame.tRex.setDuck(true);
      }
    }
  };

  const triggerGameDuckEnd = () => {
    const activeGame = dinoGame || miniPracticeGame;
    if (activeGame && activeGame.playing) {
      activeGame.tRex.speedDrop = false;
      activeGame.tRex.setDuck(false);
    }
  };

  function setupTouchButton(btn, onStart, onEnd) {
    if (!btn) return;

    const handleStart = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (onStart) onStart();
    };

    const handleEnd = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (onEnd) onEnd();
    };

    btn.addEventListener('touchstart', handleStart, { passive: false });
    btn.addEventListener('touchend', handleEnd, { passive: false });
    btn.addEventListener('touchcancel', handleEnd, { passive: false });

    btn.addEventListener('mousedown', handleStart);
    btn.addEventListener('mouseup', handleEnd);
    btn.addEventListener('mouseleave', handleEnd);
  }

  setupTouchButton(touchJump, triggerGameJump, null);
  setupTouchButton(touchDuck, triggerGameDuckStart, triggerGameDuckEnd);
  setupTouchButton(practiceTouchJump, triggerGameJump, null);
  setupTouchButton(practiceTouchDuck, triggerGameDuckStart, triggerGameDuckEnd);

  const isJumpKey = (e) => {
    if (!e) return false;
    const keyCode = e.keyCode || e.which || 0;
    const code = e.code || '';
    const key = (e.key || '').toLowerCase();
    return (
      keyCode === 32 || keyCode === 38 || keyCode === 87 || keyCode === 68 || keyCode === 75 || keyCode === 104 ||
      code === 'Space' || code === 'ArrowUp' || code === 'KeyW' || code === 'KeyD' || code === 'KeyK' ||
      code === 'Numpad8' || code === 'NumpadUp' || code === 'Up' ||
      key === ' ' || key === 'space' || key === 'spacebar' ||
      key === 'arrowup' || key === 'up' || key === 'arrow_up' ||
      key === 'w' || key === 'd' || key === 'k'
    );
  };

  const isDuckKey = (e) => {
    if (!e) return false;
    const keyCode = e.keyCode || e.which || 0;
    const code = e.code || '';
    const key = (e.key || '').toLowerCase();
    return (
      keyCode === 40 || keyCode === 83 || keyCode === 65 || keyCode === 74 || keyCode === 98 ||
      code === 'ArrowDown' || code === 'KeyS' || code === 'KeyA' || code === 'KeyJ' ||
      code === 'Numpad2' || code === 'NumpadDown' || code === 'Down' ||
      key === 'arrowdown' || key === 'down' || key === 'arrow_down' ||
      key === 's' || key === 'a' || key === 'j'
    );
  };

  // Manejador global de teclado en Window (con fase de captura para interceptar Flechas y S/W/A/D antes de cualquier scroll)
  window.addEventListener('keydown', (e) => {
    // Si el foco está en un input o textarea y estamos en la pantalla de ingreso de nombre/PIN, permitir escribir
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
      if (screens.game.classList.contains('active') || screens.countdown.classList.contains('active') || screens.lobby.classList.contains('active')) {
        document.activeElement.blur();
      } else {
        return;
      }
    }

    if (isJumpKey(e)) {
      e.preventDefault();
      triggerGameJump();
    } else if (isDuckKey(e)) {
      e.preventDefault();
      triggerGameDuckStart();
    }
  }, { capture: true, passive: false });

  window.addEventListener('keyup', (e) => {
    if (isDuckKey(e)) {
      triggerGameDuckEnd();
    } else if (isJumpKey(e)) {
      const activeGame = dinoGame || miniPracticeGame;
      if (activeGame && activeGame.tRex) {
        activeGame.tRex.endJump();
      }
    }
  }, { capture: true, passive: false });

  // Liberar agachado al perder el foco de la ventana
  window.addEventListener('blur', () => {
    triggerGameDuckEnd();
  });

  // Desenfocar cualquier botón pulsado para que el foco no capture la barra espaciadora
  document.addEventListener('click', (e) => {
    if (e.target && typeof e.target.blur === 'function' && e.target.tagName === 'BUTTON') {
      e.target.blur();
    }
  });
})();
