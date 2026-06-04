#!/usr/bin/env bash
# Render build script — set Build Command to: bash build.sh
#
# We create a .venv in the project folder and install dependencies there.
# The start script uses THAT same Python so "No module named uvicorn" cannot happen.

set -euo pipefail

echo "==> Creating virtual environment..."
python3 -m venv .venv

echo "==> Upgrading pip..."
.venv/bin/python -m pip install --upgrade pip

echo "==> Installing requirements..."
.venv/bin/pip install -r requirements.txt

echo "==> Build finished. Packages installed into .venv"
