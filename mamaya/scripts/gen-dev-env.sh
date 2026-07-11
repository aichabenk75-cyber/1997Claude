#!/usr/bin/env bash
# Génère le fichier .env de DÉVELOPPEMENT pour `docker compose up`.
# ⚠️ Secrets de dev uniquement — ne JAMAIS réutiliser ces valeurs en production.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  echo "⚠️  .env existe déjà — supprime-le d'abord si tu veux le régénérer."
  exit 1
fi

# Paire Ed25519 pour signer les JWT (PKCS8 privé + SPKI public)
PRIV=$(openssl genpkey -algorithm ed25519)
PUB=$(printf '%s\n' "$PRIV" | openssl pkey -pubout)

# Les PEM sont multi-lignes → on les stocke avec des `\n` littéraux ;
# l'API les re-normalise au démarrage (voir main.ts).
esc() { printf '%s' "$1" | awk 'NR>1 {printf "\\n"} {printf "%s", $0}'; }

cat > .env <<EOF
DEV_MASTER_KEY=$(openssl rand -base64 32)
GEO_JITTER_SECRET=$(openssl rand -hex 32)
JWT_PRIVATE_PEM='$(esc "$PRIV")'
JWT_PUBLIC_PEM='$(esc "$PUB")'
EOF

chmod 600 .env
echo "✅ .env généré (secrets de DEV). Lance maintenant : docker compose up --build"
