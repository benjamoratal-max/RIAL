# 🤖 Sistema de IA Generativa con Aprendizaje

## 📋 Resumen

Se ha implementado un sistema completo de **IA Generativa con Aprendizaje Continuo** que transforma el chatbot y broker AI en asistentes inteligentes capaces de:

- ✅ Responder **cualquier tipo de pregunta** (no solo las predefinidas)
- ✅ **Aprender de cada interacción** y mejorar continuamente
- ✅ Usar **IA generativa** (OpenAI, Anthropic) para respuestas naturales
- ✅ Sistema **híbrido**: reglas para casos específicos + IA generativa para el resto
- ✅ **Base de conocimiento** que crece con el tiempo
- ✅ **Feedback del usuario** para mejorar respuestas

## 🏗️ Arquitectura

### Sistema Híbrido

```
Usuario pregunta
    ↓
¿Es caso específico con alta confianza?
    ├─ SÍ → Sistema de Reglas (rápido, preciso)
    └─ NO → IA Generativa (flexible, capaz)
            ↓
        ¿Respuesta en base de conocimiento?
            ├─ SÍ → Usar respuesta mejorada
            └─ NO → Generar nueva respuesta
                    ↓
                Guardar para aprendizaje
```

## 📁 Archivos Creados/Modificados

### Frontend (`long-term-rentals/`)

1. **`src/utils/generativeAI.ts`** - Servicio principal de IA generativa
   - Integración con OpenAI/Anthropic
   - Base de conocimiento local
   - Búsqueda semántica de respuestas similares
   - Aprendizaje de feedback

2. **`src/utils/learningSystem.ts`** - Sistema de análisis y aprendizaje
   - Análisis de calidad de respuestas
   - Extracción de patrones
   - Métricas de aprendizaje
   - Sugerencias de mejora

3. **`src/components/AIFeedback.tsx`** - Componente de feedback
   - Botones de útil/no útil
   - Campo para mejorar respuestas
   - Integración con sistema de aprendizaje

4. **`src/components/AIAssistant.tsx`** - Actualizado con integración híbrida
   - Usa reglas para casos específicos
   - Usa IA generativa para preguntas complejas
   - Integra componente de feedback

5. **`src/components/RentalProcess.tsx`** - Broker AI actualizado
   - Misma estrategia híbrida
   - IA generativa para preguntas complejas del proceso

### Backend (`real-rentals-ai/`)

1. **`src/routes/aiRoutes.ts`** - Rutas de API para IA
   - `/api/ai/generate` - Generar respuestas con IA
   - `/api/ai/interaction` - Guardar interacciones
   - `/api/ai/knowledge-base` - Obtener base de conocimiento
   - `/api/ai/feedback` - Enviar feedback
   - `/api/ai/stats` - Estadísticas de aprendizaje

2. **`prisma/schema.prisma`** - Modelo `AIInteraction` agregado
   - Guarda todas las interacciones
   - Feedback del usuario
   - Respuestas mejoradas
   - Metadata y categorías

## ⚙️ Configuración

### Variables de Entorno

#### Backend (`.env` en `real-rentals-ai/`)

```env
# Configuración de IA Generativa
AI_PROVIDER=openai  # o anthropic, local
AI_API_KEY=sk-...   # Tu API key
AI_MODEL=gpt-4o-mini  # o gpt-4, claude-3-sonnet-3-20240229
```

#### Frontend (`.env` en `long-term-rentals/`)

```env
VITE_AI_PROVIDER=openai
VITE_AI_API_KEY=sk-...  # Opcional, se puede manejar desde backend
VITE_AI_MODEL=gpt-4o-mini
```

### Obtener API Keys

1. **OpenAI**: https://platform.openai.com/api-keys
2. **Anthropic**: https://console.anthropic.com/

### Base de Datos

Ejecutar migración de Prisma:

```bash
cd real-rentals-ai
npx prisma db push
npx prisma generate
```

## 🚀 Uso

### Sin API Key (Modo Local)

El sistema funciona sin API key usando:
- Sistema de reglas para casos específicos
- Fallback inteligente para preguntas generales
- Base de conocimiento local (localStorage)

