# ✅ Checklist Previo al Evento / Torneo

Antes de iniciar el evento oficial en vivo, completa esta lista de verificación para garantizar una experiencia 100% fluida:

---

### 1. 📶 Conectividad y Red
- [ ] Conexión a Internet estable en la computadora del anfitrión (preferiblemente cableada o WiFi 5GHz).
- [ ] Red WiFi disponible para los asistentes con señal suficiente en el salón.
- [ ] En caso de fallo de internet externo, tener probado el **Plan B Local** (laptop con `npm start` y celulares conectados al mismo router o punto de acceso móvil).

---

### 2. 🖥️ Proyector y Audio
- [ ] Proyector o televisor principal conectado y probado en resolución 1080p.
- [ ] Sistema de sonido o altavoces conectados (para escuchar la cuenta regresiva, beeps de inicio y fanfarria de victoria).
- [ ] Navegador en modo pantalla completa (`F11`).

---

### 3. 🌐 Verificación de Servidor y Base de Datos
- [ ] Probar endpoint de salud de la base de datos: [https://juegodino.pages.dev/api/health](https://juegodino.pages.dev/api/health) (debe devolver `ok: true, database: true`).
- [ ] Probar inicio de sesión en el panel `/admin` con la clave secreta (`dino2026`).

---

### 4. 📱 Prueba Piloto con Dispositivos Móviles
- [ ] Crear una sala de prueba con PIN.
- [ ] Conectar 2 o 3 teléfonos móviles escaneando o ingresando el PIN.
- [ ] Probar controles táctiles en pantalla (salto y agachado).
- [ ] Probar la mini-práctica en el lobby de espera.
- [ ] Iniciar una carrera de prueba de 30 segundos y verificar que el podio aparezca correctamente.
- [ ] Probar la exportación de resultados a CSV o PDF.

---

### 5. 🦺 Plan B (Fallback Local de Emergencia)
Si el evento se realiza en un lugar sin conexión a internet externa:
1. Abre una terminal en la carpeta del proyecto.
2. Ejecuta:
   ```bash
   npm start
   ```
3. El servidor mostrará la IP local (ejemplo: `http://192.168.1.100:3000`).
4. Abre `http://localhost:3000/admin` en la laptop y pide a los participantes que ingresen a `http://192.168.1.100:3000/player` desde sus teléfonos conectados al mismo WiFi.
