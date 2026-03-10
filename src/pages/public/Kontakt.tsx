import { Link } from 'react-router-dom'
import MarketingNavbar from '../../components/MarketingNavbar'

const KONTAKTI = [
  {
    ime: 'Enes',
    telefon: '+381 63 830 6056',
    telefonLink: '0638306056',
    email: 'enesh23@gmail.com',
  },
  {
    ime: 'Irfan',
    telefon: '+381 69 555 4991',
    telefonLink: '0695554991',
    email: 'catovicc84@gmail.com',
  },
] as const

const TRUST_ITEMS = [
  {
    icon: IconClubs,
    value: '30+',
    label: 'aktivnih klubova kod nas',
  },
  {
    icon: IconClock,
    value: '< 1h',
    label: 'odgovor u roku od sat vremena',
  },
  {
    icon: IconHeart,
    value: '100%',
    label: 'zadovoljni klijenti',
  },
  {
    icon: IconStar,
    value: '5.0',
    label: 'preporuke i ocene',
  },
] as const

export default function Kontakt() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/80 via-white to-emerald-50/80">
      <header className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-10 pt-6">
        <MarketingNavbar />
      </header>

      <main className="max-w-4xl mx-auto px-4 pb-20">
        {/* Hero */}
        <div className="text-center mt-10 sm:mt-14 mb-12">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 mb-5">
            <IconChat className="h-7 w-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4 tracking-tight">
            Tu smo za vas
          </h1>
          <p className="text-gray-600 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            Pitanja o NaVrhu aplikaciji, ponudi za vaše društvo ili tehnička podrška – javite nam se.
            Naš tim vam odgovara brzo i konkretno.
          </p>
        </div>

        {/* Trust strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-14">
          {TRUST_ITEMS.map((item) => (
            <div
              key={item.label}
              className="relative rounded-2xl bg-white border border-emerald-100/80 shadow-sm hover:shadow-md hover:border-emerald-200/80 transition-all p-4 sm:p-5 text-center overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50/50 rounded-bl-full" />
              <div className="relative flex flex-col items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <item.icon className="h-5 w-5" />
                </span>
                <span className="text-xl sm:text-2xl font-bold text-emerald-700">{item.value}</span>
                <span className="text-xs sm:text-sm text-gray-600 leading-snug">{item.label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Contact section title */}
        <div className="flex items-center gap-3 mb-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <IconTeam className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-semibold text-gray-900">Kontakt osobe</h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-5 sm:gap-6">
          {KONTAKTI.map((osoba) => (
            <section
              key={osoba.ime}
              className="group rounded-2xl bg-white border border-emerald-100 shadow-sm hover:shadow-md hover:border-emerald-200/80 transition-all p-6 sm:p-7"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white font-semibold text-lg shadow-md shadow-emerald-500/25">
                  {osoba.ime.charAt(0)}
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{osoba.ime}</h3>
              </div>
              <div className="space-y-3">
                <a
                  href={`tel:+381${osoba.telefonLink.replace(/\s/g, '').replace(/^0/, '')}`}
                  className="flex items-center gap-3 py-2 px-3 -mx-3 rounded-xl text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 shrink-0">
                    <PhoneIcon className="h-4 w-4" />
                  </span>
                  <span className="font-medium">{osoba.telefon}</span>
                </a>
                <a
                  href={`mailto:${osoba.email}`}
                  className="flex items-center gap-3 py-2 px-3 -mx-3 rounded-xl text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors break-all"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 shrink-0">
                    <EmailIcon className="h-4 w-4" />
                  </span>
                  <span className="font-medium text-sm sm:text-base">{osoba.email}</span>
                </a>
              </div>
            </section>
          ))}
        </div>

        {/* CTA Cena */}
        <div className="mt-14 relative rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-600 to-emerald-800 p-8 sm:p-10 text-center shadow-xl shadow-emerald-500/20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.12)_0%,transparent_50%)]" />
          <div className="absolute bottom-0 right-0 w-48 h-48 bg-white/5 rounded-tl-full" />
          <div className="relative">
            <p className="text-emerald-50/95 text-sm sm:text-base mb-5 max-w-lg mx-auto leading-relaxed">
              Želite ponudu za vaše planinarsko društvo? Popunite kratku formu na stranici Cene – poslaćemo vam
              detaljnu ponudu prilagođenu broju članova i potrebama.
            </p>
            <Link
              to="/cena"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-emerald-800 bg-white hover:bg-emerald-50 transition-colors shadow-lg"
            >
              Pogledaj cene i pošalji zahtev
              <IconArrow className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

function IconChat({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  )
}

function IconClubs({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
      />
    </svg>
  )
}

function IconClock({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )
}

function IconHeart({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
      />
    </svg>
  )
}

function IconStar({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
      />
    </svg>
  )
}

function IconTeam({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  )
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
      />
    </svg>
  )
}

function EmailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  )
}

function IconArrow({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
    </svg>
  )
}