### Con API Key (Modo Completo)

1. Agregar API key en `.env`
2. El sistema usará IA generativa para preguntas complejas
3. Aprenderá de cada interacción
4. Mejorará con el tiempo

## 🎯 Características

### 1. Sistema Híbrido Inteligente

- **Reglas** para: búsquedas, comparaciones, precios, ubicaciones (rápido y preciso)
- **IA Generativa** para: preguntas complejas, casos no cubiertos, explicaciones detalladas

### 2. Base de Conocimiento

- Guarda todas las preguntas y respuestas
- Búsqueda semántica de respuestas similares
- Mejora respuestas existentes con contexto actual
- Comparte conocimiento entre usuarios

### 3. Aprendizaje Continuo

- Feedback del usuario (útil/no útil)
- Respuestas mejoradas manualmente
- Análisis de calidad automático
- Extracción de patrones exitosos

### 4. Análisis de Calidad

- Métricas: longitud, información accionable, contexto, completitud
- Sugerencias de mejora automáticas
- Identificación de preguntas sin respuesta satisfactoria

### 5. Estadísticas y Métricas

- Tasa de respuestas útiles
- Calidad promedio
- Tendencias de mejora
- Categorías más comunes

## 📊 Flujo de Aprendizaje

```
1. Usuario hace pregunta
   ↓
2. Sistema busca respuesta similar en base de conocimiento
   ↓
3. Si encuentra y es útil → Usa respuesta mejorada
   Si no encuentra → Genera nueva con IA
   ↓
4. Usuario recibe respuesta
   ↓
5. Usuario da feedback (útil/no útil)
   ↓
6. Sistema aprende y mejora
   ↓
7. Próxima pregunta similar → Respuesta mejorada
```

## 🔧 Personalización

### Agregar Nuevos Proveedores de IA

En `generativeAI.ts`, agregar en `callGenerativeAI()`:

```typescript
else if (aiProvider === 'tu-proveedor') {
  // Implementar llamada a API
}
```

### Ajustar Umbrales

En `AIAssistant.tsx`, modificar:

```typescript
const useRuleBased = intentAnalysis.confidence > 0.8 && 
  ['search', 'compare', ...].includes(intentAnalysis.intent)
```

### Personalizar Prompts

En `generativeAI.ts`, función `buildSystemPrompt()`:

```typescript
// Agregar instrucciones específicas de tu dominio
```

## 📈 Mejoras Futuras

- [ ] Embeddings vectoriales para búsqueda semántica mejorada
- [ ] Fine-tuning de modelos con datos propios
- [ ] Análisis de sentimiento
- [ ] Multi-idioma automático
- [ ] Respuestas con imágenes/diagramas
- [ ] Integración con más proveedores (Google Gemini, etc.)

## 🐛 Troubleshooting

### "Servicio de IA no configurado"

- Verificar que `AI_API_KEY` esté en `.env`
- Verificar que el backend esté corriendo
- El sistema funcionará en modo local sin API key

### Respuestas genéricas

- El sistema aprende con el tiempo
- Dar feedback útil/no útil ayuda
- Agregar más contexto en las preguntas

### Errores de API

- Verificar API key válida
- Verificar límites de rate limiting
- El sistema tiene fallback automático

## 📝 Notas

- El sistema funciona **sin API key** usando reglas y fallback
- Con API key, se activa la **IA generativa completa**
- El aprendizaje es **progresivo** - mejora con cada interacción
- La base de conocimiento se guarda en **localStorage** (frontend) y **base de datos** (backend)

## 🎉 Resultado

Ahora tienes un sistema de IA que:

✅ Responde **cualquier pregunta** (no solo predefinidas)
✅ **Aprende continuamente** de cada interacción
✅ Mejora con el **feedback del usuario**
✅ Usa **IA generativa** para respuestas naturales
✅ Mantiene **base de conocimiento** creciente
✅ Funciona **híbrido** (reglas + generativa)

**¡El chatbot y broker AI ahora son verdaderos asistentes inteligentes!** 🚀
