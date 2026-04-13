#!/usr/bin/env node

/**
 * Espera a que el backend responda en /health antes de continuar.
 * Uso: node scripts/wait-for-backend.js
 * Sale con 0 cuando el backend está listo, 1 si se agota el tiempo.
 */

const http = require('http');

const HOST = process.env.API_HOST || '127.0.0.1';
const PORT = parseInt(process.env.API_PORT || '3000', 10);
const INTERVAL = 800;
const MAX_WAIT = 60000; // 60 segundos máximo

const url = `http://${HOST}:${PORT}/health`;

function check() {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  const start = Date.now();
  process.stdout.write('Esperando backend en ' + HOST + ':' + PORT + '...');
  while (Date.now() - start < MAX_WAIT) {
    if (await check()) {
      process.stdout.write(' listo.\n');
      process.exit(0);
    }
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, INTERVAL));
  }
  process.stdout.write(' tiempo agotado.\n');
  process.exit(1);
}

main();
