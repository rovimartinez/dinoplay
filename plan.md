# Plan de mejoras - Dino Runner Multijugador

Este documento es una hoja de ruta manual para convertir el proyecto en una version mas segura, justa, persistente y lista para evento en linea usando Cloudflare.

## Objetivo general

Preparar el juego para eventos reales en linea, manteniendo pruebas locales, con:

- Partidas nombradas por evento o ronda, por ejemplo: "Cuarto grado", "Semifinal", "Final".
- Registro de jugadores, resultados, salas y rondas en base de datos.
- Carreras competitivas mas justas.
- Seguridad basica contra trampas y abuso.
- Publicacion web con Cloudflare.
- Mejor experiencia para anfitrion, jugadores y espectadores.

## Prioridades

- **Alta**: necesario antes de un evento real.
- **Media**: importante para estabilidad y administracion.
- **Baja**: mejora de experiencia, mantenimiento o pulido.

## Fase 1 - Correcciones inmediatas locales

- [x] **Alta** - Bloquear doble inicio de partida.
  - Evitar que `admin:start_game` funcione si la sala ya esta en `starting`, `playing` o `finished`.
  - Archivo relacionado: `server.js`.

- [x] **Alta** - Corregir tabla final del admin.
  - Actualmente la tabla declara columna "Distancia", pero no se renderiza la celda correspondiente.
  - Opcion A: mostrar distancia.
  - Opcion B: quitar la columna.
  - Archivos relacionados: `public/admin.html`, `public/admin.js`.

- [x] **Alta** - Validar datos enviados por jugadores.
  - Validar `name`, `pin`, `color`, `avatar`, `score`, `distance`, `action`, `crashed` y `obstacles`.
  - Rechazar colores no permitidos.
  - Limitar longitud de nombre.
  - Limitar cantidad y tamano de obstaculos enviados.
  - Archivo relacionado: `server.js`.

- [x] **Alta** - Evitar `innerHTML` con datos de usuario.
  - Cambiar renderizados peligrosos por `textContent` o creacion segura de nodos.
  - Revisar especialmente el podio del jugador.
  - Archivos relacionados: `public/player.js`, `public/admin.js`.

- [ ] **Media** - Implementar o quitar boton de sonido del admin.
  - El boton existe en HTML, pero no tiene logica conectada.
  - Archivos relacionados: `public/admin.html`, `public/admin.js`.

- [x] **Media** - Mover `puppeteer-core` a `devDependencies`.
  - Parece usarse solo para pruebas.
  - Archivo relacionado: `package.json`.

- [x] **Media** - Agregar scripts basicos.
  - `npm start`
  - `npm test`
  - `npm run lint`
  - `npm run format`

## Fase 2 - Justicia competitiva y anti-trampa

- [ ] **Alta** - Usar semilla compartida por partida.
  - Generar una `race_seed` en el servidor al iniciar cada ronda.
  - Enviar esa semilla a todos los jugadores junto con `game:start`.
  - Usar un generador pseudoaleatorio deterministico en el motor.
  - Objetivo: que todos los jugadores tengan la misma secuencia de obstaculos.

- [ ] **Alta** - Guardar configuracion de carrera.
  - Guardar velocidad inicial, aceleracion, semilla, fecha de inicio y reglas de puntuacion.
  - Esto permite auditar resultados despues del evento.

- [ ] **Alta** - No confiar ciegamente en el puntaje enviado por el cliente.
  - Opcion inicial: validar que `score` y `distance` no suban mas rapido de lo posible.
  - Opcion robusta: el servidor calcula o verifica el puntaje a partir de tiempo, semilla y eventos.

- [ ] **Alta** - Rate limit para `player:update_state`.
  - Limitar frecuencia por jugador.
  - Ignorar updates demasiado frecuentes.
  - Detectar saltos imposibles de puntaje/distancia.

- [ ] **Media** - Registrar eventos sospechosos.
  - Guardar casos como puntaje imposible, demasiados updates, color invalido, pin invalido repetido.

- [ ] **Media** - Definir reglas de desempate.
  - Puntaje mayor.
  - Distancia mayor.
  - Tiempo de supervivencia mayor.
  - Hora de choque mas tardia.

## Fase 3 - Base de datos con Cloudflare D1

Base sugerida: **Cloudflare D1** porque el juego necesita datos relacionales simples: eventos, partidas, jugadores, rondas y resultados.

### Datos que se deben guardar

- Eventos o torneos.
- Partidas con nombre manual.
- Salas y PIN.
- Jugadores.
- Participaciones de jugadores en cada partida.
- Resultados finales.
- Historial de rondas.
- Configuracion de carrera.
- Auditoria basica.

### Modelo inicial de tablas

- [x] **Alta** - Crear tabla `events`.
  - `id`
  - `name`
  - `description`
  - `starts_at`
  - `created_at`
  - Ejemplos de `name`: "Torneo colegio", "Dia de la familia".

