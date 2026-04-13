# Guía de Configuración de Email

Esta guía te ayudará a configurar el envío de emails para la aplicación RIAL.

## 📧 Configuración de Email (SMTP)

### Opción 1: Gmail (Recomendado para desarrollo)

#### Paso 1: Activar verificación en 2 pasos
1. Ve a tu cuenta de Google: https://myaccount.google.com
2. Ve a **Seguridad** → **Verificación en 2 pasos**
3. Activa la verificación en 2 pasos si no está activada

#### Paso 2: Crear Contraseña de aplicación
1. Ve a: https://myaccount.google.com/apppasswords
2. Selecciona:
   - **Aplicación**: "Correo"
   - **Dispositivo**: "Otro (nombre personalizado)" → Escribe "RIAL App"
3. Haz clic en **Generar**
4. **Copia la contraseña de 16 caracteres** (se muestra solo una vez)

#### Paso 3: Configurar en .env
Abre el archivo `real-rentals-ai/.env` y actualiza:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-email@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx  # La contraseña de aplicación de 16 caracteres (sin espacios)
SMTP_FROM=noreply@rial.com
```

**⚠️ Importante**: 
- Usa la contraseña de aplicación, NO tu contraseña normal de Gmail
- Quita los espacios de la contraseña si los tiene

### Opción 2: Mailtrap (Ideal para desarrollo/testing)

Mailtrap es un servicio que captura todos los emails en desarrollo sin enviarlos realmente.

1. **Regístrate gratis**: https://mailtrap.io
2. Ve a **Email Testing** → **Inboxes** → Selecciona tu inbox
3. Ve a **SMTP Settings** → Selecciona **Node.js - Nodemailer**
4. Copia las credenciales y actualiza en `.env`:

```env
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_SECURE=false
SMTP_USER=tu-username-de-mailtrap
SMTP_PASS=tu-password-de-mailtrap
SMTP_FROM=noreply@rial.com
```

### Opción 3: SendGrid (Producción)

1. **Regístrate**: https://sendgrid.com
2. Crea una **API Key**:
   - Ve a **Settings** → **API Keys**
   - Crea una nueva API Key con permisos de "Mail Send"
3. Configura en `.env`:

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=tu-api-key-de-sendgrid
SMTP_FROM=noreply@rial.com
```

### Opción 4: AWS SES (Producción)

1. **Configura AWS SES**: https://aws.amazon.com/ses
2. Verifica tu dominio o email
3. Obtén las credenciales SMTP
4. Configura en `.env`:

```env
SMTP_HOST=email-smtp.region.amazonaws.com  # Reemplaza 'region' con tu región
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-access-key-id
SMTP_PASS=tu-secret-access-key
SMTP_FROM=noreply@tudominio.com
```

---

## ✅ Verificar la configuración

### Probar Email

1. Reinicia el servidor backend
2. Intenta registrarte o solicitar verificación de email
3. Revisa:
   - **Gmail**: Tu bandeja de entrada
   - **Mailtrap**: Tu inbox en mailtrap.io
   - **SendGrid/AWS**: Tu email configurado

---

## 🔧 Solución de problemas

### Email no se envía

1. **Verifica las credenciales** en `.env`
2. **Revisa los logs** del servidor para ver errores
3. **Gmail**: Asegúrate de usar contraseña de aplicación, no tu contraseña normal
4. **Firewall**: Verifica que el puerto 587 esté abierto
5. **Revisa spam**: Los emails pueden ir a spam

### Variables no se cargan

1. **Reinicia el servidor** después de cambiar `.env`
2. **Verifica sintaxis**: No uses comillas en los valores (excepto si el valor tiene espacios)
3. **Sin espacios**: No dejes espacios alrededor del `=`

---

## 📝 Ejemplo de .env completo

```env
# Database
DATABASE_URL="file:./prisma/dev.db"

# JWT
JWT_SECRET=dev_secret_change_me_in_production

# Server
PORT=3000
NODE_ENV=development

# Email (SMTP) - Gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=miemail@gmail.com
SMTP_PASS=abcd efgh ijkl mnop
SMTP_FROM=noreply@rial.com
```

---

## 🚀 Modo desarrollo sin configuración

Si no configuras email, el sistema funcionará pero:
- **Emails**: Se simularán (aparecerán en logs del servidor)

Esto es útil para desarrollo, pero **NO funciona en producción**.

---

## 📞 Soporte

Si tienes problemas:
1. Revisa los logs del servidor
2. Verifica que las variables estén correctamente escritas en `.env`
3. Asegúrate de haber reiniciado el servidor después de cambios
