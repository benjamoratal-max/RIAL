#!/usr/bin/env node

/**
 * Script simplificado para URLs temporales (sin configuración previa)
 * Inicia: Backend + Frontend + Cloudflare Tunnel con URLs temporales
 * No requiere autenticación ni configuración previa
 */

const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const BACKEND_DIR = path.join(__dirname, 'real-rentals-ai');
const FRONTEND_DIR = path.join(__dirname, 'long-term-rentals');

let backendProcess, frontendProcess, frontendTunnel, backendTunnel;
let frontendUrl = '', backendUrl = '';
let urlsShown = false;
let isShuttingDown = false;

function startBackend() {
  console.log('\n📦 Iniciando backend...');
  const proc = spawn('npm', ['run', 'dev'], {
    cwd: BACKEND_DIR,
    shell: true,
    stdio: 'inherit'
  });
  proc.on('exit', (code, signal) => {
    if (isShuttingDown) return;
    console.error(`\n❌ Backend detenido inesperadamente (code=${code}, signal=${signal || 'none'}). Reiniciando en 2s...`);
    setTimeout(() => {
      if (!isShuttingDown) backendProcess = startBackend();
    }, 2000);
  });
  return proc;
}

function startFrontend() {
  console.log('📦 Iniciando frontend...');
  const proc = spawn('npm', ['run', 'dev'], {
    cwd: FRONTEND_DIR,
    shell: true,
    stdio: 'inherit'
  });
  proc.on('exit', (code, signal) => {
    if (isShuttingDown) return;
    console.error(`\n❌ Frontend detenido inesperadamente (code=${code}, signal=${signal || 'none'}).`);
  });
  return proc;
}

function waitForBackend() {
  const http = require('http');
  const url = 'http://127.0.0.1:3000/health';
  const interval = 700;
  const maxWait = 45000;

  return new Promise((resolve, reject) => {
    const start = Date.now();
    process.stdout.write('   Esperando backend');
    function check() {
      const req = http.get(url, (res) => {
        if (res.statusCode === 200) {
          process.stdout.write(' listo.\n');
          return resolve(true);
        }
        schedule();
      });
      req.on('error', schedule);
      req.setTimeout(2500, () => {
        req.destroy();
        schedule();
      });
    }
    function schedule() {
      if (Date.now() - start >= maxWait) {
        process.stdout.write(' timeout.\n');
        return reject(new Error('El backend no respondió a /health a tiempo'));
      }
      process.stdout.write('.');
      setTimeout(check, interval);
    }
    check();
  });
}

