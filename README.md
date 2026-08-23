# Dino Runner Multijugador (DinoPlay) 🦖

Plataforma de carreras multijugador centralizada en tiempo real estilo Kahoot / Quizizz, diseñada para torneos escolares, eventos tech, olimpiadas y competencias presenciales o remotas.

---

## 🚀 Enlaces Rápidos y Producción

- **Producción Cloudflare Pages:** [https://juegodino.pages.dev/](https://juegodino.pages.dev/)
- **Panel Anfitrión (Proyector):** [https://juegodino.pages.dev/admin](https://juegodino.pages.dev/admin) *(Clave: `dino2026`)*
- **Entrada Jugadores (Móvil / PC):** [https://juegodino.pages.dev/player](https://juegodino.pages.dev/player)
- **Modo Espectador en Vivo:** [https://juegodino.pages.dev/spectator](https://juegodino.pages.dev/spectator)
- **Modo Práctica Individual:** [https://juegodino.pages.dev/practice](https://juegodino.pages.dev/practice)
- **Healthcheck Base de Datos D1:** [https://juegodino.pages.dev/api/health](https://juegodino.pages.dev/api/health)

---

## 📚 Guías del Organizador

- 🎪 **[Guía Paso a Paso para Organizar un Torneo](GUIA_EVENTO.md)**: Cómo proyectar, nombrar rondas, invitar jugadores y exportar resultados.
- ✅ **[Checklist Previo al Evento](CHECKLIST_EVENTO.md)**: Lista de verificación de red, audio, celulares y plan B.

---

## ✨ Características Principales

- 🎮 **Multijugador Centralizado con PIN:** El anfitrión proyecta la pantalla central y los participantes se unen instantáneamente con un código PIN de 4 dígitos.
- 🎯 **Justicia Competitiva (Seed Determinista):** Todos los jugadores esquivan exactamente la misma secuencia de obstáculos generada por el PRNG `Mulberry32`.
- 🛡️ **Anti-Trampas & Anti-Speedhack:** Validación física de velocidad máxima, rate limiting por socket e IP, y desempate por milisegundos de supervivencia.
- 🔄 **Reconexión Automática Transparente:** Sistema de `sessionToken` que restaura la partida de cualquier jugador en caso de corte de red o recarga accidental.
- 📳 **Feedback Háptico y Visual:** Vibración táctil en móviles al colisionar y sacudida de pantalla.
- 📊 **Exportación de Resultados:** Descarga de tablas en **CSV (Excel/Sheets)**, **JSON** o **Reporte Imprimible / PDF**.
- 🔒 **Seguridad y Control:** Panel de anfitrión protegido con clave `ADMIN_SECRET`, bloqueo de entradas una vez iniciada la carrera y sugerencia automática de Modo Espectador.
- ⚡ **Infraestructura Cloudflare D1 + Pages:** Persistencia SQL serverless con Cloudflare D1 y backend de alta velocidad.

---

## 💻 Ejecución Local

### 1. Instalación
```bash
npm install
```

### 2. Ejecutar Pruebas Automatizadas
```bash
npm test
```

### 3. Iniciar Servidor
```bash
npm start
```
*También puedes hacer doble clic en `INICIAR_JUEGO.bat` en Windows.*

El servidor imprimirá las URLs locales y de red WiFi:
- **Vista Anfitrión:** `http://localhost:3000/admin`
- **Vista Jugador Móvil:** `http://192.168.X.X:3000/player`

---

## 🧪 Comandos de Prueba Disponibles

| Comando | Descripción |
|---|---|
| `npm test` | Ejecuta linting y toda la suite de pruebas completa |
| `npm run test:fairness` | Pruebas de PRNG, desempates y anti-speedhack (Fase 2) |
| `npm run test:admin` | Pruebas de panel anfitrión, límites y exportación (Fase 5) |
| `npm run test:player` | Pruebas de reconexión y nombres duplicados (Fase 6) |
| `npm run test:security` | Pruebas de autenticación admin y rate limiting por IP (Fase 7) |
| `npm run test:comprehensive` | Pruebas e2e del ciclo de vida de partidas (Fase 8) |
| `npm run test:stress` | Prueba de estrés con 30 jugadores concurrentes (>800 updates/seg) (Fase 8) |
