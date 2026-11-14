#!/usr/bin/env bash
# One-time setup: creates .venv with Python 3.11 and installs everything RefDAW needs.
#   ./setup.sh           core install
#   ./setup.sh --stems   also install Demucs for stem separation (large: PyTorch)
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v uv >/dev/null 2>&1; then
  echo "Installing uv (Python package manager)…"
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi

uv venv --python 3.11 .venv
uv pip install --python .venv/bin/python -r requirements.txt
uv pip install --python .venv/bin/python --no-deps basic-pitch==0.4.0
if [[ "${1:-}" == "--stems" ]]; then
  uv pip install --python .venv/bin/python demucs
fi
[ -f .env ] || cp .env.example .env
echo
echo "Setup complete. Add your API keys to refdaw/.env, then start the app with ./run.sh"
