import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useEffect, useState } from 'react'
import api from '../../services/api'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const checkSetup = async () => {
      setLoading(true)
      try {
        const res = await api.get('/api/setup/status')

        if (res.data.needsSuperadmin) {
          navigate('/register-superadmin', { replace: true })
          return
        }

        const setupCompleted = res.data.hasUsers || res.data.setupCompleted || false
        if (!setupCompleted) {
          navigate('/welcome', { replace: true })
        }
      } catch (err) {
        console.error('Greška pri proveri statusa', err)
      } finally {
        setLoading(false)
      }
    }
    checkSetup()
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await api.post('/login', { username, password })
      login(response.data)
      navigate('/home')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Pogrešno korisničko ime ili lozinka.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-emerald-50 via-white to-sky-50 flex items-center justify-center px-4 sm:px-6 lg:px-10 overflow-hidden">
      {/* Background hiking images around the form */}
      <div className="pointer-events-none absolute inset-0">
        {/* Gornji levi ugao – portret, produžen po visini */}
        <div className="absolute left-[-4rem] top-0 sm:left-[-5rem] sm:top-4 w-60 h-64 sm:w-72 sm:h-80 rounded-3xl overflow-hidden shadow-xl shadow-emerald-100/60 border border-white/70 bg-white/70">
          <img
            src="/hike1.jpg"
            alt="Planinari na usponu"
            className="w-full h-full object-cover"
          />
        </div>
        {/* Gornji desni ugao – portret, produžen po visini */}
        <div className="absolute right-[-3rem] top-6 sm:right-[-4.5rem] sm:top-10 w-52 h-64 sm:w-68 sm:h-80 rounded-3xl overflow-hidden shadow-xl shadow-sky-100/60 border border-white/70 bg-white/70">
          <img
            src="/hike2.jpg"
            alt="Pogled sa vrha"
            className="w-full h-full object-cover"
          />
        </div>
        {/* Donji levi ugao – niže od forme, veći */}
        <div className="absolute left-[-3rem] bottom-8 sm:left-[-4rem] sm:bottom-12 w-56 h-40 sm:w-72 sm:h-52 rounded-3xl overflow-hidden shadow-xl shadow-emerald-100/70 border border-white/70 bg-white/70">
          <img
            src="/hike3.jpg"
            alt="Staza kroz šumu"
            className="w-full h-full object-cover"
          />
        </div>
        {/* Donji desni ugao – skroz ispod kartice, širi kadar */}
        <div className="absolute right-[-3rem] bottom-[-1rem] sm:right-[-4rem] sm:bottom-0 w-52 h-36 sm:w-72 sm:h-48 rounded-3xl overflow-hidden shadow-xl shadow-emerald-100/70 border border-white/70 bg-white/70">
          <img
            src="/hike4.jpg"
            alt="Planinari na grebenu"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Soft color blobs for depth, in app colors */}
        <div className="pointer-events-none absolute -left-32 -top-24 h-72 w-72 rounded-full bg-emerald-200/50 blur-3xl" />
        <div className="pointer-events-none absolute right-[-6rem] top-1/3 h-80 w-80 rounded-full bg-yellow-200/50 blur-3xl" />
        <div className="pointer-events-none absolute left-1/3 bottom-[-6rem] h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
      </div>

      {/* Loading overlay for initial setup check – now light themed */}
      {loading && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 rounded-full border-[3px] border-emerald-500 border-t-transparent animate-spin" />
            <p className="text-sm text-emerald-700">Proveravam stanje aplikacije…</p>
          </div>
        </div>
      )}

      <div className="relative w-full max-w-3xl">
        {/* Subtle outline in app colors */}
        <div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-br from-emerald-400/60 via-emerald-400/10 to-amber-300/60 opacity-70" />

        {/* Main login card */}
        <div className="relative rounded-3xl bg-white/90 backdrop-blur-md border border-emerald-100 shadow-xl shadow-emerald-100/80 px-6 py-7 sm:px-8 sm:py-8 lg:px-10 lg:py-9">
          {/* Badge + title */}
          <div className="mb-6 flex flex-col items-center text-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 border border-emerald-100">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white text-xs font-extrabold shadow-sm">
                N
              </span>
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-emerald-700">
                Prijava u NaVrhu
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900">
              Dobrodošli nazad
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md">
              Jedan nalog za sve što vaše planinarsko društvo treba – članovi, akcije, finansije i ranking.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs sm:text-sm text-rose-700 flex items-start gap-2">
              <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                !
              </span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div className="space-y-1.5">
              <label
                htmlFor="username"
                className="block text-xs sm:text-sm font-medium text-slate-800"
              >
                Korisničko ime
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-emerald-100 bg-white px-3.5 py-2.5 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 outline-none transition"
                placeholder="Korisničko ime"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-xs sm:text-sm font-medium text-slate-800"
              >
                Lozinka
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-emerald-100 bg-white px-3.5 py-2.5 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 outline-none transition"
                placeholder="Unesi lozinku"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`mt-1 inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 sm:py-3 text-sm sm:text-base font-semibold text-slate-950 shadow-lg shadow-emerald-300/50 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 transition-all ${
                loading ? 'opacity-70 cursor-wait' : ''
              }`}
            >
              {loading ? 'Prijavljujem…' : 'Prijava'}
            </button>
          </form>

          <p className="mt-5 text-[11px] sm:text-xs text-center text-slate-500">
            Nemaš nalog? Obrati se rukovodstvu ili administratoru svog planinarskog društva.
          </p>

          <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-slate-400">
            <span>NaVrhu • sistem za planinarska društva</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>Sigurne evidencije, više vremena na stazi</span>
          </div>
        </div>
      </div>
    </div>
  )
}