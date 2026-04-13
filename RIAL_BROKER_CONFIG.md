# Configuración del Rial AI Broker

El chatbot y el broker del proceso de alquiler usan el mismo agente **Rial AI Broker**. Su personalidad, reglas y contexto de negocio se configuran desde variables de entorno en el frontend.

## Variables de entorno (frontend)

En `long-term-rentals/.env` puedes definir:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `VITE_RIAL_TONO` | Marca/tono de comunicación | `formal pero amigable` |
| `VITE_RIAL_CIUDAD` | Zona de operación principal | `Buenos Aires, Argentina` |
| `VITE_RIAL_HORARIOS` | Horarios de atención humana / derivación | `Lunes a Viernes 9-18h` |
| `VITE_RIAL_WHATSAPP` | WhatsApp oficial (si existe) | `+54 11 1234-5678` |
| `VITE_RIAL_EMAIL` | Email oficial | `contacto@rial.com` |
| `VITE_RIAL_TELEFONO` | Teléfono oficial | `+54 11 4321-8765` |
| `VITE_RIAL_POLITICA_COMISION` | Política de comisión/honorarios | `Sin comisión para inquilinos` |
| `VITE_RIAL_POLITICA_RESERVA` | Política de reservas/señas | `Seña 1 mes; reembolsable si no se concreta` |

Si no defines alguna variable, se usan valores por defecto (por ejemplo, "Argentina", "Lunes a Viernes 9-18h", "Consultar con el equipo").

## Ejemplo de `.env`

```env
# IA (Ollama)
VITE_AI_PROVIDER=ollama
VITE_AI_MODEL=llama3.2:3b
VITE_OLLAMA_BASE_URL=http://localhost:11434

# Rial AI Broker - contexto de negocio
VITE_RIAL_TONO=formal pero amigable
VITE_RIAL_CIUDAD=Buenos Aires, Argentina
VITE_RIAL_HORARIOS=Lunes a Viernes 9-18h. Urgencias: WhatsApp 24/7
VITE_RIAL_WHATSAPP=+54 9 11 1234-5678
VITE_RIAL_EMAIL=hola@rial.com
VITE_RIAL_TELEFONO=
VITE_RIAL_POLITICA_COMISION=Sin comisión para inquilinos
VITE_RIAL_POLITICA_RESERVA=Seña equivalente a 1 mes de alquiler; reembolsable si no se concreta
```

## Comportamiento del agente

- **Chatbot principal**: tiene acceso al inventario de propiedades y a las preferencias del usuario para hacer matching y recomendar opciones.
- **Broker en proceso de alquiler**: recibe el paso actual, datos del formulario y la propiedad en proceso para guiar al usuario (documentos, contrato, firma, etc.).

El prompt completo (personalidad, prioridades, playbook, manejo de objeciones, CTAs) está definido en `long-term-rentals/src/utils/rialBrokerPrompt.ts`.
