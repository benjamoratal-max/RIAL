#!/usr/bin/env bash
# Backup de Postgres con rotación. Pensado para cron (ej. diario 03:00):
#   crontab -e
#   0 3 * * *  /home/ubuntu/rial/deploy/oracle/backup.sh >> /home/ubuntu/backups/backup.log 2>&1
#
# Variables opcionales:  BACKUP_DIR (default ~/backups)   KEEP_DAYS (default 14)
set -euo pipefail
cd "$(dirname "$0")"

# Carga POSTGRES_USER / POSTGRES_DB desde el mismo .env.production
set -a; [ -f .env.production ] && . ./.env.production; set +a

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
mkdir -p "$BACKUP_DIR"

STAMP="$(date +%F_%H%M)"
FILE="$BACKUP_DIR/rial_${STAMP}.sql.gz"

echo "[backup] Generando $FILE ..."
docker compose --env-file .env.production exec -T db \
  pg_dump -U "${POSTGRES_USER:-rial}" -d "${POSTGRES_DB:-rial}" --no-owner --no-acl \
  | gzip > "$FILE"

echo "[backup] Rotando: borrando backups de más de ${KEEP_DAYS} días..."
find "$BACKUP_DIR" -name 'rial_*.sql.gz' -type f -mtime +"$KEEP_DAYS" -delete

echo "[backup] OK. Últimos backups:"
ls -lh "$BACKUP_DIR"/rial_*.sql.gz 2>/dev/null | tail -n 5
