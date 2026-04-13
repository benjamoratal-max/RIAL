#!/usr/bin/env node

/**
 * Script de configuración inicial para Cloudflare Tunnel
 * Ejecuta este script UNA VEZ para configurar el túnel
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function checkCloudflared() {
  try {
    execSync('cloudflared --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function createYAMLConfig(tunnelName, frontendHostname, backendHostname, credentialsPath) {
  return `tunnel: ${tunnelName}
credentials-file: ${credentialsPath}

ingress:
${frontendHostname ? `  - hostname: ${frontendHostname}
    service: http://localhost:5173` : `  - service: http://localhost:5173`}
${backendHostname ? `  - hostname: ${backendHostname}
    service: http://localhost:3000` : `  - service: http://localhost:3000`}
  - service: http_status:404
`;
}

async function main() {
  console.log('🚀 Configuración de Cloudflare Tunnel para RIAL APP\n');
  
  // Verificar cloudflared
  console.log('📦 Verificando cloudflared...');
  if (!(await checkCloudflared())) {
    console.error('❌ cloudflared no está instalado.');
    console.log('\n📥 Instalación:');
    console.log('   Windows: Descarga desde https://github.com/cloudflare/cloudflared/releases');
    console.log('   O instala con: winget install --id Cloudflare.cloudflared');
    console.log('   O con Chocolatey: choco install cloudflared');
    console.log('\n   Después de instalar, ejecuta este script nuevamente.');
    process.exit(1);
  }
  
  console.log('✅ cloudflared está instalado\n');
  
  // Verificar login
  console.log('🔐 Verificando autenticación con Cloudflare...');
  try {
    execSync('cloudflared tunnel list', { stdio: 'ignore' });
    console.log('✅ Ya estás autenticado con Cloudflare\n');
  } catch {
    console.log('⚠️  Necesitas autenticarte con Cloudflare');
    console.log('   Abriendo navegador para autenticación...\n');
    const loginProcess = spawn('cloudflared', ['tunnel', 'login'], { 
      stdio: 'inherit', 
      shell: true 
    });
    
    loginProcess.on('close', (code) => {
      if (code === 0) {
        console.log('\n✅ Autenticación completada\n');
        rl.close();
        console.log('🔄 Ejecuta este script nuevamente para continuar con la configuración.');
        process.exit(0);
      } else {
        console.log('\n❌ Error en la autenticación. Intenta nuevamente.');
        process.exit(1);
      }
    });
    return;
  }
  
  // Crear túnel
  const tunnelName = await question('📝 Nombre del túnel (ej: rial-app, Enter para "rial-app"): ') || 'rial-app';
  
  console.log(`\n🔨 Creando túnel "${tunnelName}"...`);
  try {
    execSync(`cloudflared tunnel create ${tunnelName}`, { stdio: 'inherit' });
    console.log('✅ Túnel creado exitosamente\n');
  } catch (error) {
    const errorMsg = error.message || error.toString();
    if (errorMsg.includes('already exists') || errorMsg.includes('duplicate')) {
      console.log('ℹ️  El túnel ya existe, continuando...\n');
    } else {
      console.error('❌ Error al crear túnel:', errorMsg);
      process.exit(1);
    }
  }
  
  // Obtener dominio
  console.log('\n🌐 IMPORTANTE: Necesitas tener un dominio configurado en Cloudflare');
  console.log('   Si no tienes uno, puedes usar URLs temporales (pero no serán fijas)');
  const domain = await question('   Tu dominio en Cloudflare (ej: tudominio.com, Enter para URLs temporales): ');
  
  if (!domain || domain.trim() === '') {
    console.log('\n⚠️  Sin dominio configurado. Usarás URLs temporales.');
    console.log('   Las URLs cambiarán cada vez que reinicies el túnel.');
    console.log('   Para URLs fijas, configura un dominio en Cloudflare y ejecuta este script nuevamente.\n');
    
    // Configuración mínima para URLs temporales
    const configDir = path.join(__dirname, '.cloudflared');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    const credentialsPath = path.join(
      process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH || '',
      '.cloudflared',
      `${tunnelName}.json`
    );
    
    const configPath = path.join(configDir, 'config.yml');
    const config = createYAMLConfig(tunnelName, null, null, credentialsPath);
    fs.writeFileSync(configPath, config);
    
    const envConfig = {
      TUNNEL_NAME: tunnelName,
      FRONTEND_HOSTNAME: '',
      BACKEND_HOSTNAME: '',
      DOMAIN: ''
    };
    
    const envPath = path.join(configDir, '.env.tunnel');
    fs.writeFileSync(envPath, Object.entries(envConfig).map(([k, v]) => `${k}=${v}`).join('\n'));
    
    console.log('✅ Configuración básica guardada');
    console.log('   Ejecuta "npm run dev:tunnel" para iniciar y obtener URLs temporales\n');
    rl.close();
    return;
  }
  
  const domainClean = domain.trim();
  
  // Configurar subdominios
  console.log('\n📱 Configurando subdominios...');
  const frontendSubdomain = await question('   Subdominio para frontend (ej: demo, Enter para "demo"): ') || 'demo';
  const backendSubdomain = await question('   Subdominio para backend (ej: api, Enter para "api"): ') || 'api';
  
  const frontendHostname = `${frontendSubdomain}.${domainClean}`;
  const backendHostname = `${backendSubdomain}.${domainClean}`;
  
  // Crear config.yml
  const configDir = path.join(__dirname, '.cloudflared');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  const credentialsPath = path.join(
    process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH || '',
    '.cloudflared',
    `${tunnelName}.json`
  );
  
  const configPath = path.join(configDir, 'config.yml');
  const config = createYAMLConfig(tunnelName, frontendHostname, backendHostname, credentialsPath);
  fs.writeFileSync(configPath, config);
  console.log(`\n✅ Configuración guardada en ${configPath}\n`);
  
  // Configurar DNS
  console.log('🌐 Configurando DNS en Cloudflare...');
  try {
    execSync(`cloudflared tunnel route dns ${tunnelName} ${frontendHostname}`, { stdio: 'inherit' });
    console.log(`✅ ${frontendHostname} configurado\n`);
  } catch (error) {
    console.log(`⚠️  Error al configurar ${frontendHostname}`);
    console.log(`   Configúralo manualmente desde el dashboard de Cloudflare\n`);
  }
  
  try {
    execSync(`cloudflared tunnel route dns ${tunnelName} ${backendHostname}`, { stdio: 'inherit' });
    console.log(`✅ ${backendHostname} configurado\n`);
  } catch (error) {
    console.log(`⚠️  Error al configurar ${backendHostname}`);
    console.log(`   Configúralo manualmente desde el dashboard de Cloudflare\n`);
  }
  
  // Guardar configuración para los scripts
  const envConfig = {
    TUNNEL_NAME: tunnelName,
    FRONTEND_HOSTNAME: frontendHostname,
    BACKEND_HOSTNAME: backendHostname,
    DOMAIN: domainClean
  };
  
  const envPath = path.join(configDir, '.env.tunnel');
  fs.writeFileSync(envPath, Object.entries(envConfig).map(([k, v]) => `${k}=${v}`).join('\n'));
  
  console.log('✅ Configuración completada!\n');
  console.log('📋 Resumen:');
  console.log(`   Túnel: ${tunnelName}`);
  console.log(`   Frontend: https://${frontendHostname}`);
  console.log(`   Backend: https://${backendHostname}`);
  console.log('\n🚀 Ahora puedes ejecutar: npm run dev:tunnel\n');
  console.log('📝 IMPORTANTE: Actualiza las variables de entorno:');
  console.log(`   En real-rentals-ai/.env agrega:`);
  console.log(`   PUBLIC_FRONTEND_URL=https://${frontendHostname}`);
  console.log(`   CORS_ORIGINS=http://localhost:5173,https://${frontendHostname}`);
  console.log(`   PUBLIC_BACKEND_URL=https://${backendHostname}`);
  console.log(`\n   En long-term-rentals/.env agrega:`);
  console.log(`   VITE_API_URL=https://${backendHostname}\n`);
  
  rl.close();
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  rl.close();
  process.exit(1);
});
