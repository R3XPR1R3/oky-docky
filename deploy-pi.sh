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
#  CLOUDFLARE TUNNEL (access from anywhere):
#    By default, a free quick tunnel is created automatically.
#    You'll see a public URL like https://random-words.trycloudflare.com
#
#    For a PERMANENT domain, set the TUNNEL_TOKEN env var:
#      1. Sign up at https://dash.cloudflare.com (free)
#      2. Go to Zero Trust → Networks → Tunnels → Create
#      3. Copy the tunnel token
#      4. export TUNNEL_TOKEN="your-token-here"
#      5. Re-run ./deploy-pi.sh
#
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BRANCH="${DEPLOY_BRANCH:-main}"
CHECK_INTERVAL="${CHECK_INTERVAL:-20}"
LOG_FILE="${SCRIPT_DIR}/deploy.log"
TUNNEL_TOKEN="${TUNNEL_TOKEN:-}"
GIT_FORCE_SYNC="${GIT_FORCE_SYNC:-1}"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.pi.yml"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# ------------------------------------------------------------------
#  Cloudflare Tunnel: expose Pi to the internet
# ------------------------------------------------------------------
CLOUDFLARED_BIN="${SCRIPT_DIR}/.cloudflared/cloudflared"

install_cloudflared() {
  if [ -f "$CLOUDFLARED_BIN" ]; then
    return 0
  fi

  log "Installing cloudflared..."
  mkdir -p "${SCRIPT_DIR}/.cloudflared"

  ARCH=$(uname -m)
  case "$ARCH" in
    aarch64|arm64) CF_ARCH="arm64" ;;
    armv7l|armhf)  CF_ARCH="arm"   ;;
    x86_64)        CF_ARCH="amd64" ;;
    *)             log "Unsupported architecture: $ARCH"; return 1 ;;
  esac

  curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH}" \
    -o "$CLOUDFLARED_BIN"
  chmod +x "$CLOUDFLARED_BIN"
  log "cloudflared installed."
}

start_tunnel() {
  install_cloudflared || { log "Failed to install cloudflared, skipping tunnel."; return 1; }

  if pgrep -f "cloudflared.*tunnel" > /dev/null 2>&1; then
    log "Cloudflare tunnel already running."
    return 0
  fi

  if [ -n "$TUNNEL_TOKEN" ]; then
    # Permanent tunnel with a configured domain
    log "Starting Cloudflare tunnel (permanent, token-based)..."
    nohup "$CLOUDFLARED_BIN" tunnel --no-autoupdate run --token "$TUNNEL_TOKEN" \
      >> "${SCRIPT_DIR}/tunnel.log" 2>&1 &
    log "Tunnel started. Check your Cloudflare dashboard for the domain."
  else
    # Quick free tunnel — random URL, no registration needed
    log "Starting Cloudflare quick tunnel (free, temporary URL)..."
    nohup "$CLOUDFLARED_BIN" tunnel --no-autoupdate --url http://localhost:80 \
      >> "${SCRIPT_DIR}/tunnel.log" 2>&1 &

    # Wait for the URL to appear in the log
    for i in $(seq 1 15); do
      sleep 2
      TUNNEL_URL=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" "${SCRIPT_DIR}/tunnel.log" 2>/dev/null | tail -1 || true)
      if [ -n "$TUNNEL_URL" ]; then
        log "============================================"
        log "  PUBLIC URL: ${TUNNEL_URL}"
        log "============================================"
        log "Share this link with friends!"
        return 0
      fi
    done
    log "Tunnel started but URL not yet available. Check tunnel.log"
  fi
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

  if [ -n "$(git status --porcelain)" ]; then
    if [ "$GIT_FORCE_SYNC" = "1" ]; then
      local stash_name
      stash_name="okydoky-autostash-$(date '+%Y%m%d-%H%M%S')"
      log "Local repo changes detected. Saving them to stash: ${stash_name}"
      git stash push -u -m "$stash_name" >/dev/null || true
    else
      log "Local changes detected, and GIT_FORCE_SYNC=0. Skipping update to avoid conflicts."
      return 1
    fi
  fi

  log "New commits: ${LOCAL:0:8} -> ${REMOTE:0:8}"
  if ! git pull --ff-only origin "$BRANCH"; then
    if [ "$GIT_FORCE_SYNC" != "1" ]; then
      log "git pull --ff-only failed and GIT_FORCE_SYNC=0. Manual intervention required."
      return 1
    fi

    log "Fast-forward pull failed. Forcing repo sync to origin/${BRANCH}."
    git reset --hard "origin/${BRANCH}"
    git clean -fd
  fi

  NEW_HEAD=$(git rev-parse --short HEAD)
  log "✅ Git update pulled successfully. Current commit: ${NEW_HEAD}"

  # Backend: uvicorn --reload picks up changes automatically
  # via the volume mount — nothing to do.
  if git diff --name-only "$LOCAL" "$REMOTE" | grep -q "^actual/back/"; then
    log "Backend changes detected — uvicorn reload will apply them automatically."
  fi

  # Frontend: rebuild static files into the shared volume.
  # This runs a throwaway container; nginx serves new files instantly.
  if git diff --name-only "$LOCAL" "$REMOTE" | grep -q "^actual/front/"; then
    log "Frontend changes detected — rebuilding dist..."
    $COMPOSE run --rm frontend-builder
    log "Frontend dist updated and applied by nginx."
  fi

  log "✅ Update applied successfully (no container restart)."
  return 0
}

