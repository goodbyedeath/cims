@echo off
chcp 65001 >nul 2>&1
title CIMS - Fresh Install

:: Absolute paths to Laragon binaries
set "PHP_EXE=D:\laragon\bin\php\php-8.3.30-Win32-vs16-x64\php.exe"
set "MYSQL_EXE=D:\laragon\bin\mysql\mysql-8.4.3-winx64\bin\mysql.exe"
set "NPX_CMD=D:\laragon\bin\nodejs\node-v22\npx.cmd"
set "NPM_CMD=D:\laragon\bin\nodejs\node-v22\npm.cmd"
set "COMPOSER_EXE=D:\laragon\bin\composer\composer.bat"
set "PATH=D:\laragon\bin\php\php-8.3.30-Win32-vs16-x64;D:\laragon\bin\mysql\mysql-8.4.3-winx64\bin;D:\laragon\bin\nodejs\node-v22;D:\laragon\bin\composer;%PATH%"

cd /d "%~dp0"

echo.
echo   CIMS Fresh Install
echo   ==================
echo.
echo   This will DROP all tables and re-seed the database.
echo.
set /p confirm="   Are you sure? (y/N): "
if /i not "%confirm%"=="y" (
    echo   Cancelled.
    pause
    exit /b 0
)

echo.
echo   [1/5] Creating database...
"%MYSQL_EXE%" -u root -e "CREATE DATABASE IF NOT EXISTS cims_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>nul

echo   [2/5] Installing composer dependencies...
"%COMPOSER_EXE%" install --no-interaction --quiet

echo   [3/5] Installing npm dependencies...
"%NPM_CMD%" install --silent

echo   [4/5] Running fresh migration + seed...
"%PHP_EXE%" artisan migrate:fresh --seed --force

echo   [5/5] Building frontend assets...
"%NPX_CMD%" vite build

echo.
echo   ================================================================
echo   Fresh install complete!
echo   Run start.bat to launch the application.
echo   ================================================================
echo.
pause
