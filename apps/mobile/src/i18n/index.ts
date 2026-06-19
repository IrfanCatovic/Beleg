import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { sr } from './sr'

const STORAGE_LANG = 'app_language'

void i18n.use(initReactI18next).init({
  resources: {
    sr: sr as unknown as Record<string, Record<string, string>>,
  },
  lng: 'sr',
  fallbackLng: 'sr',
  defaultNS: 'common',
  ns: Object.keys(sr),
  interpolation: { escapeValue: false },
  returnNull: false,
})

export { STORAGE_LANG }
export default i18n
