import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Mail, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react'
import { Button, Input } from './UI'
import { toast } from 'react-hot-toast'
import { api } from '../utils/api'

interface EmailVerificationProps {
  token: string
  user: any
  onUpdate?: () => void
}

export function EmailVerification({ token, user, onUpdate }: EmailVerificationProps) {
  const [status, setStatus] = useState<{ verified: boolean; verifiedAt?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [code, setCode] = useState('')

  useEffect(() => {
    if (token) {
      loadStatus()
    } else {
      setLoading(false)
    }
  }, [token])

  async function loadStatus() {
    try {
      const data = await api('/api/email-verification/status', { token })
      setStatus(data)
    } catch (error: any) {
      toast.error(error.message || 'Error al cargar estado de verificación')
    } finally {
      setLoading(false)
    }
  }

  async function sendCode() {
    setSending(true)
    try {
      await api('/api/email-verification/send-code', {
        method: 'POST',
        token,
      })
      toast.success('Código de verificación enviado a tu email')
    } catch (error: any) {
      toast.error(error.message || 'Error al enviar código')
    } finally {
      setSending(false)
    }
  }

  async function verifyCode() {
    if (!code || code.length !== 6) {
      toast.error('Ingresa un código de 6 dígitos')
      return
    }

    setVerifying(true)
    try {
      await api('/api/email-verification/verify', {
        method: 'POST',
        token,
        body: { code },
      })
      toast.success('Email verificado exitosamente')
      setCode('')
      await loadStatus()
      onUpdate?.()
    } catch (error: any) {
      toast.error(error.message || 'Código inválido')
    } finally {
      setVerifying(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
        <div className="text-center text-gray-500 dark:text-gray-400">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Verificación de Email</h3>
        </div>
        {status?.verified ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
            <CheckCircle className="w-3 h-3" />
            Verificado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300">
            <Clock className="w-3 h-3" />
            Pendiente
          </span>
        )}
      </div>

      {status?.verified ? (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <p className="text-green-600 dark:text-green-400 font-medium mb-1">
            ✅ Tu email está verificado
          </p>
          {status.verifiedAt && (
            <p>Verificado el: {new Date(status.verifiedAt).toLocaleDateString()}</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Verifica tu email para aumentar la seguridad de tu cuenta
          </p>
          
          {code ? (
            <motion.div
              className="space-y-3"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
            >
              <Input
                placeholder="Código de verificación (6 dígitos)"
                value={code}
                onChange={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                icon={<Mail className="w-4 h-4" />}
                maxLength={6}
              />
              <div className="flex gap-2">
                <Button
                  onClick={verifyCode}
                  disabled={verifying || code.length !== 6}
                  className="flex-1"
                >
                  {verifying ? 'Verificando...' : 'Verificar'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCode('')}
                >
                  Cancelar
                </Button>
              </div>
            </motion.div>
          ) : (
            <Button
              onClick={sendCode}
              disabled={sending}
              icon={sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            >
              {sending ? 'Enviando...' : 'Enviar código de verificación'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
