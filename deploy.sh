#!/usr/bin/env sh
# Atualiza a produção (VPS) com a última versão do GitHub. Uso:
#   ./deploy.sh
set -e
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "Falta o .env (veja .env.production.example)." >&2
  exit 1
fi

# --ff-only: aborta em vez de criar merge se alguém editou arquivos direto na VPS.
git pull --ff-only
docker compose -f docker-compose.prod.yml up -d --build
# Remove as imagens antigas que cada rebuild deixa para trás.
docker image prune -f
