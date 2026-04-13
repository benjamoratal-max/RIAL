# 🚀 Instrucciones Rápidas - URLs Temporales (Gratis)

## ⚡ Inicio Súper Rápido (2 pasos)

### 1️⃣ Instalar cloudflared

**Windows (PowerShell):**
```powershell
winget install --id Cloudflare.cloudflared
```

**O descarga manual:**
- Ve a: https://github.com/cloudflare/cloudflared/releases
- Descarga `cloudflared-windows-amd64.exe`
- Renómbralo a `cloudflared.exe` y agrégalo al PATH

**Verificar:**
```bash
cloudflared --version
```

### 2️⃣ Iniciar demo

```bash
npm run dev:tunnel-temp
```

¡Eso es todo! El script mostrará las URLs automáticamente.

**Comparte la URL del frontend** con los inversores. Funciona desde cualquier dispositivo y red.

---

## 📱 ¿Qué verás?

Después de ejecutar el comando:

```
✅ DEMO INICIADA CORRECTAMENTE
======================================================================

🌍 FRONTEND (Comparte esta URL con los inversores):
   https://xxxx-xxxx-xxxx.trycloudflare.com

🔧 BACKEND:
   https://yyyy-yyyy-yyyy.trycloudflare.com
```

---

## ⚠️ Importante: URLs Temporales

- ✅ **100% Gratis** - Sin costos
- ✅ **Sin límites** - Usa todo lo que necesites
- ✅ **Sin configuración** - Funciona inmediatamente
- ⚠️ **Cambian cada vez** que reinicias el túnel
- ⚠️ **Expiran** cuando cierras el túnel

**Perfecto para:** Demos rápidas, pruebas con inversores, desarrollo

---

## 🔄 Opción Alternativa (Con más control)

Si quieres más control sobre el túnel:

```bash
# Primera vez
npm run setup:tunnel
# Presiona Enter cuando pida dominio (para URLs temporales)

# Cada vez
npm run dev:tunnel
```

---

## 🛑 Detener

Presiona `Ctrl+C` en la terminal.

---

## 📖 Documentación Completa

- **URLs Temporales:** Ver `GUIA_URLS_TEMPORALES.md`
- **URLs Fijas (con dominio):** Ver `GUIA_CLOUDFLARE_TUNNEL.md`

---

## ❓ Problemas Comunes

**"cloudflared not found"**
→ Instala cloudflared (paso 1)

**URLs no aparecen**
→ Espera unos segundos, revisa la consola
→ Busca líneas con "trycloudflare.com"

**No funciona desde otra red (WiFi distinto, datos móviles, internet)**
→ **DEBES usar el túnel:** `npm run dev:tunnel-temp` (no basta con `dev:frontend` + `dev:backend`)
→ Usa la URL del **FRONTEND** que muestra el script
→ No configures VITE_API_URL en .env (el proxy maneja las APIs automáticamente)
→ Si usas la URL del frontend, las llamadas API van por el mismo túnel

**No funciona desde la red local (mismo WiFi)**
→ Usa la IP local de tu PC: `http://192.168.x.x:5173` (la IP aparece en la terminal al iniciar Vite)
→ Si no conecta: **Firewall de Windows** puede estar bloqueando. Permite Node.js en puertos 5173 y 3000:
  - Panel de Control → Sistema y seguridad → Firewall de Windows → Configuración avanzada
  - Reglas de entrada → Nueva regla → Puerto → TCP → 5173, 3000 → Permitir

**Prueba básica**
→ Primero accede desde el mismo PC (http://localhost:5173). Si funciona ahí, el problema es de red/firewall.
