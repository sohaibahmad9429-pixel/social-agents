#!/bin/bash
set -e

echo "🚀 Starting Browser View Services..."

# Start Xvfb (Virtual Display)
echo "📺 Starting Xvfb virtual display..."
Xvfb :99 -screen 0 ${DISPLAY_WIDTH:-1280}x${DISPLAY_HEIGHT:-720}x24 -ac &
sleep 2

# Verify Xvfb is running
if ! pgrep -x Xvfb > /dev/null; then
    echo "❌ Xvfb failed to start"
    exit 1
fi
echo "✅ Xvfb started on display :99"

# Start Fluxbox window manager
echo "🪟 Starting Fluxbox window manager..."
fluxbox -display :99 &
sleep 1

# Start x11vnc server
echo "📡 Starting x11vnc server on port 5900..."
x11vnc -display :99 -forever -shared -rfbport 5900 -nopw -xkb &
sleep 2

# Verify x11vnc is running
if ! netstat -tuln | grep -q ":5900 "; then
    echo "❌ x11vnc failed to start"
    exit 1
fi
echo "✅ x11vnc started on port 5900"

# Start noVNC
echo "🌐 Starting noVNC WebSocket proxy on port 6080..."
/opt/noVNC/utils/novnc_proxy --vnc localhost:5900 --listen 6080 --web /opt/noVNC &
sleep 2

# Verify noVNC is running
if ! netstat -tuln | grep -q ":6080 "; then
    echo "❌ noVNC failed to start"
    exit 1
fi
echo "✅ noVNC started on port 6080"

echo ""
echo "🎉 All display services started successfully!"
echo "📺 VNC available at: vnc://localhost:5900"
echo "🌐 noVNC available at: http://localhost:6080/vnc.html"
echo ""

# Start the FastAPI application
echo "🐍 Starting FastAPI application on port 8000..."
exec uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
