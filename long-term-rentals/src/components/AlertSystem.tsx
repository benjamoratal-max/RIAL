import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Plus, X, Trash2, Edit2, Check, AlertCircle, DollarSign, MapPin, Home } from 'lucide-react'
import { Button, Input, classNames } from './UI'
import { toast } from 'react-hot-toast'

interface Alert {
  id: number
  type: string
  location?: string | null
  minPrice?: number | null
  maxPrice?: number | null
  propertyId?: number | null
  isActive: boolean
  createdAt: string
}

interface AlertSystemProps {
  token: string
  user: any
  onClose: () => void
}

export function AlertSystem({ token, user, onClose }: AlertSystemProps) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null)
  const [form, setForm] = useState({
    type: 'new_property',
    location: '',
    minPrice: '',
    maxPrice: '',
    propertyId: '',
  })

  useEffect(() => {
    if (token) {
      loadAlerts()
    }
  }, [token])

  async function loadAlerts() {
    try {
      const res = await fetch('/api/alerts', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      if (!res.ok) throw new Error('Error al cargar alertas')
      const data = await res.json()
      setAlerts(data)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  async function createAlert() {
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: form.type,
          location: form.location || null,
          minPrice: form.minPrice ? Number(form.minPrice) : null,
          maxPrice: form.maxPrice ? Number(form.maxPrice) : null,
          propertyId: form.propertyId ? Number(form.propertyId) : null,
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al crear alerta')
      }
      await loadAlerts()
      setShowForm(false)
      setForm({ type: 'new_property', location: '', minPrice: '', maxPrice: '', propertyId: '' })
      toast.success('Alerta creada exitosamente')
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  async function toggleAlert(id: number, isActive: boolean) {
    try {
      const res = await fetch(`/api/alerts/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !isActive }),
      })
      if (!res.ok) throw new Error('Error al actualizar alerta')
      await loadAlerts()
      toast.success('Alerta actualizada')
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  async function deleteAlert(id: number) {
    if (!confirm('¿Estás seguro de eliminar esta alerta?')) return
    try {
      const res = await fetch(`/api/alerts/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      if (!res.ok) throw new Error('Error al eliminar alerta')
      await loadAlerts()
      toast.success('Alerta eliminada')
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  function getAlertTypeLabel(type: string) {
    const labels: Record<string, string> = {
      price_drop: 'Baja de precio',
      availability: 'Disponibilidad',
      new_property: 'Nueva propiedad',
      custom: 'Personalizada',
    }
    return labels[type] || type
  }

  function getAlertTypeIcon(type: string) {
    switch (type) {
      case 'price_drop':
        return <DollarSign className="w-4 h-4" />
      case 'availability':
        return <Home className="w-4 h-4" />
      case 'new_property':
        return <Bell className="w-4 h-4" />
      default:
        return <AlertCircle className="w-4 h-4" />
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
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Alertas Inteligentes</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Recibe notificaciones cuando haya propiedades que coincidan con tus criterios
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={() => {
                setShowForm(true)
                setEditingAlert(null)
                setForm({ type: 'new_property', location: '', minPrice: '', maxPrice: '', propertyId: '' })
              }}
              icon={<Plus className="w-4 h-4" />}
            >
              Nueva Alerta
            </Button>
            <Button variant="outline" onClick={onClose} icon={<X className="w-4 h-4" />}>
              Cerrar
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {showForm && (
            <motion.div
              className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <h3 className="font-semibold mb-4 text-gray-900 dark:text-white">
                {editingAlert ? 'Editar Alerta' : 'Nueva Alerta'}
              </h3>
              <div className="grid md:grid-cols-2 gap-3">
                <select
                  className="input"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  <option value="new_property">Nueva Propiedad</option>
                  <option value="price_drop">Baja de Precio</option>
                  <option value="availability">Disponibilidad</option>
                </select>
                <Input
                  placeholder="Ubicación"
                  value={form.location}
                  onChange={(value) => setForm({ ...form, location: value })}
                  icon={<MapPin className="w-4 h-4" />}
                />
                <Input
                  type="number"
                  placeholder="Precio mínimo"
                  value={form.minPrice}
                  onChange={(value) => setForm({ ...form, minPrice: value })}
                  icon={<DollarSign className="w-4 h-4" />}
                />
                <Input
                  type="number"
                  placeholder="Precio máximo"
                  value={form.maxPrice}
                  onChange={(value) => setForm({ ...form, maxPrice: value })}
                  icon={<DollarSign className="w-4 h-4" />}
                />
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
                <Button onClick={createAlert} icon={<Check className="w-4 h-4" />}>
                  {editingAlert ? 'Actualizar' : 'Crear'} Alerta
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">Cargando alertas...</div>
          ) : alerts.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No tienes alertas configuradas</p>
              <p className="text-sm mt-2">Crea una alerta para recibir notificaciones</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <motion.div
                  key={alert.id}
                  className={classNames(
                    'p-4 rounded-xl border',
                    alert.isActive
                      ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                      : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 opacity-60'
                  )}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={classNames(
                          'p-2 rounded-lg',
                          alert.isActive
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300'
                            : 'bg-gray-200 dark:bg-gray-600 text-gray-500'
                        )}>
                          {getAlertTypeIcon(alert.type)}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {getAlertTypeLabel(alert.type)}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {alert.location && <span>📍 {alert.location}</span>}
                            {alert.minPrice && <span className="ml-2">💰 ${alert.minPrice}</span>}
                            {alert.maxPrice && <span> - ${alert.maxPrice}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Creada: {new Date(alert.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleAlert(alert.id, alert.isActive)}
                        icon={alert.isActive ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                      >
                        {alert.isActive ? 'Desactivar' : 'Activar'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteAlert(alert.id)}
                        icon={<Trash2 className="w-4 h-4" />}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

