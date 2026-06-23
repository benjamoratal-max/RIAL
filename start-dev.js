#!/usr/bin/env node

/**
 * Inicia backend, Stripe CLI (si está configurado) y frontend con un solo comando.
 * Uso: npm run dev
 *      npm run dev -- --no-stripe   (sin reenvío de webhooks)
 */

const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');
const {
  parseEnvFile,
  findStripeCli,
  isStripeConfigured,
  stripeWebhookForwardUrl,
} = require('./scripts/dev-utils');

const BACKEND_DIR = path.join(__dirname, 'real-rentals-ai');
const FRONTEND_DIR = path.join(__dirname, 'long-term-rentals');
const BACKEND_ENV = path.join(BACKEND_DIR, '.env');
const HEALTH_URL = 'http://127.0.0.1:3000/health';
const POLL_INTERVAL = 800;
const MAX_WAIT = 60000;

const skipStripe =
  process.argv.includes('--no-stripe') || process.env.NO_STRIPE_LISTEN === '1';

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

function run(cmd, args, cwd, extraEnv = {}) {
  return spawn(cmd, args, {
    cwd,
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });
}

function startStripeListen(env) {
  const stripeExe = findStripeCli();
  const forwardTo = stripeWebhookForwardUrl(env.PORT || 3000);
  const args = ['listen', '--forward-to', forwardTo, '--api-key', env.STRIPE_SECRET_KEY];

  console.log('\nStripe: reenviando webhooks → http://' + forwardTo);
  if (stripeExe !== 'stripe' && !fs.existsSync(stripeExe)) {
    console.warn(
      '⚠️  Stripe CLI no encontrado. Instalá con: winget install Stripe.StripeCli\n' +
        '   Los pagos igual se confirman al volver de Checkout (session_id).\n'
    );
    return null;
  }

  const proc = spawn(stripeExe, args, {
    shell: false,
    stdio: 'inherit',
    env: process.env,
  });

  proc.on('error', (err) => {
    console.warn('⚠️  No se pudo iniciar Stripe CLI:', err.message);
    console.warn('   Los pagos igual se confirman al volver de Checkout (session_id).\n');
  });

  return proc;
}

async function main() {
  const env = parseEnvFile(BACKEND_ENV);
  const stripeActive = !skipStripe && isStripeConfigured(env);

  console.log('Iniciando backend...\n');
  const backend = run('npm', ['run', 'dev'], BACKEND_DIR);
  backend.on('error', (err) => {
    console.error('Error al iniciar backend:', err.message);
    process.exit(1);
  });

  let stripe = null;
  if (stripeActive) {
    console.log('Stripe detectado en .env — iniciando reenvío de webhooks...\n');
    stripe = startStripeListen(env);
  } else if (skipStripe) {
    console.log('Stripe listen omitido (--no-stripe).\n');
  }

  await waitForBackend();

  console.log('\nIniciando frontend...\n');
  const frontend = run('npm', ['run', 'dev'], FRONTEND_DIR);
  frontend.on('error', (err) => {
    console.error('Error al iniciar frontend:', err.message);
    backend.kill('SIGTERM');
    if (stripe) stripe.kill('SIGTERM');
    process.exit(1);
  });

  if (stripeActive && stripe) {
    console.log(
      '\n✓ Desarrollo listo. Pagos con tarjeta: tarjeta de prueba 4242 4242 4242 4242\n'
    );
  }

  const cleanup = () => {
    console.log('\nDeteniendo servicios...');
    frontend.kill('SIGTERM');
    backend.kill('SIGTERM');
    if (stripe) stripe.kill('SIGTERM');
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
