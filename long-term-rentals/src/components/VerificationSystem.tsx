import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle, Clock, Upload, Shield, Mail, FileText, AlertCircle, Camera } from 'lucide-react'
import { Button, Input, classNames } from './UI'
import { toast } from 'react-hot-toast'
import { api } from '../utils/api'

interface VerificationSystemProps {
  token: string
  user: any
  onUpdate?: () => void
}

type VerificationMethod = 'email' | 'document' | null

export function VerificationSystem({ token, user, onUpdate }: VerificationSystemProps) {
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedMethod, setSelectedMethod] = useState<VerificationMethod>(null)
  
  // Estados para verificación por email
  const [emailCode, setEmailCode] = useState('')
  const [emailCodeSent, setEmailCodeSent] = useState(false)
  const [sendingEmailCode, setSendingEmailCode] = useState(false)
  
  // Estados para verificación por documento
  const [documentUrl, setDocumentUrl] = useState('')
  const [documentType, setDocumentType] = useState<'dni' | 'passport' | 'driver_license'>('dni')
  const [uploadingDocument, setUploadingDocument] = useState(false)

  useEffect(() => {
    if (token) {
      loadVerificationStatus()
    } else {
      setLoading(false)
    }
  }, [token])

  async function loadVerificationStatus() {
    try {
      const data = await api('/api/verification/status', {
        token,
      })
      setStatus(data || { verified: false })
    } catch (error: any) {
      console.error('Error loading verification status:', error)
      // No mostrar toast si es un error de red, solo establecer estado por defecto
      setStatus({ verified: false, emailVerified: false, documentVerified: false })
    } finally {
      setLoading(false)
    }
  }

  async function sendEmailCode() {
    setSendingEmailCode(true)
    try {
      await api('/api/email-verification/send-code', {
        method: 'POST',
        token,
      })
      setEmailCodeSent(true)
      toast.success('Código de verificación enviado a tu email')
    } catch (error: any) {
      toast.error(error.message || 'Error al enviar código')
    } finally {
      setSendingEmailCode(false)
    }
  }

  async function verifyEmailCode() {
    if (!emailCode || emailCode.length !== 6) {
      toast.error('Ingresa un código de 6 dígitos')
      return
    }

    try {
      await api('/api/email-verification/verify', {
        method: 'POST',
        token,
        body: { code: emailCode },
      })
      toast.success('Email verificado exitosamente')
      setEmailCode('')
      setEmailCodeSent(false)
      setSelectedMethod(null)
      await loadVerificationStatus()
      onUpdate?.()
    } catch (error: any) {
      toast.error(error.message || 'Código inválido')
    }
  }

  async function verifyDocument() {
    if (!documentUrl) {
      toast.error('Ingresa la URL del documento')
      return
    }

    if (!documentType) {
      toast.error('Selecciona el tipo de documento')
      return
    }

    setUploadingDocument(true)
    try {
      const result = await api('/api/verification/document', {
        method: 'POST',
        token,
        body: { documentUrl, documentType },
      })

      if (result.verificationResult?.verified) {
        toast.success('Documento verificado exitosamente')
        setDocumentUrl('')
        setSelectedMethod(null)
        await loadVerificationStatus()
        onUpdate?.()
      } else {
        toast.error(result.verificationResult?.reason || 'El documento no pudo ser verificado')
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al verificar documento')
    } finally {
      setUploadingDocument(false)
    }
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    // En producción, aquí subirías el archivo a un servicio de almacenamiento
    // Por ahora, usamos una URL local o simulada
    const reader = new FileReader()
    reader.onload = (e) => {
      const fileUrl = e.target?.result as string
      setDocumentUrl(fileUrl)
      toast.success('Archivo listo. Haz clic en "Verificar Documento" para enviarlo.')
    }
    reader.readAsDataURL(file)
  }

  if (loading) {
    return (
      <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="text-center text-gray-500 dark:text-gray-400">Cargando...</div>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="text-center text-gray-500 dark:text-gray-400">
          Inicia sesión para verificar tu cuenta
        </div>
      </div>
    )
  }

  const isVerified = status?.verified === true
  const emailVerified = status?.emailVerified === true
  const documentVerified = status?.documentVerified === true

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Verificación de Cuenta</h3>
        </div>
        {isVerified ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
            <CheckCircle className="w-3 h-3" />
            Verificado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300">
            <AlertCircle className="w-3 h-3" />
            No verificado
          </span>
        )}
      </div>

      {isVerified ? (
        <div className="space-y-3">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p className="text-green-600 dark:text-green-400 font-medium mb-2">
              ✅ Tu cuenta está verificada
            </p>
            <div className="space-y-1">
              {emailVerified && (
                <p className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email verificado
                </p>
              )}
              {documentVerified && (
                <p className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Documento verificado
                </p>
              )}
            </div>
            {status?.verifiedAt && (
              <p className="text-xs mt-2">Verificado el: {new Date(status.verifiedAt).toLocaleDateString()}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium mb-1">
              ⚠️ Verificación requerida
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              Debes verificar tu cuenta (por email o documento) para poder comprar, alquilar o vender propiedades.
            </p>
          </div>

          {!selectedMethod ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Elige un método de verificación (puedes hacer ambos para mayor seguridad):
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedMethod('email')}
                  className="p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all text-left"
                >
                  <Mail className="w-6 h-6 text-blue-500 mb-2" />
                  <p className="font-medium text-gray-900 dark:text-white">Por Email</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {emailVerified ? '✅ Verificado' : 'Código por email'}
                  </p>
                </button>

                <button
                  onClick={() => setSelectedMethod('document')}
                  className="p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all text-left"
                >
                  <FileText className="w-6 h-6 text-blue-500 mb-2" />
                  <p className="font-medium text-gray-900 dark:text-white">Por Documento</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {documentVerified ? '✅ Verificado' : 'DNI, Pasaporte o Licencia'}
                  </p>
                </button>
              </div>
            </div>
          ) : selectedMethod === 'email' ? (
            <motion.div
              className="space-y-3"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
            >
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Verificación por Email
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedMethod(null)
                    setEmailCode('')
                    setEmailCodeSent(false)
                  }}
                >
                  ← Volver
                </Button>
              </div>

              {!emailCodeSent ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Te enviaremos un código de verificación a tu email.
                  </p>
                  <Button
                    onClick={sendEmailCode}
                    disabled={sendingEmailCode}
                    className="w-full"
                    icon={<Mail className="w-4 h-4" />}
                  >
                    {sendingEmailCode ? 'Enviando...' : 'Enviar código de verificación'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Ingresa el código de 6 dígitos que recibiste por email.
                  </p>
                  <Input
                    placeholder="Código de verificación (6 dígitos)"
                    value={emailCode}
                    onChange={(value) => setEmailCode(value.replace(/\D/g, '').slice(0, 6))}
                    icon={<Mail className="w-4 h-4" />}
                    maxLength={6}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={verifyEmailCode}
                      disabled={emailCode.length !== 6}
                      className="flex-1"
                    >
                      Verificar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEmailCodeSent(false)
                        setEmailCode('')
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              className="space-y-3"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
            >
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Verificación por Documento
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedMethod(null)
                    setDocumentUrl('')
                  }}
                >
                  ← Volver
                </Button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tipo de documento
                  </label>
                  <select
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value as any)}
                  >
                    <option value="dni">DNI / Cédula</option>
                    <option value="passport">Pasaporte</option>
                    <option value="driver_license">Licencia de Conducir</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    URL del documento o subir archivo
                  </label>
                  <div className="space-y-2">
                    <Input
                      placeholder="URL del documento (ej: https://ejemplo.com/documento.jpg)"
                      value={documentUrl}
                      onChange={(value) => setDocumentUrl(value)}
                      icon={<Upload className="w-4 h-4" />}
                    />
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <Button
                        variant="outline"
                        className="w-full"
                        icon={<Camera className="w-4 h-4" />}
                      >
                        O subir archivo desde tu dispositivo
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Sube una <strong>foto</strong> del documento (JPG o PNG), no PDF. El sistema verificará que sea un DNI, cédula o pasaporte real.
                  </p>
                </div>

                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-800 dark:text-blue-200">
                    ℹ️ Solo se aceptan documentos de identidad reales. Se analiza el contenido (OCR) para verificar que sea un DNI, cédula o pasaporte válido y que seas mayor de 18 años.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={verifyDocument}
                    disabled={!documentUrl || uploadingDocument}
                    className="flex-1"
                    icon={<Shield className="w-4 h-4" />}
                  >
                    {uploadingDocument ? 'Verificando...' : 'Verificar Documento'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedMethod(null)
                      setDocumentUrl('')
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  )
}

// Badge de verificación para mostrar en cards
export function VerificationBadge({ verified }: { verified: boolean }) {
  if (!verified) return null

  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
      <CheckCircle className="w-3 h-3" />
      Verificado
    </span>
  )
}
