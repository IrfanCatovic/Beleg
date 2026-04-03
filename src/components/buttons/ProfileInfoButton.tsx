import { Link } from 'react-router-dom'
import { InformationCircleIcon } from '@heroicons/react/24/outline'
import { useTranslation } from 'react-i18next'

const buttonClass =
  'w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-md hover:bg-gray-50 text-gray-600 hover:text-gray-900 transition-colors'

interface ProfileInfoButtonProps {
  to: string
  className?: string
}

export default function ProfileInfoButton({ to, className = '' }: ProfileInfoButtonProps) {
  const { t } = useTranslation('uiExtras')
  return (
    <Link
      to={to}
      className={`${buttonClass} ${className}`.trim()}
      title={t('buttons.profileInfo')}
      aria-label={t('buttons.profileInfo')}
    >
      <InformationCircleIcon className="w-6 h-6" />
    </Link>
  )
}
