@echo off
title DinoPlay - Jugador Web
color 0b

echo =============================================================
echo             🌐 ABRIENDO DINOPLAY JUGADOR WEB 🌐
echo =============================================================
echo.

echo [*] Abriendo pantalla del jugador en linea...

:: Abrir en el navegador predeterminado la version Web en la nube
start https://juegodino.pages.dev/player.html || explorer "https://juegodino.pages.dev/player.html" || rundll32 url.dll,FileProtocolHandler "https://juegodino.pages.dev/player.html"

timeout /t 1 /nobreak >nul
exit
