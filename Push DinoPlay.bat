@echo off
:: Cambia la codificación a UTF-8 para mostrar tildes y signos correctamente
chcp 65001 >nul
title Actualizador DinoPlay (GitHub)
color 0b

:: Obtiene la ruta de este proyecto automáticamente
set "REPO_PATH=%~dp0"

echo =====================================================
echo    🦖 DINOPLAY - ACTUALIZADOR A GITHUB
echo =====================================================
echo.
echo Accediendo al repositorio en: %REPO_PATH%
cd /d "%REPO_PATH%"

if not exist ".git" (
    color 0c
    echo =====================================================
    echo ERROR: No se encontró el repositorio .git en:
    echo %REPO_PATH%
    echo =====================================================
    pause
    exit /b
)

echo.
echo === 📁 Archivos modificados detectados ===
git status -s

echo.
echo === 📦 Preparando archivos (git add .) ===
git add .

echo.
set /p msg="¿Qué cambios hiciste hoy? (ENTER para mensaje automático): "

if "%msg%"=="" (
    set "msg=Actualización DinoPlay - %date% %time%"
)

echo.
echo === 💾 Guardando cambios locales (commit) ===
git commit -m "%msg%"

echo.
echo === 🚀 Subiendo a GitHub (git push origin main) ===
git push origin main

if %ERRORLEVEL% equ 0 (
    color 0a
    echo.
    echo =====================================================
    echo   ✅ ¡Actualización subida a GitHub con éxito!
    echo   Repositorio: rovimartinez/dinoplay
    echo =====================================================
) else (
    color 0c
    echo.
    echo =====================================================
    echo   ❌ Ocurrió un error al subir los cambios a GitHub.
    echo   Verifica tu conexión o permisos de acceso.
    echo =====================================================
)

pause