import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import LanguageSwitcher from '../../components/LanguageSwitcher'

/** Dozvoljeno pri unosu (i velika slova); u bazi se čuva malim slovima — kao na backendu. */
const usernameCharsetRegex = /^[a-zA-Z0-9._]+$/

function validateUsername(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return 'Korisničko ime je obavezno.'
  if (/\s/.test(trimmed)) return 'Korisničko ime ne sme sadržati razmake.'
  if (!usernameCharsetRegex.test(trimmed)) {
    return 'Dozvoljena su samo slova, brojevi, tačka i donja crta (bez razmaka, crtica i drugih znakova).'
  }
  const lower = trimmed.toLowerCase()
  if (lower.length < 2 || lower.length > 30) return 'Korisničko ime mora imati između 2 i 30 karaktera.'
  if (lower.startsWith('.') || lower.endsWith('.') || lower.startsWith('_') || lower.endsWith('_')) {
    return 'Korisničko ime ne sme počinjati niti završavati tačkom ili donjom crtom.'
  }
  if (lower.includes('..') || lower.includes('__') || lower.includes('._') || lower.includes('_.')) {
    return 'Korisničko ime ne sme imati uzastopne specijalne znakove.'
  }
  return null
}

export default function RegisterOpen() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const usernameErr = validateUsername(username)
    if (usernameErr) {
      setError(usernameErr)
      return
    }
    if (password.length < 8) {
      setError('Lozinka mora imati najmanje 8 karaktera.')
      return
    }
    if (!email.trim()) {
      setError('Email je obavezan.')
      return
    }

    setLoading(true)
    try {
      await api.post('/api/register/open', {
        username: username.trim().toLowerCase(),
        password,
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
      })
      setSuccess('Nalog je kreiran. Poslali smo verifikacioni email.')
      navigate('/registracija-email-provera', {
        replace: true,
        state: { email: email.trim().toLowerCase() },
      })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Registracija nije uspela.'
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
        <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-emerald-600 mb-1">
          Novi korisnik
        </p>
        <h1 className="text-xl sm:text-2xl font-bold text-center text-slate-900 tracking-tight mb-2">
          Registracija bez kluba
        </h1>
        <p className="text-sm text-slate-600 text-center mb-6">
          Nakon registracije potvrdite email da biste se prijavili.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Korisničko ime (npr. Catko — čuva se kao catko)"
            className="w-full rounded-xl border border-emerald-100 bg-white py-2.5 px-3.5 text-sm text-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 outline-none transition"
            disabled={loading}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Lozinka (min 8)"
            className="w-full rounded-xl border border-emerald-100 bg-white py-2.5 px-3.5 text-sm text-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 outline-none transition"
            disabled={loading}
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-xl border border-emerald-100 bg-white py-2.5 px-3.5 text-sm text-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 outline-none transition"
            disabled={loading}
          />
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ime i prezime (opciono)"
            className="w-full rounded-xl border border-emerald-100 bg-white py-2.5 px-3.5 text-sm text-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 outline-none transition"
            disabled={loading}
          />

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-700">{success}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-300/50 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 transition-all ${
              loading ? 'opacity-70 cursor-wait' : 'hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300'
            }`}
          >
            {loading ? 'Slanje...' : 'Registruj se'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm">
          <Link to="/login" className="text-emerald-700 hover:text-emerald-800 font-medium underline-offset-2 hover:underline">
            Nazad na login
          </Link>
        </p>
      </div>
    </div>
  )
}
