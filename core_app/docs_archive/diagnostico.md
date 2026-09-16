# Diagnostico inicial - Dino Runner

Fecha: 2026-09-11

## Sintomas reportados

- El juego no corre o no inicia correctamente.
- En algunos casos se congela.
- Los jugadores quedan en espera despues de que el admin presiona "Iniciar Partida".
- El problema ocurre tanto en local como en linea.

## Diagnostico inicial

### 1. Local

El flujo local depende de `server.js` con Express y Socket.IO:

- El admin crea una sala con `admin:create_room`.
- Los jugadores entran con `player:join_room`.
- El admin dispara `admin:start_game`.
- El servidor emite `game:countdown` y luego `game:start`.
- Cada jugador crea el motor con `window.createDinoGame(...)`.

Puntos de riesgo encontrados:

- Si el cliente del jugador tiene un error JavaScript antes de registrar `game:countdown` o `game:start`, el servidor si inicia pero el navegador no cambia a la pantalla de juego.
- El jugador emite `player:reconnect` automaticamente al cargar si existe un token previo en `localStorage`. Si ese intento ocurre antes de una entrada normal, puede mover el estado visual a lobby/cuenta regresiva/juego de forma inesperada.
- El servidor solo permite entrar cuando la sala esta en `lobby`; esto es correcto para competencia, pero si los jugadores usan un PIN viejo o un enlace viejo parecen "congelados" esperando una sala distinta.
- El boton de iniciar se deshabilita al hacer clic y, si el servidor rechaza el inicio por estado distinto de `lobby`, queda deshabilitado. Esto puede aparentar congelamiento para el admin.

### 2. En linea

El despliegue online no tiene una capa real de Socket.IO persistente en Cloudflare Pages/Worker. La arquitectura actual funciona asi:

- `iniciar_online.js` levanta `server.js` en la PC del admin.
- Abre un tunel publico con `localtunnel`.
- Publica ese tunel en `https://juegodino.pages.dev/api/server-url`.
- Las paginas en Pages redirigen hacia el tunel activo.

Puntos de riesgo encontrados:

- Si el tunel se cae, cambia de URL, queda bloqueado por red/firewall, o el heartbeat no actualiza Pages, los jugadores online quedan conectando a un backend inexistente o viejo.
- Cloudflare Pages solo sirve estaticos y endpoints HTTP basicos; no reemplaza el Socket.IO de `server.js`. Por eso, abrir directamente Pages sin tunel activo no puede iniciar partidas multijugador.
- Los links y QR generados por el admin usan el host actual. Si el admin esta en `localhost`, el link para jugadores puede quedar como IP LAN, valido solo para la misma red Wi-Fi, no para internet.

### 3. Hipotesis principal

El fallo de "el admin inicia pero los jugadores no arrancan" probablemente viene de una combinacion de:

1. Estado de conexion/backend distinto entre admin y jugadores, especialmente online por tuneles caducados.
2. Estado persistido en `localStorage/sessionStorage` que intenta reconectar a salas anteriores.
3. Falta de confirmacion/recuperacion cuando un jugador se une tarde o pierde el evento `game:start`.
4. Posibles errores JavaScript de cliente que impiden que `game:start` cree el motor.

## Reparaciones iniciales recomendadas

- Agregar un diagnostico visible de conexion, PIN y backend en admin/jugador.
- Hacer que `game:countdown` y `game:start` incluyan estado suficiente para que un jugador reconectado pueda recuperarse.
- En el servidor, emitir un estado de sala mas completo al admin y jugadores.
- En el cliente jugador, evitar que una reconexion fallida interrumpa el flujo normal de entrada.
- Mejorar la generacion de enlaces online para que, cuando el admin esta usando un tunel, el QR use ese tunel y no una IP local.
- Agregar pruebas automaticas del flujo admin -> jugador -> iniciar -> game:start.

## Estado

Archivo creado antes de iniciar reparaciones de codigo.

## Diagnostico confirmado durante reparacion

### Causa local confirmada

El admin estaba enviando `admin:create_room` dos veces al cargar cuando ya tenia clave guardada:

- Una emision se hacia inmediatamente al cargar el script.
- Otra emision se hacia al evento `socket.on('connect')`.

En pruebas E2E esto produjo dos PIN distintos para el mismo admin. Ese comportamiento puede explicar que algunos jugadores queden esperando en una sala/PIN anterior mientras el admin inicia otra sala mas reciente.

### Causa online confirmada

La experiencia online depende de `https://juegodino.pages.dev/api/server-url` para descubrir el tunel activo hacia la PC del admin. Ese endpoint estaba detras de una validacion global de D1. Si el binding `DB` no estaba disponible o fallaba, `/api/server-url` respondia error en vez de responder "offline", y las paginas no podian redirigir correctamente al backend Socket.IO.

Tambien se confirmo que el panel admin generaba el QR/enlace desde el host local cuando el admin abria `localhost`, lo cual sirve para Wi-Fi/LAN pero no para jugadores por internet. Ahora el QR se refresca con el tunel publico activo cuando Pages lo reporta.

## Reparaciones iniciadas

- `public/admin.js`
  - Evita crear/reconectar sala antes de que Socket.IO este conectado.
  - Elimina el doble `admin:create_room` que generaba PINs duplicados.
  - Refresca enlace y QR desde `https://juegodino.pages.dev/api/server-url` si hay tunel online activo.

- `server.js`
  - Guarda `countdown`, `countdownStartedAt`, `gameMode`, `maxLives`, `raceConfig` y `started_at` para reconexiones.
  - Devuelve esos datos en `player:reconnect_success`.

- `public/player.js`
  - Usa `gameMode`, `maxLives`, `race_seed` y `countdown` al reconectar.
  - Si Socket.IO no carga, muestra error claro en vez de romper el script silenciosamente.

- `functions/api/[[path]].js` y `src/worker.js`
  - `/api/server-url` ahora responde de forma segura aunque falte D1, marcando `is_online: false`.
  - El POST de heartbeat sigue exigiendo D1 porque necesita persistir la URL activa.

- Pruebas visuales
  - `test_e2e_admin_sync.js`, `test_crashed_visual.js` y `test_obstacles_sync.js` ahora guardan capturas en `test-results/` dentro del proyecto, no en carpetas externas sin permiso.
  - `test_obstacles_sync.js` abre admin con `?key=dino2026`.

## Verificacion ejecutada

- `npm run lint`: aprobado.
- `node test_e2e_admin_sync.js`: aprobado; ahora se crea un solo PIN.
- `node test_multitab_simultaneous.js`: aprobado; 6 jugadores avanzan sin quedarse en 0.
- `npm test`: aprobado completo, incluyendo seguridad, reconexion, ciclo de vida y estres de 30 jugadores.
