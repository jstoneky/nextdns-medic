#!/usr/bin/env bash
# Spin up a Pi-hole v6 Docker container for local extension testing.
# Usage:
#   npm run pihole:start   — start container (idempotent)
#   npm run pihole:stop    — stop + remove container
#   npm run pihole:reset   — stop + remove + re-create fresh

set -e

CONTAINER="pihole-dev"
PORT="8080"
PASSWORD="testpassword"
IMAGE="pihole/pihole:latest"

ACTION="${1:-start}"

stop_container() {
  if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    echo "⏹  Stopping and removing $CONTAINER..."
    docker stop "$CONTAINER" >/dev/null 2>&1 || true
    docker rm   "$CONTAINER" >/dev/null 2>&1 || true
  fi
}

start_container() {
  if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    echo "✅  $CONTAINER is already running at http://localhost:${PORT}"
    echo "    Admin UI: http://localhost:${PORT}/admin"
    echo "    Password: ${PASSWORD}"
    return
  fi

  if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    echo "▶  Starting existing $CONTAINER container..."
    docker start "$CONTAINER" >/dev/null
  else
    echo "🐳  Pulling $IMAGE and creating $CONTAINER..."
    docker run -d \
      --name "$CONTAINER" \
      -p "${PORT}:80" \
      -p 8443:443 \
      -p 53:53/udp \
      -p 53:53/tcp \
      -e WEBPASSWORD="$PASSWORD" \
      --restart unless-stopped \
      "$IMAGE" >/dev/null
  fi

  # Wait for healthy
  echo -n "⏳  Waiting for Pi-hole to be ready"
  for i in $(seq 1 30); do
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo "starting")
    if [ "$STATUS" = "healthy" ]; then
      echo " ✓"
      break
    fi
    echo -n "."
    sleep 2
  done

  # Set password via pihole CLI (in case env var wasn't picked up)
  docker exec "$CONTAINER" pihole setpassword "$PASSWORD" >/dev/null 2>&1 || true

  echo ""
  echo "✅  Pi-hole ready!"
  echo "    URL:      http://localhost:${PORT}"
  echo "    Admin UI: http://localhost:${PORT}/admin"
  echo "    Password: ${PASSWORD}"
  echo ""
  echo "    Extension settings:"
  echo "      Provider:  Pi-hole"
  echo "      URL:       http://localhost:${PORT}"
  echo "      API Token: ${PASSWORD}"
  echo ""
  echo "    To route Chrome/Firefox DNS through Pi-hole (DoH):"
  echo "      1. Visit https://localhost:8443 → accept the self-signed cert"
  echo "      2. Chrome: chrome://settings/security → Use secure DNS → Custom → https://localhost:8443/dns-query"
  echo "      3. Firefox: about:preferences#privacy → DNS over HTTPS → Custom → https://localhost:8443/dns-query"
}

case "$ACTION" in
  start)
    start_container
    ;;
  stop)
    stop_container
    echo "✅  $CONTAINER stopped and removed."
    ;;
  reset)
    stop_container
    start_container
    ;;
  *)
    echo "Usage: $0 [start|stop|reset]"
    exit 1
    ;;
esac
