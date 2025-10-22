@echo off
echo ========================================
echo   Запуск серверов разработки
echo ========================================
echo.
echo Frontend (Vite): http://localhost:5173
echo Backend (Node):  http://localhost:3000
echo.
echo Для остановки нажмите Ctrl+C
echo ========================================
echo.

start "Backend Server" cmd /k "node --watch server/server.js"
timeout /t 2 /nobreak >nul
start "Frontend Dev Server" cmd /k "npm run dev"

echo.
echo Серверы запущены в отдельных окнах!
echo.
