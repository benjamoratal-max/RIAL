import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy al backend: usar 127.0.0.1 cuando corren en la misma máquina.
// En producción (Vercel), esta configuración de dev server no se utiliza.
const API_HOST = '127.0.0.1'
const API_TARGET = `http://${API_HOST}:3000`

// Evitar spam en terminal: quitar el log por defecto de Vite y solo avisar una vez + responder al cliente
function configureProxySilent(_prefix: string) {
  let alreadyLogged = false
  return (proxy: any) => {
    proxy.removeAllListeners('error') // quita el log de Vite que imprime cada error
    proxy.on('error', (err: any, _req: any, res: any) => {
      if (err?.code === 'ECONNREFUSED' && !alreadyLogged) {
        alreadyLogged = true
      }
      if (res && !res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Backend no disponible' }))
      }
    })
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // En Vercel suele definirse RENDER_API_URL; sin esto el bundle usa /api relativo y falla si no hay rewrites.
  const apiBase = (env.VITE_API_URL || env.RENDER_API_URL || '').trim().replace(/\/$/, '')

  return {
  plugins: [react()],
  define: apiBase
    ? { 'import.meta.env.VITE_API_URL': JSON.stringify(apiBase) }
    : {},
  server: {
    host: true, // Permite acceso desde otros dispositivos
    port: 5173,
    allowedHosts: true, // Permite Cloudflare Tunnel y otras URLs públicas (trycloudflare.com)
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
        configure: configureProxySilent('Backend (/api)'),
      },
      '/health': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
        configure: configureProxySilent('Backend (/health)'),
      },
      '/server-date': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
        configure: configureProxySilent('Backend (/server-date)'),
      },
      '/contracts': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
        configure: configureProxySilent('Backend (/contracts)'),
      },
      // Proxy para Ollama: el frontend llama a /ollama y Vite reenvía a localhost:11434 (evita CORS)
      '/ollama': {
        target: 'http://localhost:11434',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/ollama/, ''),
      },
    },
  },
  build: {
    target: 'es2015',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Eliminar console.log en producción
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          animations: ['framer-motion'],
          icons: ['lucide-react'],
          toast: ['react-hot-toast'],
          i18n: ['i18next', 'react-i18next'],
        },
        // Optimizar nombres de chunks
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      }
    },
    // Optimizar tamaño del bundle
    chunkSizeWarningLimit: 1000,
  },
  }
})
