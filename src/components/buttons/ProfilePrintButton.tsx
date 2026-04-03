import { PrinterIcon } from '@heroicons/react/24/outline'
import { useTranslation } from 'react-i18next'

const buttonClass =
  'w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-md hover:bg-gray-50 text-gray-600 hover:text-gray-900 transition-colors'

interface ProfilePrintButtonProps {
  onClick?: () => void
  title?: string
  className?: string
}

export default function ProfilePrintButton({
  onClick,
  title,
  className = '',
}: ProfilePrintButtonProps) {
  const { t } = useTranslation('uiExtras')
  const resolvedTitle = title || t('buttons.print')
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${buttonClass} ${className}`.trim()}
      title={resolvedTitle}
      aria-label={resolvedTitle}
    >
      <PrinterIcon className="w-6 h-6" />
    </button>
  )
}
