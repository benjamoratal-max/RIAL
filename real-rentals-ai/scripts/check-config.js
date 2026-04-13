/**
 * Script para verificar la configuración de Email y SMS
 * Ejecuta: node scripts/check-config.js
 */

require('dotenv').config();

console.log('🔍 Verificando configuración de Email y SMS...\n');

// Verificar configuración de Email
console.log('📧 Configuración de Email (SMTP):');
const smtpConfig = {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS ? '***' + process.env.SMTP_PASS.slice(-4) : undefined,
  from: process.env.SMTP_FROM,
};

let emailConfigured = true;
Object.entries(smtpConfig).forEach(([key, value]) => {
  const status = value ? '✅' : '❌';
  const displayValue = value || 'NO CONFIGURADO';
  console.log(`  ${status} ${key}: ${displayValue}`);
  if (!value && key !== 'pass') {
    emailConfigured = false;
  }
});

if (!emailConfigured) {
  console.log('\n  ⚠️  Email no está completamente configurado');
  console.log('  📖 Ver guía: CONFIGURACION_EMAIL_SMS.md');
} else {
  console.log('\n  ✅ Email configurado correctamente');
}

// Verificar configuración de SMS
console.log('\n📱 Configuración de SMS (Twilio):');
const twilioConfig = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN ? '***' + process.env.TWILIO_AUTH_TOKEN.slice(-4) : undefined,
  phoneNumber: process.env.TWILIO_PHONE_NUMBER,
};

let smsConfigured = true;
Object.entries(twilioConfig).forEach(([key, value]) => {
  const status = value ? '✅' : '❌';
  const displayValue = value || 'NO CONFIGURADO';
  console.log(`  ${status} ${key}: ${displayValue}`);
  if (!value) {
    smsConfigured = false;
  }
});

if (!smsConfigured) {
  console.log('\n  ⚠️  SMS no está completamente configurado');
  console.log('  📖 Ver guía: CONFIGURACION_EMAIL_SMS.md');
} else {
  console.log('\n  ✅ SMS configurado correctamente');
}

// Resumen
console.log('\n' + '='.repeat(50));
if (emailConfigured && smsConfigured) {
  console.log('✅ Todo está configurado correctamente');
} else {
  console.log('⚠️  Configuración incompleta');
  console.log('   El sistema funcionará en modo simulación');
  console.log('   Para producción, completa la configuración');
}
console.log('='.repeat(50) + '\n');
