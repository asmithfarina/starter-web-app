#!/usr/bin/env bash
# New laptop setup. Cursor, Copilot, and Claude Code all assume deps and
# .env exist after this. Run from anywhere: ./scripts/setup-dev.sh

set -euo pipefail
cd "$(dirname "$0")/.."

# experimented with `nvm use` here. half the team doesn't have nvm
# (the copilot cloud agent, jordan's laptop) so we just check.
# nvm use 22

need=18
if ! command -v node >/dev/null 2>&1; then
  echo "node is not installed (need $need+)"
  exit 1
fi

major="$(node -p "process.versions.node.split('.')[0]")"
if [ "$major" -lt "$need" ]; then
  echo "need Node $need or newer, found $(node -v)"
  exit 1
fi

echo "node $(node -v)"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "copied .env.example -> .env"
else
  echo ".env already there, leaving it"
fi

# TODO: this doesn't install the extensions in .vscode/extensions.json.
# Copilot users never open that file. mention it in the README instead of
# shelling out to `code --install-extension`, which fails in the agent VMs.

npm install
npm run lint

# TODO: run npm test here too. CI already does. left out until the smoke
# file stops being the only coverage and people trust it on a fresh clone.
