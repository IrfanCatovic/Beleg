import { useNavigate } from 'react-router-dom'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useTranslation } from 'react-i18next'

type BackButtonProps = {
  to?: string
  className?: string
}

export default function BackButton({ to, className = '' }: BackButtonProps) {
  const { t } = useTranslation('uiExtras')
  const navigate = useNavigate()
  const handleBack = () => {
    if (to) navigate(to)
    else navigate(-1)
  }
  return (
    <button
      type="button"
      className={`mb-4 flex items-center justify-center w-14 h-14 rounded-full bg-gray-100 text-gray-800 shadow-xl hover:bg-gray-200 active:scale-95 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300 ${className}`.trim()}
      onClick={handleBack}
      aria-label={t('buttons.back')}
      title={t('buttons.back')}
    >
      <ArrowLeftIcon className="h-7 w-7" />
    </button>
  )
}