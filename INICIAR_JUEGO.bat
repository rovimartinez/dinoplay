@echo off
title Dino Runner Multijugador
color 0a
cd /d "%~dp0"

echo ===================================================
echo     DINO RUNNER MULTIJUGADOR - INICIANDO
echo ===================================================
echo.

:: 1. Verificar si Node.js esta instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0c
    echo [ERROR] Node.js no esta instalado en este equipo.
    echo Por favor descarga e instala Node.js desde: https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: 2. Instalar dependencias si faltan
if not exist "node_modules\" (
    echo [INFO] Instalando dependencias por primera vez...
    call npm install
    echo.
)

echo [OK] Servidor listo.
echo.
echo Abriendo el juego en tu navegador...
echo  - Portal Principal:   http://localhost:3000
echo  - Panel de Anfitrion: http://localhost:3000/admin
echo  - Vista de Jugadores: http://localhost:3000/player
echo.
echo (Para detener el servidor, solo cierra esta ventana)
echo ===================================================
echo.

:: 3. Abrir el navegador automaticamente
start "" "http://localhost:3000"

:: 4. Arrancar el servidor
node server.js

pause
