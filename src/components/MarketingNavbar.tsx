import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from './LanguageSwitcher'

export default function MarketingNavbar() {
  const { t } = useTranslation('common')

  return (
    <>
    <div className="mb-3 md:hidden flex items-center justify-end">
      <LanguageSwitcher />
    </div>
    <nav className="mb-8 sm:mb-12 flex items-center justify-between gap-4 rounded-full border border-emerald-100/70 bg-white/80 px-4 py-2 shadow-sm backdrop-blur">
      {/* Logo + home */}
      <Link
        to="/"
        className="flex items-center gap-3 group"
        aria-label={t('nav.homeAria')}
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
        </div>
      </Link>

      {/* Linkovi na stranice */}
      <div className="flex items-center gap-2 text-xs sm:text-sm">
        <div className="flex items-center gap-2 sm:gap-3 rounded-full bg-emerald-50/80 px-2 py-1 sm:px-3 sm:py-1.5">
          <Link
            to="/cena"
            className="rounded-full px-3 py-1 text-xs sm:text-sm font-medium text-emerald-800 hover:bg-white hover:text-emerald-900 transition-colors"
          >
            {t('nav.prices')}
          </Link>
          <Link
            to="/kontakt"
            className="rounded-full px-3 py-1 text-xs sm:text-sm font-medium text-emerald-800 hover:bg-white hover:text-emerald-900 transition-colors"
          >
            {t('nav.contact')}
          </Link>
        </div>
        <div className="hidden md:block">
          <LanguageSwitcher />
        </div>
        <Link
          to="/login"
          className="inline-flex items-center rounded-full px-4 py-1.5 text-xs sm:text-sm font-semibold text-white shadow-md shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        >
          {t('nav.login')}
        </Link>
      </div>
    </nav>
    </>
  )
}

