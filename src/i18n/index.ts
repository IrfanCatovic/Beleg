import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import { resources } from './resources'

const supportedLngs = ['sr', 'bs', 'hr', 'de', 'en'] as const

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'sr',
    supportedLngs,
    defaultNS: 'common',
    ns: ['common', 'landing', 'login', 'appLayout', 'home', 'tasks', 'actions', 'actionDetails', 'users', 'userInfo', 'profileSettings', 'userProfile'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'app_language',
      caches: ['localStorage'],
    },
  })

export default i18n
