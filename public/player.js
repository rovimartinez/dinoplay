(function () {
  'use strict';

  const socket = io();

  // Elementos DOM
  const screens = {
    login: document.getElementById('screen-login'),
    lobby: document.getElementById('screen-lobby'),
    countdown: document.getElementById('screen-countdown'),
    game: document.getElementById('screen-game'),
    crashed: document.getElementById('screen-crashed'),
    podium: document.getElementById('screen-podium')
  };

  const joinForm = document.getElementById('join-form');
  const inputPin = document.getElementById('input-pin');
  const inputName = document.getElementById('input-name');
  const colorBtns = document.querySelectorAll('.color-btn');
  const joinError = document.getElementById('join-error');

  const lobbyPin = document.getElementById('lobby-pin');
  const lobbyPlayerName = document.getElementById('lobby-player-name');
  const lobbyPlayerCount = document.getElementById('lobby-player-count');
  const lobbyAvatarPreview = document.getElementById('lobby-avatar-preview');

  const countdownNum = document.getElementById('countdown-num');

  const hudRank = document.getElementById('hud-rank');
  const hudLeader = document.getElementById('hud-leader');
  const hudScore = document.getElementById('hud-score');
  const rankToast = document.getElementById('rank-toast');

  const crashScore = document.getElementById('crash-score');
  const crashRank = document.getElementById('crash-rank');

  const podiumTop3List = document.getElementById('podium-top3-list');
  const yourFinalRank = document.getElementById('your-final-rank');
  const yourFinalScore = document.getElementById('your-final-score');

  const touchDuck = document.getElementById('touch-duck');
  const touchJump = document.getElementById('touch-jump');

  // Estado local del jugador
  let selectedColor = '#2E7D32';
  let myPlayerInfo = null;
  let currentPin = '';
  let dinoGame = null;
  let currentRank = 1;
  let lastScore = 0;
  let toastTimeout = null;

  // Cambiar pantalla activa
  function showScreen(name) {
    Object.keys(screens).forEach((key) => {
      if (key === name) {
        screens[key].classList.add('active');
      } else {
        screens[key].classList.remove('active');
      }
    });
  }

  // Prellenar PIN si viene en la URL (?pin=1234)
  const urlParams = new URLSearchParams(window.location.search);
  const pinFromUrl = urlParams.get('pin');
  if (pinFromUrl) {
    inputPin.value = pinFromUrl;
  }

  // Selector de colores
  colorBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      colorBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectedColor = btn.getAttribute('data-color');
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
    joinError.textContent = '';
    const pin = inputPin.value.trim();
    const name = inputName.value.trim();

    if (!pin || !name) {
      joinError.textContent = 'Por favor ingresa el PIN y tu nombre.';
      return;
    }

    currentPin = pin;
    socket.emit('player:join_room', {
      pin: pin,
      name: name,
      color: selectedColor,
      avatar: '🦖'
    });
  });

  // Respuesta de unión exitosa
  socket.on('player:join_success', (data) => {
    myPlayerInfo = data.player;
    lobbyPin.textContent = data.pin;
    lobbyPlayerName.textContent = data.player.name;

    // Actualizar anillo de avatar en el lobby
    const ring = lobbyAvatarPreview.querySelector('.avatar-ring');
    if (ring) {
      ring.style.borderColor = data.player.color;
      ring.style.boxShadow = `0 0 20px ${data.player.color}88`;
    }

    showScreen('lobby');
  });

  socket.on('player:join_error', (data) => {
    joinError.textContent = data.message || 'Error al unirse a la sala.';
  });

  socket.on('room:players_update', (data) => {
    if (lobbyPlayerCount) {
      lobbyPlayerCount.textContent = data.count || (data.players ? data.players.length : 1);
    }
  });

  // Cuenta regresiva
  socket.on('game:countdown', (data) => {
    showScreen('countdown');
    countdownNum.textContent = data.countdown;
  });

  // Inicio de partida
  socket.on('game:start', () => {
    showScreen('game');

    // Limpiar contenedor anterior si existe
    const container = document.getElementById('dino-game-container');
    container.innerHTML = '';

    const startRunning = () => {
      if (dinoGame && dinoGame.canvas) {
        dinoGame.startGame();
        dinoGame.update();
      }
    };

    // Crear el motor del Dino Runner
    dinoGame = window.createDinoGame('#dino-game-container', {
      dinoColor: selectedColor,
      onEngineReady: () => {
        startRunning();
      },
      onStateUpdate: (state) => {
        const validScore = Number.isFinite(state.score) ? state.score : 0;
        lastScore = validScore;
        hudScore.textContent = String(validScore).padStart(5, '0');

        socket.emit('player:update_state', {
          pin: currentPin,
          score: validScore,
          distance: Number.isFinite(state.distance) ? state.distance : 0,
          action: state.action,
          crashed: state.crashed,
          obstacles: state.obstacles || []
        });
      },
      onCrash: (state) => {
        const validScore = Number.isFinite(state.score) ? state.score : 0;
        lastScore = validScore;
        socket.emit('player:update_state', {
          pin: currentPin,
          score: validScore,
          distance: Number.isFinite(state.distance) ? state.distance : 0,
          action: 'crashed',
          crashed: true,
          obstacles: state.obstacles || []
        });

        setTimeout(() => {
          crashScore.textContent = validScore;
          crashRank.textContent = '#' + currentRank;
          showScreen('crashed');
        }, 1200);
      }
    });

    startRunning();
  });

  // Sincronización de posición / ranking individual
  socket.on('player:rank_sync', (data) => {
    const prev = currentRank;
    currentRank = data.rank;

    hudRank.textContent = data.rank + 'º';
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

    if (data.rankChange === 'up' && prev > data.rank) {
      showRankToast(`⬆️ ¡Subiste al puesto ${data.rank}º!`, true);
    } else if (data.rankChange === 'down' && prev < data.rank) {
      showRankToast(`⬇️ Bajaste al puesto ${data.rank}º`, false);
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
    alert(data.message || 'Has sido expulsado de la sala.');
    window.location.reload();
  });

  socket.on('room:closed', (data) => {
    alert(data.message || 'La sala ha sido cerrada por el anfitrión.');
    window.location.reload();
  });

  // Controles táctiles virtuales para móviles
  if (touchJump) {
    const triggerJump = (e) => {
      e.preventDefault();
      if (dinoGame && dinoGame.playing && !dinoGame.crashed) {
        if (!dinoGame.tRex.jumping && !dinoGame.tRex.ducking) {
          dinoGame.playSound(dinoGame.soundFx.BUTTON_PRESS);
          dinoGame.tRex.startJump(dinoGame.currentSpeed);
        }
      }
    };
    touchJump.addEventListener('touchstart', triggerJump, { passive: false });
    touchJump.addEventListener('mousedown', triggerJump);
  }

  if (touchDuck) {
    const startDuck = (e) => {
      e.preventDefault();
      if (dinoGame && dinoGame.playing && !dinoGame.crashed) {
        if (dinoGame.tRex.jumping) {
          dinoGame.tRex.setSpeedDrop();
        } else {
          dinoGame.tRex.setDuck(true);
        }
      }
    };

    const endDuck = (e) => {
      e.preventDefault();
      if (dinoGame && dinoGame.playing) {
        dinoGame.tRex.speedDrop = false;
        dinoGame.tRex.setDuck(false);
      }
    };

    touchDuck.addEventListener('touchstart', startDuck, { passive: false });
    touchDuck.addEventListener('touchend', endDuck, { passive: false });
    touchDuck.addEventListener('mousedown', startDuck);
    touchDuck.addEventListener('mouseup', endDuck);
    touchDuck.addEventListener('mouseleave', endDuck);
  }
})();