- [x] **Alta** - Crear tabla `matches`.
  - `id`
  - `event_id`
  - `name`
  - `stage`
  - `status`
  - `room_pin`
  - `race_seed`
  - `max_players`
  - `created_at`
  - `started_at`
  - `ended_at`
  - Ejemplos de `name`: "Cuarto grado", "Semifinal", "Final".
  - Ejemplos de `stage`: `practice`, `qualifier`, `semifinal`, `final`.

- [x] **Alta** - Crear tabla `players`.
  - `id`
  - `display_name`
  - `color`
  - `avatar`
  - `created_at`
  - Nota: no guardar datos personales sensibles si no son necesarios.

- [x] **Alta** - Crear tabla `match_players`.
  - `id`
  - `match_id`
  - `player_id`
  - `socket_id`
  - `joined_at`
  - `left_at`
  - `status`

- [x] **Alta** - Crear tabla `results`.
  - `id`
  - `match_id`
  - `player_id`
  - `rank`
  - `score`
  - `distance`
  - `survival_ms`
  - `crashed`
  - `crashed_at`
  - `created_at`

- [x] **Media** - Crear tabla `race_events`.
  - `id`
  - `match_id`
  - `player_id`
  - `type`
  - `payload_json`
  - `created_at`
  - Usar para auditoria, no para cada frame.

- [x] **Media** - Crear tabla `admin_sessions`.
  - `id`
  - `event_id`
  - `match_id`
  - `token_hash`
  - `created_at`
  - `expires_at`

### Migraciones

- [x] **Alta** - Crear carpeta de migraciones.
  - Ejemplo: `migrations/0001_initial_schema.sql`.

- [x] **Alta** - Crear base local para pruebas.
  - Usar Wrangler con D1 local.

- [x] **Alta** - Crear base remota para produccion.
  - Crear la base en Cloudflare.
  - Agregar binding `DB` al Worker.

- [x] **Media** - Crear consultas basicas.
  - Crear evento.
  - Crear partida.
  - Registrar jugador.
  - Guardar resultado.
  - Consultar leaderboard historico.

## Fase 4 - Publicacion en Cloudflare

Para un evento en linea, el proyecto no deberia depender de un servidor Express en memoria. Se recomienda migrar gradualmente a Cloudflare.

### Arquitectura recomendada

- **Cloudflare Workers**: API, rutas, validaciones y autenticacion basica.
- **Durable Objects**: estado en tiempo real de cada sala/partida.
- **Cloudflare D1**: almacenamiento permanente de eventos, partidas, jugadores y resultados.
- **Cloudflare Pages o Workers static assets**: archivos estaticos del frontend.

### Tareas de migracion

- [x] **Alta** - Crear proyecto Cloudflare Worker.
  - Preparar `wrangler.jsonc`.
  - Definir entorno local, staging y produccion.

- [ ] **Alta** - Reemplazar Socket.IO o crear capa compatible.
  - Durable Objects funcionan bien para WebSockets nativos.
  - Evaluar si conviene migrar de Socket.IO a WebSocket nativo.
  - Mantener Socket.IO solo si se usara un runtime compatible y estable para produccion.

- [ ] **Alta** - Crear Durable Object por sala.
  - ID por `room_pin` o por `match_id`.
  - Mantener jugadores conectados.
  - Emitir countdown.
  - Sincronizar leaderboard.
  - Cerrar sala.
  - Guardar resultados al terminar.

- [ ] **Alta** - Persistir resultados al finalizar la partida.
  - El Durable Object debe escribir resumen final en D1.
  - No guardar cada frame en D1.

- [x] **Alta** - Configurar dominio publico.
  - Ejemplo: `dino.tudominio.com`.
  - Rutas esperadas:
    - `/`
    - `/admin`
    - `/player`
    - `/practice`
    - `/api/*`

- [x] **Media** - Configurar ambientes.
  - Local: pruebas con `wrangler dev`.
  - Staging: prueba online cerrada.
  - Produccion: evento real.

- [x] **Media** - Agregar logs y observabilidad.
  - Ver conexiones.
  - Ver errores.
  - Ver salas activas.
  - Ver intentos invalidos.

## Fase 5 - Panel de administracion

- [ ] **Alta** - Permitir nombrar la partida antes de crear la sala.
  - Campo: `Nombre de partida`.
  - Ejemplos: "Cuarto grado", "Semifinal", "Final".

- [ ] **Alta** - Permitir seleccionar o crear evento.
  - Campo: `Evento`.
  - Ejemplo: "Torneo matematico 2026".

- [ ] **Media** - Mostrar historial de partidas.
  - Nombre.
  - Fecha.
  - Numero de jugadores.
  - Ganador.
  - Boton para ver resultados.

- [ ] **Media** - Exportar resultados.
  - CSV.
  - JSON.
  - Vista imprimible.

