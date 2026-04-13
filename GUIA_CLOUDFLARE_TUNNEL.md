# Guía Completa: Acceso desde Internet con Cloudflare Tunnel

## 🎯 Características

- ✅ **URLs fijas** con dominio propio en Cloudflare
- ✅ **Gratis y sin límites**
- ✅ **HTTPS automático** (gestionado por Cloudflare)
- ✅ **Protección con contraseña** opcional (Cloudflare Access)
- ✅ **Un solo comando** para iniciar todo (backend + frontend + túnel)
- ✅ **Acceso desde cualquier dispositivo** en cualquier red

## 📋 Requisitos Previos

### 1. Dominio en Cloudflare

**IMPORTANTE:** Necesitas tener un dominio configurado en Cloudflare para URLs fijas.

Si no tienes un dominio:
- Puedes comprar uno en Cloudflare o cualquier registrador
- Luego transfiere el dominio a Cloudflare o cambia los nameservers
- Cloudflare tiene un plan gratuito que incluye todo lo necesario

**Pasos para configurar dominio en Cloudflare:**
1. Ve a [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Agrega tu sitio/dominio
3. Sigue las instrucciones para cambiar los nameservers
4. Espera a que Cloudflare verifique el dominio (puede tardar unas horas)

### 2. Instalar cloudflared

**Windows:**
```powershell
# Opción 1: Con winget (recomendado)
winget install --id Cloudflare.cloudflared

# Opción 2: Con Chocolatey
choco install cloudflared

# Opción 3: Descarga manual
# 1. Ve a https://github.com/cloudflare/cloudflared/releases
# 2. Descarga cloudflared-windows-amd64.exe
# 3. Renómbralo a cloudflared.exe
# 4. Colócalo en una carpeta (ej: C:\cloudflared)
# 5. Agrega esa carpeta al PATH de Windows
```

**Verificar instalación:**
```bash
cloudflared --version
```

## 🚀 Configuración Inicial (Solo una vez)

### Paso 1: Ejecutar script de configuración

```bash
npm run setup:tunnel
```

Este script te guiará paso a paso:

1. **Verifica cloudflared** - Si no está instalado, te indicará cómo instalarlo
2. **Autenticación con Cloudflare** - Abrirá tu navegador para autenticarte
3. **Crear túnel** - Te pedirá un nombre para el túnel (ej: `rial-app`)
4. **Configurar dominio** - Ingresa tu dominio en Cloudflare (ej: `tudominio.com`)
5. **Configurar subdominios** - Te pedirá subdominios para frontend y backend
   - Frontend: `demo` → `https://demo.tudominio.com`
   - Backend: `api` → `https://api.tudominio.com`

### Paso 2: Configurar variables de entorno

Después de ejecutar el script de setup, actualiza los archivos `.env`:

**Backend (`real-rentals-ai/.env`):**
```env
PUBLIC_FRONTEND_URL=https://demo.tudominio.com
CORS_ORIGINS=http://localhost:5173,https://demo.tudominio.com
PUBLIC_BACKEND_URL=https://api.tudominio.com
```

**Frontend (`long-term-rentals/.env`):**
```env
VITE_API_URL=https://api.tudominio.com
```

> **Nota:** Reemplaza `tudominio.com` con tu dominio real y los subdominios que hayas configurado.

## 🎬 Iniciar la Demo

Una vez configurado, cada vez que quieras iniciar la demo:

```bash
npm run dev:tunnel
```

Este comando:
1. ✅ Solicita contraseña (opcional, puedes presionar Enter)
2. ✅ Inicia el backend en `http://localhost:3000`
3. ✅ Inicia el frontend en `http://localhost:5173`
4. ✅ Inicia Cloudflare Tunnel
5. ✅ Muestra las URLs públicas

**Para detener todo:** Presiona `Ctrl+C`

## 🔐 Protección con Contraseña (Opcional)

Para agregar protección con contraseña usando Cloudflare Access:

### Opción 1: Cloudflare Access (Recomendado)

1. Ve a [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Ve a **Zero Trust** → **Access** → **Applications**
3. Haz clic en **Add an application**
4. Selecciona **Self-hosted**
5. Configura:
   - **Application name:** RIAL Demo
   - **Session duration:** 24 hours
   - **Application domain:** Selecciona tu subdominio (ej: `demo.tudominio.com`)
6. En **Policies**, agrega una política:
   - **Policy name:** Demo Password
   - **Action:** Allow
   - **Include:** 
     - **Emails:** Agrega los emails de los inversores
     - O usa **Service Token** para una contraseña compartida
7. Guarda la configuración

### Opción 2: Service Token (Contraseña Simple)

1. En Cloudflare Access, crea una política con **Service Token**
2. Genera un token
3. Comparte ese token con los inversores
4. Cuando accedan a la URL, Cloudflare pedirá el token

## 📱 Compartir con Inversores

Una vez iniciada la demo, verás algo como:

```
✅ DEMO INICIADA CORRECTAMENTE
======================================================================

🌍 FRONTEND (Comparte esta URL con los inversores):
   https://demo.tudominio.com

🔧 BACKEND:
   https://api.tudominio.com
```

**Comparte la URL del frontend** con los inversores. Pueden acceder desde:
- ✅ Cualquier dispositivo (celular, laptop, tablet)
- ✅ Cualquier red (WiFi, datos móviles, etc.)
- ✅ Cualquier lugar del mundo

## 🛠️ Estructura de Archivos

Después de la configuración, se crearán estos archivos:

```
RIAL APP/
├── .cloudflared/
│   ├── config.yml          # Configuración del túnel
│   └── .env.tunnel         # Variables de configuración
├── setup-cloudflare-tunnel.js  # Script de configuración
└── start-demo.js           # Script para iniciar demo
```

## ⚠️ Notas Importantes

1. **El túnel debe estar corriendo** mientras quieras que la app sea accesible
2. **URLs fijas** solo funcionan si tienes dominio configurado en Cloudflare
3. **HTTPS automático** - Cloudflare gestiona los certificados SSL
4. **Sin límites** - Cloudflare Tunnel es completamente gratis
5. **Seguridad** - Solo expone los puertos que configuraste (5173 y 3000)

## 🐛 Solución de Problemas

### Error: "cloudflared not found"
- Verifica que cloudflared esté instalado: `cloudflared --version`
- Si no está, instálalo siguiendo las instrucciones arriba
- Verifica que esté en el PATH de Windows

### Error: "tunnel not found"
- Ejecuta primero: `npm run setup:tunnel`
- Verifica que el túnel se haya creado: `cloudflared tunnel list`

### Error: "authentication required"
- Ejecuta: `cloudflared tunnel login`
- Se abrirá tu navegador para autenticarte

### URLs no aparecen
- Espera unos segundos después de iniciar (el túnel tarda en conectarse)
- Revisa la salida de cloudflared en la consola
- Verifica que los servidores estén corriendo (backend y frontend)

### Error de CORS
- Verifica que hayas actualizado `CORS_ORIGINS` en `real-rentals-ai/.env`
- Verifica que `VITE_API_URL` esté configurada en `long-term-rentals/.env`
- Reinicia los servidores después de cambiar `.env`

### El dominio no funciona
- Verifica que el dominio esté configurado en Cloudflare
- Verifica que los nameservers apunten a Cloudflare
- Espera a que DNS se propague (puede tardar hasta 24 horas, pero usualmente es más rápido)
- Verifica que el túnel esté corriendo: `cloudflared tunnel run <nombre>`

### DNS no se configuró automáticamente
Si el script no pudo configurar DNS automáticamente:

1. Ve a Cloudflare Dashboard → **Zero Trust** → **Networks** → **Tunnels**
2. Selecciona tu túnel
3. Ve a **Public Hostnames**
4. Agrega manualmente:
   - **Subdomain:** `demo` (o el que hayas elegido)
   - **Domain:** Tu dominio
   - **Service:** `http://localhost:5173`
5. Repite para el backend con subdomain `api` y service `http://localhost:3000`

## 📚 Recursos Adicionales

- [Documentación oficial de Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- [Guía de Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/)
- [Dashboard de Cloudflare](https://dash.cloudflare.com)

## ✅ Checklist de Configuración

Antes de compartir con inversores, verifica:

- [ ] cloudflared instalado y funcionando
- [ ] Dominio configurado en Cloudflare
- [ ] Túnel creado y configurado (`npm run setup:tunnel`)
- [ ] Variables de entorno actualizadas en ambos `.env`
- [ ] DNS configurado (verificado en Cloudflare Dashboard)
- [ ] Demo iniciada correctamente (`npm run dev:tunnel`)
- [ ] URLs accesibles desde otro dispositivo/red
- [ ] Protección con contraseña configurada (opcional)

## 🎉 ¡Listo!

Una vez completado todo, tendrás:
- ✅ URLs fijas y profesionales
- ✅ Acceso desde cualquier lugar
- ✅ HTTPS automático
- ✅ Protección opcional con contraseña
- ✅ Un solo comando para iniciar todo

¡Tu app está lista para impresionar a los inversores! 🚀
