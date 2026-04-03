import { useTranslation } from 'react-i18next'

const LANGUAGES = ['sr', 'bs', 'hr', 'de', 'en'] as const

type LanguageSwitcherProps = { compact?: boolean }

export default function LanguageSwitcher({ compact }: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation('common')
  const current = LANGUAGES.includes(i18n.resolvedLanguage as (typeof LANGUAGES)[number])
    ? (i18n.resolvedLanguage as (typeof LANGUAGES)[number])
    : 'sr'

  const labelClass = compact
    ? 'inline-flex items-center gap-1 text-[10px] text-gray-700 shrink-0'
    : 'inline-flex items-center gap-2 text-xs text-gray-700'
  const selectClass = compact
    ? 'rounded-lg border border-emerald-200 bg-white px-2 py-1 text-[10px] font-semibold text-emerald-900 max-w-[4.75rem] sm:max-w-[5.25rem] focus:outline-none focus:ring-2 focus:ring-emerald-400/50'
    : 'rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-400/50'

  return (
    <label className={labelClass}>
      <span className="sr-only">{t('language')}</span>
      <select
        className={selectClass}
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
