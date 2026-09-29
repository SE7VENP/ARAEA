@echo off
title ARAEA — AIoT Music Ambient System
color 0B
echo.
echo  ===================================================
echo   ARAEA  Stage 3  —  AIoT Music Ambient System
echo  ===================================================
echo.
echo  Starting all 3 servers...
echo.

REM ── Backend :3001 ──────────────────────────────────
start "ARAEA Backend  :3001" cmd /k ^
  "title ARAEA Backend :3001 && color 0A && cd /d "%~dp0backend" && ^
   echo [Backend] Installing... && npm install --silent && ^
   echo [Backend] Starting... && npm run dev"

timeout /t 4 /nobreak > nul

REM ── Frontend :5173 ─────────────────────────────────
start "ARAEA Frontend :5173" cmd /k ^
  "title ARAEA Frontend :5173 && color 0B && cd /d "%~dp0frontend" && ^
   echo [Frontend] Installing... && npm install --silent && ^
   echo [Frontend] Starting... && npm run dev"

timeout /t 4 /nobreak > nul

REM ── Python AI Server :5678 ─────────────────────────
start "ARAEA AI Server :5678" cmd /k ^
  "title ARAEA AI Server :5678 && color 0D && cd /d "%~dp0python" && ^
   echo [AI] Installing Python deps... && ^
   pip install websockets Pillow numpy scipy --break-system-packages -q 2>nul || ^
   pip install websockets Pillow numpy scipy -q && ^
   echo [AI] Starting AI Visual Server (Tier 4)... && ^
   python ai_visual_server.py --tier 4"

echo.
echo  Waiting for servers to start...
timeout /t 8 /nobreak > nul

echo.
echo  Opening ARAEA Dashboard...
start http://localhost:5173

echo.
echo  ===================================================
echo   All servers launched. Close this window anytime.
echo   Dashboard: http://localhost:5173
echo   Backend:   http://localhost:3001
echo   AI Server: ws://127.0.0.1:5678
echo  ===================================================
echo.
pause
