import { useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import MarketingNavbar from '../../components/MarketingNavbar'
import api from '../../services/api'

const PILLARS = [
  {
    icon: IconShieldCare,
    title: 'Brinemo o klubovima',
    text:
      'Vaše društvo nije samo „korisnik“ – zajedno gradimo alate koji stvarno olakšavaju administraciju, članstvo i organizaciju izleta.',
  },
  {
    icon: IconLayers,
    title: 'Deo velikog projekta',
    text:
      'Planiner raste kao platforma posvećena planinarstvu: jedan sistem, jasni ciljevi, manje papirologije i više vremena za staze i ljude.',
  },
  {
    icon: IconMountainFamily,
    title: 'Jedna velika porodica planinara',
    text:
      'Želimo da povežemo klubove u širu zajednicu – deljenje iskustva, podrška i osećaj da niste sami u digitalizaciji.',
  },
] as const

export default function Cena() {
  const [contactPerson, setContactPerson] = useState('')
  const [clubName, setClubName] = useState('')
  const [city, setCity] = useState('')
  const [question, setQuestion] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [sending, setSending] = useState(false)
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = async () => {
    const person = contactPerson.trim()
    const club = clubName.trim()
    const place = city.trim()
    const q = question.trim()

    setFieldError('')
    setSubmitMessage(null)

    if (!person || !club || !place || !q) {
      setFieldError('Molimo popunite sva obavezna polja.')
      return
    }

    const noteBody = `Upit poslato sa stranice Cena:\n\nKontakt osoba: ${person}\nIme kluba: ${club}\nMesto: ${place}\n\nPitanje:\n${q}\n`

    setSending(true)
    try {
      await api.post(
        '/api/cena-zahtev',
        {
          paket: 'Cena stranica',
          extraUsers: 0,
          extraAdmins: 0,
          note: noteBody,
          imeKluba: club,
          contactEmail: '',
          contactPhone: '',
          basePriceRsd: 0,
          extraUsersCostRsd: 0,
          extraAdminsCostRsd: 0,
          totalMonthlyRsd: 0,
        },
        { timeout: 45_000, withCredentials: false },
      )
      setSubmitMessage({ type: 'success', text: 'Poruka je uspešno poslata. Javićemo vam se uskoro.' })
      setContactPerson('')
      setClubName('')
      setCity('')
      setQuestion('')
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const code = err.code
        const timedOut =
          code === 'ECONNABORTED' ||
          code === 'ETIMEDOUT' ||
          (typeof err.message === 'string' && err.message.toLowerCase().includes('timeout'))
        if (timedOut) {
          setSubmitMessage({
            type: 'error',
            text: 'Zahtev je predugo trajao. Na produkciji proverite SMTP/Resend na serveru i VITE_API_URL + CORS.',
          })
          return
        }
        if (!err.response && (code === 'ERR_NETWORK' || err.message === 'Network Error')) {
          setSubmitMessage({
            type: 'error',
            text: 'Nema odgovora od servera. Proverite VITE_API_URL i CORS_ORIGINS (tačan URL vašeg sajta).',
          })
          return
        }
        const apiMsg = (err.response?.data as { error?: string } | undefined)?.error
        if (apiMsg) {
          setSubmitMessage({ type: 'error', text: apiMsg })
          return
        }
      }
      const res =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response
          : null
      const msg = res?.data?.error ?? 'Greška pri slanju. Pokušajte ponovo.'
      setSubmitMessage({ type: 'error', text: msg })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-emerald-50/60">
      <header className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-10 pt-6 relative z-10">
        <MarketingNavbar />
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-emerald-900/10">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-800" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(255,255,255,0.18),transparent)]" />
        <div className="absolute inset-0 opacity-[0.07] bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M30 5 L55 45 L5 45 Z\' fill=\'none\' stroke=\'%23fff\' stroke-width=\'0.8\'/%3E%3C/svg%3E')] bg-[length:72px_72px]" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-8 py-14 sm:py-20 lg:py-24 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 text-emerald-50 text-xs font-semibold uppercase tracking-wider px-3 py-1 ring-1 ring-white/20 backdrop-blur-sm">
              <IconSpark className="h-3.5 w-3.5" />
              Besplatno za planinarske klubove
            </span>
            <span className="inline-flex rounded-full bg-emerald-950/30 text-emerald-100 text-xs font-medium px-3 py-1 ring-1 ring-white/10">
              Registracija kluba bez naknade
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-[1.15] mb-6 max-w-4xl mx-auto text-balance">
            Jedna platforma,{' '}
            <span className="text-emerald-200">jedna velika porodica</span> planinara
          </h1>
          <p className="text-emerald-50/95 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed mb-4">
            Planiner je deo šireg projekta koji želi da <strong className="text-white font-semibold">olakša upravljanje klubovima</strong> –
            manje stresa oko administracije, više vremena za članove i planine.
          </p>
          <p className="text-emerald-100/90 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            Brinemo o društvima koja nam poveravaju svoj rad: naš cilj je da vas povežemo u zajednicu u kojoj svaki klub
            oseća podršku. Zato je <strong className="text-white">cela aplikacija besplatna</strong> – da niko ne ostane po strani.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <a
              href="#upit-kluba"
              className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-emerald-900 bg-white hover:bg-emerald-50 shadow-lg shadow-emerald-950/20 transition-colors"
            >
              Pošaljite upit za klub
            </a>
            <Link
              to="/kontakt"
              className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-white ring-2 ring-white/40 hover:bg-white/10 transition-colors"
            >
              Kontakt stranica
            </Link>
          </div>
        </div>
      </section>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 -mt-6 relative z-[1]">
        {/* Intro card */}
        <div className="rounded-2xl bg-white border border-emerald-100 shadow-lg shadow-emerald-900/5 p-6 sm:p-8 mb-10 sm:mb-14">
          <div className="flex flex-col sm:flex-row sm:items-start gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30">
              <IconHeartMountain className="h-7 w-7" />
            </div>
            <div className="space-y-3 text-gray-700 text-sm sm:text-base leading-relaxed">
              <p className="text-lg sm:text-xl font-semibold text-gray-900">
                Niste samo „još jedan klub u sistemu“
              </p>
              <p>
                Verujemo da planinarska društva drže zajednicu živom. Zato Planiner gradimo kao dugoročan projekat: alat koji
                raste sa vama – od članarine i evidencije do akcija i dokumentacije – bez da vas cena odvoji od digitalnog
                koraka napred.
              </p>
            </div>
          </div>
        </div>

        {/* Pillars */}
        <div className="mb-10 sm:mb-14">
          <h2 className="text-center text-xs font-bold uppercase tracking-[0.2em] text-emerald-700 mb-2">
            Zašto Planiner
          </h2>
          <p className="text-center text-xl sm:text-2xl font-bold text-gray-900 mb-8 max-w-2xl mx-auto">
            Zajedno činimo upravljanje klubom jednostavnijim
          </p>
          <div className="grid gap-5 sm:gap-6 md:grid-cols-3">
            {PILLARS.map((item) => (
              <article
                key={item.title}
                className="group relative rounded-2xl border border-emerald-100/90 bg-white p-6 shadow-sm hover:shadow-md hover:border-emerald-200/90 transition-all duration-300 overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-50 to-transparent rounded-bl-full opacity-80" />
                <div className="relative flex flex-col h-full">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 mb-4 group-hover:bg-emerald-100 transition-colors">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-base font-bold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed flex-1">{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Why free */}
        <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-8 sm:p-10 mb-12 sm:mb-16 shadow-xl shadow-emerald-600/25 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-2xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-900/30 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
          <div className="relative max-w-2xl">
            <h2 className="text-xl sm:text-2xl font-bold mb-3 flex items-center gap-2 flex-wrap">
              <IconGift className="h-7 w-7 text-emerald-200 shrink-0" />
              Zašto je sve besplatno?
            </h2>
            <p className="text-emerald-50 leading-relaxed text-sm sm:text-base mb-4">
              Naša misija je da <strong className="text-white">povežemo jednu veliku porodicu planinara</strong> – od malih
              društava do aktivnih klubova. Ako naplatimo svakom klubu ulazak, deo te porodice jednostavno ne bi mogao da krene.
            </p>
            <p className="text-emerald-100/95 text-sm sm:text-base leading-relaxed">
              Besplatna aplikacija nije reklama: to je izbor da <strong className="text-white">prioritet budu klubovi i zajednica</strong>,
              a ne brza zarada. Kad pošaljete upit, dogovaramo registraciju i podršku kao partneri, ne kao prodavci.
            </p>
          </div>
        </div>

        {/* Form */}
        <div
          id="upit-kluba"
          className="scroll-mt-24 rounded-2xl bg-white border border-emerald-100 shadow-sm p-6 sm:p-8 space-y-5"
        >
          <div className="flex items-start gap-4 pb-1 border-b border-emerald-100/80">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <IconPen className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Pridružite se zajednici</h2>
              <p className="text-xs sm:text-sm text-gray-600 mt-1 max-w-xl">
                Ostavite osnovne podatke – odgovorićemo vam i dogovorićemo registraciju vašeg kluba. Upit je označen kao sa
                stranice Cena.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="cena-contact-person" className="text-xs font-medium text-gray-600">
                Kontakt osoba <span className="text-red-500">*</span>
              </label>
              <input
                id="cena-contact-person"
                type="text"
                value={contactPerson}
                onChange={(e) => {
                  setContactPerson(e.target.value)
                  setFieldError('')
                }}
                className={`w-full rounded-xl border px-3 py-2 text-sm text-gray-800 shadow-sm focus:ring-2 focus:ring-emerald-500/30 outline-none ${
                  fieldError ? 'border-red-400' : 'border-gray-300 focus:border-emerald-500'
                }`}
                placeholder="Ime i prezime kontakt osobe"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="cena-club-name" className="text-xs font-medium text-gray-600">
                Ime kluba <span className="text-red-500">*</span>
              </label>
              <input
                id="cena-club-name"
                type="text"
                value={clubName}
                onChange={(e) => {
                  setClubName(e.target.value)
                  setFieldError('')
                }}
                className={`w-full rounded-xl border px-3 py-2 text-sm text-gray-800 shadow-sm focus:ring-2 focus:ring-emerald-500/30 outline-none ${
                  fieldError ? 'border-red-400' : 'border-gray-300 focus:border-emerald-500'
                }`}
                placeholder="npr. Planinarsko društvo Javor"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="cena-city" className="text-xs font-medium text-gray-600">
              Mesto <span className="text-red-500">*</span>
            </label>
            <input
              id="cena-city"
              type="text"
              value={city}
              onChange={(e) => {
                setCity(e.target.value)
                setFieldError('')
              }}
              className={`w-full rounded-xl border px-3 py-2 text-sm text-gray-800 shadow-sm focus:ring-2 focus:ring-emerald-500/30 outline-none ${
                fieldError ? 'border-red-400' : 'border-gray-300 focus:border-emerald-500'
              }`}
              placeholder="Grad ili mesto u kojem je klub"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="cena-question" className="text-xs font-medium text-gray-600">
              Pitanje za nas <span className="text-red-500">*</span>
            </label>
            <textarea
              id="cena-question"
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value)
                setFieldError('')
              }}
              rows={4}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none resize-y"
              placeholder="npr. želimo registraciju kluba, broj članova, pitanja o funkcijama…"
            />
          </div>

          {fieldError && <p className="text-xs text-red-600">{fieldError}</p>}
          {submitMessage && (
            <p
              className={`text-sm font-medium ${
                submitMessage.type === 'success' ? 'text-emerald-700' : 'text-red-600'
              }`}
            >
              {submitMessage.text}
            </p>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
            <p className="text-xs text-gray-500 max-w-md">
              Poruka stiže našem timu sa oznakom da je poslato sa stranice Cena. Hvala što gradite zajedno sa nama.
            </p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={sending}
              className="inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-70 disabled:cursor-not-allowed transition-colors shadow-md shadow-emerald-600/20"
            >
              {sending ? 'Slanje…' : 'Pošalji upit'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

function IconSpark({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  )
}

function IconShieldCare({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  )
}

function IconLayers({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V7zm0 8a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z"
      />
    </svg>
  )
}

function IconMountainFamily({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}

function IconHeartMountain({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3M3 12h3m12 0h3" opacity={0.35} />
    </svg>
  )
}

function IconGift({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v13m0-13V6a2 2 0 112-2h-2.5a2.5 2.5 0 000 5H12zm0-5h2.5a2.5 2.5 0 010 5H12m-7 8h14a2 2 0 002-2v-5a2 2 0 00-2-2H5a2 2 0 00-2 2v5a2 2 0 002 2z" />
    </svg>
  )
}

function IconPen({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  )
}
