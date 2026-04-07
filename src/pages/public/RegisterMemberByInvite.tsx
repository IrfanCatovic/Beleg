import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../../components/LanguageSwitcher'

export type RegisterMemberByInviteLocationState = {
  klubId: number
  klubNaziv?: string
}

/**
 * Placeholder posle uspešnog koda: ovde će u sledećem koraku biti ista forma kao RegisterUser,
 * ali bez izbora kluba/uloge (fiksno: klub iz state-a, uloga član).
 */
export default function RegisterMemberByInvite() {
  const { t } = useTranslation('invite')
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as RegisterMemberByInviteLocationState | null

  useEffect(() => {
    if (!state?.klubId) {
      navigate('/registracija-kod', { replace: true })
    }
  }, [state?.klubId, navigate])

  if (!state?.klubId) {
    return null
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-emerald-50 via-white to-sky-50 flex items-center justify-center px-4 sm:px-6 lg:px-10 overflow-hidden">
      <div className="absolute right-4 top-4 z-10">
        <LanguageSwitcher />
      </div>

      <div className="relative w-full max-w-lg">
        <div className="rounded-2xl border border-emerald-100/80 bg-white/90 backdrop-blur-sm shadow-xl shadow-emerald-100/50 px-6 py-8 sm:px-8 sm:py-10">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-2">
            {t('registerPlaceholder.title')}
          </h1>
          <p className="text-sm text-slate-600 mb-4">{t('registerPlaceholder.subtitle')}</p>
          <div className="rounded-xl bg-emerald-50/90 border border-emerald-100 px-4 py-3 text-sm">
            <span className="text-slate-500">{t('registerPlaceholder.klubLabel')}: </span>
            <span className="font-semibold text-emerald-900">
              {state.klubNaziv ?? `ID ${state.klubId}`}
            </span>
          </div>
          <p className="mt-6 text-center text-sm">
            <Link
              to="/registracija-kod"
              className="text-emerald-700 hover:text-emerald-800 font-medium underline-offset-2 hover:underline"
            >
              {t('registerPlaceholder.back')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