- [ ] **Media** - Agregar limite de jugadores por partida.
  - Ejemplo: 10, 20, 30, 50.

- [ ] **Baja** - Agregar modo espectador publico.
  - URL separada para ver leaderboard sin controles de admin.

## Fase 6 - Experiencia del jugador

- [ ] **Alta** - Pantalla de reconexion.
  - Si el jugador recarga o pierde internet, intentar recuperar su participacion.

- [ ] **Alta** - Evitar que un jugador entre cuando la partida ya esta en curso.
  - Actualmente se bloquea si `status === playing`; tambien revisar `starting` y `finished`.

- [ ] **Media** - Mensajes claros para errores.
  - PIN inexistente.
  - Sala llena.
  - Partida iniciada.
  - Nombre repetido.
  - Conexion perdida.

- [ ] **Media** - Mejorar soporte movil.
  - Verificar que botones tactiles no tapen el juego.
  - Probar en pantallas pequenas.

- [ ] **Baja** - Permitir seleccionar avatar.
  - Mantener lista cerrada de avatares permitidos.

## Fase 7 - Seguridad para evento online

- [ ] **Alta** - Restringir CORS en produccion.
  - No usar `origin: '*'`.
  - Permitir solo el dominio oficial.

- [ ] **Alta** - Proteger vista admin.
  - Token temporal por evento.
  - Codigo secreto para anfitrion.
  - No permitir que cualquiera cree o cierre salas en produccion.

- [ ] **Alta** - Validar todos los mensajes del cliente.
  - Usar esquema de validacion.
  - Rechazar payloads grandes o invalidos.

- [ ] **Alta** - Rate limit por IP y por socket.
  - Join room.
  - Update state.
  - Crear sala.

- [ ] **Media** - Agregar Cloudflare Turnstile si hay abuso.
  - Especialmente en entrada de jugadores o creacion de salas publicas.

- [ ] **Media** - Ocultar datos internos.
  - No exponer `socket_id` o tokens en respuestas publicas.

## Fase 8 - Pruebas

- [ ] **Alta** - Crear pruebas unitarias.
  - Ranking.
  - Empates.
  - Crear sala.
  - Unirse a sala.
  - Expulsar jugador.
  - Reiniciar a lobby.
  - Fin automatico cuando todos chocan.

- [ ] **Alta** - Crear pruebas contra trampas.
  - Puntaje imposible.
  - Distancia negativa.
  - Color invalido.
  - Obstaculos gigantes.
  - Updates excesivos.

- [ ] **Media** - Crear test e2e portable.
  - No depender de ruta fija de Chrome.
  - Guardar screenshots dentro del proyecto, por ejemplo `test-results/`.

- [ ] **Media** - Probar carga.
  - 10 jugadores.
  - 30 jugadores.
  - 50 jugadores.
  - Ver consumo, latencia y estabilidad.

- [ ] **Media** - Probar evento completo.
  - Crear evento.
  - Crear partida "Cuarto grado".
  - Jugar.
  - Guardar resultados.
  - Crear "Semifinal".
  - Crear "Final".
  - Exportar resultados.

## Fase 9 - Documentacion

- [x] **Alta** - Crear `README.md` actualizado.
  - Instalacion.
  - Ejecutar local.
  - Entrar como admin.
  - Entrar como jugador.
  - Modo practica.
  - Configuracion de Cloudflare.

- [ ] **Media** - Crear guia de evento.
  - Que abrir en pantalla principal.
  - Que enlace compartir.
  - Como nombrar partidas.
  - Que hacer si alguien se desconecta.
  - Como exportar resultados.

- [ ] **Media** - Crear checklist antes del evento.
  - Internet estable.
  - Dominio probado.
  - Base de datos conectada.
  - Sala de prueba creada.
  - Celulares probados.
  - Plan B local preparado.

## Fase 10 - Orden sugerido de trabajo

1. Corregir tabla final, doble inicio y validaciones basicas.
2. Evitar `innerHTML` inseguro con datos de usuario.
3. Agregar nombre de partida y estructura conceptual de evento.
4. Crear esquema D1 y migraciones.
5. Guardar resultados al finalizar partida.
6. Crear semilla compartida para obstaculos.
7. Agregar anti-trampa basico.
8. Migrar tiempo real a Durable Objects/WebSockets.
9. Publicar staging en Cloudflare.
10. Probar con varios jugadores reales.
11. Publicar produccion.
12. Hacer ensayo general antes del evento.

## Notas importantes

- Para pruebas locales se puede mantener Express y Socket.IO temporalmente.
- Para evento en linea conviene migrar el estado de salas a Durable Objects, porque el estado en memoria de `server.js` no es confiable para produccion.
- D1 debe guardar datos importantes, pero no cada update de cada frame.
- El cliente nunca debe ser la fuente final de verdad para resultados competitivos.
- Antes del evento real, hacer una prueba online con varios dispositivos y red movil.
