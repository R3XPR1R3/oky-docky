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
#    For a PERMANENT domain, set TUNNEL_TOKEN in .env. When present,
#    deploy-pi.sh starts the cloudflared Docker container instead of
#    creating a random trycloudflare.com link.
#
#    Setup for a PERMANENT domain:
#      1. Sign up at https://dash.cloudflare.com (free)
#      2. Go to Zero Trust → Networks → Tunnels → Create
#      3. Copy the tunnel token
#      4. cp .env.example .env
#      5. Paste the token into TUNNEL_TOKEN and keep PUBLIC_DOMAIN=barckhat.com
#      6. Re-run ./deploy-pi.sh
#
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load local deployment secrets/settings without committing them.
# Put TUNNEL_TOKEN and PUBLIC_DOMAIN in .env on the Pi.
ENV_FILE="${SCRIPT_DIR}/.env"
FIRST_SETUP=0
if [ ! -f "$ENV_FILE" ]; then
  FIRST_SETUP=1
fi
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

BRANCH="${DEPLOY_BRANCH:-main}"
CHECK_INTERVAL="${CHECK_INTERVAL:-20}"

# Fix "dubious ownership" error when repo owner differs from current user
# (common on Pi when service runs as different user or after sudo clone)
git config --global --add safe.directory "$SCRIPT_DIR" 2>/dev/null || true
LOG_FILE="${SCRIPT_DIR}/deploy.log"
TUNNEL_LOG="${SCRIPT_DIR}/tunnel.log"
TUNNEL_URL_FILE="${SCRIPT_DIR}/tunnel-url.txt"
TUNNEL_TOKEN="${TUNNEL_TOKEN:-}"
PUBLIC_DOMAIN="${PUBLIC_DOMAIN:-barckhat.com}"
PUBLIC_PATH="${PUBLIC_PATH:-/oky-docky/}"
[[ "$PUBLIC_PATH" == /* ]] || PUBLIC_PATH="/${PUBLIC_PATH}"
[[ "$PUBLIC_PATH" == */ ]] || PUBLIC_PATH="${PUBLIC_PATH}/"
PUBLIC_URL="${PUBLIC_URL:-https://${PUBLIC_DOMAIN}${PUBLIC_PATH}}"
if [ "${PUBLIC_URL%/}" = "https://${PUBLIC_DOMAIN}" ]; then
  PUBLIC_URL="https://${PUBLIC_DOMAIN}${PUBLIC_PATH}"
fi
if [ "$TUNNEL_TOKEN" = "paste-your-cloudflare-tunnel-token-here" ]; then
  TUNNEL_TOKEN=""
fi
GIT_FORCE_SYNC="${GIT_FORCE_SYNC:-0}"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.pi.yml"
if [ -n "$TUNNEL_TOKEN" ]; then
  # Include the cloudflared profile in normal compose operations so backend,
  # frontend, and the named tunnel start as one stack.
  export COMPOSE_PROFILES="${COMPOSE_PROFILES:-tunnel}"
fi
UPDATE_STATUS_FILE="${SCRIPT_DIR}/.update-status"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

require_command() {
  local command_name="$1"
  local install_hint="$2"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    log "ERROR: ${command_name} was not found. ${install_hint}"
    return 1
  fi
}

check_prerequisites() {
  require_command docker "Install Docker with: curl -fsSL https://get.docker.com | sh"
  require_command git "Install it with: sudo apt-get install -y git"
  require_command curl "Install it with: sudo apt-get install -y curl"
  require_command python3 "Install it with: sudo apt-get install -y python3"
  if ! docker compose version >/dev/null 2>&1; then
    log "ERROR: Docker Compose v2 is unavailable. Install the docker-compose-plugin package."
    return 1
  fi
}

upsert_env() {
  local key="$1" value="$2" temporary
  temporary="${ENV_FILE}.tmp"
  touch "$ENV_FILE"
  awk -v key="$key" 'index($0, key "=") != 1' "$ENV_FILE" > "$temporary"
  printf '%s=%s\n' "$key" "$value" >> "$temporary"
  mv "$temporary" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
}

