import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, Shield, Mail, FileText, AlertCircle, Camera } from 'lucide-react'
import { Button, Input, classNames } from './UI'
import { toast } from 'react-hot-toast'
import { compressIdentityImageToJpegDataUrl } from '../utils/compressIdentityImage'

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
  const [documentDataUrl, setDocumentDataUrl] = useState('')
  const [documentType, setDocumentType] = useState<'dni' | 'passport'>('dni')
  const [uploadingDocument, setUploadingDocument] = useState(false)
  const [idPreviewName, setIdPreviewName] = useState('')

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
      toast.success('Email confirmado. Para operar en RIAL aún debes verificar tu identidad con cédula o pasaporte.')
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
    if (!documentDataUrl || !documentDataUrl.startsWith('data:image/')) {
      toast.error('Sube una foto clara de tu cédula o pasaporte (JPG o PNG)')
      return
    }

    setUploadingDocument(true)
    try {
      const result = await api('/api/verification/document', {
        method: 'POST',
        token,
        body: { documentUrl: documentDataUrl, documentType },
      })

      if (result.verificationResult?.verified) {
        toast.success('Identidad verificada. Tu cuenta ya está lista para operaciones que lo requieran.')
        setDocumentDataUrl('')
        setIdPreviewName('')
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

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const okType = /^image\/(jpeg|jpg|png|webp)$/i.test(file.type)
    if (!okType) {
      toast.error('Usa una imagen JPG, PNG o WebP')
      return
    }
    const maxBytes = 15 * 1024 * 1024
    if (file.size > maxBytes) {
      toast.error('La imagen es demasiado grande (máx. 15 MB)')
      return
    }

    try {
      const dataUrl = await compressIdentityImageToJpegDataUrl(file)
      setDocumentDataUrl(dataUrl)
      setIdPreviewName(file.name)
      toast.success('Foto lista. Pulsa «Verificar identidad» para enviarla al sistema.')
    } catch {
      toast.error('No se pudo procesar la imagen. Prueba con otra foto.')
    }
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
          <Shield className="h-5 w-5 text-rial-navy dark:text-rial-gold" />
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
              Para comprar, alquilar o vender debes <strong>verificar tu identidad</strong> subiendo una foto de tu{' '}
              <strong>cédula o pasaporte</strong>. Confirmar el email es recomendable pero no sustituye el documento.
            </p>
          </div>

          {!selectedMethod ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Confirma tu email y sube una foto de tu documento (puedes hacer ambos):
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedMethod('email')}
                  className="rounded-lg border-2 border-rial-cream-dark/50 p-4 text-left transition-all hover:border-rial-gold dark:border-slate-600 dark:hover:border-rial-gold"
                >
                  <Mail className="mb-2 h-6 w-6 text-rial-navy dark:text-rial-gold" />
                  <p className="font-medium text-gray-900 dark:text-white">Email</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {emailVerified ? '✅ Confirmado' : 'Código a tu correo'}
                  </p>
                </button>

                <button
                  onClick={() => setSelectedMethod('document')}
                  className="rounded-lg border-2 border-rial-cream-dark/50 p-4 text-left transition-all hover:border-rial-gold dark:border-slate-600 dark:hover:border-rial-gold"
                >
                  <FileText className="mb-2 h-6 w-6 text-rial-navy dark:text-rial-gold" />
                  <p className="font-medium text-gray-900 dark:text-white">Cédula o pasaporte</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {documentVerified ? '✅ Identidad verificada' : 'Foto obligatoria'}
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
                    Te enviaremos un código a tu email para confirmar que es tuyo (no activa por sí solo la verificación
                    de identidad).
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
                  Verificación de identidad
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedMethod(null)
                    setDocumentDataUrl('')
                    setIdPreviewName('')
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
                    className="w-full rounded-xl border border-rial-cream-dark/50 bg-white px-3 py-2 text-rial-navy focus:outline-none focus:ring-2 focus:ring-rial-gold dark:border-slate-600 dark:bg-slate-900 dark:text-rial-cream"
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value as 'dni' | 'passport')}
                  >
                    <option value="dni">Cédula / DNI</option>
                    <option value="passport">Pasaporte</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Foto del documento (obligatorio)
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handleFileUpload}
                      className="absolute inset-0 z-10 w-full h-full cursor-pointer opacity-0"
                    />
                    <Button variant="outline" className="w-full pointer-events-none" icon={<Camera className="w-4 h-4" />}>
                      Elegir foto (JPG, PNG o WebP)
                    </Button>
                  </div>
                  {idPreviewName ? (
                    <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                      Archivo: <span className="font-medium">{idPreviewName}</span>
                    </p>
                  ) : null}
                  {documentDataUrl ? (
                    <div className="mt-3 overflow-hidden rounded-lg border border-rial-cream-dark/50 dark:border-slate-600">
                      <img src={documentDataUrl} alt="Vista previa" className="max-h-48 w-full object-contain bg-black/5 dark:bg-black/30" />
                    </div>
                  ) : null}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Toma una foto <strong>frontal</strong>, bien iluminada, sin reflejos. Para pasaporte, incluye la página
                    con datos y las <strong>líneas MRZ</strong> inferiores. No uses PDF.
                  </p>
                </div>

                <div className="rounded-lg border border-rial-cream-dark/50 bg-rial-cream-dark/30 p-3 dark:border-slate-600 dark:bg-slate-800/70">
                  <p className="text-xs text-rial-navy dark:text-rial-cream">
                    El archivo pasa por el verificador automático de RIAL (tamaño, proporción, OCR y MRZ en pasaportes)
                    para comprobar que corresponde a un documento de identidad real y que la edad sea coherente con mayor
                    de edad cuando los datos lo permiten.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={verifyDocument}
                    disabled={!documentDataUrl || uploadingDocument}
                    className="flex-1"
                    icon={<Shield className="w-4 h-4" />}
                  >
                    {uploadingDocument ? 'Verificando...' : 'Verificar identidad'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedMethod(null)
                      setDocumentDataUrl('')
                    setIdPreviewName('')
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
