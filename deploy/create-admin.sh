#!/usr/bin/env bash
# deploy/create-admin.sh : create the admin account, or reset its password. Run on the server.
# Asks for the details, hashes the password, and writes it. Nothing is stored in shell history.
set -euo pipefail
cd "$(dirname "$0")/../server"
DB="${DB:-carterthetown}"

sqlq() { local x="${1//\\/\\\\}"; printf '%s' "${x//\'/\'\'}"; }

read -r -p "Admin name: " NAME
read -r -p "Admin email (used to log in): " EMAIL
read -r -s -p "Password (10+ characters): " PW; echo
read -r -s -p "Repeat password: " PW2; echo
[ "$PW" = "$PW2" ] || { echo "Passwords do not match."; exit 1; }
[ "${#PW}" -ge 10 ] || { echo "Use at least 10 characters."; exit 1; }

EMAIL="$(printf '%s' "$EMAIL" | tr '[:upper:]' '[:lower:]' | xargs)"
HASH="$(node scripts/hash-password.js "$PW")"

sudo mysql "$DB" -e "INSERT INTO users (name, email, password_hash, role)
  VALUES ('$(sqlq "$NAME")', '$(sqlq "$EMAIL")', '$HASH', 'admin')
  ON DUPLICATE KEY UPDATE name=VALUES(name), password_hash=VALUES(password_hash), role='admin';"
sudo mysql "$DB" -e "SELECT id, email, role, LEFT(password_hash,7) AS hash_start FROM users;"
echo "Admin ready. Log in at /admin/login."
