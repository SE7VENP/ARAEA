#!/bin/bash
# ARAEA Stage 3 — One-click launcher (Mac/Linux)
# Usage: chmod +x start.sh && ./start.sh

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo ""
echo " ================================================="
echo "  ARAEA  Stage 3  —  AIoT Music Ambient System"
echo " ================================================="
echo ""

# Detect terminal emulator
if command -v gnome-terminal &>/dev/null; then
  TERM_CMD="gnome-terminal --"
elif command -v xterm &>/dev/null; then
  TERM_CMD="xterm -e"
elif [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS — use osascript
  open_mac_terminal() {
    osascript -e "tell app \"Terminal\" to do script \"$1\""
  }
  echo " Opening 3 Terminal windows..."
  open_mac_terminal "cd '$DIR/backend' && npm install && npm run dev"
  sleep 2
  open_mac_terminal "cd '$DIR/frontend' && npm install && npm run dev"
  sleep 2
  open_mac_terminal "cd '$DIR/python' && pip install websockets Pillow numpy scipy 2>/dev/null; python ai_visual_server.py --tier 4"
  sleep 6
  echo " Opening dashboard..."
  open http://localhost:5173
  echo ""
  echo " ✅ All servers launched in separate Terminal windows"
  echo "    Dashboard: http://localhost:5173"
  exit 0
else
  TERM_CMD="x-terminal-emulator -e"
fi

# Linux
echo " Starting backend..."
$TERM_CMD bash -c "cd '$DIR/backend' && npm install && npm run dev; bash" &
sleep 3
echo " Starting frontend..."
$TERM_CMD bash -c "cd '$DIR/frontend' && npm install && npm run dev; bash" &
sleep 3
echo " Starting AI server..."
$TERM_CMD bash -c "cd '$DIR/python' && pip install websockets Pillow numpy scipy -q; python ai_visual_server.py --tier 4; bash" &
sleep 6
echo " Opening dashboard..."
xdg-open http://localhost:5173 2>/dev/null || echo " Open: http://localhost:5173"

echo ""
echo " ✅ All servers launched"
echo "    Dashboard: http://localhost:5173"
echo "    Backend:   http://localhost:3001"
echo "    AI Server: ws://127.0.0.1:5678"
