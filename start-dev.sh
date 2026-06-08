#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

cleanup() { kill "${SERVER_PID:--}" 2>/dev/null; }
# Fire cleanup on any exit (INT, SIGTERM, set -e, normal end)
trap cleanup EXIT INT TERM

node server.js &
SERVER_PID=$!
sleep 2
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/
echo "Server PID: $SERVER_PID"
wait $SERVER_PID
