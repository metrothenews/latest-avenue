#!/bin/bash
# Double-click to install dependencies, start the dev server and open it in Chrome.
cd "$(dirname "$0")"
if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js isn't installed. Get the LTS version from https://nodejs.org, then run this again."
  read -n 1 -s -r -p "Press any key to close"; exit 1
fi
[ -d node_modules ] || npm install || { read -n 1 -s -r -p "npm install failed. Press any key to close"; exit 1; }
(sleep 3; open -a "Google Chrome" http://localhost:5173) &
npm run dev
