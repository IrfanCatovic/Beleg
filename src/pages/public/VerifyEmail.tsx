import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import LanguageSwitcher from '../../components/LanguageSwitcher'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const token = useMemo(() => params.get('token') ?? '', [params])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!token) {
        setError('Nedostaje verifikacioni token.')
        setLoading(false)
        return
      }
      try {
        const res = await api.get('/api/email/verify', { params: { token } })
        if (!cancelled) setMessage(res.data?.message || 'Email adresa je uspešno potvrđena.')
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          'Verifikacija nije uspela.'
        if (!cancelled) setError(msg)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-emerald-50 via-white to-sky-50 flex items-center justify-center px-4 sm:px-6 lg:px-10">
      <div className="absolute right-4 top-4 z-10">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-md rounded-2xl border border-emerald-100/80 bg-white/90 shadow-xl shadow-emerald-100/50 px-6 py-8 sm:px-8 sm:py-10">
        <h1 className="text-xl sm:text-2xl font-bold text-center text-slate-900 tracking-tight mb-4">
          Verifikacija email adrese
        </h1>

        {loading ? <p className="text-sm text-slate-600 text-center">Proveravamo link...</p> : null}
        {!loading && message ? <p className="text-sm text-emerald-700 text-center">{message}</p> : null}
        {!loading && error ? <p className="text-sm text-red-600 text-center">{error}</p> : null}

        <p className="mt-6 text-center text-sm">
          <Link to="/login" className="text-emerald-700 hover:text-emerald-800 font-medium underline-offset-2 hover:underline">
            Idi na login
          </Link>
        </p>
      </div>
    </div>
  )
}