# ------------------------------------------------------------------
#  First-time build & start
# ------------------------------------------------------------------
initial_deploy() {
  log "=== Initial deploy ==="
  git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/${BRANCH}"
  if ! git pull --ff-only origin "$BRANCH"; then
    if [ "$GIT_FORCE_SYNC" != "1" ]; then
      log "Initial git sync failed (non fast-forward). Set GIT_FORCE_SYNC=1 or sync manually."
      return 1
    fi

    log "Initial sync is divergent. Forcing repo sync to origin/${BRANCH}."
    git fetch origin "$BRANCH"
    git reset --hard "origin/${BRANCH}"
    git clean -fd
  fi
  log "✅ Initial git sync complete. Commit: $(git rev-parse --short HEAD)"

  log "Building containers (this may take a while on Pi)..."
  $COMPOSE build --parallel

  log "Starting services..."
  $COMPOSE up -d --remove-orphans

  # Populate the shared frontend-dist volume
  log "Building frontend dist into shared volume..."
  $COMPOSE run --rm frontend-builder

  log "Initial deploy complete!"
  $COMPOSE ps

  # Start Cloudflare tunnel for external access
  start_tunnel
}

# ------------------------------------------------------------------
#  Watch mode: poll for changes every CHECK_INTERVAL seconds
# ------------------------------------------------------------------
watch_loop() {
  log "=== Watch mode started (every ${CHECK_INTERVAL}s, branch: ${BRANCH}) ==="
  # Make sure tunnel is running
  start_tunnel || true
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
Environment=TUNNEL_TOKEN=${TUNNEL_TOKEN}
Environment=GIT_FORCE_SYNC=${GIT_FORCE_SYNC}
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

  # Install autostart terminal that shows Cloudflare URL
  install_autostart_terminal
}

