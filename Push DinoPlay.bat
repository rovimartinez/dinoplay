@echo off
title Actualizador DinoPlay (GitHub)
color 0b
cd /d "%~dp0"

echo =====================================================
echo    DINOPLAY - ACTUALIZADOR A GITHUB
echo =====================================================
echo.

where git >nul 2>nul
if %errorlevel% neq 0 (
    color 0c
    echo [ERROR] Git no esta instalado o no se encuentra en el PATH.
    echo Descarga e instala Git desde: https://git-scm.com/
    echo.
    pause
    exit /b 1
)

if not exist ".git" (
    color 0c
    echo =====================================================
    echo [ERROR] No se encontro el repositorio .git en:
    echo %~dp0
    echo =====================================================
    pause
    exit /b 1
)

echo Accediendo al repositorio en: %~dp0
echo.
echo === [1/4] Archivos modificados detectados ===
git status -s
echo.

echo === [2/4] Preparando archivos (git add .) ===
git add .
echo [OK] Archivos preparados correctamente.
echo.

echo === [3/4] Mensaje del cambio ===
set "msg="
set /p "msg=Que cambios hiciste? (Presiona ENTER para mensaje automatico): "

if not defined msg set "msg=Actualizacion DinoPlay - %date% %time%"
if "%msg%"=="" set "msg=Actualizacion DinoPlay - %date% %time%"

echo.
echo === [4/4] Guardando y subiendo a GitHub ===

git diff --cached --quiet
if %errorlevel% neq 0 (
    git commit -m "%msg%"
) else (
    echo [INFO] No hay cambios nuevos para registrar. Todo esta al dia.
)

echo.
echo Subiendo cambios a GitHub (git push origin main)...
git push origin main

if %errorlevel% equ 0 (
    color 0a
    echo.
    echo =====================================================
    echo   [EXITO] Actualizacion subida a GitHub correctamente!
    echo   Repositorio: rovimartinez/dinoplay - Rama: main
    echo =====================================================
) else (
    color 0c
    echo.
    echo =====================================================
    echo   [ERROR] Ocurrio un error al subir los cambios a GitHub.
    echo   Verifica tu conexion a internet o permisos de acceso.
    echo =====================================================
)

echo.
pause1