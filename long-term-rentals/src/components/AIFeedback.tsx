/**
 * Componente de Feedback para Aprendizaje de IA
 * Permite al usuario calificar respuestas para mejorar el sistema
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ThumbsUp, ThumbsDown, X } from 'lucide-react'
import { Button } from './UI'

interface AIFeedbackProps {
  knowledgeId: string | null
  question: string
  answer: string
  onFeedback: (helpful: boolean, improvedAnswer?: string) => void
  onClose?: () => void
}

export function AIFeedback({ knowledgeId, question, answer, onFeedback, onClose }: AIFeedbackProps) {
  const [feedback, setFeedback] = useState<'helpful' | 'not_helpful' | null>(null)
  const [improvedAnswer, setImprovedAnswer] = useState('')
  const [showImprovement, setShowImprovement] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  if (!knowledgeId || submitted) return null

  const handleFeedback = async (isHelpful: boolean) => {
    setFeedback(isHelpful ? 'helpful' : 'not_helpful')
    
    if (isHelpful) {
      // Feedback positivo - enviar inmediatamente
      await onFeedback(true)
      setSubmitted(true)
      setTimeout(() => {
        onClose?.()
      }, 2000)
    } else {
      // Feedback negativo - mostrar opción de mejorar
      setShowImprovement(true)
    }
  }

  const handleSubmitImprovement = async () => {
    if (improvedAnswer.trim()) {
      await onFeedback(false, improvedAnswer)
    } else {
      await onFeedback(false)
    }
    setSubmitted(true)
    setTimeout(() => {
      onClose?.()
    }, 2000)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="mt-4 rounded-lg border border-rial-cream-dark/50 bg-rial-cream-dark/35 p-4 dark:border-slate-600 dark:bg-slate-800/70"
      >
        <div className="mb-3 flex items-start justify-between">
          <p className="text-sm font-medium text-rial-navy dark:text-rial-cream">
            ¿Esta respuesta te fue útil?
          </p>
          {onClose && (
            <button
              onClick={onClose}
              className="text-rial-navy hover:text-rial-gold dark:text-rial-gold dark:hover:text-rial-cream"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {!showImprovement ? (
          <div className="flex gap-2">
            <button
              onClick={() => handleFeedback(true)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                feedback === 'helpful'
                  ? 'bg-green-500 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-green-900/20 border border-green-300 dark:border-green-700'
              }`}
            >
              <ThumbsUp className="w-4 h-4" />
              <span className="text-sm font-medium">Sí, útil</span>
            </button>
            <button
              onClick={() => handleFeedback(false)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                feedback === 'not_helpful'
                  ? 'bg-red-500 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-300 dark:border-red-700'
              }`}
            >
              <ThumbsDown className="w-4 h-4" />
              <span className="text-sm font-medium">No, mejorar</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-rial-navy dark:text-rial-cream">
              ¿Cómo podríamos mejorar esta respuesta?
            </p>
            <textarea
              value={improvedAnswer}
              onChange={(e) => setImprovedAnswer(e.target.value)}
              placeholder="Escribe cómo debería ser la respuesta ideal..."
              className="w-full resize-none rounded-lg border border-rial-cream-dark/50 bg-white px-3 py-2 text-sm text-rial-navy focus:outline-none focus:ring-2 focus:ring-rial-gold dark:border-slate-600 dark:bg-slate-900 dark:text-rial-cream"
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                onClick={handleSubmitImprovement}
                className="flex-1"
                size="sm"
              >
                Enviar mejora
              </Button>
              <Button
                onClick={() => {
                  setShowImprovement(false)
                  setFeedback(null)
                }}
                variant="ghost"
                size="sm"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {submitted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 text-sm text-green-600 dark:text-green-400 text-center"
          >
            ¡Gracias por tu feedback! Esto nos ayuda a mejorar. 😊
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
