# Configuración de Ollama para RIAL App

Este documento explica cómo configurar Ollama para usar modelos de inteligencia artificial de código abierto (como Llama) en RIAL App.

## ¿Qué es Ollama?

Ollama es una herramienta que permite ejecutar modelos de IA de código abierto localmente en tu computadora. Esto significa que puedes usar modelos potentes como Llama, Mistral, y otros sin necesidad de API keys o conexión a servicios externos.

## Instalación

### Windows

1. Descarga Ollama desde: https://ollama.ai/download
2. Ejecuta el instalador
3. Ollama se iniciará automáticamente como servicio

### macOS

```bash
# Usando Homebrew
brew install ollama

# O descarga desde: https://ollama.ai/download
```

### Linux

```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

## Descargar un Modelo

Una vez instalado Ollama, necesitas descargar un modelo. **RIAL App usa por defecto llama3.2:3b** (más pequeño y rápido, ~2GB):

```bash
ollama pull llama3.2:3b
```

### Otros modelos recomendados:

- **llama3.2:1b** - Muy pequeño y rápido (~1.3GB). Para máquinas con poca RAM
- **llama3.2:3b** - Modelo por defecto de RIAL: buen balance velocidad/calidad (recomendado)
- **llama3.2** - Más calidad, más recursos
- **llama3.1:8b** - Más potente, requiere más recursos
- **mistral** - Alternativa excelente
- **phi3** - Modelo pequeño y eficiente

## Verificar que Ollama está funcionando

```bash
# Probar que Ollama responde
ollama list

# Probar el modelo (usa el mismo que RIAL por defecto)
ollama run llama3.2:3b "Hola, ¿cómo estás?"
```

## Configuración en RIAL App

### Variables de Entorno

Crea o edita el archivo `.env` en la raíz del proyecto:

```env
# Para usar Ollama (recomendado). Modelo por defecto: llama3.2:3b (pequeño y rápido)
VITE_AI_PROVIDER=ollama
VITE_AI_MODEL=llama3.2:3b
VITE_OLLAMA_BASE_URL=http://localhost:11434

# O si prefieres usar OpenAI (requiere API key)
# VITE_AI_PROVIDER=openai
# VITE_AI_API_KEY=tu-api-key-aqui
# VITE_AI_MODEL=gpt-4o-mini
```

### Backend (real-rentals-ai)

En el archivo `.env` del backend:

```env
# Para usar Ollama (modelo por defecto: llama3.2:3b)
AI_PROVIDER=ollama
AI_MODEL=llama3.2:3b
OLLAMA_BASE_URL=http://localhost:11434

# O si prefieres OpenAI
# AI_PROVIDER=openai
# AI_API_KEY=tu-api-key-aqui
# AI_MODEL=gpt-4o-mini
```

## Uso

Una vez configurado, el chatbot de RIAL App usará automáticamente Ollama para generar respuestas inteligentes que:

- ✅ Entienden el contexto de la conversación
- ✅ Recuerdan información previa
- ✅ Proporcionan respuestas relevantes y útiles
- ✅ Funcionan completamente offline (sin necesidad de internet después de la instalación)

## Solución de Problemas

### Error: "Ollama no está disponible"

1. Verifica que Ollama esté ejecutándose:
   ```bash
   ollama list
   ```

2. Si no está ejecutándose, inícialo:
   ```bash
   # Windows: Se inicia automáticamente
   # macOS/Linux:
   ollama serve
   ```

3. Verifica que el puerto 11434 esté disponible:
   ```bash
   # Windows PowerShell
   Test-NetConnection -ComputerName localhost -Port 11434
   
   # macOS/Linux
   curl http://localhost:11434/api/tags
   ```

### El modelo no responde o es muy lento

1. RIAL ya usa por defecto llama3.2:3b. Si aun así es lento, prueba un modelo aún más pequeño:
   ```bash
   ollama pull llama3.2:1b
   ```
   Y en `.env` pon `VITE_AI_MODEL=llama3.2:1b`

2. Verifica que tengas suficiente RAM (recomendado: mínimo 8GB, ideal 16GB+)

3. Cierra otras aplicaciones que consuman mucha memoria

### Cambiar el modelo

1. Descarga el nuevo modelo:
   ```bash
   ollama pull nombre-del-modelo
   ```

2. Actualiza la variable de entorno `VITE_AI_MODEL` o `AI_MODEL`

3. Reinicia la aplicación

## Ventajas de Ollama

- 🆓 **Gratis** - No requiere API keys ni pagos
- 🔒 **Privado** - Todo se ejecuta localmente, tus datos no salen de tu computadora
- ⚡ **Rápido** - Sin latencia de red
- 🔄 **Offline** - Funciona sin conexión a internet
- 🎯 **Personalizable** - Puedes usar diferentes modelos según tus necesidades

## Recursos Adicionales

- Documentación oficial: https://ollama.ai/docs
- Lista de modelos disponibles: https://ollama.ai/library
- Comunidad: https://github.com/ollama/ollama
