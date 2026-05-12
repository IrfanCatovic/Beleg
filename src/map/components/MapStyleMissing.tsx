import { useTranslation } from 'react-i18next'

export function MapStyleMissing(props: { className?: string }) {
  const { t } = useTranslation('ferrate')
  return (
    <div
      className={`flex h-full min-h-[12rem] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-200/80 bg-gradient-to-b from-slate-50 to-emerald-50/50 px-4 py-8 text-center ${props.className ?? ''}`}
    >
      <p className="text-sm font-bold text-gray-900">{t('mapConfigMissingTitle')}</p>
      <p className="max-w-sm text-xs leading-relaxed text-gray-600">{t('mapConfigMissingBody')}</p>
    </div>
  )
}
