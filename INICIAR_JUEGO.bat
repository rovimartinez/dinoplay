@echo off
title DinoPlay - Servidor Completo (Local y Online)
color 0a
cd /d "%~dp0"

echo =============================================================
echo               🦖 INICIANDO DINOPLAY 🦖
echo =============================================================
echo.

:: 1. Verificar si Node.js esta instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0c
    echo [ERROR] Node.js no esta instalado o no se encuentra en el PATH.
    echo Descargalo e instalalo desde: https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: 2. Instalar dependencias si faltan
if not exist "node_modules\" (
    echo [INFO] Instalando dependencias necesarias...
    call npm install
    echo.
)

:: 3. Liberar puerto 3000 si un proceso anterior quedo colgado
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>nul
)

:: 4. Cerrar tuneles previos si quedaron abiertos
taskkill /F /IM cloudflared.exe >nul 2>nul

:: 5. Arrancar servidor y conexion completa
node iniciar_online.js
pause
