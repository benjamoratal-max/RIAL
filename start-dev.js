#!/usr/bin/env node

/**
 * Inicia backend, espera a que responda en /health y luego inicia el frontend.
 * Evita ECONNREFUSED cuando el frontend hace peticiones antes de que el backend esté listo.
 * Uso: npm run dev
 */

const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const BACKEND_DIR = path.join(__dirname, 'real-rentals-ai');
const FRONTEND_DIR = path.join(__dirname, 'long-term-rentals');
const HEALTH_URL = 'http://127.0.0.1:3000/health';
const POLL_INTERVAL = 800;
const MAX_WAIT = 60000;

function checkBackend() {
  return new Promise((resolve) => {
    const req = http.get(HEALTH_URL, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForBackend() {
  const start = Date.now();
  process.stdout.write('Esperando backend en http://127.0.0.1:3000');
  while (Date.now() - start < MAX_WAIT) {
    if (await checkBackend()) {
      process.stdout.write(' listo.\n');
      return;
    }
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }
  process.stdout.write(' tiempo agotado.\n');
  process.exit(1);
}

function run(cmd, args, cwd) {
  return spawn(cmd, args, {
    cwd,
    shell: true,
    stdio: 'inherit',
  });
}

async function main() {
  console.log('Iniciando backend...\n');
  const backend = run('npm', ['run', 'dev'], BACKEND_DIR);
  backend.on('error', (err) => {
    console.error('Error al iniciar backend:', err.message);
    process.exit(1);
  });

  await waitForBackend();

  console.log('\nIniciando frontend...\n');
  const frontend = run('npm', ['run', 'dev'], FRONTEND_DIR);
  frontend.on('error', (err) => {
    console.error('Error al iniciar frontend:', err.message);
    backend.kill('SIGTERM');
    process.exit(1);
  });

  const cleanup = () => {
    console.log('\nDeteniendo servicios...');
    frontend.kill('SIGTERM');
    backend.kill('SIGTERM');
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
