#!/bin/bash
set -e

# Start virtual display
Xvfb :99 -screen 0 1920x1080x24 -ac &
sleep 1

# Start window manager
fluxbox &
sleep 0.5

# Start VNC server
x11vnc -display :99 -nopw -forever -shared -rfbport 5900 &
sleep 0.5

# Start noVNC (websockify proxy) with autoconnect
websockify --web /usr/share/novnc 6080 localhost:5900 &
sleep 0.5

# Patch noVNC index to autoconnect
sed -i 's|</head>|<script>window.onload=function(){if(!location.search.includes("autoconnect"))location.search="?autoconnect=true\&resize=scale"}</script></head>|' /usr/share/novnc/vnc.html 2>/dev/null || true

# Start the API server
exec node server.js
