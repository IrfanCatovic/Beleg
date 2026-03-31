import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from './LanguageSwitcher'

export default function MarketingNavbar() {
  const { t } = useTranslation('common')

  return (
    <nav className="mb-8 sm:mb-12 flex items-center justify-between gap-2 sm:gap-4 rounded-full border border-emerald-100/70 bg-white/80 px-3 py-2 sm:px-4 shadow-sm backdrop-blur min-w-0">
      {/* Logo + home */}
      <Link
        to="/"
        className="flex items-center gap-2 sm:gap-3 group min-w-0 shrink"
        aria-label={t('nav.homeAria')}
      >
        <img
          src="/LogoP.jpg"
          alt={t('appName')}
          className="h-9 w-9 shrink-0 rounded-2xl shadow-md shadow-emerald-500/40 group-hover:scale-105 transition-transform"
        />
        <div className="leading-tight min-w-0 max-w-[5.5rem] sm:max-w-none">
          <p className="text-sm sm:text-lg font-semibold tracking-tight text-slate-900 truncate">
            {t('appName')}
          </p>
        </div>
      </Link>

      {/* Linkovi, jezik (kompaktno na mobilnom u istom redu), login */}
      <div className="flex items-center justify-end gap-1.5 sm:gap-2 text-xs sm:text-sm min-w-0">
        <div className="flex items-center gap-1 sm:gap-2 md:gap-3 rounded-full bg-emerald-50/80 px-1.5 py-1 sm:px-3 sm:py-1.5 min-w-0">
          <Link
            to="/cena"
            className="rounded-full px-2 sm:px-3 py-1 text-[11px] sm:text-sm font-medium text-emerald-800 hover:bg-white hover:text-emerald-900 transition-colors whitespace-nowrap"
          >
            {t('nav.prices')}
          </Link>
          <Link
            to="/kontakt"
            className="rounded-full px-2 sm:px-3 py-1 text-[11px] sm:text-sm font-medium text-emerald-800 hover:bg-white hover:text-emerald-900 transition-colors whitespace-nowrap"
          >
            {t('nav.contact')}
          </Link>
        </div>
        <div className="shrink-0 md:hidden">
          <LanguageSwitcher compact />
        </div>
        <div className="hidden md:block shrink-0">
          <LanguageSwitcher />
        </div>
        <Link
          to="/login"
          className="inline-flex items-center shrink-0 rounded-full px-3 sm:px-4 py-1.5 text-[11px] sm:text-sm font-semibold text-white shadow-md shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/30 whitespace-nowrap"
        >
          {t('nav.login')}
        </Link>
      </div>
    </nav>
  )
}

