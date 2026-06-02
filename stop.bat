@echo off
title CIMS - Stopping Servers
echo.
echo   Stopping CIMS servers...
echo.
taskkill /FI "WINDOWTITLE eq CIMS - Vite" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq CIMS - Laravel" /F >nul 2>&1
echo   All CIMS servers stopped.
echo.
pause
