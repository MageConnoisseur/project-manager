#!/usr/bin/env bash
# Render start script — set Start Command to: bash start.sh
#
# Must use the same .venv that build.sh created (not system /usr/bin/python3).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -x ".venv/bin/python" ]; then
  echo "ERROR: .venv/bin/python not found. Build Command must run: bash build.sh"
  exit 1
fi

echo "==> Starting API with .venv Python on port ${PORT:?PORT not set}..."
exec .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