configure_environment() {
  local token="$TUNNEL_TOKEN"
  local admin_username="${ADMIN_USERNAME:-admin}"
  local entered_username=""
  local password="" password_confirm=""
  local admin_hash="${ADMIN_PASSWORD_HASH:-}"
  local session_secret="${ADMIN_SESSION_SECRET:-}"

  if [ "$FIRST_SETUP" = "1" ] && [ -t 0 ]; then
    local entered_domain="" entered_path=""
    read -r -p "Public domain [${PUBLIC_DOMAIN}]: " entered_domain < /dev/tty
    read -r -p "Application path [${PUBLIC_PATH}]: " entered_path < /dev/tty
    [ -n "$entered_domain" ] && PUBLIC_DOMAIN="$entered_domain"
    [ -n "$entered_path" ] && PUBLIC_PATH="$entered_path"
    [[ "$PUBLIC_PATH" == /* ]] || PUBLIC_PATH="/${PUBLIC_PATH}"
    [[ "$PUBLIC_PATH" == */ ]] || PUBLIC_PATH="${PUBLIC_PATH}/"
    PUBLIC_URL="https://${PUBLIC_DOMAIN}${PUBLIC_PATH}"
  fi

  if [ -z "$token" ] || [ "$token" = "paste-your-cloudflare-tunnel-token-here" ]; then
    if [ ! -t 0 ]; then
      log "ERROR: TUNNEL_TOKEN is missing. Run ./deploy-pi.sh interactively once."
      return 1
    fi
    echo "Paste the Cloudflare named-tunnel token. Input is hidden." >&2
    read -r -s -p "Cloudflare tunnel token: " token < /dev/tty
    echo >&2
    if [ ${#token} -lt 40 ]; then
      log "ERROR: The Cloudflare tunnel token looks incomplete."
      return 1
    fi
  fi

  if [ -z "$admin_hash" ] || [[ "$admin_hash" == *":iterations:salt:hash" ]]; then
    if [ ! -t 0 ]; then
      log "ERROR: Admin credentials are missing. Run ./deploy-pi.sh interactively once."
      return 1
    fi
    read -r -p "Admin username [${admin_username}]: " entered_username < /dev/tty
    [ -n "${entered_username:-}" ] && admin_username="$entered_username"
    if [[ ! "$admin_username" =~ ^[A-Za-z][A-Za-z0-9_-]{2,39}$ ]]; then
      log "ERROR: Admin username must be 3-40 letters, digits, underscores, or hyphens."
      return 1
    fi
    while true; do
      read -r -s -p "Admin password (minimum 12 characters): " password < /dev/tty
      echo >&2
      read -r -s -p "Repeat admin password: " password_confirm < /dev/tty
      echo >&2
      if [ "$password" != "$password_confirm" ]; then
        echo "Passwords do not match. Try again." >&2
      elif [ ${#password} -lt 12 ]; then
        echo "Password is too short. Try again." >&2
      else
        break
      fi
    done
    admin_hash=$(printf '%s' "$password" | python3 -c 'import base64,hashlib,secrets,sys; p=sys.stdin.buffer.read(); i=310000; s=secrets.token_bytes(18); d=hashlib.pbkdf2_hmac("sha256",p,s,i); enc=lambda b:base64.urlsafe_b64encode(b).decode().rstrip("="); print(f"pbkdf2_sha256:{i}:{enc(s)}:{enc(d)}")')
  fi

  [ -n "$session_secret" ] || session_secret=$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')

  upsert_env TUNNEL_TOKEN "$token"
  upsert_env PUBLIC_DOMAIN "$PUBLIC_DOMAIN"
  upsert_env PUBLIC_PATH "$PUBLIC_PATH"
  upsert_env PUBLIC_URL "$PUBLIC_URL"
  upsert_env ADMIN_USERNAME "$admin_username"
  upsert_env ADMIN_PASSWORD_HASH "$admin_hash"
  upsert_env ADMIN_SESSION_SECRET "$session_secret"
  upsert_env ADMIN_COOKIE_SECURE "1"

  export TUNNEL_TOKEN="$token" PUBLIC_DOMAIN PUBLIC_PATH PUBLIC_URL
  export ADMIN_USERNAME="$admin_username" ADMIN_PASSWORD_HASH="$admin_hash"
  export ADMIN_SESSION_SECRET="$session_secret" ADMIN_COOKIE_SECURE=1
  export COMPOSE_PROFILES="${COMPOSE_PROFILES:-tunnel}"
  log "Deployment configuration saved to .env (permissions 600)."
  log "Admin URL: ${PUBLIC_URL}admin"
}

wait_for_docker() {
  if docker info >/dev/null 2>&1; then
    log "Docker engine is ready."
    return 0
  fi

  log "Waiting for Docker engine..."
  if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl start docker >/dev/null 2>&1 || true
  fi
  for _ in $(seq 1 60); do
    sleep 2
    if docker info >/dev/null 2>&1; then
      log "Docker engine is ready."
      return 0
    fi
  done
  log "ERROR: Docker did not become ready within two minutes. Check: sudo systemctl status docker"
  return 1
}

stop_previous_stack() {
  log "Stopping the previous Oky-Docky stack, if present..."
  $COMPOSE down --remove-orphans
}

wait_for_stack() {
  log "Waiting for backend and frontend health checks..."
  for _ in $(seq 1 60); do
    if curl -fsS http://localhost:8000/api/meta >/dev/null 2>&1 \
      && curl -fsS http://localhost:80/oky-docky/ >/dev/null 2>&1; then
      log "Backend and frontend are ready."
      return 0
    fi
    sleep 2
  done
  log "ERROR: The stack did not become ready within two minutes."
  $COMPOSE ps || true
  $COMPOSE logs --tail=80 backend frontend || true
  return 1
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

write_tunnel_url() {
  local tunnel_url="$1"
  echo "$tunnel_url" > "$TUNNEL_URL_FILE"
}

start_tunnel() {
  : > "$TUNNEL_LOG"

  if [ -n "$TUNNEL_TOKEN" ]; then
    # Permanent named tunnel with a configured domain. Run it as a Docker container
    # so it is managed together with the rest of the stack instead of creating a
    # random trycloudflare.com link.
    export COMPOSE_PROFILES="${COMPOSE_PROFILES:-tunnel}"

    if $COMPOSE ps --services --filter status=running 2>/dev/null | grep -qx "cloudflared"; then
      log "Cloudflare tunnel container already running."
      write_tunnel_url "$PUBLIC_URL"
      log "Current tunnel URL: ${PUBLIC_URL}"
      return 0
    fi

    log "Starting Cloudflare tunnel container (permanent, token-based)..."
    $COMPOSE up -d cloudflared >> "$TUNNEL_LOG" 2>&1
    write_tunnel_url "$PUBLIC_URL"
    log "============================================"
    log "  PUBLIC URL: ${PUBLIC_URL}"
    log "============================================"
    log "Cloudflare tunnel container started for ${PUBLIC_DOMAIN}."
    return 0
  fi

  install_cloudflared || { log "Failed to install cloudflared, skipping tunnel."; return 1; }

  if pgrep -f "cloudflared.*tunnel" > /dev/null 2>&1; then
    log "Cloudflare quick tunnel already running."
    if [ -f "$TUNNEL_URL_FILE" ]; then
      log "Current tunnel URL: $(cat "$TUNNEL_URL_FILE")"
    fi
    return 0
  fi

  rm -f "$TUNNEL_URL_FILE"

  # Quick free tunnel — random URL, no registration needed
  log "Starting Cloudflare quick tunnel (free, temporary URL)..."
  nohup "$CLOUDFLARED_BIN" tunnel --no-autoupdate --url http://localhost:80       >> "$TUNNEL_LOG" 2>&1 &

  # Wait for the URL to appear in the fresh log
  for _ in $(seq 1 20); do
    sleep 2
    TUNNEL_URL=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" "$TUNNEL_LOG" 2>/dev/null | tail -1 || true)
    if [ -n "$TUNNEL_URL" ]; then
      TUNNEL_URL="${TUNNEL_URL%/}${PUBLIC_PATH}"
      write_tunnel_url "$TUNNEL_URL"
      log "============================================"
      log "  PUBLIC URL: ${TUNNEL_URL}"
      log "============================================"
      log "Share this link with friends!"
      return 0
    fi
  done
  log "Tunnel started but URL not yet available. Check tunnel.log"
}

# ------------------------------------------------------------------
#  Git with retry: exponential backoff for flaky Pi networking
# ------------------------------------------------------------------
git_retry() {
  local max_attempts=4
  local delay=2
  local attempt=1
  local cmd_desc="$1"
  shift

  while [ "$attempt" -le "$max_attempts" ]; do
    if "$@" 2>&1; then
      return 0
    fi
    if [ "$attempt" -eq "$max_attempts" ]; then
      log "❌ $cmd_desc failed after $max_attempts attempts."
      return 1
    fi
    log "⚠️  $cmd_desc failed (attempt ${attempt}/${max_attempts}). Retrying in ${delay}s..."
    sleep "$delay"
    delay=$((delay * 2))
    attempt=$((attempt + 1))
  done
}

# ------------------------------------------------------------------
#  Async frontend rebuild: build dist + reload nginx (runs in bg)
# ------------------------------------------------------------------
FRONTEND_BUILD_LOCK="${SCRIPT_DIR}/.frontend-build.lock"

_rebuild_frontend_async() {
  # Prevent concurrent builds
  if [ -f "$FRONTEND_BUILD_LOCK" ]; then
    local lock_pid
    lock_pid=$(cat "$FRONTEND_BUILD_LOCK" 2>/dev/null || true)
    if [[ "$lock_pid" =~ ^[0-9]+$ ]] && kill -0 "$lock_pid" 2>/dev/null; then
      log "Frontend build already in progress (PID ${lock_pid}) — skipping."
      return 0
    fi
    log "Removing stale frontend build lock${lock_pid:+ (PID ${lock_pid})}."
    rm -f "$FRONTEND_BUILD_LOCK"
  fi
  trap 'rm -f "$FRONTEND_BUILD_LOCK"' EXIT
  printf '%s\n' "${BASHPID:-$$}" > "$FRONTEND_BUILD_LOCK"

  # Rebuild the builder image if deps/Dockerfile changed
  if git diff --name-only HEAD~1 HEAD 2>/dev/null | grep -Eq '^actual/front/(package\.json|package-lock\.json|pnpm-lock\.yaml|Dockerfile)$'; then
    log "[frontend-async] Dependency files changed — rebuilding image..."
    $COMPOSE build frontend-builder 2>&1 | tail -5
  fi

  log "[frontend-async] Building dist..."
  if $COMPOSE run --rm --build frontend-builder 2>&1 | tail -5; then
    log "[frontend-async] Build done. Reloading nginx..."
    # Signal nginx to re-read files from the shared volume
    docker compose -f docker-compose.yml -f docker-compose.pi.yml exec -T frontend nginx -s reload 2>/dev/null \
      || log "[frontend-async] nginx reload signal failed (non-critical)."
    log "[frontend-async] ✅ Frontend updated."
    # Notify terminal that frontend is ready
    {
      echo "time=$(date '+%H:%M:%S')"
      echo "event=frontend_ready"
      echo "message=Frontend пересобран и обновлён"
    } > "$UPDATE_STATUS_FILE"
  else
    log "[frontend-async] ❌ Frontend build failed. Check logs."
    {
      echo "time=$(date '+%H:%M:%S')"
      echo "event=frontend_failed"
      echo "message=Ошибка сборки frontend — смотри deploy.log"
    } > "$UPDATE_STATUS_FILE"
  fi

  rm -f "$FRONTEND_BUILD_LOCK"
  trap - EXIT
}

# ------------------------------------------------------------------
#  Hot-update: pull and let containers pick up changes live
# ------------------------------------------------------------------
_git_fetch_with_retry() {
  local attempt max_attempts=4 delay=2
  for attempt in $(seq 1 $max_attempts); do
    if git fetch origin "$BRANCH" 2>&1; then
      return 0
    fi
    if [ "$attempt" -lt "$max_attempts" ]; then
      log "⚠ git fetch failed (attempt ${attempt}/${max_attempts}). Retrying in ${delay}s..."
      sleep "$delay"
      delay=$((delay * 2))
    fi
  done
  log "✖ git fetch failed after ${max_attempts} attempts. Cannot reach GitHub. Check network / credentials on this Pi."
  return 1
}

hot_update() {
  log "Checking for updates on origin/${BRANCH}..."
  if ! git_retry "git fetch" git fetch origin "$BRANCH"; then
    log "Cannot reach GitHub. Check network / credentials on this Pi."
    return 1
  fi

  LOCAL=$(git rev-parse HEAD)
  REMOTE=$(git rev-parse "origin/${BRANCH}")

  if [ "$LOCAL" = "$REMOTE" ]; then
    log "No updates found on origin/${BRANCH}."
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
  if ! git_retry "git pull" git pull --ff-only origin "$BRANCH"; then
    if [ "$GIT_FORCE_SYNC" != "1" ]; then
      log "git pull failed and GIT_FORCE_SYNC=0. Manual intervention required."
      return 1
    fi

    log "Fast-forward pull failed. Forcing repo sync to origin/${BRANCH}."
    git fetch origin "$BRANCH"
    git reset --hard "origin/${BRANCH}"
    git clean -fd
  fi

  NEW_HEAD=$(git rev-parse --short HEAD)
  log "✅ Git update pulled successfully. Current commit: ${NEW_HEAD}"

  local changed_parts=""

  # Source-only backend changes reload through the bind mount. Dependency and
  # image changes need the same rebuild/recreate behavior as the Windows launcher.
  if git diff --name-only "$LOCAL" "$REMOTE" | grep -Eq '^(actual/back/|actual/requirements\.txt$)'; then
    if git diff --name-only "$LOCAL" "$REMOTE" | grep -Eq '^(actual/requirements\.txt|actual/back/Dockerfile)$'; then
      log "Backend runtime changed - rebuilding and recreating backend..."
      $COMPOSE up -d --build --force-recreate backend
    else
      log "Backend source changed - uvicorn reload will apply it automatically."
    fi
    changed_parts="backend"
  fi

  if git diff --name-only "$LOCAL" "$REMOTE" | grep -Eq '^docker-compose(\.pi)?\.yml$'; then
    log "Compose configuration changed - reconciling the whole stack..."
    $COMPOSE up -d --build --remove-orphans
    changed_parts="${changed_parts:+${changed_parts}+}compose"
  fi

  # Frontend: rebuild static files into the shared volume (async).
  # Runs in background so the watch loop isn't blocked during build.
  if git diff --name-only "$LOCAL" "$REMOTE" | grep -q "^actual/front/"; then
    log "Frontend changes detected — starting async rebuild..."
    changed_parts="${changed_parts:+${changed_parts}+}frontend"
    _rebuild_frontend_async &
  fi

  # Write status for the okydoky terminal to pick up
  {
    echo "time=$(date '+%H:%M:%S')"
    echo "from=${LOCAL:0:8}"
    echo "to=${NEW_HEAD}"
    echo "changed=${changed_parts:-other}"
    echo "summary=$(git log --oneline "${LOCAL}..${REMOTE}" 2>/dev/null | head -3 | tr '\n' '|')"
  } > "$UPDATE_STATUS_FILE"

  log "✅ Update applied successfully (no container restart)."
  return 0
}

# ------------------------------------------------------------------
#  First-time build & start
# ------------------------------------------------------------------
initial_deploy() {
  log "=== Initial deploy ==="
  check_prerequisites
  configure_environment
  wait_for_docker
  git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/${BRANCH}"
  if ! git_retry "git pull" git pull --ff-only origin "$BRANCH"; then
    if [ "$GIT_FORCE_SYNC" != "1" ]; then
      log "Initial git sync failed (non fast-forward). Set GIT_FORCE_SYNC=1 or sync manually."
      return 1
    fi

    log "Initial sync is divergent. Forcing repo sync to origin/${BRANCH}."
    git_retry "git fetch" git fetch origin "$BRANCH"
    git reset --hard "origin/${BRANCH}"
    git clean -fd
  fi
  log "✅ Initial git sync complete. Commit: $(git rev-parse --short HEAD)"

  stop_previous_stack

  log "Building containers (this may take a while on Pi)..."
  $COMPOSE build

  log "Starting services..."
  $COMPOSE up -d --remove-orphans --force-recreate

  # Populate the shared frontend-dist volume
  log "Building frontend dist into shared volume..."
  if $COMPOSE run --rm --build frontend-builder; then
    {
      echo "time=$(date '+%H:%M:%S')"
      echo "event=frontend_ready"
      echo "message=Frontend собран и готов"
    } > "$UPDATE_STATUS_FILE"
  else
    {
      echo "time=$(date '+%H:%M:%S')"
      echo "event=frontend_failed"
      echo "message=Ошибка сборки frontend — смотри deploy.log"
    } > "$UPDATE_STATUS_FILE"
    log "❌ Frontend build failed during initial deploy."
    return 1
  fi

  wait_for_stack

  log "Initial deploy complete!"
  $COMPOSE ps
  log "Local URL: http://localhost/oky-docky/"

  # Start Cloudflare tunnel for external access
  start_tunnel
}

# ------------------------------------------------------------------
#  Ensure containers are running and healthy
# ------------------------------------------------------------------
ensure_containers_up() {
  # Check if Docker is ready
  if ! docker info >/dev/null 2>&1; then
    log "Waiting for Docker daemon..."
    for _ in $(seq 1 30); do
      sleep 2
      if docker info >/dev/null 2>&1; then
        log "Docker daemon is ready."
        break
      fi
    done
    if ! docker info >/dev/null 2>&1; then
      log "❌ Docker daemon not available after 60s."
      return 1
    fi
  fi

  # Check if containers are running
  local running
  running=$($COMPOSE ps --format '{{.Service}}:{{.State}}' 2>/dev/null || echo "")

  if ! echo "$running" | grep -q "backend:running"; then
    log "Backend container not running — starting containers..."
    $COMPOSE up -d --remove-orphans
  fi

  if ! echo "$running" | grep -q "frontend:running"; then
    log "Frontend container not running — starting containers..."
    $COMPOSE up -d --remove-orphans
  fi

  # Check if frontend dist volume has content (nginx serves from it)
  local dist_check
  dist_check=$(docker compose -f docker-compose.yml -f docker-compose.pi.yml \
    exec -T frontend ls /usr/share/nginx/html/index.html 2>/dev/null || echo "")
  if [ -z "$dist_check" ]; then
    log "Frontend dist volume is empty — rebuilding..."
    _rebuild_frontend_async &
  fi

  # Wait for backend to respond
  log "Waiting for backend to be ready..."
  for _ in $(seq 1 30); do
    if curl -sf http://localhost:8000/api/meta >/dev/null 2>&1; then
      log "Backend is ready."
      return 0
    fi
    sleep 2
  done
  log "⚠️ Backend not responding after 60s — tunnel may not work immediately."
  return 0
}

# ------------------------------------------------------------------
#  Watch mode: poll for changes every CHECK_INTERVAL seconds
# ------------------------------------------------------------------
watch_loop() {
  log "=== Watch mode started (every ${CHECK_INTERVAL}s, branch: ${BRANCH}) ==="

  # On boot: make sure everything is up before starting tunnel
  ensure_containers_up || true

  # Start tunnel after containers are ready
  start_tunnel || true
  while true; do
    hot_update || true
    start_tunnel || true
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
Environment=PUBLIC_DOMAIN=${PUBLIC_DOMAIN}
Environment=PUBLIC_PATH=${PUBLIC_PATH}
Environment=PUBLIC_URL=${PUBLIC_URL}
Environment=COMPOSE_PROFILES=${COMPOSE_PROFILES:-}
Environment=GIT_FORCE_SYNC=${GIT_FORCE_SYNC}
EnvironmentFile=-${SCRIPT_DIR}/.env
ExecStart=${SCRIPT_DIR}/deploy-pi.sh --watch
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
UNIT

  sudo systemctl daemon-reload
  sudo systemctl enable oky-docky
  sudo systemctl restart oky-docky
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
  REAL_HOME=$(getent passwd "$REAL_USER" | cut -d: -f6 2>/dev/null || eval echo "~${REAL_USER}")

  local SHOW_SCRIPT="${SCRIPT_DIR}/show-tunnel-url.sh"
  local AUTOSTART_DIR="${REAL_HOME}/.config/autostart"
  local LXDE_AUTOSTART="${REAL_HOME}/.config/lxsession/LXDE-pi/autostart"

  # Detect available terminal emulator
  local TERM_CMD=""
  if command -v lxterminal >/dev/null 2>&1; then
    TERM_CMD="lxterminal --title=Oky-Docky -e"
  elif command -v xfce4-terminal >/dev/null 2>&1; then
    TERM_CMD="xfce4-terminal --title=Oky-Docky -e"
  elif command -v xterm >/dev/null 2>&1; then
    TERM_CMD="xterm -T Oky-Docky -e"
  elif command -v x-terminal-emulator >/dev/null 2>&1; then
    TERM_CMD="x-terminal-emulator -e"
  else
    log "⚠️ No terminal emulator found (lxterminal, xfce4-terminal, xterm). Skipping autostart terminal."
    return 1
  fi
  log "Using terminal: ${TERM_CMD%% *}"

  # Create the helper script that waits for and displays the URL
  cat > "$SHOW_SCRIPT" <<'URLSCRIPT'
#!/usr/bin/env bash
# ── Oky-Docky: show Cloudflare tunnel URL + local control commands ──
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TUNNEL_LOG="${SCRIPT_DIR}/tunnel.log"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.pi.yml"
TUNNEL_TOKEN=""
if [ -f "${SCRIPT_DIR}/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "${SCRIPT_DIR}/.env"
  set +a
fi
if [ -n "$TUNNEL_TOKEN" ]; then
  # Include the cloudflared profile in normal compose operations so backend,
  # frontend, and the named tunnel start as one stack.
  export COMPOSE_PROFILES="${COMPOSE_PROFILES:-tunnel}"
fi
UPDATE_STATUS_FILE="${SCRIPT_DIR}/.update-status"
URL=""
LAST_UPDATE_MSG=""
LAST_UPDATE_MTIME=""

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
  if [ -n "$LAST_UPDATE_MSG" ]; then
    echo "   Обновление: $LAST_UPDATE_MSG"
    echo ""
  fi
  echo "========================================"
  echo "Команды в этом же терминале:"
  echo "  okydoky reboot"
  echo "  okydoky changecolor blue"
  echo "  okydoky changecolor purple"
  echo "  okydoky status"
  echo "  okydoky help"
  echo "  exit"
  echo "========================================"
}

refresh_url() {
  local new_url
  if [ -f "${SCRIPT_DIR}/tunnel-url.txt" ]; then
    new_url=$(cat "${SCRIPT_DIR}/tunnel-url.txt" 2>/dev/null || true)
  else
    new_url=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" "$TUNNEL_LOG" 2>/dev/null | tail -1 || true)
  fi
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
      if (cd "$SCRIPT_DIR" && $COMPOSE down && $COMPOSE up -d --remove-orphans && $COMPOSE run --rm --build frontend-builder); then
        {
          echo "time=$(date '+%H:%M:%S')"
          echo "event=frontend_ready"
          echo "message=Frontend собран и готов"
        } > "$UPDATE_STATUS_FILE"
        echo "[okydoky] ✅ Reload завершён."
      else
        {
          echo "time=$(date '+%H:%M:%S')"
          echo "event=frontend_failed"
          echo "message=Ошибка сборки frontend — смотри deploy.log"
        } > "$UPDATE_STATUS_FILE"
        echo "[okydoky] ❌ Reload не завершился."
        return 1
      fi
      ;;
    changecolor)
      local color="${2:-}"
      if [ "$color" != "blue" ] && [ "$color" != "purple" ]; then
        echo "[okydoky] Использование: okydoky changecolor blue|purple"
        return 1
      fi
      echo "[okydoky] Переключение темы билдера на: $color"
      apply_builder_theme "$color"
      if (cd "$SCRIPT_DIR" && $COMPOSE run --rm --build frontend-builder); then
        {
          echo "time=$(date '+%H:%M:%S')"
          echo "event=frontend_ready"
          echo "message=Frontend собран и готов"
        } > "$UPDATE_STATUS_FILE"
        echo "[okydoky] ✅ Тема "$color" применена."
      else
        {
          echo "time=$(date '+%H:%M:%S')"
          echo "event=frontend_failed"
          echo "message=Ошибка сборки frontend — смотри deploy.log"
        } > "$UPDATE_STATUS_FILE"
        echo "[okydoky] ❌ Сборка темы не завершилась."
        return 1
      fi
      ;;
    status)
      echo "[okydoky] Текущий коммит: $(cd "$SCRIPT_DIR" && git rev-parse --short HEAD 2>/dev/null || echo 'N/A')"
      echo "[okydoky] Ветка: $(cd "$SCRIPT_DIR" && git branch --show-current 2>/dev/null || echo 'N/A')"
      if [ -f "$UPDATE_STATUS_FILE" ]; then
        echo "[okydoky] Последнее обновление:"
        while IFS='=' read -r key val; do
          case "$key" in
            time) echo "  Время: $val" ;;
            to) echo "  Коммит: $val" ;;
            changed) echo "  Изменения: $val" ;;
          esac
        done < "$UPDATE_STATUS_FILE"
      else
        echo "[okydoky] Обновлений пока не было."
      fi
      local backend_status
      backend_status=$(cd "$SCRIPT_DIR" && $COMPOSE ps --format '{{.Service}}: {{.Status}}' 2>/dev/null | head -5 || echo "N/A")
      echo "[okydoky] Контейнеры:"
      echo "$backend_status" | sed 's/^/  /'
      ;;
    help|"")
      echo "okydoky reboot"
      echo "okydoky changecolor blue"
      echo "okydoky changecolor purple"
      echo "okydoky status"
      ;;
    *)
      echo "[okydoky] Неизвестная команда: $cmd"
      echo "[okydoky] Подсказка: okydoky help"
      return 1
      ;;
  esac
}

