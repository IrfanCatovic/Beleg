import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import MarketingNavbar from "../MarketingNavbar";
import HeroDashboardMockup from "./HeroDashboardMockup";

export default function HeroLanding() {
  const { t } = useTranslation("landing");

  return (
    <header className="relative isolate overflow-hidden bg-gradient-to-b from-emerald-50/70 via-white to-white">
      <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,#41ac53_0%,transparent_55%)] opacity-[0.10]" />
        <div className="absolute -right-24 top-24 h-72 w-72 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute right-1/3 bottom-0 h-56 w-56 rounded-full bg-emerald-100/40 blur-3xl" />
        <svg
          viewBox="0 0 800 200"
          preserveAspectRatio="none"
          className="absolute inset-x-0 bottom-0 h-24 w-full text-emerald-900/[0.04]"
        >
          <path
            fill="currentColor"
            d="M0 180 L120 110 L210 150 L320 70 L420 140 L520 90 L640 150 L740 100 L800 130 L800 200 L0 200 Z"
          />
        </svg>
        <svg
          viewBox="0 0 800 200"
          preserveAspectRatio="none"
          className="absolute inset-x-0 bottom-0 h-32 w-full text-emerald-700/[0.05]"
        >
          <path
            fill="currentColor"
            d="M0 200 L80 150 L180 175 L260 130 L370 165 L470 120 L580 165 L700 140 L800 170 L800 200 L0 200 Z"
          />
        </svg>
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10 pt-6 pb-10 lg:pt-10 lg:pb-16">
        <MarketingNavbar />

        <div className="flex flex-col md:flex-row items-center gap-10 md:gap-10 lg:gap-14 mt-4 sm:mt-6">
          <div className="w-full md:flex-[1.05] flex flex-col items-start gap-5 lg:gap-6 max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              {t('hero.badge')}
            </span>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.15] text-slate-900">
              {t('hero.titleStart')}{' '}
              <span className="text-emerald-600">{t('hero.titleAccent')}</span>{' '}
              {t('hero.titleEnd')}
            </h1>

            <p className="text-base sm:text-lg text-slate-700 leading-relaxed">
              {t('hero.subtitle')}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto pt-1">
              <Link
                to="/kontakt"
                className="inline-flex items-center justify-center px-6 py-3 rounded-full text-sm sm:text-base font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/25 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                {t('hero.primaryCta')}
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center px-6 py-3 rounded-full text-sm sm:text-base font-semibold text-slate-800 bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300/60"
              >
                {t('hero.secondaryCta')}
              </a>
            </div>

            <p className="text-xs sm:text-sm text-slate-500">
              {t('hero.ctaNote')}
            </p>

            <div className="flex flex-wrap gap-2 pt-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50/70 px-3 py-1 text-xs sm:text-sm font-medium text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                {t('hero.chips.members')}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50/70 px-3 py-1 text-xs sm:text-sm font-medium text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                {t('hero.chips.actions')}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50/70 px-3 py-1 text-xs sm:text-sm font-medium text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                {t('hero.chips.payments')}
              </span>
            </div>
          </div>

          <div className="w-full md:flex-[0.95] flex justify-center md:justify-end">
            <div className="w-full max-w-md sm:max-w-lg md:max-w-md lg:max-w-xl xl:max-w-2xl">
              <HeroDashboardMockup />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
