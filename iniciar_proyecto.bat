@echo off
setlocal enabledelayedexpansion

echo =======================================================
echo Iniciando GemaAcademy API - Antigravity Launcher
echo =======================================================

cd /d "%~dp0"

:: 1. Verificar si Docker esta instalado y corriendo
echo [1/4] Verificando Docker...
docker --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker no esta instalado o no se encuentra en el PATH.
    pause
    exit /b
)

:: 2. Levantar servicios de docker-compose (PostgreSQL)
echo [2/4] Levantando Base de Datos en Docker...
docker-compose up -d
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Fallo al iniciar los contenedores de Docker.
    pause
    exit /b
)

:: 3. Esperar un par de segundos para que PostgreSQL acepte conexiones
echo Esperando a que PostgreSQL este listo...
timeout /t 3 /nobreak >nul

:: 4. Sincronizar Prisma
echo [3/4] Sincronizando Prisma con la Base de Datos...
call npx prisma generate
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Fallo al generar el cliente de Prisma.
    pause
    exit /b
)

call npx prisma db push
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Fallo al sincronizar la base de datos con Prisma db push.
    pause
    exit /b
)

:: Poblar la BD si está vacía
echo Poblando base de datos con Catálogos y Roles...
call npm run db:seed

:: 5. Iniciar Servidor Node Backend
echo [4/4] Iniciando el servidor de desarrollo...
echo =======================================================
call node --watch --env-file=.env src/index.js

pause
