@echo off
setlocal
chcp 65001 >nul 2>&1
title CIMS - Channel Intelligence Management System

:: ============================================================
::  Absolute paths to Laragon binaries
:: ============================================================
set PHP=D:\laragon\bin\php\php-8.3.30-Win32-vs16-x64\php.exe
set MYSQL=D:\laragon\bin\mysql\mysql-8.4.3-winx64\bin\mysql.exe
set NPX=D:\laragon\bin\nodejs\node-v22\npx.cmd
set PROJDIR=%~dp0

:: Add Laragon bins to PATH for child processes
set PATH=D:\laragon\bin\php\php-8.3.30-Win32-vs16-x64;D:\laragon\bin\mysql\mysql-8.4.3-winx64\bin;D:\laragon\bin\nodejs\node-v22;D:\laragon\bin\composer;%PATH%

cd /d %PROJDIR%

:: ============================================================
::  Banner
:: ============================================================
cls
echo.
echo   ================================================================
echo.
echo        CIMS - Channel Intelligence Management System
echo.
echo   ================================================================
echo.

:: ============================================================
::  Step 1: Check MySQL
:: ============================================================
echo   [1/4] Checking MySQL connection...
%MYSQL% -u root -e "SELECT 1" >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo   [ERROR] MySQL is not running!
    echo   Please start Laragon first, then run this script again.
    echo.
    pause
    exit /b 1
)
%MYSQL% -u root -e "CREATE DATABASE IF NOT EXISTS cims_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>nul
echo         Database cims_db ... OK
echo.

:: ============================================================
::  Step 2: Run migrations
:: ============================================================
echo   [2/4] Running migrations...
%PHP% artisan migrate --force
echo.

:: ============================================================
::  Step 3: Start Vite dev server
:: ============================================================
echo   [3/4] Starting Vite dev server...
start "CIMS-Vite" /min cmd /k "cd /d %PROJDIR% && set PATH=D:\laragon\bin\nodejs\node-v22;%PATH% && %NPX% vite"

timeout /t 3 /nobreak >nul

:: ============================================================
::  Step 4: Start Laravel server
:: ============================================================
echo   [4/4] Starting Laravel server...
start "CIMS-Laravel" /min cmd /k "cd /d %PROJDIR% && %PHP% artisan serve --host=127.0.0.1 --port=8000"

timeout /t 2 /nobreak >nul

:: ============================================================
::  Open browser
:: ============================================================
echo.
echo   ================================================================
echo.
echo   CIMS is running!
echo.
echo   App      : http://127.0.0.1:8000
echo   Vite HMR : http://127.0.0.1:5173
echo.
echo   Login    : admin@cims.com / password
echo.
echo   Close this window to stop all servers.
echo.
echo   ================================================================
echo.

start http://127.0.0.1:8000

:: ============================================================
::  Keep alive
:: ============================================================
:wait
timeout /t 60 /nobreak >nul
goto wait
