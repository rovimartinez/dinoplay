# 📋 Tareas Pendientes para Continuar Mañana

Este documento recopila las solicitudes, mejoras y nuevos modos de juego pendientes por implementar en la plataforma **Dino Tournament**.

---

## 1. 🔄 Reconexión y Persistencia del Panel de Administrador (Evitar que se detenga al recargar)
- [ ] **Problema actual:** Cuando el anfitrión recarga la página (`F5`) o pierde conexión momentáneamente, el servidor cierra la sala automáticamente (`disconnect`), deteniendo la partida para todos los jugadores conectados.
- [ ] **Solución requerida:** 
  - La sala debe persistir activa en el servidor y en la base de datos con un token de sesión para el administrador (`adminSessionToken` guardado en `localStorage`).
  - Si el administrador recarga la página (`F5`), debe reconectarse automáticamente a su misma sala activa sin reiniciar ni detener el juego de los participantes.
  - Al reconectar, el panel de admin debe sincronizar de inmediato el estado actual (lobby, cuenta regresiva, partida en vivo o resultados) y reconstruir el grid de jugadores en tiempo real.
  - Añadir un tiempo de gracia de 60 segundos antes de considerar la sala cerrada si el admin no regresa.

---

## 2. 🦖 Corrección en Modo Práctica Individual (`practice.html`)
- [ ] **Problema actual:** En la pantalla de práctica individual (`/practice`), al seleccionar un color para el dinosaurio en el selector:
  1. El color del dinosaurio no se actualiza correctamente.
  2. Los obstáculos (cactus y pterodáctilos) dejan de renderizarse o desaparecen al reiniciar el juego con el nuevo color.
- [ ] **Solución requerida:**
  - Integrar la inicialización limpia de `customDinoColor` en el motor de práctica.
  - Al cambiar de color, reiniciar el canvas sin perder la carga ni las referencias de los sprites de obstáculos (`SPRITE_1X_SRC` / `SPRITE_2X_SRC`).

---

## 3. 🎮 Nuevos Modos de Juego para Torneo

Configurables desde el panel de administración antes de iniciar la partida:

### A) ⏱️ Modo Contrarreloj / Límite de Tiempo (Survival Timer)
- [ ] **Mecánica:**
  - El anfitrión puede establecer un cronómetro regresivo para la ronda (ej. **2 minutos**, **3 minutos**, **5 minutos** o **Sin límite**).
  - El cronómetro se muestra en grande en el proyector del admin y en el HUD del jugador.
  - Los jugadores que logran sobrevivir hasta que el cronómetro llega a `00:00` clasifican automáticamente a la siguiente etapa.
  - Quienes colisionen antes del tiempo límite quedan eliminados y se ordenan por el tiempo sobrevivido y puntaje acumulado.

### B) 💖 Modo 3 Vidas (3 Lives Tournament)
- [ ] **Mecánica:**
  - Cada participante inicia con **3 vidas** (indicadas con corazones en su pantalla y en la tarjeta del admin).
  - Al chocar contra un obstáculo, el jugador no es eliminado de inmediato: pierde 1 vida, recibe un parpadeo de invulnerabilidad temporal (1.5 segundos) y continúa corriendo.
  - Al perder las 3 vidas, el jugador queda definitivamente **ELIMINADO** (tarjeta roja con `✕`).
  - Gana el concursante que logre llegar más lejos o sea el último sobreviviente con vidas restantes.

---

## 4. 🌍 Mismo Mundo Determinista para Todos los Jugadores (Obstáculos y Pista 100% Idénticos)
- [ ] **Problema actual:** En las partidas de prueba, a distintos jugadores les pueden aparecer obstáculos en momentos o posiciones ligeramente diferentes si existe alguna llamada no sembrada a `Math.random()` en el motor (`dino-engine.js`).
- [ ] **Solución requerida:**
  - Garantizar equidad absoluta de torneo: **a todos los jugadores les debe salir exactamente el mismo mundo**.
  - Cada obstáculo (tipo de cactus pequeño/grande, grupos dobles/triples, pterodáctilos, altura de vuelo, nubes y distancia exacta entre obstáculos) debe generarse **estrictamente a partir de la semilla compartida (`race_seed`)** enviada por el servidor.
  - Reemplazar cualquier llamada residual a `Math.random()` dentro del bucle del horizonte, generación de obstáculos y nubes por el generador pseudoaleatorio determinista (`PRNG(race_seed)`).
  - Asegurar que al comenzar la partida tras la cuenta regresiva, el reloj y la distancia inicien en el fotograma 0 exactamente sincronizados para todos los concursantes.

---

## 5. 🛑 Transición Inmediata a Tarjeta Roja al Chocar (Evitar Dino "Temblando" sobre el Cactus)
- [ ] **Problema reportado:** Al colisionar, el dinosaurio se queda sobre el cactus detenido o "temblando" en el canvas blanco del admin, sin pasar de inmediato a la pantalla roja de eliminado y manteniendo el contador en `Corriendo`.
- [ ] **Solución requerida:**
  - Asegurar que al momento exacto de la colisión en `dino-engine.js`:
    1. Se emita de inmediato el paquete prioritario `{ action: 'crashed', crashed: true, speed: 0 }` al servidor sin depender del siguiente ciclo de `requestAnimationFrame`.
    2. En el servidor (`server.js`), al recibir `crashed: true` o `action: 'crashed'`, fijar permanentemente `player.crashed = true` y emitir una sincronización instantánea (`leaderboard:sync`) a la sala.
    3. En el panel de administración (`admin.js` / `admin.css`), al recibir el estado de choque:
       - Ocultar de inmediato el canvas del juego del dino (`display: none`).
       - Activar el fondo **rojo intenso** con resplandor neón.
       - Estampar la **`✕` gigante**, el **nombre del jugador en grande**, la insignia **`ELIMINADO`** y su puntaje final.
       - Incrementar el contador superior de `Chocados` y decrementar `Corriendo`.

---

## 📌 Checklist de Archivos a Modificar
- `server.js`: Gestión de reconexión del host admin, lógica de modos de juego (tiempo y vidas) y broadcast prioritario de choque.
- `public/admin.html` y `public/admin.js`: Selector de modos de juego (Clásico, Tiempo Límite, 3 Vidas), cronómetro visible, persistencia de sesión admin y renderizado instantáneo de tarjeta roja.
- `public/player.html` y `public/player.js`: HUD de vidas (corazones), HUD de cronómetro, emisión inmediata de choque y respuesta a colisiones por vidas.
- `public/practice.html` y `public/practice.js`: Corrección del selector de color y regeneración de obstáculos.
- `public/dino-engine.js`: 100% determinismo de obstáculos y mundo con `race_seed`, emisión inmediata de `onCrash` y soporte de invulnerabilidad en modo 3 vidas.
