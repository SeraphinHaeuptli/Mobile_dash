#!/usr/bin/env bash
# One-command dev launcher: installs deps only if missing, then starts the dev server.
set -e
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  npm install
fi

if [ ! -f .env.local ] && [ -f .env.example ]; then
  cp .env.example .env.local
fi

echo "Starting Lumen Dashboard at http://localhost:3000"
npm run dev
