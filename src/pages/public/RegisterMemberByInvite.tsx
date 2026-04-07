import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../../components/LanguageSwitcher'
import MemberRegistrationForm from '../../components/register/MemberRegistrationForm'

export type RegisterMemberByInviteLocationState = {
  klubId: number
  klubNaziv?: string
  inviteCode: string
}

export default function RegisterMemberByInvite() {
  const { t } = useTranslation('invite')
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as RegisterMemberByInviteLocationState | null

  useEffect(() => {
    if (!state?.klubId || !state?.inviteCode) {
      navigate('/registracija-kod', { replace: true })
    }
  }, [state?.klubId, state?.inviteCode, navigate])

  if (!state?.klubId || !state.inviteCode) {
    return null
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-emerald-50 via-white to-sky-50">
      <div className="absolute right-4 top-4 z-10">
        <LanguageSwitcher />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <p className="text-center text-sm mb-6">
          <Link
            to="/registracija-kod"
            className="text-emerald-700 hover:text-emerald-800 font-medium underline-offset-2 hover:underline"
          >
            {t('registerForm.backToCode')}
          </Link>
        </p>

        <MemberRegistrationForm
          variant="invite"
          inviteCode={state.inviteCode}
          klubId={state.klubId}
          klubNaziv={state.klubNaziv}
          onSuccess={() => navigate('/login', { replace: true })}
        />
      </div>
    </div>
  )
}
