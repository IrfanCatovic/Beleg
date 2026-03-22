import { Link } from 'react-router-dom'

export default function MarketingNavbar() {
  return (
    <>
    <nav className="mb-8 sm:mb-12 flex items-center justify-between gap-4 rounded-full border border-emerald-100/70 bg-white/80 px-4 py-2 shadow-sm backdrop-blur">
      {/* Logo + home */}
      <Link
        to="/"
        className="flex items-center gap-3 group"
        aria-label="Početna – planiner"
      >
        <img
          src="/LogoP.jpg"
          alt="planiner"
          className="h-9 w-9 rounded-2xl shadow-md shadow-emerald-500/40 group-hover:scale-105 transition-transform"
        />
        <div className="leading-tight">
          <p className="text-base sm:text-lg font-semibold tracking-tight text-slate-900">
            Planiner
          </p>
          <p className="text-[10px] sm:text-xs text-gray-500">
            Aplikacija za planinarska društva
          </p>
        </div>
      </Link>

      {/* Linkovi na stranice */}
      <div className="flex items-center gap-2 text-xs sm:text-sm">
        <div className="flex items-center gap-2 sm:gap-3 rounded-full bg-emerald-50/80 px-2 py-1 sm:px-3 sm:py-1.5">
          <Link
            to="/cena"
            className="rounded-full px-3 py-1 text-xs sm:text-sm font-medium text-emerald-800 hover:bg-white hover:text-emerald-900 transition-colors"
          >
            Cene
          </Link>
          <Link
            to="/kontakt"
            className="rounded-full px-3 py-1 text-xs sm:text-sm font-medium text-emerald-800 hover:bg-white hover:text-emerald-900 transition-colors"
          >
            Kontakt
          </Link>
        </div>
        <Link
          to="/login"
          className="hidden sm:inline-flex items-center rounded-full px-4 py-1.5 text-xs sm:text-sm font-semibold text-white shadow-md transition-colors"
          style={{ background: 'linear-gradient(135deg,#41ac53 0%,#2f855a 100%)' }}
        >
          Ulaz za članove
        </Link>
      </div>
    </nav>

    {/* Mobilni floating login – prikazuje se samo na malim ekranima */}
    <Link
      to="/login"
      className="sm:hidden fixed bottom-5 left-4 right-4 z-50 flex items-center justify-center gap-2 py-3.5 px-5 rounded-full bg-white/95 backdrop-blur-md border border-emerald-200/80 shadow-lg shadow-emerald-900/10 active:scale-[0.98] transition-transform"
      style={{ bottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <span className="text-sm font-semibold text-emerald-700">Prijavi se</span>
      <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
    </Link>
    </>
  )
}