# ------------------------------------------------------------------
#  Autostart terminal: open a terminal on boot showing tunnel URL
# ------------------------------------------------------------------
install_autostart_terminal() {
  local REAL_USER="${SUDO_USER:-$(whoami)}"
  local REAL_HOME
  REAL_HOME=$(eval echo "~${REAL_USER}")

  local SHOW_SCRIPT="${SCRIPT_DIR}/show-tunnel-url.sh"
  local AUTOSTART_DIR="${REAL_HOME}/.config/autostart"

  # Create the helper script that waits for and displays the URL
  cat > "$SHOW_SCRIPT" <<'URLSCRIPT'
#!/usr/bin/env bash
# ── Oky-Docky: show Cloudflare tunnel URL + local control commands ──
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TUNNEL_LOG="${SCRIPT_DIR}/tunnel.log"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.pi.yml"
URL=""

print_header() {
  clear
  echo "========================================"
  echo "   Oky-Docky запущен!"
  echo "========================================"
  echo ""
  echo "   Ссылка для доступа:"
  echo ""
  echo "   ${URL:-<ожидание ссылки>}"
  echo ""
  echo "========================================"
  echo "Команды в этом же терминале:"
  echo "  okydoky reboot"
  echo "  okydoky changecolor blue"
  echo "  okydoky changecolor purple"
  echo "  okydoky help"
  echo "  exit"
  echo "========================================"
}

refresh_url() {
  local new_url
  new_url=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" "$TUNNEL_LOG" 2>/dev/null | tail -1 || true)
  if [ -n "$new_url" ] && [ "$new_url" != "$URL" ]; then
    URL="$new_url"
    print_header
  fi
}

wait_for_initial_url() {
  clear
  echo "========================================"
  echo "   Oky-Docky — ожидание запуска...      "
  echo "========================================"
  echo ""
  for i in $(seq 1 45); do
    refresh_url
    if [ -n "$URL" ]; then
      return 0
    fi
    sleep 2
  done
  print_header
  echo "⚠️ Ссылка пока не найдена. Проверьте: ${TUNNEL_LOG}"
}

apply_builder_theme() {
  local color="$1"
  local form="${SCRIPT_DIR}/actual/front/src/app/components/FormBuilder.tsx"
  local preview="${SCRIPT_DIR}/actual/front/src/app/components/PdfFieldPreview.tsx"

  if [ ! -f "$form" ] || [ ! -f "$preview" ]; then
    echo "[okydoky] Ошибка: файлы билдера не найдены."
    return 1
  fi

  python3 - "$color" "$form" "$preview" <<'PYTHEME'
import sys
from pathlib import Path

color, form_path, preview_path = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3])

maps = {
    'blue': {
        'from-indigo-600 to-purple-600': 'from-blue-600 to-cyan-600',
        'from-indigo-100 to-purple-100': 'from-blue-100 to-cyan-100',
        'bg-purple-600': 'bg-blue-600',
        'text-purple-600': 'text-blue-600',
        'text-purple-700': 'text-blue-700',
        'bg-purple-50': 'bg-blue-50',
        'border-purple-200': 'border-blue-200',
        'border-purple-300': 'border-blue-300',
        'border-purple-500': 'border-blue-500',
        'focus:border-purple-500': 'focus:border-blue-500',
        'hover:bg-purple-700': 'hover:bg-blue-700',
        'hover:bg-purple-100': 'hover:bg-blue-100',
        'hover:text-purple-700': 'hover:text-blue-700',
        'bg-purple-400/20': 'bg-blue-400/20',
        'bg-purple-400/25': 'bg-blue-400/25',
        'bg-purple-400/15': 'bg-blue-400/15',
        'hover:bg-purple-400/30': 'hover:bg-blue-400/30',
        'bg-violet-100 text-violet-700': 'bg-blue-100 text-blue-700',
        'bg-purple-100 text-purple-700': 'bg-blue-100 text-blue-700',
    },
    'purple': {
        'from-blue-600 to-cyan-600': 'from-indigo-600 to-purple-600',
        'from-blue-100 to-cyan-100': 'from-indigo-100 to-purple-100',
        'bg-blue-600': 'bg-purple-600',
        'text-blue-600': 'text-purple-600',
        'text-blue-700': 'text-purple-700',
        'bg-blue-50': 'bg-purple-50',
        'border-blue-200': 'border-purple-200',
        'border-blue-300': 'border-purple-300',
        'border-blue-500': 'border-purple-500',
        'focus:border-blue-500': 'focus:border-purple-500',
        'hover:bg-blue-700': 'hover:bg-purple-700',
        'hover:bg-blue-100': 'hover:bg-purple-100',
        'hover:text-blue-700': 'hover:text-purple-700',
        'bg-blue-400/20': 'bg-purple-400/20',
        'bg-blue-400/25': 'bg-purple-400/25',
        'bg-blue-400/15': 'bg-purple-400/15',
        'hover:bg-blue-400/30': 'hover:bg-purple-400/30',
        'bg-blue-100 text-blue-700': 'bg-purple-100 text-purple-700',
    },
}

