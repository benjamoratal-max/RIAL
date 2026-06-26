#!/bin/sh
set -e

# Sincroniza el esquema de Prisma contra Postgres antes de arrancar.
# Usamos `db push` (no `migrate deploy`) porque el historial de migraciones del repo
# se generó para SQLite (dev local) y su provider no coincide con postgresql. `db push`
# crea/actualiza las tablas directo desde schema.prisma. Es no-op si ya está al día
# (p. ej. tras restaurar un dump de producción), así que es seguro en cada arranque.
echo "[entrypoint] Sincronizando esquema con la DB (prisma db push)..."
npx prisma db push --skip-generate

echo "[entrypoint] Iniciando backend RIAL..."
exec node dist/index.js