function startTunnel(port, type) {
  console.log(`\n🌐 Iniciando túnel para ${type} (puerto ${port})...`);
  
  const tunnel = spawn('cloudflared', ['tunnel', '--protocol', 'http2', '--url', `http://localhost:${port}`], {
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  const tryExtractUrl = (text) => {
    const urlMatch = text.match(/https:\/\/[\w-]+\.trycloudflare\.com/);
    if (urlMatch && urlMatch[0]) {
      const url = urlMatch[0];
      if (type === 'frontend' && !frontendUrl) {
        frontendUrl = url;
        console.log(`\n✅ Frontend disponible en: ${frontendUrl}`);
        checkAndShowUrls();
      } else if (type === 'backend' && !backendUrl) {
        backendUrl = url;
        console.log(`\n✅ Backend disponible en: ${backendUrl}`);
        checkAndShowUrls();
      }
    }
  };

  tunnel.stdout.on('data', (data) => {
    const text = data.toString();
    process.stdout.write(text);
    tryExtractUrl(text);
  });
  
  // Cloudflared envía las URLs en stderr (líneas INF)
  tunnel.stderr.on('data', (data) => {
    const text = data.toString();
    tryExtractUrl(text);
    // Evitar ruido de logs no críticos en Windows (cert/config/icmp), pero dejar errores reales
    const noisy =
      text.includes('Cannot determine default configuration path') ||
      text.includes('Cannot determine default origin certificate path') ||
      text.includes('does not support loading the system root certificate pool on Windows') ||
      text.includes('Generated Connector ID') ||
      text.includes('Initial protocol') ||
      text.includes('ICMP proxy will use') ||
      text.includes('Starting metrics server') ||
      text.includes('Thank you for trying Cloudflare Tunnel') ||
      text.includes('Requesting new quick Tunnel on trycloudflare.com');

    if (!noisy) {
      process.stderr.write(text);
    }
  });
  
  tunnel.on('error', (error) => {
    console.error(`\n❌ Error al iniciar túnel para ${type}:`, error.message);
    console.error('   Verifica que cloudflared esté instalado correctamente');
  });
  
  return tunnel;
}

function checkAndShowUrls() {
  // Mostrar en cuanto tengamos el frontend (la URL principal para compartir)
  if (frontendUrl && !urlsShown) {
    urlsShown = true;
    showUrls();
  }
}

function showUrls() {
  console.log('\n' + '='.repeat(70));
  console.log('✅ DEMO INICIADA CORRECTAMENTE');
  console.log('='.repeat(70));
  console.log(`\n🌍 PARA ACCESO DESDE OTRA RED - Usa esta URL:`);
  console.log(`   ${frontendUrl}`);
  console.log(`\n   ↳ Comparte esta URL. Funciona desde celular, otra WiFi, datos móviles, etc.`);
  if (backendUrl) {
    console.log(`\n🔧 BACKEND (solo para referencia/debug):`);
    console.log(`   ${backendUrl}`);
  }
  console.log('\n📝 IMPORTANTE:');
  console.log('   - Las URLs cambiarán cada vez que reinicies el túnel');
  console.log('   - No necesitas configurar VITE_API_URL; todo funciona por el túnel');
  console.log('   - Si no carga desde otro dispositivo: verifica que copiaste la URL del FRONTEND');
  console.log('\n💡 Presiona Ctrl+C para detener todos los servicios');
  console.log('='.repeat(70) + '\n');
}

async function main() {
  console.log('🚀 Iniciando RIAL APP Demo con URLs Temporales (Cloudflare Tunnel)\n');
  
  // Verificar cloudflared
  try {
    require('child_process').execSync('cloudflared --version', { stdio: 'ignore' });
  } catch {
    console.error('❌ cloudflared no está instalado.');
    console.log('\n📥 Instalación:');
    console.log('   Windows: winget install --id Cloudflare.cloudflared');
    console.log('   O descarga desde: https://github.com/cloudflare/cloudflared/releases');
    console.log('\n   Después de instalar, ejecuta este script nuevamente.');
    process.exit(1);
  }
  
  console.log('✅ cloudflared está instalado\n');
  console.log('ℹ️  Usando URLs temporales de Cloudflare (gratis, sin límites)');
  console.log('   No se requiere configuración previa ni autenticación\n');
  
  // Iniciar servicios
  console.log('🔄 Iniciando servicios...\n');
  backendProcess = startBackend();

  await waitForBackend();
  frontendProcess = startFrontend();

  setTimeout(() => {
    console.log('\n⏳ Esperando a que los servidores inicien...');
    frontendTunnel = startTunnel(5173, 'frontend');
    backendTunnel = startTunnel(3000, 'backend');
    
    // Mostrar URLs después de un tiempo si no se detectaron automáticamente
    setTimeout(() => {
      if (!urlsShown) {
        console.log('\n⚠️  Las URLs deberían aparecer arriba.');
        console.log('   Si no aparecen, revisa la salida de cloudflared.');
        console.log('   Busca líneas que contengan "trycloudflare.com"\n');
      }
    }, 15000);
  }, 5000);
  
  // Manejar cierre
  const cleanup = () => {
    isShuttingDown = true;
    console.log('\n\n🛑 Deteniendo servicios...');
    if (frontendTunnel) {
      frontendTunnel.kill('SIGTERM');
    }
    if (backendTunnel) {
      backendTunnel.kill('SIGTERM');
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
