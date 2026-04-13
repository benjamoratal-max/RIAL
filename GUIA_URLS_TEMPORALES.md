# 🚀 Guía Rápida: URLs Temporales con Cloudflare Tunnel

## ✅ Ventajas de Cloudflare Tunnel

- ✅ **100% Gratis** - Sin costos ocultos
- ✅ **Sin límites** - Sin restricciones de uso
- ✅ **Sin cuenta requerida** - Para URLs temporales simples
- ✅ **HTTPS automático** - Certificados SSL incluidos
- ✅ **Fácil de usar** - Un solo comando

## 📦 Instalación (Solo una vez)

### Paso 1: Instalar cloudflared

**Windows (PowerShell):**
```powershell
winget install --id Cloudflare.cloudflared
```

**O descarga manual:**
1. Ve a: https://github.com/cloudflare/cloudflared/releases
2. Descarga `cloudflared-windows-amd64.exe`
3. Renómbralo a `cloudflared.exe`
4. Guárdalo en una carpeta (ej: `C:\cloudflared`)
5. Agrega esa carpeta al PATH de Windows

**Verificar instalación:**
```bash
cloudflared --version
```

## 🎬 Uso Rápido (Sin configuración)

### Opción 1: Script Simplificado (Recomendado)

```bash
npm run dev:tunnel-temp
```

Este comando:
1. ✅ Inicia el backend
2. ✅ Inicia el frontend
3. ✅ Crea túneles temporales para ambos
4. ✅ Muestra las URLs automáticamente

**¡Eso es todo!** No necesitas configurar nada más.

### Opción 2: Con Configuración (Más control)

Si quieres más control sobre el túnel:

```bash
# Primera vez (configuración)
npm run setup:tunnel
# Cuando te pregunte por dominio, presiona Enter (sin escribir nada)

# Cada vez que quieras iniciar
npm run dev:tunnel
```

## 📱 Compartir con Inversores

Después de ejecutar el comando, verás algo como:

```
✅ DEMO INICIADA CORRECTAMENTE
======================================================================

🌍 FRONTEND (Comparte esta URL con los inversores):
   https://xxxx-xxxx-xxxx.trycloudflare.com

🔧 BACKEND:
   https://yyyy-yyyy-yyyy.trycloudflare.com
```

**Comparte la URL del frontend** con los inversores. Pueden acceder desde:
- ✅ Cualquier dispositivo (celular, laptop, tablet)
- ✅ Cualquier red (WiFi, datos móviles, etc.)
- ✅ Cualquier lugar del mundo

## ⚠️ Importante: URLs Temporales

### Características:
- ✅ Funcionan perfectamente para demos
- ✅ Son completamente gratuitas
- ✅ Sin límites de uso
- ⚠️ **Cambian cada vez que reinicias el túnel**
- ⚠️ **Expiran cuando cierras el túnel**

### ¿Cuándo usar URLs temporales?
- ✅ Para demos rápidas
- ✅ Para pruebas con inversores
- ✅ Cuando no necesitas URLs fijas
- ✅ Para desarrollo y testing

### ¿Cuándo necesitas URLs fijas?
- Si quieres compartir la misma URL siempre
- Para producción o uso continuo
- Necesitas un dominio propio en Cloudflare

## 🔧 Configuración Manual (Opcional)

Si quieres actualizar las variables de entorno manualmente cuando obtengas las URLs:

**Backend (`real-rentals-ai/.env`):**
```env
PUBLIC_FRONTEND_URL=https://xxxx-xxxx-xxxx.trycloudflare.com
CORS_ORIGINS=http://localhost:5173,https://xxxx-xxxx-xxxx.trycloudflare.com
PUBLIC_BACKEND_URL=https://yyyy-yyyy-yyyy.trycloudflare.com
```

**Frontend (`long-term-rentals/.env`):**
```env
VITE_API_URL=https://yyyy-yyyy-yyyy.trycloudflare.com
```

> **Nota:** Esto es opcional. El sistema funciona sin estas variables, pero pueden ayudar con algunos casos edge.

## 🛑 Detener la Demo

Presiona `Ctrl+C` en la terminal donde está corriendo.

Esto detendrá:
- ✅ Backend
- ✅ Frontend
- ✅ Túneles de Cloudflare

## 🐛 Solución de Problemas

### Error: "cloudflared not found"
- Verifica que esté instalado: `cloudflared --version`
- Si no está, instálalo con `winget install --id Cloudflare.cloudflared`
- Verifica que esté en el PATH de Windows

### URLs no aparecen
- Espera unos segundos (los túneles tardan en conectarse)
- Revisa la salida de cloudflared en la consola
- Busca líneas que contengan "trycloudflare.com"
- Verifica que los servidores estén corriendo (backend y frontend)

### Error de conexión desde otro dispositivo
- Verifica que las URLs sean correctas (copia exacta)
- Asegúrate de que el túnel esté corriendo
- Verifica que ambos dispositivos tengan internet
- Prueba acceder desde el mismo dispositivo primero

### El túnel se cierra solo
- Verifica tu conexión a internet
- Algunos firewalls pueden bloquear cloudflared
- Revisa los logs para ver el error específico

## 📊 Comparación: Temporales vs Fijas

| Característica | URLs Temporales | URLs Fijas |
|----------------|-----------------|------------|
| Costo | ✅ Gratis | ✅ Gratis (requiere dominio) |
| Configuración | ✅ Mínima | ⚠️ Requiere dominio |
| Estabilidad | ⚠️ Cambian al reiniciar | ✅ Siempre iguales |
| Uso | ✅ Perfecto para demos | ✅ Perfecto para producción |
| Límites | ✅ Sin límites | ✅ Sin límites |

## 💡 Tips

1. **Guarda las URLs**: Cuando aparezcan, cópialas en un lugar seguro
2. **Comparte rápido**: Las URLs funcionan mientras el túnel esté activo
3. **Una demo a la vez**: Si reinicias, las URLs cambiarán
4. **Sin preocupaciones**: Cloudflare Tunnel es completamente confiable y seguro

## ✅ Checklist Rápido

Antes de compartir con inversores:

- [ ] cloudflared instalado y funcionando
- [ ] Demo iniciada con `npm run dev:tunnel-temp`
- [ ] URLs aparecen en la consola
- [ ] Probado desde otro dispositivo/red
- [ ] URLs copiadas y listas para compartir

## 🎉 ¡Listo!

Con esto ya puedes compartir tu app con los inversores desde cualquier lugar del mundo, completamente gratis y sin complicaciones.

**Comando principal:**
```bash
npm run dev:tunnel-temp
```

¡Eso es todo lo que necesitas! 🚀
