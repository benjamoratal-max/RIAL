import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Flag, FileText, AlertTriangle, CheckCircle2, X, Image as ImageIcon } from 'lucide-react'
import { Button, LoadingSpinner, classNames } from './UI'
import { api } from '../utils/api'
import { getErrorMessage } from '../utils/errorHandler'
import { toast } from 'react-hot-toast'

interface ComplianceListingsReviewPanelProps {
  token: string
  onClose: () => void
}

type ListingItem = {
  property: {
    id: number
    title: string
    location: string | null
    price: number | null
    createdAt: string
    verified?: boolean
  }
  owner?: {
    id: number
    name: string | null
    email: string | null
    role: string
  } | null
  flags: string[]
}

const FLAG_LABELS: Record<string, string> = {
  SIN_IMAGENES: 'Sin imágenes',
  POCAS_IMAGENES: 'Pocas imágenes',
  DESCRIPCION_CORTA: 'Descripción corta',
  SOSPECHA_DUPLICADO: 'Posible duplicado',
  LISTING_NO_VERIFICADO: 'Listing no verificado',
  SIN_OWNER_ASIGNADO: 'Sin owner asignado',
}

export function ComplianceListingsReviewPanel({ token, onClose }: ComplianceListingsReviewPanelProps) {
  const [items, setItems] = useState<ListingItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      loadListings()
    }
  }, [token])

  async function loadListings() {
    setLoading(true)
    try {
      const data = await api('/api/compliance/listings/review', { token })
      setItems(Array.isArray(data?.items) ? data.items : [])
    } catch (err) {
      toast.error(getErrorMessage(err))
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 bg-black/40 backdrop-blur flex items-center justify-center p-4 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Listings review & flags
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Panel de calidad de publicaciones (solo compliance/admin).
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onClose} icon={<X className="w-4 h-4" />}>
            Cerrar
          </Button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner size="lg" text="Cargando publicaciones para revisión..." />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {items.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-10">
                No hay publicaciones con flags relevantes en este momento.
              </div>
            ) : (
              items.map((item) => {
                const hasFlags = item.flags && item.flags.length > 0
                return (
                  <div
                    key={item.property.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/70"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        <div className="truncate">
                          <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {item.property.title || 'Sin título'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {item.property.location || 'Ubicación no disponible'}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                        {item.owner && (
                          <span>
                            Owner: {item.owner.name || 'Sin nombre'} · {item.owner.email || 'Sin email'} ·{' '}
                            {item.owner.role}
                          </span>
                        )}
                        <span>
                          ID: #{item.property.id}
                        </span>
                        <span
                          className={classNames(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold',
                            item.property.verified
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'
                              : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                          )}
                        >
                          {item.property.verified ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              Verificado
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-3 h-3" />
                              No verificado
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                      <div className="flex flex-wrap gap-1 justify-end">
                        {hasFlags ? (
                          item.flags.map((flag) => (
                            <span
                              key={flag}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
                            >
                              {flag === 'SIN_IMAGENES' || flag === 'POCAS_IMAGENES' ? (
                                <ImageIcon className="w-3 h-3" />
                              ) : (
                                <AlertTriangle className="w-3 h-3" />
                              )}
                              {FLAG_LABELS[flag] || flag}
                            </span>
                          ))
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Sin flags relevantes
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            toast('Acción avanzada pendiente de implementar (abrir detalle de listing).')
                          }}
                        >
                          Ver detalle
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

