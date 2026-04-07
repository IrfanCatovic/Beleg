import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../../components/LanguageSwitcher'
import { normalizeInviteCodeInput } from '../../domain/invite'
import { validateInviteCodePublic } from '../../services/invite'

/**
 * Javna stranica: član unosi kod koji je klub podelio.
 * Korak 2 u flow-u: validacija → (sledeći korak) ista forma kao kod admina sa fiksnim klubom.
 */
export default function EnterClubInviteCode() {
  const { t } = useTranslation('invite')
  const { t: tLogin } = useTranslation('login')
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await validateInviteCodePublic(code)
      if (!result.ok) {
        setError(
          result.error === 'INVALID_FORMAT'
            ? t('enterPage.invalidFormat')
            : result.error || t('enterPage.errorGeneric'),
        )
        return
      }
      navigate('/registracija-clan', {
        state: {
          klubId: result.klubId,
          klubNaziv: result.klubNaziv,
          inviteCode: normalizeInviteCodeInput(code),
        },
        replace: false,
      })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        t('enterPage.errorGeneric')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-emerald-50 via-white to-sky-50 flex items-center justify-center px-4 sm:px-6 lg:px-10 overflow-hidden">
      <div className="absolute right-4 top-4 z-10">
        <LanguageSwitcher />
      </div>

      <div className="relative w-full max-w-md">
        <div className="rounded-2xl border border-emerald-100/80 bg-white/90 backdrop-blur-sm shadow-xl shadow-emerald-100/50 px-6 py-8 sm:px-8 sm:py-10">
          <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-emerald-600 mb-1">
            {t('enterPage.badge')}
          </p>
          <h1 className="text-xl sm:text-2xl font-bold text-center text-slate-900 tracking-tight mb-2">
            {t('enterPage.title')}
          </h1>
          <p className="text-sm text-slate-600 text-center mb-6">{t('enterPage.subtitle')}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="club-invite-code" className="block text-xs sm:text-sm font-medium text-slate-800">
                {t('enterPage.label')}
              </label>
              <input
                id="club-invite-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="mt-1 w-full rounded-xl border border-emerald-100 bg-white py-2.5 px-3.5 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 tracking-widest font-mono focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 outline-none transition uppercase"
                placeholder={t('enterPage.placeholder')}
                autoComplete="off"
                maxLength={16}
                disabled={loading}
                aria-invalid={!!error}
              />
            </div>

            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 sm:py-3 text-sm sm:text-base font-semibold text-slate-950 shadow-lg shadow-emerald-300/50 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 transition-all ${
                loading ? 'opacity-70 cursor-wait' : ''
              }`}
            >
              {loading ? t('enterPage.submitting') : t('enterPage.submit')}
            </button>
          </form>

          <p className="mt-6 text-center text-sm">
            <Link to="/login" className="text-emerald-700 hover:text-emerald-800 font-medium underline-offset-2 hover:underline">
              {t('enterPage.backToLogin')}
            </Link>
          </p>
          <p className="mt-3 text-[11px] text-center text-slate-500">{tLogin('noAccount')}</p>
        </div>
      </div>
    </div>
  )
}
