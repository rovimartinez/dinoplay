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
  let toastTimeout = null;
  let lastRaceSeed = null;
  let currentGameMode = 'sudden_death';
  let currentMaxLives = 1;

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

  // Prellenar PIN si viene en la URL (?pin=1234) o en localStorage
  const pinFromUrl = urlParams.get('pin');
  if (pinFromUrl) {
    inputPin.value = pinFromUrl;
  } else {
    const savedPin = localStorage.getItem(STORAGE_KEY_PIN);
    if (savedPin) inputPin.value = savedPin;
  }

  // Intentar reconexión automática si existe token guardado
  const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
  const targetPin = pinFromUrl || localStorage.getItem(STORAGE_KEY_PIN);
  if (savedToken && targetPin) {
    socket.emit('player:reconnect', {
      pin: targetPin,
      sessionToken: savedToken,
      name: savedName || ''
    });
  }

  // Selector de colores
  colorBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      colorBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectedColor = btn.getAttribute('data-color');
      localStorage.setItem(STORAGE_KEY_COLOR, selectedColor);
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

  // Respuesta de unión exitosa
  socket.on('player:join_success', (data) => {
    myPlayerInfo = data.player;
    currentPin = data.pin;
    selectedColor = data.player.color || selectedColor;
    lobbyPin.textContent = data.pin;
    lobbyPlayerName.textContent = data.player.name;

    if (data.sessionToken) {
      localStorage.setItem(STORAGE_KEY_TOKEN, data.sessionToken);
    }
    localStorage.setItem(STORAGE_KEY_PIN, data.pin);

    // Actualizar anillo de avatar en el lobby
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
    lastRaceSeed = data.race_seed;
    lobbyPin.textContent = data.pin;
    lobbyPlayerName.textContent = data.player.name;

    if (data.sessionToken) {
      localStorage.setItem(STORAGE_KEY_TOKEN, data.sessionToken);
    }
    localStorage.setItem(STORAGE_KEY_PIN, data.pin);

    reconnectBanner.style.display = 'none';

    if (data.roomStatus === 'playing') {
      showScreen('game');
      if (!dinoGame) {
        startLiveGame(data.race_seed);
      }
    } else if (data.roomStatus === 'finished') {
      showScreen('podium');
    } else if (data.roomStatus === 'starting') {
      showScreen('countdown');
    } else {
      showScreen('lobby');
    }
  });

  socket.on('player:reconnect_error', () => {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    reconnectBanner.style.display = 'none';
    showScreen('login');
  });

  socket.on('player:join_error', (data) => {
    showError(data.message || 'Error al unirse a la sala.', data.allowSpectator, data.pin);
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
  socket.on('game:countdown', (data) => {
    stopMiniPractice();
    if (lobbyPracticeViewport) lobbyPracticeViewport.style.display = 'none';
    showScreen('countdown');
    countdownNum.textContent = data.countdown;
    lastRaceSeed = data.race_seed;
    currentGameMode = data.gameMode || 'sudden_death';
    currentMaxLives = data.maxLives || (currentGameMode === 'three_lives' ? 3 : 1);
  });

  // Inicio de partida
  socket.on('game:start', (data) => {
    stopMiniPractice();
    if (data && data.gameMode) currentGameMode = data.gameMode;
    if (data && data.maxLives) currentMaxLives = data.maxLives;
    startLiveGame(data && data.race_seed ? data.race_seed : lastRaceSeed);
  });

  function startLiveGame(seed) {
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

    // Configurar visualización de vidas
    if (hudLivesBox && hudLives) {
      if (currentGameMode === 'three_lives' || currentMaxLives === 3) {
        hudLivesBox.style.display = 'flex';
        hudLives.textContent = '❤️❤️❤️';
      } else {
        hudLivesBox.style.display = 'none';
      }
    }

    dinoGame = window.createDinoGame('#dino-game-container', {
      dinoColor: selectedColor,
      seed: seed || null,
      maxLives: currentMaxLives,
      onEngineReady: function () {
        startRunning(this);
      },
      onStateUpdate: (state) => {
        const validScore = Number.isFinite(state.score) ? state.score : 0;
        lastScore = validScore;
        hudScore.textContent = String(validScore).padStart(5, '0');

        if (hudLives && state.lives !== undefined && (currentGameMode === 'three_lives' || currentMaxLives === 3)) {
          if (state.lives >= 3) hudLives.textContent = '❤️❤️❤️';
          else if (state.lives === 2) hudLives.textContent = '❤️❤️🤍';
          else if (state.lives === 1) hudLives.textContent = '❤️🤍🤍';
          else hudLives.textContent = '💀';
        }

        socket.emit('player:update_state', {
          pin: currentPin,
          score: validScore,
          distance: Number.isFinite(state.distance) ? state.distance : 0,
          action: state.action,
          crashed: state.crashed,
          lives: (state.lives !== undefined) ? state.lives : (state.crashed ? 0 : currentMaxLives),
          obstacles: state.obstacles || [],
          dinoY: Number.isFinite(state.dinoY) ? state.dinoY : 93,
          speed: Number.isFinite(state.speed) ? state.speed : 6
        });
      },
      onCrash: (state) => {
        const validScore = Number.isFinite(state.score) ? state.score : 0;
        lastScore = validScore;

        // Feedback háptico (Vibración)
        if (navigator.vibrate) {
          try { navigator.vibrate([120, 60, 120]); } catch (e) {}
        }

        // Sacudida visual de pantalla
        if (gameViewportWrapper) {
          gameViewportWrapper.classList.add('screen-shake');
          setTimeout(() => gameViewportWrapper.classList.remove('screen-shake'), 450);
        }

        socket.emit('player:update_state', {
          pin: currentPin,
          score: validScore,
          distance: Number.isFinite(state.distance) ? state.distance : 0,
          action: 'crashed',
          crashed: true,
          obstacles: state.obstacles || [],
          dinoY: Number.isFinite(state.dinoY) ? state.dinoY : 93,
          speed: 0
        });

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

      const name = document.createElement('strong');
      name.style.color = player.color;
      name.textContent = player.name || 'Dino';

      const score = document.createElement('strong');
      score.style.fontFamily = 'monospace';
      score.style.color = '#4ade80';
      score.textContent = `${player.score} pts`;

      playerWrap.append(medal, name);
      item.append(playerWrap, score);
      podiumTop3List.appendChild(item);
    });

    yourFinalRank.textContent = '#' + currentRank;
    yourFinalScore.textContent = lastScore + ' pts';
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

  // Manejador global de teclado en Window para garantizar que Espaciadora, Flechas y ASDW/WASD siempre funcionen
  window.addEventListener('keydown', (e) => {
    // Si el foco está en un input o textarea y estamos en la pantalla de login/unión, dejar que escriba
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
      if (screens.game.classList.contains('active') || screens.countdown.classList.contains('active')) {
        document.activeElement.blur();
      } else {
        return;
      }
    }

    const code = e.code || '';
    const key = (e.key || '').toLowerCase();
    const keyCode = e.keyCode || e.which;

    const isJumpKey = keyCode === 32 || keyCode === 38 || keyCode === 87 || keyCode === 68 || keyCode === 75 ||
                      code === 'Space' || key === ' ' || key === 'spacebar' ||
                      code === 'ArrowUp' || key === 'arrowup' || key === 'up' ||
                      code === 'KeyW' || key === 'w' ||
                      code === 'KeyD' || key === 'd' ||
                      code === 'KeyK' || key === 'k';

    const isDuckKey = keyCode === 40 || keyCode === 83 || keyCode === 65 || keyCode === 74 ||
                      code === 'ArrowDown' || key === 'arrowdown' || key === 'down' ||
                      code === 'KeyS' || key === 's' ||
                      code === 'KeyA' || key === 'a' ||
                      code === 'KeyJ' || key === 'j';

    if (isJumpKey) {
      e.preventDefault();
      triggerGameJump();
    } else if (isDuckKey) {
      e.preventDefault();
      triggerGameDuckStart();
    }
  }, { passive: false });

  window.addEventListener('keyup', (e) => {
    const code = e.code || '';
    const key = (e.key || '').toLowerCase();
    const keyCode = e.keyCode || e.which;

    const isDuckKey = keyCode === 40 || keyCode === 83 || keyCode === 65 || keyCode === 74 ||
                      code === 'ArrowDown' || key === 'arrowdown' || key === 'down' ||
                      code === 'KeyS' || key === 's' ||
                      code === 'KeyA' || key === 'a' ||
                      code === 'KeyJ' || key === 'j';

    const isJumpKey = keyCode === 32 || keyCode === 38 || keyCode === 87 || keyCode === 68 || keyCode === 75 ||
                      code === 'Space' || key === ' ' || key === 'spacebar' ||
                      code === 'ArrowUp' || key === 'arrowup' || key === 'up' ||
                      code === 'KeyW' || key === 'w' ||
                      code === 'KeyD' || key === 'd' ||
                      code === 'KeyK' || key === 'k';

    if (isDuckKey) {
      triggerGameDuckEnd();
    } else if (isJumpKey) {
      const activeGame = dinoGame || miniPracticeGame;
      if (activeGame && activeGame.tRex) {
        activeGame.tRex.endJump();
      }
    }
  });

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
