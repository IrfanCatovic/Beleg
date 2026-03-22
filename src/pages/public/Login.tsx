import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useEffect, useState, useMemo } from 'react'
import api from '../../services/api'
import Loader from '../../components/Loader'
import { getRandomHikingGreeting } from '../../data/hikingGreetings'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const greeting = useMemo(() => getRandomHikingGreeting(), [])

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
        {/* Gornji levi ugao portret, produžen po visini */}
        <div className="absolute left-[-4rem] top-0 sm:left-[-5rem] sm:top-4 w-60 h-64 sm:w-72 sm:h-80 rounded-3xl overflow-hidden shadow-xl shadow-emerald-100/60 border border-white/70 bg-white/70">
          <img
            src="/hike1.jpg"
            alt="Planinari na usponu"
            className="w-full h-full object-cover"
          />
        </div>
        {/* Gornji desni ugao portret, produžen po visini */}
        <div className="absolute right-[-3rem] top-6 sm:right-[-4.5rem] sm:top-10 w-52 h-64 sm:w-68 sm:h-80 rounded-3xl overflow-hidden shadow-xl shadow-sky-100/60 border border-white/70 bg-white/70">
          <img
            src="/hike2.jpg"
            alt="Pogled sa vrha"
            className="w-full h-full object-cover"
          />
        </div>
        {/* Donji levi ugao  niže od forme, veći */}
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

        {/* Dekorativni elementi – ptice, drveće, sunce */}
        <svg className="absolute top-12 left-[15%] w-8 h-8 text-emerald-300/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 8c-4 0-7 3-7 3s-3-3-7-3" strokeLinecap="round" /><path d="M19 5c-5 0-8 4-8 4s-3-4-8-4" strokeLinecap="round" /></svg>
        <svg className="absolute top-20 right-[18%] w-6 h-6 text-emerald-200/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 8c-4 0-7 3-7 3s-3-3-7-3" strokeLinecap="round" /></svg>
        <svg className="absolute bottom-16 left-[22%] w-10 h-10 text-emerald-300/30" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L8 12h3v10l4-12h-3z" opacity="0.3" /><path d="M12 2l-2 5h1.5v4l2-5h-1.5z" /></svg>
        <svg className="absolute bottom-24 right-[20%] w-8 h-8 text-emerald-400/20" viewBox="0 0 40 40" fill="currentColor"><path d="M20 4L10 28h8v8l12-20h-8z" opacity="0.4" /></svg>

        {/* Sunce gore desno */}
        <div className="absolute top-6 right-[30%] sm:right-[35%]">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-yellow-300/40 to-amber-200/30 blur-sm" />
          <div className="absolute inset-1 h-6 w-6 rounded-full bg-yellow-200/50" />
        </div>

        {/* Mountain silhouette na dnu */}
        <svg className="absolute bottom-0 left-0 w-full h-16 sm:h-20 text-emerald-100/40" viewBox="0 0 1440 120" preserveAspectRatio="none" fill="currentColor">
          <path d="M0,120 L0,80 Q80,20 160,60 Q240,100 320,50 Q400,0 480,40 Q560,80 640,30 Q720,-10 800,50 Q880,110 960,40 Q1040,-10 1120,60 Q1200,100 1280,30 Q1360,-20 1440,70 L1440,120 Z" />
        </svg>
        <svg className="absolute bottom-0 left-0 w-full h-12 sm:h-16 text-emerald-200/25" viewBox="0 0 1440 100" preserveAspectRatio="none" fill="currentColor">
          <path d="M0,100 L0,70 Q120,30 240,55 Q360,80 480,35 Q600,10 720,50 Q840,90 960,45 Q1080,10 1200,60 Q1320,90 1440,50 L1440,100 Z" />
        </svg>
      </div>

      {/* Loading overlay for initial setup check – now light themed */}
      {loading && (
        <Loader />
      )}

      <div className="relative w-full max-w-3xl">
        {/* Subtle outline in app colors */}
        <div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-br from-emerald-400/60 via-emerald-400/10 to-amber-300/60 opacity-70" />

        {/* Main login card */}
        <div className="relative rounded-3xl bg-white/90 backdrop-blur-md border border-emerald-100 shadow-xl shadow-emerald-100/80 px-6 py-7 sm:px-8 sm:py-8 lg:px-10 lg:py-9">
          {/* Badge + title */}
          <div className="mb-6 flex flex-col items-center text-center gap-2">
            <div className="inline-flex items-center gap-2.5 rounded-full bg-emerald-50 px-3 py-1.5 border border-emerald-100">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl overflow-hidden shadow-sm hover:scale-105 transition-transform"
                aria-label="Početna stranica"
              >
                <img src="/LogoP.jpg" alt="planiner" className="h-full w-full" />
              </button>
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-emerald-700">
                Prijava u planiner
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900">
              Dobrodošli nazad
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md">
              Jedan nalog za sve što vaše planinarsko društvo treba – članovi, akcije, finansije i ranking.
            </p>
            <p className="text-[11px] sm:text-xs italic text-emerald-600/70 max-w-sm">
              „{greeting}"
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

          <div className="mt-5 p-3 rounded-xl bg-emerald-50/80 border border-emerald-100 text-center">
            <p className="text-[11px] sm:text-xs text-emerald-800 font-medium mb-0.5">Demo nalog za testiranje</p>
            <p className="text-[11px] sm:text-xs text-slate-600">username <strong>planiner</strong> / pw <strong>admin123</strong></p>
          </div>
          <p className="mt-5 text-[11px] sm:text-xs text-center text-slate-500">
            Nemaš nalog? Obrati se rukovodstvu ili administratoru svog planinarskog društva.
          </p>

          {/* Dekorativna linija razdvajač */}
          <div className="mt-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-emerald-200 to-transparent" />
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-emerald-300">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" opacity="0.6" />
            </svg>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-emerald-200 to-transparent" />
          </div>

          {/* Mini elevation profil */}
          <div className="mt-4 flex flex-col items-center gap-1">
            <svg viewBox="0 0 200 40" className="w-48 h-8 text-emerald-400/50" fill="none">
              <path d="M0,35 L15,28 L30,32 L50,18 L65,25 L80,12 L100,8 L120,15 L135,6 L150,20 L170,14 L185,22 L200,18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M0,35 L15,28 L30,32 L50,18 L65,25 L80,12 L100,8 L120,15 L135,6 L150,20 L170,14 L185,22 L200,18 L200,40 L0,40 Z" fill="currentColor" opacity="0.1" />
              <circle cx="135" cy="6" r="2.5" fill="currentColor" opacity="0.8" />
            </svg>
            <p className="text-[9px] text-emerald-500/60 tracking-wider uppercase font-medium">tvoj sledeći vrh te čeka</p>
          </div>

          <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-slate-400">
            <span>planiner • sistem za planinarska društva</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>Sigurne evidencije, više vremena na stazi</span>
          </div>
        </div>
      </div>
    </div>
  )
}