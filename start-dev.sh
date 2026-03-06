#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONT_DIR="$ROOT_DIR/actual/front"

echo "[1/4] Installing backend dependencies..."
python3 -m pip install -r "$ROOT_DIR/actual/requirements.txt"

echo "[2/4] Installing frontend dependencies..."
cd "$FRONT_DIR"
npm install

echo "[3/4] Starting backend on http://localhost:8000 ..."
cd "$ROOT_DIR"
python3 -m uvicorn actual.back.fillable_processor:app --reload --host 0.0.0.0 --port 8000 &
BACK_PID=$!

cleanup() {
  if ps -p "$BACK_PID" >/dev/null 2>&1; then
    echo "Stopping backend (PID $BACK_PID)..."
    kill "$BACK_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

echo "[4/4] Starting frontend on http://localhost:5173 ..."
cd "$FRONT_DIR"
npm run dev -- --host 0.0.0.0 --port 5173
