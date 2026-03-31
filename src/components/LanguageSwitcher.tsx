import { useTranslation } from 'react-i18next'

const LANGUAGES = ['sr', 'bs', 'hr', 'de', 'en'] as const

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation('common')
  const current = LANGUAGES.includes(i18n.resolvedLanguage as (typeof LANGUAGES)[number])
    ? (i18n.resolvedLanguage as (typeof LANGUAGES)[number])
    : 'sr'

  return (
    <label className="inline-flex items-center gap-2 text-xs text-gray-700">
      <span className="sr-only">{t('language')}</span>
      <select
        className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
        value={current}
        onChange={(event) => {
          void i18n.changeLanguage(event.target.value)
        }}
        aria-label={t('language')}
      >
        {LANGUAGES.map((lng) => (
          <option key={lng} value={lng}>
            {t(`languages.${lng}`)}
          </option>
        ))}
      </select>
    </label>
  )
}
