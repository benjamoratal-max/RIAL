# 🚀 Inicio Rápido - Configuración de Email

## Verificar configuración actual

```bash
npm run check-config
```

Este comando te mostrará qué está configurado y qué falta.

## Configuración rápida

### 📧 Email (5 minutos)

**Opción más fácil - Mailtrap (desarrollo):**
1. Regístrate en https://mailtrap.io (gratis)
2. Copia las credenciales SMTP
3. Actualiza en `.env`:
   ```env
   SMTP_HOST=smtp.mailtrap.io
   SMTP_PORT=2525
   SMTP_USER=tu-username
   SMTP_PASS=tu-password
   SMTP_FROM=noreply@rial.com
   ```

**Para Gmail:**
1. Activa 2FA en Google
2. Crea contraseña de aplicación: https://myaccount.google.com/apppasswords
3. Actualiza en `.env`:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=tu-email@gmail.com
   SMTP_PASS=la-contraseña-de-16-caracteres
   SMTP_FROM=noreply@rial.com
   ```

## Después de configurar

1. Reinicia el servidor: `npm run dev`
2. Verifica: `npm run check-config`
3. Prueba registrando un usuario nuevo

## 📖 Guía completa

Para más detalles, ver: [CONFIGURACION_EMAIL.md](./CONFIGURACION_EMAIL.md)

## ⚠️ Nota importante

Si no configuras email, el sistema funcionará en **modo simulación**:
- Los emails aparecerán en los logs del servidor
- Esto es útil para desarrollo, pero NO para producción
