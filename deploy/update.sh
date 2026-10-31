#!/usr/bin/env bash
# Run on the server from anywhere:  bash ~/app/deploy/update.sh
# Builds the client, publishes it to the web root, restarts the API.
# Override the web root with:  WEB_ROOT=/some/path bash deploy/update.sh
set -euo pipefail
cd "$(dirname "$0")/.."
WEB_ROOT="${WEB_ROOT:-/var/www/carterthetownwear}"

echo "[1/4] Building client"
cd client
npm ci
npm run build

echo "[2/4] Publishing client to $WEB_ROOT (sudo password may be requested)"
sudo mkdir -p "$WEB_ROOT"
sudo rm -rf "${WEB_ROOT:?}"/*
sudo cp -r dist/* "$WEB_ROOT"/
sudo chown -R www-data:www-data "$WEB_ROOT"
sudo chmod -R 755 "$WEB_ROOT"

echo "[3/4] Installing server deps"
cd ../server
npm ci --omit=dev
mkdir -p uploads

if [ ! -f ecosystem.config.js ]; then
  echo "ERROR: server/ecosystem.config.js is missing. Copy ecosystem.config.example.js and fill it in." >&2
  exit 1
fi

echo "[4/4] Restarting API"
if pm2 describe carterthetownwear-api >/dev/null 2>&1; then
  pm2 restart carterthetownwear-api --update-env
else
  pm2 start ecosystem.config.js
fi
pm2 save
echo "Done. Check: curl http://127.0.0.1:5000/api/health"
