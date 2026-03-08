#!/usr/bin/env bash
# ============================================================
#  Oky-Docky — Raspberry Pi Deploy + Hot-Update Script
# ============================================================
#
#  FIRST-TIME SETUP on your Raspberry Pi:
#
#    1. Install Docker & Docker Compose:
#         curl -fsSL https://get.docker.com | sh
#         sudo usermod -aG docker $USER   # then re-login
#
#    2. Clone the repo:
#         git clone https://github.com/<your-user>/oky-docky.git ~/oky-docky
#         cd ~/oky-docky
#
#    3. Run this script:
#         chmod +x deploy-pi.sh
#         ./deploy-pi.sh
#
#       This will build containers, start them, AND install a
#       systemd service that auto-starts on boot and pulls
#       updates from GitHub every 20 seconds without restarting.
#
#  HOW HOT-UPDATE WORKS:
#    - Backend source is mounted into the container as a volume.
#      uvicorn --reload detects file changes and reloads the app.
#    - Frontend dist is a shared Docker volume. After git pull,
#      a builder container rebuilds the static files and nginx
#      serves them immediately — no container restart needed.
#
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BRANCH="${DEPLOY_BRANCH:-main}"
CHECK_INTERVAL="${CHECK_INTERVAL:-20}"
LOG_FILE="${SCRIPT_DIR}/deploy.log"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.pi.yml"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# ------------------------------------------------------------------
#  Hot-update: pull and let containers pick up changes live
# ------------------------------------------------------------------
hot_update() {
  log "Checking for updates on origin/${BRANCH}..."
  git fetch origin "$BRANCH"

  LOCAL=$(git rev-parse HEAD)
  REMOTE=$(git rev-parse "origin/${BRANCH}")

  if [ "$LOCAL" = "$REMOTE" ]; then
    return 1  # nothing changed
  fi

  log "New commits: ${LOCAL:0:8} -> ${REMOTE:0:8}"
  git pull origin "$BRANCH"

  # Backend: uvicorn --reload picks up changes automatically
  # via the volume mount — nothing to do.

  # Frontend: rebuild static files into the shared volume.
  # This runs a throwaway container; nginx serves new files instantly.
  if git diff --name-only "$LOCAL" "$REMOTE" | grep -q "^actual/front/"; then
    log "Frontend changes detected — rebuilding dist..."
    $COMPOSE run --rm frontend-builder
    log "Frontend dist updated."
  fi

  log "Hot-update complete (no container restart)."
  return 0
}

# ------------------------------------------------------------------
#  First-time build & start
# ------------------------------------------------------------------
initial_deploy() {
  log "=== Initial deploy ==="
  git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/${BRANCH}"
  git pull origin "$BRANCH"

  log "Building containers (this may take a while on Pi)..."
  $COMPOSE build --parallel

  log "Starting services..."
  $COMPOSE up -d --remove-orphans

  # Populate the shared frontend-dist volume
  log "Building frontend dist into shared volume..."
  $COMPOSE run --rm frontend-builder

  log "Initial deploy complete!"
  $COMPOSE ps
}

# ------------------------------------------------------------------
#  Watch mode: poll for changes every CHECK_INTERVAL seconds
# ------------------------------------------------------------------
watch_loop() {
  log "=== Watch mode started (every ${CHECK_INTERVAL}s, branch: ${BRANCH}) ==="
  while true; do
    hot_update || true
    sleep "$CHECK_INTERVAL"
  done
}

# ------------------------------------------------------------------
#  Install as systemd service (auto-start on boot)
# ------------------------------------------------------------------
install_service() {
  SERVICE_FILE="/etc/systemd/system/oky-docky.service"
  log "Installing systemd service..."

  sudo tee "$SERVICE_FILE" > /dev/null <<UNIT
[Unit]
Description=Oky-Docky Document Filler
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=${SCRIPT_DIR}
Environment=DEPLOY_BRANCH=${BRANCH}
Environment=CHECK_INTERVAL=${CHECK_INTERVAL}
ExecStart=${SCRIPT_DIR}/deploy-pi.sh --watch
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
UNIT

  sudo systemctl daemon-reload
  sudo systemctl enable oky-docky
  sudo systemctl start oky-docky
  log "Systemd service 'oky-docky' installed, enabled, and started."
  log "  Status:  sudo systemctl status oky-docky"
  log "  Logs:    journalctl -u oky-docky -f"
}

# ------------------------------------------------------------------
#  CLI
# ------------------------------------------------------------------
case "${1:-}" in
  --watch)
    watch_loop
    ;;
  --install-service)
    install_service
    ;;
  --hot-update)
    hot_update || log "Already up to date."
    ;;
  --help|-h)
    echo "Usage: ./deploy-pi.sh [OPTION]"
    echo ""
    echo "  (no args)          First-time build, start, and install autostart service"
    echo "  --watch            Poll for git changes every ${CHECK_INTERVAL}s and hot-update"
    echo "  --hot-update       One-shot: pull & hot-update if changes found"
    echo "  --install-service  (Re-)install systemd service only"
    echo ""
    echo "Environment variables:"
    echo "  DEPLOY_BRANCH      Git branch to track (default: main)"
    echo "  CHECK_INTERVAL     Seconds between checks (default: 20)"
    ;;
  *)
    initial_deploy
    echo ""
    log "=== Setting up autostart ==="
    install_service
    echo ""
    log "Done! Your app is running and will auto-start on boot."
    log "Updates from GitHub are pulled every ${CHECK_INTERVAL}s without restarting."
    ;;
esac
