import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import MarketingNavbar from "../MarketingNavbar";

export default function HeroLanding() {
  const { t } = useTranslation("landing");

  return (
    <header className="relative isolate overflow-hidden bg-gradient-to-b from-emerald-50/70 via-white to-white">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,#41ac53_0%,transparent_55%)] opacity-[0.10]" />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10 pt-6 pb-6 lg:pt-10 lg:pb-10">
        <MarketingNavbar />

        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-10 lg:gap-14">
          {/* Leva kolona: tekst + CTA */}
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

          {/* Desna kolona: vizual aplikacije */}
          <div className="w-full md:flex-[0.95] flex justify-center md:justify-end">
            <div className="w-full max-w-md sm:max-w-lg md:max-w-md lg:max-w-xl xl:max-w-2xl">
              <img
                src="https://res.cloudinary.com/dfvxp5rza/image/upload/v1773786067/na_vrhu_prikaz_aplikacije_na_laptopu_i_telefonu_kp9o1u.png"
                alt={t('alts.heroProduct')}
                className="rounded-3xl w-full h-auto object-contain"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
