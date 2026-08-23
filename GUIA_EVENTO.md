# 🎪 Guía Paso a Paso para Organizar un Torneo con Dino Runner

Esta guía está diseñada para el **anfitrión / organizador** del evento para garantizar que la competencia fluya sin contratiempos, con máxima emoción y control total.

---

## 1. 🖥️ ¿Qué abrir en la pantalla principal / proyector?

1. En la computadora conectada al proyector, TV o pantalla gigante abre:
   - **En línea:** `https://juegodino.pages.dev/admin` (o tu servidor local `http://localhost:3000/admin`).
2. Ingresa la clave de anfitrión (por defecto: `dino2026`).
3. Verás en pantalla:
   - El **PIN de la sala** en números grandes.
   - El **enlace de invitación** y código para los participantes.
   - El grid de jugadores que se van uniendo en tiempo real con sus colores y avatares.

> 💡 **Tip para el proyector:** Presiona `F11` en tu navegador para poner la pantalla completa y maximizar el impacto visual.

---

## 2. 📱 ¿Qué enlace compartir con los participantes?

- **Enlace directo con PIN:**  
  `https://juegodino.pages.dev/player?pin=XXXX` (reemplaza `XXXX` con el PIN generado).
- **O enlace general:**  
  `https://juegodino.pages.dev/player` (los jugadores ingresarán el PIN manualmente).
- **Para espectadores:**  
  `https://juegodino.pages.dev/spectator?pin=XXXX` (para quienes deseen seguir la tabla en sus propios teléfonos).

---

## 3. 🏷️ ¿Cómo nombrar las partidas y estructurar el torneo?

En el panel superior del anfitrión puedes configurar:
- **Nombre del Evento:** Ej: *"Torneo Intercolegial 2026"* o *"Hackathon Dino Cup"*.
- **Nombre de Partida:**
  - *"Ronda 1 - Grupo A"*
  - *"Ronda 1 - Grupo B"*
  - *"Semifinal 1"*
  - *"Gran Final de Campeones"*
- **Límite de Jugadores:** Elige 10, 20, 30, 50 o Sin límite para controlar el tamaño de cada tanda.

---

## 4. 🎮 Durante la Carrera

1. Cuando todos los participantes estén en la sala, haz clic en el botón verde **"🚀 Iniciar Carrera"**.
2. Sonará la cuenta regresiva oficial (3, 2, 1) y todos correrán con la **misma secuencia de obstáculos generada determinísticamente**.
3. En la pantalla principal verás el **Leaderboard en vivo**, los cambios de posición y las alertas de choques.
4. Cuando el último jugador choque, el sistema **finalizará la partida automáticamente**, disparará confeti y revelará el podio oficial (1º, 2º y 3º lugar).

---

## 5. 🔄 ¿Qué hacer si un jugador se desconecta?

- El juego cuenta con **reconexión automática**: si un participante recarga la página por accidente o sufre un microcorte de red, al volver a abrir la página su sesión se restaura automáticamente sin perder su puntaje.
- Si un participante no puede volver a entrar a tiempo, puede seguir la carrera en vivo en **Modo Espectador**.

---

## 6. 📊 ¿Cómo exportar y guardar los resultados?

En la pantalla del podio encontrarás la barra de herramientas de exportación:
- **📥 Exportar CSV:** Descarga una hoja de cálculo (`.csv`) con UTF-8 compatible con Excel y Google Sheets.
- **📋 Exportar JSON:** Para integrar con sistemas externos o registros digitales.
- **🖨️ Imprimir Reporte:** Genera una vista limpia y formateada lista para imprimir en papel o guardar en PDF con la fecha, ganador y posiciones finales.

Para jugar la siguiente ronda con los mismos participantes, haz clic en **"🔄 Jugar Otra Partida (Misma Sala)"**.
