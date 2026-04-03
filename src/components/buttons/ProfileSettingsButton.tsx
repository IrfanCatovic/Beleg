import { Link } from 'react-router-dom'
import { Cog6ToothIcon } from '@heroicons/react/24/outline'
import { useTranslation } from 'react-i18next'

const buttonClass =
  'w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-md hover:bg-gray-50 text-gray-600 hover:text-gray-900 transition-colors'

interface ProfileSettingsButtonProps {
  to: string
  className?: string
}

export default function ProfileSettingsButton({ to, className = '' }: ProfileSettingsButtonProps) {
  const { t } = useTranslation('uiExtras')
  return (
    <Link
      to={to}
      className={`${buttonClass} ${className}`.trim()}
      title={t('buttons.profileSettings')}
      aria-label={t('buttons.profileSettings')}
    >
      <Cog6ToothIcon className="w-6 h-6" />
    </Link>
  )
}
