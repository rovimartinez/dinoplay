@echo off
title DinoPlay - Jugador
color 0b

echo =============================================================
echo               🦖 ABRIENDO DINOPLAY JUGADOR 🦖
echo =============================================================
echo.

:: 1. Si el servidor local no esta iniciado, lo arrancamos en segundo plano
netstat -aon | findstr ":3000" | findstr "LISTENING" >nul 2>nul
if %errorlevel% neq 0 (
    echo [*] Iniciando servidor DinoPlay...
    cd /d "%~dp0core_app"
    start /b "" node server.js >nul 2>nul
    timeout /t 2 /nobreak >nul
)

echo [*] Abriendo pantalla del jugador en el navegador...

:: 2. Intentar abrir con el navegador predeterminado mediante explorer / rundll32 / chrome / edge / start
start http://localhost:3000/player.html || explorer "http://localhost:3000/player.html" || rundll32 url.dll,FileProtocolHandler "http://localhost:3000/player.html"

timeout /t 1 /nobreak >nul
exit
