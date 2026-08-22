import { Link } from 'react-router-dom'
import { InformationCircleIcon } from '@heroicons/react/24/outline'
import { useTranslation } from 'react-i18next'

const iconButtonClass =
  'w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-md hover:bg-gray-50 text-gray-600 hover:text-gray-900 transition-colors'

const labeledButtonClass =
  'inline-flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors'

interface ProfileInfoButtonProps {
  to: string
  className?: string
  showLabel?: boolean
}

export default function ProfileInfoButton({ to, className = '', showLabel = false }: ProfileInfoButtonProps) {
  const { t } = useTranslation('uiExtras')
  const label = t('buttons.profileInfoMenu')
  const title = t('buttons.profileInfo')
  return (
    <Link
      to={to}
      role="menuitem"
      className={`${showLabel ? labeledButtonClass : iconButtonClass} ${className}`.trim()}
      title={title}
      aria-label={title}
    >
      <InformationCircleIcon className={showLabel ? 'h-5 w-5 shrink-0 text-gray-500' : 'w-6 h-6'} />
      {showLabel ? <span>{label}</span> : null}
    </Link>
  )
}
