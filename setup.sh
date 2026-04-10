#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[1/4] Backend venv + deps"
cd "$ROOT_DIR/backend"
if [[ ! -d ".venv" ]]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install -r requirements.txt

if [[ ! -f ".env" ]]; then
  cp .env.example .env
  echo "Created backend/.env from .env.example"
fi

python create_tables.py

echo "[2/4] Frontend deps"
cd "$ROOT_DIR/frontend"
npm install

if [[ ! -f ".env.local" ]]; then
  cp .env.example .env.local
  echo "Created frontend/.env.local from .env.example"
fi

echo "[3/4] Ollama model"
if command -v ollama >/dev/null 2>&1; then
  ollama pull llama3.2:1b || true
else
  echo "Ollama not found. Install Ollama and run: ollama pull llama3.2:1b"
fi

echo "[4/4] Done"
echo "Run ./run.sh to start backend, frontend, and ollama checks."