check_for_updates() {
  # Check if update status file has changed
  if [ ! -f "$UPDATE_STATUS_FILE" ]; then
    return 1
  fi

  local current_mtime
  current_mtime=$(stat -c %Y "$UPDATE_STATUS_FILE" 2>/dev/null || echo "")
  if [ "$current_mtime" = "$LAST_UPDATE_MTIME" ]; then
    return 1
  fi
  LAST_UPDATE_MTIME="$current_mtime"

  # Parse status file
  local update_time="" update_from="" update_to="" update_changed="" update_summary=""
  local update_event="" update_message=""
  while IFS='=' read -r key val; do
    case "$key" in
      time)    update_time="$val" ;;
      from)    update_from="$val" ;;
      to)      update_to="$val" ;;
      changed) update_changed="$val" ;;
      summary) update_summary="$val" ;;
      event)   update_event="$val" ;;
      message) update_message="$val" ;;
    esac
  done < "$UPDATE_STATUS_FILE"

  echo ""
  echo "  ================================================"

  if [ "$update_event" = "frontend_ready" ]; then
    echo "  ✅ ${update_message} (${update_time})"
  elif [ "$update_event" = "frontend_failed" ]; then
    echo "  ❌ ${update_message} (${update_time})"
  elif [ -n "$update_from" ]; then
    LAST_UPDATE_MSG="${update_time} ${update_from} -> ${update_to} [${update_changed}]"
    echo "  📦 Обновление подтянуто! (${update_time})"
    echo "  ${update_from} -> ${update_to}"
    if [ -n "$update_changed" ]; then
      echo "  Изменения: ${update_changed}"
    fi
    if [ -n "$update_summary" ]; then
      IFS='|' read -ra commits <<< "$update_summary"
      for c in "${commits[@]}"; do
        [ -n "$c" ] && echo "    $c"
      done
    fi
    # Hint about async frontend rebuild
    case "$update_changed" in
      *frontend*)
        echo "  ⏳ Frontend пересобирается..."
        ;;
    esac
  else
    echo "  ${update_message:-Обновление} (${update_time})"
  fi

  echo "  ================================================"
  echo ""
  return 0
}

