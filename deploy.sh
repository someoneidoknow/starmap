#!/bin/bash
set -euo pipefail

FORCE=false
if [ "${1:-}" = "--force" ]; then
  FORCE=true
fi

echo "pulling"
git fetch origin main
NEW_COMMITS=$(git rev-list HEAD..origin/main --count)

if [ "$NEW_COMMITS" -eq 0 ] && [ "$FORCE" = false ]; then
  echo "up to date"
  exit 0
fi
git reset --hard origin/main

echo "rebuilding images"
docker compose build

echo "updating services"
docker compose rm -sf webui
sleep 0.5
docker compose up -d --build --no-recreate webui
sleep 2
docker compose rm -sf webui2
sleep 0.5
docker compose up -d --build --no-recreate webui2

docker system prune -f

echo "done."
