@echo off
setlocal enabledelayedexpansion

echo =======================================================
echo Iniciando DBeaver y conectando a Gema Academy DB...
echo Leyendo configuracion de .env...
echo =======================================================

:: Asegurarse de estar en el directorio correcto donde esta el .env
cd /d "%~dp0"

if not exist ".env" (
    echo [ERROR] No se encontro el archivo .env en %~dp0
    pause
    exit /b
)

:: Leer y establecer variables de entorno desde el archivo .env
for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
    set "LINE=%%A"
    :: Ignorar lineas que empiezan con # y lineas vacias
    if not "!LINE!" == "" (
        if "!LINE:~0,1!" neq "#" (
            set "%%A=%%B"
        )
    )
)

:: Limpiar espacios en blanco al final o posibles retornos de carro
:: Y quitar comillas si el valor en el env las tiene
set "DB_PASSWORD=%DB_PASSWORD:"=%"
set "DB_USER=%DB_USER:"=%"
set "DB_HOST=%DB_HOST:"=%"
set "DB_PORT=%DB_PORT:"=%"
set "DB_NAME=%DB_NAME:"=%"

:: Validar si cargo las variables esenciales
if "%DB_USER%"=="" (
    echo [ERROR] No se pudo leer DB_USER de .env
    pause
    exit /b
)

:: Cadena de conexion para DBeaver
set CONNECTION_STRING="driver=postgresql|host=%DB_HOST%|port=%DB_PORT%|database=%DB_NAME%|user=%DB_USER%|password=%DB_PASSWORD%"

:: Buscar DBeaver en rutas comunes e iniciarlo con la conexion configurada
if exist "%ProgramFiles%\DBeaver\dbeaver.exe" (
    start "" "%ProgramFiles%\DBeaver\dbeaver.exe" -con %CONNECTION_STRING%
    exit /b
)

if exist "%LOCALAPPDATA%\DBeaver\dbeaver.exe" (
    start "" "%LOCALAPPDATA%\DBeaver\dbeaver.exe" -con %CONNECTION_STRING%
    exit /b
)

:: Si esta en el PATH global
where dbeaver >nul 2>nul
if %ERRORLEVEL% equ 0 (
    start "" dbeaver -con %CONNECTION_STRING%
    exit /b
)

echo [ERROR] No se pudo encontrar DBeaver en tu sistema.
echo Por favor, asegurate de tenerlo instalado o edita este archivo
echo agregando la ruta exacta donde lo instalaste.
pause