rep = maps[color]
for path in (form_path, preview_path):
    text = path.read_text()
    for a,b in rep.items():
        text = text.replace(a,b)
    path.write_text(text)
PYTHEME
}

okydoky_cmd() {
  local cmd="${1:-}"
  case "$cmd" in
    reboot)
      echo "[okydoky] Полный reload..."
      (cd "$SCRIPT_DIR" && $COMPOSE down && $COMPOSE up -d --remove-orphans && $COMPOSE run --rm frontend-builder)
      echo "[okydoky] ✅ Reload завершён."
      ;;
    changecolor)
      local color="${2:-}"
      if [ "$color" != "blue" ] && [ "$color" != "purple" ]; then
        echo "[okydoky] Использование: okydoky changecolor blue|purple"
        return 1
      fi
      echo "[okydoky] Переключение темы билдера на: $color"
      apply_builder_theme "$color"
      (cd "$SCRIPT_DIR" && $COMPOSE run --rm frontend-builder)
      echo "[okydoky] ✅ Тема "$color" применена."
      ;;
    help|"")
      echo "okydoky reboot"
      echo "okydoky changecolor blue"
      echo "okydoky changecolor purple"
      ;;
    *)
      echo "[okydoky] Неизвестная команда: $cmd"
      echo "[okydoky] Подсказка: okydoky help"
      return 1
      ;;
  esac
}

wait_for_initial_url
print_header

while true; do
  refresh_url
  read -r -p "okydoky> " line || break
  case "$line" in
    exit|quit)
      break
      ;;
    okydoky*)
      # shellcheck disable=SC2206
      parts=($line)
      okydoky_cmd "${parts[1]:-}" "${parts[2]:-}"
      ;;
    "")
      ;;
    *)
      echo "[okydoky] Введите команду вида: okydoky ..."
      ;;
  esac
 done
URLSCRIPT
  chmod +x "$SHOW_SCRIPT"

  # Create autostart desktop entry
  mkdir -p "$AUTOSTART_DIR"
  cat > "${AUTOSTART_DIR}/oky-docky-terminal.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Oky-Docky Tunnel URL
Comment=Shows Cloudflare tunnel URL on startup
Exec=lxterminal --title="Oky-Docky" -e "${SHOW_SCRIPT}"
Terminal=false
X-GNOME-Autostart-enabled=true
DESKTOP

  log "Autostart terminal installed: ${AUTOSTART_DIR}/oky-docky-terminal.desktop"
  log "A terminal with the Cloudflare URL will open on every boot."
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
  --tunnel)
    start_tunnel
    echo "Press Ctrl+C to stop."
    wait
    ;;
  --help|-h)
    echo "Usage: ./deploy-pi.sh [OPTION]"
    echo ""
    echo "  (no args)          First-time build, start, install autostart + tunnel"
    echo "  --watch            Poll for git changes every ${CHECK_INTERVAL}s and hot-update"
    echo "  --hot-update       One-shot: pull & hot-update if changes found"
    echo "  --tunnel           Start Cloudflare tunnel only"
    echo "  --install-service  (Re-)install systemd service only"
    echo ""
    echo "Environment variables:"
    echo "  DEPLOY_BRANCH      Git branch to track (default: main)"
    echo "  CHECK_INTERVAL     Seconds between checks (default: 20)"
    echo "  TUNNEL_TOKEN       Cloudflare tunnel token for permanent domain (optional)"
    echo "  GIT_FORCE_SYNC     1=auto-resolve local divergence on Pi (default: 1), 0=skip on conflict"
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
