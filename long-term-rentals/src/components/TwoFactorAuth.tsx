import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Shield, Mail, CheckCircle, XCircle } from 'lucide-react'
import { Button } from './UI'
import { toast } from 'react-hot-toast'
import { api } from '../utils/api'

interface TwoFactorAuthProps {
  token: string
  user: any
  onUpdate?: () => void
}

export function TwoFactorAuth({ token, user, onUpdate }: TwoFactorAuthProps) {
  const [status, setStatus] = useState<{ enabled: boolean; method?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSetup, setShowSetup] = useState(false)

  useEffect(() => {
    if (token) {
      loadStatus()
    } else {
      setLoading(false)
    }
  }, [token])

  async function loadStatus() {
    try {
      const data = await api('/api/2fa/status', { token })
      setStatus(data)
    } catch (error: any) {
      toast.error(error.message || 'Error al cargar estado de 2FA')
    } finally {
      setLoading(false)
    }
  }

  async function enable2FA() {
    try {
      await api('/api/2fa/enable', {
        method: 'POST',
        token,
      })
      toast.success('Autenticación de dos factores activada')
      setShowSetup(false)
      await loadStatus()
      onUpdate?.()
    } catch (error: any) {
      toast.error(error.message || 'Error al activar 2FA')
    }
  }

  async function disable2FA() {
    if (!confirm('¿Estás seguro de desactivar la autenticación de dos factores?')) {
      return
    }

    try {
      await api('/api/2fa/disable', {
        method: 'POST',
        token,
      })
      toast.success('Autenticación de dos factores desactivada')
      await loadStatus()
      onUpdate?.()
    } catch (error: any) {
      toast.error(error.message || 'Error al desactivar 2FA')
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
          <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Autenticación de dos factores</h3>
        </div>
        {status?.enabled ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
            <CheckCircle className="w-3 h-3" />
            Activo
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
            <XCircle className="w-3 h-3" />
            Inactivo
          </span>
        )}
      </div>

      {status?.enabled ? (
        <div className="space-y-3">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p className="text-green-600 dark:text-green-400 font-medium mb-1">
              ✅ 2FA activado por email
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Recibirás un código por email cada vez que inicies sesión
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={disable2FA}
            className="text-red-600 hover:text-red-700"
          >
            Desactivar 2FA
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Agrega una capa extra de seguridad a tu cuenta con autenticación por email
          </p>
          
          {!showSetup ? (
            <Button
              onClick={() => setShowSetup(true)}
              icon={<Shield className="w-4 h-4" />}
            >
              Configurar 2FA
            </Button>
          ) : (
            <motion.div
              className="space-y-3"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
            >
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-3 mb-2">
                  <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Autenticación por Email</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Recibirás un código de 6 dígitos en tu email cada vez que inicies sesión
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                  ⚠️ Requiere que tu email esté verificado
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={enable2FA}
                  className="flex-1"
                  icon={<Shield className="w-4 h-4" />}
                >
                  Activar 2FA
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowSetup(false)}
                >
                  Cancelar
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  )
}
