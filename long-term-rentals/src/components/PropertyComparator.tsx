 import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Trash2, GitCompare } from 'lucide-react'
import { Button, LoadingSpinner, classNames } from './UI'
import { toast } from 'react-hot-toast'
import { api } from '../utils/api'

interface PropertyComparatorProps {
  token?: string
  user?: any
  onClose: () => void
  selectedIds?: number[]
  onSelectIds?: (ids: number[]) => void
  /** Lista actual de propiedades (del listado o mock) para comparar cuando la API no tiene datos */
  properties?: Array<{ property: any; averageRating: number; reviewsCount: number; isAvailable: boolean }>
}

interface Property {
  id: number
  title: string
  location: string
  price: number
  description: string
  images: string[]
  owner?: any
  bedrooms?: number | null
  bathrooms?: number | null
  area?: number | null
  propertyType?: string | null
  verified: boolean
  averageRating: number
  reviewsCount: number
  isAvailable: boolean
  createdAt: string
}

export function PropertyComparator({ token, onClose, selectedIds: propSelectedIds, onSelectIds, properties: propsProperties = [] }: PropertyComparatorProps) {
  const { t } = useTranslation()
  const [comparison, setComparison] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>(propSelectedIds || [])
  const [maxSelections] = useState(4)

  // Sincronizar con props
  useEffect(() => {
    if (propSelectedIds) {
      setSelectedIds(propSelectedIds)
    }
  }, [propSelectedIds])

  // Actualizar props cuando cambian los IDs locales
  const updateSelectedIds = (ids: number[]) => {
    setSelectedIds(ids)
    onSelectIds?.(ids)
  }

  /** Construye la comparación desde la lista local (propiedades del listado/mock) */
  function buildComparisonFromLocal(): any {
    const selected = selectedIds
      .map((id) => propsProperties.find((it) => it.property?.id === id))
      .filter(Boolean) as Array<{ property: any; averageRating: number; reviewsCount: number; isAvailable: boolean }>
    if (selected.length !== selectedIds.length) return null
    const properties = selected.map((it) => ({
      id: it.property.id,
      title: it.property.title,
      location: it.property.location,
      price: it.property.price,
      description: it.property.description ?? '',
      images: Array.isArray(it.property.images) ? it.property.images : [],
      owner: it.property.owner ?? null,
      bedrooms: it.property.bedrooms ?? null,
      bathrooms: it.property.bathrooms ?? null,
      area: it.property.area ?? null,
      propertyType: it.property.propertyType ?? it.property.type ?? null,
      verified: Boolean(it.property.verified),
      averageRating: Number(it.averageRating) || 0,
      reviewsCount: Number(it.reviewsCount) || 0,
      isAvailable: Boolean(it.isAvailable),
      createdAt: it.property.createdAt ?? new Date().toISOString(),
    }))
    const prices = properties.map((p) => p.price)
    const ratings = properties.map((p) => p.averageRating)
    return {
      properties,
      comparison: {
        priceRange: {
          min: Math.min(...prices),
          max: Math.max(...prices),
          average: prices.reduce((a, b) => a + b, 0) / prices.length,
        },
        ratingRange: {
          min: Math.min(...ratings),
          max: Math.max(...ratings),
          average: ratings.reduce((a, b) => a + b, 0) / ratings.length,
        },
        availableCount: properties.filter((p) => p.isAvailable).length,
        verifiedCount: properties.filter((p) => p.verified).length,
      },
    }
  }

  async function compareProperties() {
    if (selectedIds.length < 2) {
      toast.error(t('comparator.minTwoRequired'))
      return
    }
    if (selectedIds.length > 4) {
      toast.error(t('comparator.maxFourAllowed'))
      return
    }

    setLoading(true)
    try {
      const data = await api('/api/comparison/compare', {
        method: 'POST',
        token: token ?? undefined,
        body: { propertyIds: selectedIds },
      })
      setComparison(data)
      toast.success(t('comparator.compareSuccess'))
    } catch (error: any) {
      const fallback = buildComparisonFromLocal()
      if (fallback) {
        setComparison(fallback)
        toast.success(t('comparator.compareSuccess'))
      } else {
        toast.error(error?.message ?? t('comparator.compareError'))
      }
    } finally {
      setLoading(false)
    }
  }

  function toggleSelection(id: number) {
    if (selectedIds.includes(id)) {
      updateSelectedIds(selectedIds.filter((i) => i !== id))
    } else {
      if (selectedIds.length >= maxSelections) {
        toast.error(t('comparator.maxReached', { max: maxSelections }))
        return
      }
      updateSelectedIds([...selectedIds, id])
    }
  }

  function clearComparison() {
    setComparison(null)
    updateSelectedIds([])
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
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('comparator.title')}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t('comparator.subtitle')}
            </p>
          </div>
          <Button variant="outline" onClick={onClose} icon={<X className="w-4 h-4" />}>
            {t('comparator.close')}
          </Button>
        </div>

        {!comparison ? (
          <div className="flex-1 overflow-y-auto">
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t('comparator.selectUpTo')}
              </p>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {t('comparator.selectedCount')}: {selectedIds.length}/{maxSelections}
                </span>
                {selectedIds.length >= 2 && (
                  <Button
                    variant="primary"
                    onClick={compareProperties}
                    icon={<GitCompare className="w-4 h-4" />}
                    disabled={loading}
                  >
                    {loading ? t('comparator.comparing') : t('comparator.compare')}
                  </Button>
                )}
              </div>
            </div>
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              <GitCompare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t('comparator.selectFromList')}</p>
              <p className="text-sm mt-2">
                {t('comparator.useCompareButton')}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="mb-4 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{t('comparator.resultTitle')}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {comparison.properties.length} {t('comparator.propertiesCompared')}
                </p>
              </div>
              <Button variant="outline" onClick={clearComparison} icon={<Trash2 className="w-4 h-4" />}>
                {t('comparator.newComparison')}
              </Button>
            </div>

            {/* Resumen de comparación */}
            {comparison.comparison && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{t('comparator.averagePrice')}</div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    ${comparison.comparison.priceRange.average.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    ${comparison.comparison.priceRange.min} - ${comparison.comparison.priceRange.max}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{t('comparator.averageRating')}</div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {comparison.comparison.ratingRange.average.toFixed(1)} ⭐
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {comparison.comparison.ratingRange.min} - {comparison.comparison.ratingRange.max}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{t('comparator.available')}</div>
                  <div className="text-lg font-bold text-green-600 dark:text-green-400">
                    {comparison.comparison.availableCount}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{t('comparator.verified')}</div>
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {comparison.comparison.verifiedCount}
                  </div>
                </div>
              </div>
            )}

            {/* Tabla comparativa */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left p-3 text-sm font-semibold text-gray-900 dark:text-white">{t('comparator.property')}</th>
                    {comparison.properties.map((prop: Property) => (
                      <th key={prop.id} className="text-center p-3 text-sm font-semibold text-gray-900 dark:text-white">
                        <div className="max-w-[200px]">
                          <div className="font-medium truncate">{prop.title}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{prop.location}</div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="p-3 text-sm font-medium text-gray-900 dark:text-white">{t('comparator.price')}</td>
                    {comparison.properties.map((prop: Property) => (
                      <td key={prop.id} className="p-3 text-center">
                        <div className="font-bold text-gray-900 dark:text-white">${prop.price}</div>
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="p-3 text-sm font-medium text-gray-900 dark:text-white">{t('comparator.rating')}</td>
                    {comparison.properties.map((prop: Property) => (
                      <td key={prop.id} className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-medium">{prop.averageRating.toFixed(1)}</span>
                          <span className="text-yellow-500">⭐</span>
                          <span className="text-xs text-gray-500">({prop.reviewsCount})</span>
                        </div>
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="p-3 text-sm font-medium text-gray-900 dark:text-white">{t('comparator.bedrooms')}</td>
                    {comparison.properties.map((prop: Property) => (
                      <td key={prop.id} className="p-3 text-center text-gray-600 dark:text-gray-400">
                        {prop.bedrooms || '-'}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="p-3 text-sm font-medium text-gray-900 dark:text-white">{t('comparator.bathrooms')}</td>
                    {comparison.properties.map((prop: Property) => (
                      <td key={prop.id} className="p-3 text-center text-gray-600 dark:text-gray-400">
                        {prop.bathrooms || '-'}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="p-3 text-sm font-medium text-gray-900 dark:text-white">{t('comparator.area')}</td>
                    {comparison.properties.map((prop: Property) => (
                      <td key={prop.id} className="p-3 text-center text-gray-600 dark:text-gray-400">
                        {prop.area ? `${prop.area} m²` : '-'}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="p-3 text-sm font-medium text-gray-900 dark:text-white">{t('comparator.type')}</td>
                    {comparison.properties.map((prop: Property) => (
                      <td key={prop.id} className="p-3 text-center text-gray-600 dark:text-gray-400">
                        {prop.propertyType || '-'}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="p-3 text-sm font-medium text-gray-900 dark:text-white">{t('comparator.availability')}</td>
                    {comparison.properties.map((prop: Property) => (
                      <td key={prop.id} className="p-3 text-center">
                        <span
                          className={classNames(
                            'px-2 py-1 rounded-full text-xs font-medium',
                            prop.isAvailable
                              ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                              : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                          )}
                        >
                          {prop.isAvailable ? t('comparator.availableLabel') : t('comparator.occupied')}
                        </span>
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="p-3 text-sm font-medium text-gray-900 dark:text-white">{t('comparator.verifiedLabel')}</td>
                    {comparison.properties.map((prop: Property) => (
                      <td key={prop.id} className="p-3 text-center">
                        {prop.verified ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                            ✓ {t('comparator.verifiedLabel')}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

// Componente para agregar a las tarjetas de propiedades
export function CompareButton({ propertyId, onSelect }: { propertyId: number; onSelect: (id: number) => void }) {
  const { t } = useTranslation()
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onSelect(propertyId)
      }}
      className="p-2 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-lg hover:bg-white dark:hover:bg-gray-700 transition-all"
      title={t('comparator.addToCompare')}
    >
      <GitCompare className="w-4 h-4 text-gray-600 dark:text-gray-400" />
    </button>
  )
}

