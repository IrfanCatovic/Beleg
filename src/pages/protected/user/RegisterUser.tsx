import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import BackButton from '../../../components/buttons/BackButton'
import MemberRegistrationForm from '../../../components/register/MemberRegistrationForm'
import { useTranslation } from 'react-i18next'

export default function RegisterUser() {
  const { t } = useTranslation('setup')
  const { user } = useAuth()
  const navigate = useNavigate()

  const roleOptions =
    user?.role === 'superadmin' || user?.role === 'admin'
      ? ['admin', 'clan', 'vodic', 'blagajnik', 'sekretar', 'menadzer-opreme']
      : ['clan', 'vodic', 'blagajnik', 'sekretar', 'menadzer-opreme']

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 pb-12">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
          <BackButton />
          <div className="flex-1 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-600 mb-1">
              {t('registerUser.badge')}
            </p>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-extrabold tracking-tight text-gray-900">
              {t('registerUser.title')}
            </h1>
          </div>
          <div className="w-10 sm:w-16" aria-hidden />
        </div>

        <div className="max-w-4xl mx-auto">
          <MemberRegistrationForm
            variant="staff"
            roleOptions={roleOptions}
            onSuccess={() => navigate('/users', { replace: true })}
          />
        </div>
      </div>
    </div>
  )
}
