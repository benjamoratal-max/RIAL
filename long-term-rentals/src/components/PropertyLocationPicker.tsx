import React, { useCallback, useEffect, useMemo } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import marker2x from 'leaflet/dist/images/marker-icon-2x.png'
import marker from 'leaflet/dist/images/marker-icon.png'
import shadow from 'leaflet/dist/images/marker-shadow.png'
import { useTranslation } from 'react-i18next'
import { Button } from './UI'
import { MapPin, Trash2 } from 'lucide-react'

L.Icon.Default.mergeOptions({
  iconRetinaUrl: marker2x,
  iconUrl: marker,
  shadowUrl: shadow,
})

const DEFAULT_CENTER: [number, number] = [25.7617, -80.1918]

export type MapLocationValue = { lat: number; lng: number }

interface PropertyLocationPickerProps {
  value: MapLocationValue | null
  onChange: (next: MapLocationValue | null) => void
}

function MapClickLayer({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function FlyToMarker({ point }: { point: MapLocationValue | null }) {
  const map = useMap()
  useEffect(() => {
    if (!point) return
    map.flyTo([point.lat, point.lng], Math.max(map.getZoom(), 15), { duration: 0.35 })
  }, [map, point?.lat, point?.lng])
  return null
}

export function PropertyLocationPicker({ value, onChange }: PropertyLocationPickerProps) {
  const { t } = useTranslation()
  const center = useMemo<[number, number]>(() => (value ? [value.lat, value.lng] : DEFAULT_CENTER), [value])

  const handlePick = useCallback(
    (lat: number, lng: number) => {
      onChange({ lat, lng })
    },
    [onChange]
  )

  const markerEvents = useMemo(
    () => ({
      dragend(e: L.LeafletEvent) {
        const m = e.target as L.Marker
        const ll = m.getLatLng()
        onChange({ lat: ll.lat, lng: ll.lng })
      },
    }),
    [onChange]
  )

  return (
    <div className="rounded-xl border border-rial-cream-dark/50 bg-rial-cream/40 p-3 dark:border-slate-600 dark:bg-slate-800/50">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-rial-navy dark:text-rial-cream">{t('createProperty.mapPinTitle')}</p>
        {value ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange(null)}
            icon={<Trash2 className="h-3.5 w-3.5" />}
          >
            {t('createProperty.mapPinClear')}
          </Button>
        ) : null}
      </div>
      <p className="mb-2 text-xs text-rial-muted dark:text-slate-400">{t('createProperty.mapPinHint')}</p>
      <div className="relative z-0 h-56 w-full overflow-hidden rounded-lg border border-slate-200/80 dark:border-slate-600">
        <MapContainer center={center} zoom={value ? 15 : 12} className="h-full w-full" scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickLayer onPick={handlePick} />
          <FlyToMarker point={value} />
          {value ? (
            <Marker position={[value.lat, value.lng]} draggable eventHandlers={markerEvents} />
          ) : null}
        </MapContainer>
      </div>
      {value ? (
        <p className="mt-2 flex items-center gap-1.5 font-mono text-[11px] text-slate-600 dark:text-slate-400">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
        </p>
      ) : null}
    </div>
  )
}
