#!/usr/bin/env bash
# Despliega/actualiza el backend RIAL en la VM Oracle.
# Uso:  cd deploy/oracle && ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env.production ]; then
  echo "ERROR: falta deploy/oracle/.env.production"
  echo "       Copialo de .env.production.example y completá los valores:"
  echo "       cp .env.production.example .env.production && nano .env.production"
  exit 1
fi

echo ">> Actualizando código (git pull)..."
git -C ../.. pull --ff-only || echo "   (no se pudo hacer pull; sigo con el código actual)"

echo ">> Construyendo y levantando contenedores..."
docker compose --env-file .env.production up -d --build

echo ">> Estado de los servicios:"
docker compose ps

echo ">> Últimos logs del API (las migraciones corren en el entrypoint):"
sleep 4
docker compose logs --tail=30 api || true

echo
echo ">> Listo. Verificá:  curl -fsS https://api.rialstateai.com/health"
echo "   (la primera vez Caddy tarda unos segundos en emitir el certificado TLS)"