wait_for_initial_url
print_header

# Show prompt once, then only re-show after a command is entered
printf "okydoky> "
while true; do
  refresh_url
  if check_for_updates; then
    printf "okydoky> "
  fi

  # read with 5s timeout; no -p flag to avoid prompt spam
  if read -r -t 5 line; then
    case "$line" in
      exit|quit)
        break
        ;;
      okydoky*)
        # shellcheck disable=SC2206
        parts=($line)
        okydoky_cmd "${parts[1]:-}" "${parts[2]:-}"
        printf "okydoky> "
        ;;
      "")
        printf "okydoky> "
        ;;
      *)
        echo "[okydoky] Введите команду вида: okydoky ..."
        printf "okydoky> "
        ;;
    esac
  fi
done
URLSCRIPT
  chmod +x "$SHOW_SCRIPT"
  # Make sure the script is owned by the real user (not root from sudo)
  chown "${REAL_USER}:" "$SHOW_SCRIPT" 2>/dev/null || true

  # --- Method 1: XDG autostart (.desktop file) ---
  mkdir -p "$AUTOSTART_DIR"
  cat > "${AUTOSTART_DIR}/oky-docky-terminal.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Oky-Docky
Comment=Shows Cloudflare tunnel URL on startup
Exec=${TERM_CMD} ${SHOW_SCRIPT}
Terminal=false
X-GNOME-Autostart-enabled=true
StartupNotify=false
DESKTOP
  chown "${REAL_USER}:" "${AUTOSTART_DIR}/oky-docky-terminal.desktop" 2>/dev/null || true

  # --- Method 2: LXDE-pi autostart (Raspberry Pi OS specific) ---
  # This is the primary autostart mechanism on Pi OS with LXDE desktop
  local LXDE_DIR
  LXDE_DIR="$(dirname "$LXDE_AUTOSTART")"
  if [ -d "$LXDE_DIR" ] || [ -d "${REAL_HOME}/.config/lxsession" ]; then
    mkdir -p "$LXDE_DIR"
    # Append our command if not already present
    if [ -f "$LXDE_AUTOSTART" ]; then
      if ! grep -q "show-tunnel-url.sh" "$LXDE_AUTOSTART" 2>/dev/null; then
        echo "@${TERM_CMD} ${SHOW_SCRIPT}" >> "$LXDE_AUTOSTART"
      fi
    else
      # Create new autostart with Pi defaults + our terminal
      cat > "$LXDE_AUTOSTART" <<LXAUTO
