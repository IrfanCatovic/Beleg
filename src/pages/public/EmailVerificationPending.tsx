import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import api from '../../services/api'
import LanguageSwitcher from '../../components/LanguageSwitcher'

type LocationState = { email?: string } | null

export default function EmailVerificationPending() {
  const location = useLocation()
  const state = location.state as LocationState
  const email = useMemo(() => state?.email?.trim().toLowerCase() ?? '', [state?.email])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const resend = async () => {
    if (!email) {
      setError('Nedostaje email adresa. Vratite se na registraciju i pokušajte ponovo.')
      return
    }
    setLoading(true)
    setMessage('')
    setError('')
    try {
      const res = await api.post('/api/email/resend', { email })
      setMessage(res.data?.message || 'Verifikacioni email je ponovo poslat.')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Slanje nije uspelo.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-emerald-50 via-white to-sky-50 flex items-center justify-center px-4 sm:px-6 lg:px-10">
      <div className="absolute right-4 top-4 z-10">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-md rounded-2xl border border-emerald-100/80 bg-white/90 shadow-xl shadow-emerald-100/50 px-6 py-8 sm:px-8 sm:py-10">
        <h1 className="text-xl sm:text-2xl font-bold text-center text-slate-900 tracking-tight mb-2">
          Potvrdite email adresu
        </h1>
        <p className="text-sm text-slate-600 text-center mb-4">
          Poslali smo verifikacioni link na:
        </p>
        <p className="text-sm text-center font-semibold text-emerald-700 mb-6 break-all">
          {email || 'email nije prosleđen'}
        </p>

        <button
          type="button"
          onClick={resend}
          disabled={loading}
          className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-300/50 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 transition-all ${
            loading ? 'opacity-70 cursor-wait' : 'hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300'
          }`}
        >
          {loading ? 'Slanje...' : 'Posalji link ponovo'}
        </button>

        {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <p className="mt-6 text-center text-sm">
          <Link to="/login" className="text-emerald-700 hover:text-emerald-800 font-medium underline-offset-2 hover:underline">
            Nazad na login
          </Link>
        </p>
      </div>
    </div>
  )
}
