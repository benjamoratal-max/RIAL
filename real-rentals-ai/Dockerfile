# syntax=docker/dockerfile:1
#
# Imagen del backend RIAL (Express + Prisma) para la VM Ampere A1 (ARM64) de Oracle.
# Se construye en la propia VM, así el query engine de Prisma queda compilado para arm64.

# ---------- Build ----------
FROM node:20-bookworm-slim AS build
WORKDIR /app

# OpenSSL: requerido por Prisma para resolver/cargar el engine correcto.
# python3/make/g++: por si alguna dependencia nativa necesita compilar en arm64.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .

# `npm run build` = prisma generate (con binaryTarget arm64) + tsc -> dist/
RUN npm run build

# ---------- Runtime ----------
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Conservamos node_modules completo (incluye el CLI de Prisma) para poder correr
# `prisma migrate deploy` desde el entrypoint en cada arranque.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x docker-entrypoint.sh && mkdir -p contracts

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
