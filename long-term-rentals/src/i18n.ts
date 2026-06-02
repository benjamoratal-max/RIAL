import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import es from './locales/es.json'

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

const initialLng = getStoredLanguage()

async function ensureLanguageBundle(lng: string): Promise<void> {
  // El bundle 'es' ya viene incluido en el init; no hay que cargar nada.
  if (lng === 'es') return
  // El bundle 'en' se carga bajo demanda (lazy) la primera vez que se necesita.
  if (lng === 'en' && !i18n.hasResourceBundle('en', 'translation')) {
    const en = await import('./locales/en.json')
    i18n.addResourceBundle('en', 'translation', en.default, true, true)
  }
}

i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
  },
  lng: initialLng === 'en' ? 'es' : initialLng,
  fallbackLng: 'es',
  interpolation: {
    escapeValue: false,
  },
})

if (initialLng === 'en') {
  void ensureLanguageBundle('en').then(() => i18n.changeLanguage('en'))
}

i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem(STORAGE_KEY, lng)
  } catch {
    // localStorage no disponible o bloqueado
  }
  void ensureLanguageBundle(lng)
})

export async function setAppLanguage(lng: string): Promise<void> {
  if (lng === 'es' || lng === 'en') {
    await ensureLanguageBundle(lng)
    await i18n.changeLanguage(lng)
  }
}

export function getAppLanguage(): string {
  return i18n.language || 'es'
}

export default i18n