@lxpanel --profile LXDE-pi
@pcmanfm --desktop --profile LXDE-pi
@${TERM_CMD} ${SHOW_SCRIPT}
LXAUTO
    fi
    chown -R "${REAL_USER}:" "$LXDE_DIR" 2>/dev/null || true
    log "LXDE autostart configured: ${LXDE_AUTOSTART}"
  fi

  log "Autostart terminal installed."
  log "  XDG: ${AUTOSTART_DIR}/oky-docky-terminal.desktop"

  # Launch terminal for the current session
  if [ -n "${DISPLAY:-}" ] || [ -n "${WAYLAND_DISPLAY:-}" ]; then
    # TERM_CMD intentionally contains the emulator and its argument string.
    # shellcheck disable=SC2086
    nohup ${TERM_CMD} "$SHOW_SCRIPT" >/dev/null 2>&1 &
    log "Launched Oky-Docky terminal for current session."
  else
    log "No display detected — terminal will open on next desktop login."
  fi
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
  --open-terminal)
    install_autostart_terminal
    ;;
  --reset-admin)
    check_prerequisites
    ADMIN_PASSWORD_HASH=""
    ADMIN_SESSION_SECRET=""
    configure_environment
    sudo systemctl restart oky-docky 2>/dev/null || true
    log "Admin password changed and existing sessions invalidated."
    ;;
  --configure-tunnel)
    check_prerequisites
    TUNNEL_TOKEN=""
    configure_environment
    sudo systemctl restart oky-docky 2>/dev/null || true
    log "Cloudflare tunnel token updated."
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
    echo "  --open-terminal    Recreate and launch Oky-Docky terminal UI now"
    echo "  --reset-admin      Set a new admin password and invalidate old sessions"
    echo "  --configure-tunnel Paste and save a new Cloudflare tunnel token"
    echo ""
    echo "Environment variables:"
    echo "  DEPLOY_BRANCH      Git branch to track (default: main)"
    echo "  CHECK_INTERVAL     Seconds between checks (default: 20)"
    echo "  TUNNEL_TOKEN       Cloudflare tunnel token for permanent domain (optional; can be set in .env)"
    echo "  PUBLIC_DOMAIN      Public domain shown in logs/UI (default: barckhat.com)"
    echo "  PUBLIC_PATH        Public app path (default: /oky-docky/)"
    echo "  PUBLIC_URL         Full public URL (default: https://PUBLIC_DOMAIN/PUBLIC_PATH)"
    echo "  GIT_FORCE_SYNC     1=auto-resolve local divergence on Pi, 0=preserve local changes (default: 0)"
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
