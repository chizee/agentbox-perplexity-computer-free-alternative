#!/bin/bash
set -e

# Start MCP server in background
node mcp-server.js &

# Start manager API
exec node server.js
