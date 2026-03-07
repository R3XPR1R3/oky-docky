#!/usr/bin/env bash
# ============================================================
#  Oky-Docky — Raspberry Pi Auto-Deploy Script
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
#    3. Run this script once to build & start:
#         chmod +x deploy-pi.sh
#         ./deploy-pi.sh
#
#    4. Enable auto-update (checks every 60 seconds):
#         ./deploy-pi.sh --watch
#
#       Or install as a systemd service (runs on boot):
#         ./deploy-pi.sh --install-service
#
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BRANCH="${DEPLOY_BRANCH:-main}"
CHECK_INTERVAL="${CHECK_INTERVAL:-60}"
LOG_FILE="${SCRIPT_DIR}/deploy.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# ------------------------------------------------------------------
#  Core: pull, rebuild, restart
# ------------------------------------------------------------------
deploy() {
  log "Pulling latest changes from origin/${BRANCH}..."
  git fetch origin "$BRANCH"

  LOCAL=$(git rev-parse HEAD)
  REMOTE=$(git rev-parse "origin/${BRANCH}")

  if [ "$LOCAL" = "$REMOTE" ]; then
    log "Already up to date (${LOCAL:0:8})."
    return 1  # nothing changed
  fi

  log "New commits detected: ${LOCAL:0:8} -> ${REMOTE:0:8}"
  git pull origin "$BRANCH"

  log "Rebuilding containers..."
  docker compose build --parallel
  docker compose up -d --remove-orphans

  log "Cleaning up old images..."
  docker image prune -f

  log "Deploy complete! Running containers:"
  docker compose ps
  return 0
}

# ------------------------------------------------------------------
#  First-time build (always build even if no new commits)
# ------------------------------------------------------------------
initial_deploy() {
  log "=== Initial deploy ==="
  git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/${BRANCH}"
  git pull origin "$BRANCH"

  log "Building containers (this may take a while on Pi)..."
  docker compose build --parallel
  docker compose up -d --remove-orphans
  log "Initial deploy complete!"
  docker compose ps
}

# ------------------------------------------------------------------
#  Watch mode: poll for changes
# ------------------------------------------------------------------
watch_loop() {
  log "=== Watch mode started (every ${CHECK_INTERVAL}s, branch: ${BRANCH}) ==="
  while true; do
    deploy || true
    sleep "$CHECK_INTERVAL"
  done
}

# ------------------------------------------------------------------
#  Install as systemd service
# ------------------------------------------------------------------
install_service() {
  SERVICE_FILE="/etc/systemd/system/oky-docky-deploy.service"
  log "Installing systemd service..."

  sudo tee "$SERVICE_FILE" > /dev/null <<UNIT
[Unit]
Description=Oky-Docky Auto-Deploy
After=network-online.target docker.service
Wants=network-online.target

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
  sudo systemctl enable oky-docky-deploy
  sudo systemctl start oky-docky-deploy
  log "Service installed and started! Check status with:"
  log "  sudo systemctl status oky-docky-deploy"
  log "  journalctl -u oky-docky-deploy -f"
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
  --deploy)
    deploy || log "No changes to deploy."
    ;;
  --help|-h)
    echo "Usage: ./deploy-pi.sh [OPTION]"
    echo ""
    echo "  (no args)          First-time build & start"
    echo "  --watch            Poll for git changes every ${CHECK_INTERVAL}s and auto-redeploy"
    echo "  --deploy           One-shot: pull & redeploy only if changes found"
    echo "  --install-service  Install as systemd service (auto-start on boot)"
    echo ""
    echo "Environment variables:"
    echo "  DEPLOY_BRANCH      Git branch to track (default: main)"
    echo "  CHECK_INTERVAL     Seconds between checks in watch mode (default: 60)"
    ;;
  *)
    initial_deploy
    ;;
esac
