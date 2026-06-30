#!/usr/bin/env bash
# One-shot local setup for the AgentHub app.
#   bash scripts/setup.sh
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(cd ../.. && pwd)"

echo "▶ AgentHub setup"
echo

# 1. Env file
if [ ! -f .env.local ]; then
  cp .env.local.example .env.local
  echo "✓ Created apps/agent/.env.local — open it and fill in your keys."
else
  echo "✓ .env.local already exists."
fi

# 2. Dependencies
echo "▶ Installing dependencies…"
npm install

# 3. Database migration (optional, needs Supabase CLI linked to your project)
if command -v supabase >/dev/null 2>&1; then
  echo
  read -r -p "Apply database migration with 'supabase db push'? [y/N] " yn
  if [[ "$yn" =~ ^[Yy]$ ]]; then
    ( cd "$ROOT" && supabase db push )
  fi
else
  echo "ℹ Supabase CLI not found — install it, then run 'supabase db push' from the repo root."
fi

# 4. Preflight
echo
echo "▶ Preflight check"
npm run check || true

echo
echo "Done. Start the app with:  npm run dev   (http://localhost:3001)"
