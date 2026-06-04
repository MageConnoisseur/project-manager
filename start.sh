#!/usr/bin/env bash
# Render start script — use this as the Start Command: bash start.sh
#
# Why this file exists:
# - Render's shell often has "python3" but NOT "python" (your logs showed both missing
#   when only "uvicorn" or "python" were used).
# - Running "python3 -m uvicorn" uses the same interpreter that pip used during build.

set -euo pipefail

# Prefer the project virtualenv if Render created one during build.
if [ -d ".venv/bin" ]; then
  exec .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT:?PORT not set}"
fi

# Fallback: system Python 3 on Render.
exec python3 -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT:?PORT not set}"
