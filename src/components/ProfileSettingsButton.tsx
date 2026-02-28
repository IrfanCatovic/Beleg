import { Link } from 'react-router-dom'
import { Cog6ToothIcon } from '@heroicons/react/24/outline'

const buttonClass =
  'w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-md hover:bg-gray-50 text-gray-600 hover:text-gray-900 transition-colors'

interface ProfileSettingsButtonProps {
  to: string
  className?: string
}

export default function ProfileSettingsButton({ to, className = '' }: ProfileSettingsButtonProps) {
  return (
    <Link
      to={to}
      className={`${buttonClass} ${className}`.trim()}
      title="Podešavanja profila"
      aria-label="Podešavanja profila"
    >
      <Cog6ToothIcon className="w-6 h-6" />
    </Link>
  )
}
