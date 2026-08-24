@echo off
title BUMOTIK FINANCIAL - SERVER
cd /d "%~dp0"
echo ========================================================
echo   MENJALANKAN SERVER APLIKASI BUMOTIK FINANCIAL
echo ========================================================
echo.
echo Sedang memulai server development...
start http://localhost:8080
npm run dev
pause
