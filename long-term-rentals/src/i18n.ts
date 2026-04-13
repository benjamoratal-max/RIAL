import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import es from './locales/es.json'
import en from './locales/en.json'

const STORAGE_KEY = 'app-language'

function getStoredLanguage(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'es' || stored === 'en') return stored
  } catch {
    // localStorage no disponible o bloqueado
  }
  return 'es'
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
    },
    lng: getStoredLanguage(),
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false,
    },
  })

i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem(STORAGE_KEY, lng)
  } catch {
    // localStorage no disponible o bloqueado
  }
})

export function setAppLanguage(lng: string): void {
  if (lng === 'es' || lng === 'en') {
    i18n.changeLanguage(lng)
  }
}

export function getAppLanguage(): string {
  return i18n.language || 'es'
}

export default i18n
