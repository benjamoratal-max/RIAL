/**
 * Utilidades compartidas para scripts de desarrollo (start-dev.js, etc.)
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function findStripeCli() {
  const candidates = [];

  if (process.platform === 'win32') {
    try {
      const out = execSync('where stripe', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      out
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((p) => candidates.push(p));
    } catch {
      // stripe no está en PATH
    }

    const localAppData = process.env.LOCALAPPDATA || '';
    candidates.push(path.join(localAppData, 'Microsoft', 'WinGet', 'Links', 'stripe.exe'));

    const wingetPackages = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
    if (fs.existsSync(wingetPackages)) {
      try {
        for (const dir of fs.readdirSync(wingetPackages)) {
          if (!/stripe/i.test(dir)) continue;
          const direct = path.join(wingetPackages, dir, 'stripe.exe');
          candidates.push(direct);
          // Algunos paquetes winget anidan el exe en subcarpetas.
          try {
            for (const sub of fs.readdirSync(path.join(wingetPackages, dir), { withFileTypes: true })) {
              if (sub.isDirectory()) {
                candidates.push(path.join(wingetPackages, dir, sub.name, 'stripe.exe'));
              }
            }
          } catch {
            // ignorar
          }
        }
      } catch {
        // ignorar
      }
    }
  } else {
    try {
      candidates.push(execSync('which stripe', { encoding: 'utf8' }).trim());
    } catch {
      // ignorar
    }
    candidates.push('/opt/homebrew/bin/stripe', '/usr/local/bin/stripe');
  }

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }

  return 'stripe';
}

function isStripeConfigured(env) {
  const key = env.STRIPE_SECRET_KEY || '';
  return key.startsWith('sk_test_') || key.startsWith('sk_live_');
}

function stripeWebhookForwardUrl(port = 3000) {
  return `localhost:${port}/api/payments/stripe/webhook`;
}

module.exports = {
  parseEnvFile,
  findStripeCli,
  isStripeConfigured,
  stripeWebhookForwardUrl,
};
