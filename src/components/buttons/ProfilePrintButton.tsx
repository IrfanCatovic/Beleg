import { PrinterIcon } from '@heroicons/react/24/outline'
import { useTranslation } from 'react-i18next'

const iconButtonClass =
  'w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-md hover:bg-gray-50 text-gray-600 hover:text-gray-900 transition-colors'

const labeledButtonClass =
  'inline-flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors'

interface ProfilePrintButtonProps {
  onClick?: () => void
  title?: string
  className?: string
  showLabel?: boolean
}

export default function ProfilePrintButton({
  onClick,
  title,
  className = '',
  showLabel = false,
}: ProfilePrintButtonProps) {
  const { t } = useTranslation('uiExtras')
  const label = t('buttons.printMenu')
  const resolvedTitle = title || t('buttons.print')
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`${showLabel ? labeledButtonClass : iconButtonClass} ${className}`.trim()}
      title={resolvedTitle}
      aria-label={resolvedTitle}
    >
      <PrinterIcon className={showLabel ? 'h-5 w-5 shrink-0 text-gray-500' : 'w-6 h-6'} />
      {showLabel ? <span>{label}</span> : null}
    </button>
  )
}
