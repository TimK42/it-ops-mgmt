#!/bin/bash
cd /Users/tim_openclaw/.openclaw/workspace/Git-Repository/it-ops-mgmt
node server.js &
SERVER_PID=$!
sleep 2
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/
echo "Server PID: $SERVER_PID"
wait $SERVER_PID
