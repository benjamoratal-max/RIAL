import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Phone } from 'lucide-react'
import { classNames } from './UI'

interface Country {
  code: string
  name: string
  flag: string
  dialCode: string
}

// Lista completa de países con prefijos telefónicos y banderas
const COUNTRIES: Country[] = [
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', dialCode: '+54' },
  { code: 'US', name: 'United States', flag: '🇺🇸', dialCode: '+1' },
  { code: 'MX', name: 'México', flag: '🇲🇽', dialCode: '+52' },
  { code: 'ES', name: 'España', flag: '🇪🇸', dialCode: '+34' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴', dialCode: '+57' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱', dialCode: '+56' },
  { code: 'PE', name: 'Perú', flag: '🇵🇪', dialCode: '+51' },
  { code: 'VE', name: 'Venezuela', flag: '🇻🇪', dialCode: '+58' },
  { code: 'EC', name: 'Ecuador', flag: '🇪🇨', dialCode: '+593' },
  { code: 'BO', name: 'Bolivia', flag: '🇧🇴', dialCode: '+591' },
  { code: 'PY', name: 'Paraguay', flag: '🇵🇾', dialCode: '+595' },
  { code: 'UY', name: 'Uruguay', flag: '🇺🇾', dialCode: '+598' },
  { code: 'BR', name: 'Brasil', flag: '🇧🇷', dialCode: '+55' },
  { code: 'CR', name: 'Costa Rica', flag: '🇨🇷', dialCode: '+506' },
  { code: 'PA', name: 'Panamá', flag: '🇵🇦', dialCode: '+507' },
  { code: 'GT', name: 'Guatemala', flag: '🇬🇹', dialCode: '+502' },
  { code: 'HN', name: 'Honduras', flag: '🇭🇳', dialCode: '+504' },
  { code: 'NI', name: 'Nicaragua', flag: '🇳🇮', dialCode: '+505' },
  { code: 'SV', name: 'El Salvador', flag: '🇸🇻', dialCode: '+503' },
  { code: 'DO', name: 'República Dominicana', flag: '🇩🇴', dialCode: '+1' },
  { code: 'CU', name: 'Cuba', flag: '🇨🇺', dialCode: '+53' },
  { code: 'PR', name: 'Puerto Rico', flag: '🇵🇷', dialCode: '+1' },
  { code: 'JM', name: 'Jamaica', flag: '🇯🇲', dialCode: '+1' },
  { code: 'CA', name: 'Canadá', flag: '🇨🇦', dialCode: '+1' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', dialCode: '+44' },
  { code: 'FR', name: 'France', flag: '🇫🇷', dialCode: '+33' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', dialCode: '+49' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹', dialCode: '+39' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹', dialCode: '+351' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', dialCode: '+31' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪', dialCode: '+32' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭', dialCode: '+41' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹', dialCode: '+43' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪', dialCode: '+46' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴', dialCode: '+47' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰', dialCode: '+45' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮', dialCode: '+358' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱', dialCode: '+48' },
  { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿', dialCode: '+420' },
  { code: 'GR', name: 'Greece', flag: '🇬🇷', dialCode: '+30' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪', dialCode: '+353' },
  { code: 'RU', name: 'Russia', flag: '🇷🇺', dialCode: '+7' },
  { code: 'CN', name: 'China', flag: '🇨🇳', dialCode: '+86' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', dialCode: '+81' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷', dialCode: '+82' },
  { code: 'IN', name: 'India', flag: '🇮🇳', dialCode: '+91' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', dialCode: '+61' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿', dialCode: '+64' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦', dialCode: '+27' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬', dialCode: '+20' },
  { code: 'IL', name: 'Israel', flag: '🇮🇱', dialCode: '+972' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', dialCode: '+971' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', dialCode: '+966' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷', dialCode: '+90' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭', dialCode: '+66' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳', dialCode: '+84' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭', dialCode: '+63' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩', dialCode: '+62' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾', dialCode: '+60' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬', dialCode: '+65' },
  { code: 'HK', name: 'Hong Kong', flag: '🇭🇰', dialCode: '+852' },
  { code: 'TW', name: 'Taiwan', flag: '🇹🇼', dialCode: '+886' },
]

interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function PhoneInput({ 
  value, 
  onChange, 
  placeholder = "Teléfono",
  className = "",
  disabled = false
}: PhoneInputProps) {
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]) // Argentina por defecto
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Detectar país basado en timezone o idioma del navegador
  const detectCountry = () => {
    try {
      // Intentar detectar por timezone
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const locale = navigator.language || 'es-AR'
      
      // Mapeo directo de timezones completos a países
      const timezoneToCountry: Record<string, string> = {
        'America/Argentina/Buenos_Aires': 'AR',
        'America/Argentina/Cordoba': 'AR',
        'America/Argentina/Mendoza': 'AR',
        'America/Mexico_City': 'MX',
        'America/New_York': 'US',
        'America/Los_Angeles': 'US',
        'America/Chicago': 'US',
        'America/Denver': 'US',
        'America/Phoenix': 'US',
        'Europe/Madrid': 'ES',
        'America/Bogota': 'CO',
        'America/Santiago': 'CL',
        'America/Lima': 'PE',
        'America/Caracas': 'VE',
        'America/Guayaquil': 'EC',
        'America/La_Paz': 'BO',
        'America/Asuncion': 'PY',
        'America/Montevideo': 'UY',
        'America/Sao_Paulo': 'BR',
        'America/Costa_Rica': 'CR',
        'America/Panama': 'PA',
        'America/Guatemala': 'GT',
        'America/Tegucigalpa': 'HN',
        'America/Managua': 'NI',
        'America/El_Salvador': 'SV',
        'America/Havana': 'CU',
        'America/Santo_Domingo': 'DO',
        'America/Puerto_Rico': 'PR',
        'America/Jamaica': 'JM',
        'America/Toronto': 'CA',
        'America/Vancouver': 'CA',
        'Europe/London': 'GB',
        'Europe/Paris': 'FR',
        'Europe/Berlin': 'DE',
        'Europe/Rome': 'IT',
        'Europe/Lisbon': 'PT',
        'Europe/Amsterdam': 'NL',
        'Europe/Brussels': 'BE',
        'Europe/Zurich': 'CH',
        'Europe/Vienna': 'AT',
        'Europe/Stockholm': 'SE',
        'Europe/Oslo': 'NO',
        'Europe/Copenhagen': 'DK',
        'Europe/Helsinki': 'FI',
        'Europe/Warsaw': 'PL',
        'Europe/Prague': 'CZ',
        'Europe/Athens': 'GR',
        'Europe/Dublin': 'IE',
        'Europe/Moscow': 'RU',
        'Asia/Shanghai': 'CN',
        'Asia/Tokyo': 'JP',
        'Asia/Seoul': 'KR',
        'Asia/Kolkata': 'IN',
        'Australia/Sydney': 'AU',
        'Australia/Melbourne': 'AU',
        'Pacific/Auckland': 'NZ',
        'Africa/Johannesburg': 'ZA',
        'Africa/Cairo': 'EG',
        'Asia/Jerusalem': 'IL',
        'Asia/Dubai': 'AE',
        'Asia/Riyadh': 'SA',
        'Europe/Istanbul': 'TR',
        'Asia/Bangkok': 'TH',
        'Asia/Ho_Chi_Minh': 'VN',
        'Asia/Manila': 'PH',
        'Asia/Jakarta': 'ID',
        'Asia/Kuala_Lumpur': 'MY',
        'Asia/Singapore': 'SG',
        'Asia/Hong_Kong': 'HK',
        'Asia/Taipei': 'TW',
      }

      // Buscar país por timezone exacto
      let detectedCode = timezoneToCountry[timezone] || 'AR'

      // Si no se encontró por timezone exacto, buscar por parte del timezone
      if (detectedCode === 'AR') {
        const timezoneParts = timezone.split('/')
        if (timezoneParts.length > 1) {
          const region = timezoneParts[1]
          // Mapeo por región
          if (region.includes('Argentina')) detectedCode = 'AR'
          else if (region.includes('Mexico')) detectedCode = 'MX'
          else if (region.includes('New_York') || region.includes('Los_Angeles') || region.includes('Chicago')) detectedCode = 'US'
          else if (region.includes('Bogota')) detectedCode = 'CO'
          else if (region.includes('Santiago')) detectedCode = 'CL'
          else if (region.includes('Lima')) detectedCode = 'PE'
          else if (region.includes('Sao_Paulo') || region.includes('Brasilia')) detectedCode = 'BR'
        }
      }

      // Si aún no se encontró, intentar por locale
      if (detectedCode === 'AR') {
        const localeCode = locale.split('-')[1]?.toUpperCase()
        const country = COUNTRIES.find(c => c.code === localeCode)
        if (country) {
          detectedCode = country.code
        }
      }

      const detectedCountry = COUNTRIES.find(c => c.code === detectedCode) || COUNTRIES[0]
      setSelectedCountry(detectedCountry)
    } catch (error) {
      console.error('Error detecting country:', error)
      // Mantener Argentina por defecto
    }
  }

  // Detectar país automáticamente al montar el componente
  useEffect(() => {
    detectCountry()
  }, [])

  // Parsear el valor inicial si viene con prefijo
  useEffect(() => {
    if (value) {
      // Intentar extraer el prefijo del valor
      const country = COUNTRIES.find(c => value.startsWith(c.dialCode))
      if (country) {
        setSelectedCountry(country)
        setPhoneNumber(value.replace(country.dialCode, '').trim())
      } else {
        setPhoneNumber(value)
      }
    }
  }, [value])

  // Actualizar el valor completo cuando cambia el país o el número
  useEffect(() => {
    const fullNumber = phoneNumber 
      ? `${selectedCountry.dialCode} ${phoneNumber}`.trim()
      : ''
    onChange(fullNumber)
  }, [selectedCountry, phoneNumber, onChange])

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
        setSearchQuery('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredCountries = COUNTRIES.filter(country =>
    country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    country.dialCode.includes(searchQuery) ||
    country.code.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country)
    setIsDropdownOpen(false)
    setSearchQuery('')
    inputRef.current?.focus()
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    // Solo permitir números, espacios, guiones y paréntesis
    const cleaned = input.replace(/[^\d\s\-()]/g, '')
    setPhoneNumber(cleaned)
  }

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-2">
        {/* Selector de país */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => !disabled && setIsDropdownOpen(!isDropdownOpen)}
            disabled={disabled}
            className={classNames(
              "flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700",
              "bg-white dark:bg-gray-800 text-gray-900 dark:text-white",
              "focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200",
              "min-w-[100px] justify-between",
              disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-blue-500"
            )}
          >
            <div className="flex items-center gap-2">
              <span 
                className="text-xl flex-shrink-0" 
                style={{ fontSize: '1.25rem', lineHeight: '1.25rem' }}
                role="img"
                aria-label={`Bandera de ${selectedCountry.name}`}
              >
                {selectedCountry.flag}
              </span>
              <span className="text-sm font-medium">{selectedCountry.dialCode}</span>
            </div>
            <ChevronDown className={classNames(
              "w-4 h-4 text-gray-400 transition-transform",
              isDropdownOpen && "transform rotate-180"
            )} />
          </button>

          {/* Dropdown de países */}
          <AnimatePresence>
            {isDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-96 overflow-hidden flex flex-col"
              >
                {/* Buscador */}
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                  <input
                    type="text"
                    placeholder="Buscar país..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>

                {/* Lista de países */}
                <div className="overflow-y-auto max-h-80">
                  {filteredCountries.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No se encontraron países
                    </div>
                  ) : (
                    filteredCountries.map((country) => (
                      <button
                        key={country.code}
                        type="button"
                        onClick={() => handleCountrySelect(country)}
                        className={classNames(
                          "w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors",
                          selectedCountry.code === country.code && "bg-blue-50 dark:bg-blue-900/20"
                        )}
                      >
                        <span 
                          className="flex-shrink-0 text-2xl leading-none" 
                          style={{ 
                            fontSize: '1.75rem', 
                            lineHeight: '1',
                            display: 'inline-block',
                            width: '2rem',
                            textAlign: 'center'
                          }}
                          role="img"
                          aria-label={`Bandera de ${country.name}`}
                        >
                          {country.flag}
                        </span>
                        <div className="flex-1 text-left min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {country.flag} {country.name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {country.dialCode}
                          </div>
                        </div>
                        {selectedCountry.code === country.code && (
                          <span className="text-blue-500 flex-shrink-0">✓</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input de teléfono */}
        <div className="flex-1 relative">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500">
            <Phone className="w-4 h-4" />
          </div>
          <input
            ref={inputRef}
            type="tel"
            value={phoneNumber}
            onChange={handlePhoneChange}
            placeholder={placeholder}
            disabled={disabled}
            className={classNames(
              "w-full pl-10 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700",
              "bg-white dark:bg-gray-800 text-gray-900 dark:text-white",
              "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
              "transition-all duration-200",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          />
        </div>
      </div>
    </div>
  )
}
