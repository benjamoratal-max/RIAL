#!/usr/bin/env node

/**
 * Script unificado para iniciar la demo completa
 * Inicia: Backend + Frontend + Cloudflare Tunnel
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const BACKEND_DIR = path.join(__dirname, 'real-rentals-ai');
const FRONTEND_DIR = path.join(__dirname, 'long-term-rentals');
const CONFIG_FILE = path.join(__dirname, '.cloudflared', '.env.tunnel');

let backendProcess, frontendProcess, tunnelProcess;
let tunnelUrls = { frontend: '', backend: '' };
let config = {};

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    console.error('❌ Configuración no encontrada.');
    console.error('   Ejecuta primero: npm run setup:tunnel');
    process.exit(1);
  }
  
  const configData = {};
  const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...values] = trimmed.split('=');
      if (key && values.length) {
        configData[key.trim()] = values.join('=').trim();
      }
    }
  });
  return configData;
}

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function checkPassword() {
  console.log('\n🔐 Protección con contraseña');
  console.log('   (Presiona Enter para omitir la contraseña)');
  const password = await question('   Contraseña de la demo: ');
  return password.trim();
}

function startBackend() {
  console.log('\n📦 Iniciando backend...');
  return spawn('npm', ['run', 'dev'], {
    cwd: BACKEND_DIR,
    shell: true,
    stdio: 'inherit'
  });
}

function startFrontend() {
  console.log('📦 Iniciando frontend...');
  return spawn('npm', ['run', 'dev'], {
    cwd: FRONTEND_DIR,
    shell: true,
    stdio: 'inherit'
  });
}

function waitForBackend() {
  const http = require('http');
  const url = 'http://127.0.0.1:3000/health';
  const interval = 800;
  const maxWait = 60000;

  return new Promise((resolve, reject) => {
    const start = Date.now();
    process.stdout.write('   Esperando backend');
    function check() {
      const req = http.get(url, (res) => {
        if (res.statusCode === 200) {
          process.stdout.write(' listo.\n');
          return resolve();
        }
        schedule();
      });
      req.on('error', schedule);
      req.setTimeout(3000, () => { req.destroy(); schedule(); });
    }
    function schedule() {
      if (Date.now() - start >= maxWait) {
        process.stdout.write(' tiempo agotado.\n');
        return reject(new Error('Backend no respondió a tiempo'));
      }
      process.stdout.write('.');
      setTimeout(check, interval);
    }
    check();
  });
}

function startTunnel(config) {
  console.log('🌐 Iniciando Cloudflare Tunnel...\n');
  
  const configPath = path.join(__dirname, '.cloudflared', 'config.yml');
  const args = ['tunnel', 'run', config.TUNNEL_NAME || 'rial-app'];
  
  if (fs.existsSync(configPath)) {
    args.push('--config', configPath);
  }
  
  const tunnel = spawn('cloudflared', args, {
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  let output = '';
  let errorOutput = '';
  
  tunnel.stdout.on('data', (data) => {
    const text = data.toString();
    output += text;
    process.stdout.write(text);
    
    // Detectar URLs temporales (mejorado para capturar todas las variantes)
    const tempUrlMatch = text.match(/https:\/\/[\w-]+\.trycloudflare\.com/g);
    if (tempUrlMatch) {
      tempUrlMatch.forEach((url) => {
        // Si no tenemos frontend, asumir que el primero es frontend
        if (!tunnelUrls.frontend) {
          tunnelUrls.frontend = url;
          console.log(`\n✅ URL temporal detectada para frontend: ${url}`);
        } 
        // Si ya tenemos frontend pero no backend, este es el backend
        else if (!tunnelUrls.backend && url !== tunnelUrls.frontend) {
          tunnelUrls.backend = url;
          console.log(`\n✅ URL temporal detectada para backend: ${url}`);
        }
      });
      // Mostrar URLs si las tenemos
      if (tunnelUrls.frontend || tunnelUrls.backend) {
        setTimeout(() => showUrls(), 1000);
      }
    }
    
    // Detectar cuando el túnel está listo (para URLs con dominio propio)
    if (text.includes('Connection established') || text.includes('Registered tunnel connection')) {
      setTimeout(() => {
        if (config.FRONTEND_HOSTNAME && !tunnelUrls.frontend) {
          tunnelUrls.frontend = `https://${config.FRONTEND_HOSTNAME}`;
        }
        if (config.BACKEND_HOSTNAME && !tunnelUrls.backend) {
          tunnelUrls.backend = `https://${config.BACKEND_HOSTNAME}`;
        }
        if (tunnelUrls.frontend || tunnelUrls.backend) {
          showUrls();
        }
      }, 2000);
    }
  });
  
  tunnel.stderr.on('data', (data) => {
    const text = data.toString();
    errorOutput += text;
    process.stderr.write(text);
  });
  
  tunnel.on('error', (error) => {
    console.error('\n❌ Error al iniciar túnel:', error.message);
    console.error('   Verifica que cloudflared esté instalado y configurado correctamente');
  });
  
  return tunnel;
}

function showUrls() {
  console.log('\n' + '='.repeat(70));
  console.log('✅ DEMO INICIADA CORRECTAMENTE');
  console.log('='.repeat(70));
  
  if (tunnelUrls.frontend) {
    console.log(`\n🌍 FRONTEND (Comparte esta URL con los inversores):`);
    console.log(`   ${tunnelUrls.frontend}`);
  }
  
  if (tunnelUrls.backend) {
    console.log(`\n🔧 BACKEND:`);
    console.log(`   ${tunnelUrls.backend}`);
    console.log(`\n📌 Para que el chatbot (Ollama) funcione desde otros dispositivos, en long-term-rentals/.env agrega:`);
    console.log(`   VITE_API_URL=${tunnelUrls.backend}`);
  }
  
  if (!tunnelUrls.frontend && !tunnelUrls.backend) {
    console.log('\n⏳ Esperando URLs del túnel...');
    if (config.FRONTEND_HOSTNAME) {
      console.log(`   URL esperada: https://${config.FRONTEND_HOSTNAME}`);
    }
  }
  
  console.log('\n💡 Presiona Ctrl+C para detener todos los servicios');
  console.log('='.repeat(70) + '\n');
}

async function main() {
  console.log('🚀 Iniciando RIAL APP Demo\n');
  
  // Verificar cloudflared
  try {
    require('child_process').execSync('cloudflared --version', { stdio: 'ignore' });
  } catch {
    console.error('❌ cloudflared no está instalado.');
    console.log('   Instala desde: https://github.com/cloudflare/cloudflared/releases');
    console.log('   O con: winget install --id Cloudflare.cloudflared');
    process.exit(1);
  }
  
  // Cargar configuración
  config = loadConfig();
  
  // Solicitar contraseña (opcional)
  const password = await checkPassword();
  if (password) {
    console.log('   ⚠️  Nota: La protección con contraseña debe configurarse en Cloudflare Access');
    console.log('   Por ahora, el túnel se iniciará sin protección adicional\n');
  }
  
  // Iniciar servicios
  console.log('🔄 Iniciando servicios...\n');
  backendProcess = startBackend();

  try {
    await waitForBackend();
    frontendProcess = startFrontend();
  } catch (e) {
    console.error('❌', e.message);
    if (backendProcess) backendProcess.kill('SIGTERM');
    process.exit(1);
  }
  
  setTimeout(() => {
    tunnelProcess = startTunnel(config);
    
    // Mostrar URLs después de un momento
    setTimeout(() => {
      if (tunnelUrls.frontend || tunnelUrls.backend) {
        showUrls();
      } else if (config.FRONTEND_HOSTNAME) {
        // Si hay hostname configurado, asumir que está listo
        tunnelUrls.frontend = `https://${config.FRONTEND_HOSTNAME}`;
        tunnelUrls.backend = `https://${config.BACKEND_HOSTNAME || config.FRONTEND_HOSTNAME.replace(/^[^.]+/, 'api')}`;
        showUrls();
      }
    }, 8000);
  }, 5000);
  
  // Manejar cierre
  const cleanup = () => {
    console.log('\n\n🛑 Deteniendo servicios...');
    if (tunnelProcess) {
      tunnelProcess.kill('SIGTERM');
    }
    if (frontendProcess) {
      frontendProcess.kill('SIGTERM');
    }
    if (backendProcess) {
      backendProcess.kill('SIGTERM');
    }
    setTimeout(() => {
      rl.close();
      process.exit(0);
    }, 2000);
  };
  
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  rl.close();
  process.exit(1);
});
