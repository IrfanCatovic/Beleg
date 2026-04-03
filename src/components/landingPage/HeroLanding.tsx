import { useTranslation } from "react-i18next";
import MarketingNavbar from "../MarketingNavbar";

export default function HeroLanding() {
  const { t } = useTranslation("landing");
  return (
    <header className="relative isolate overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-emerald-50">
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_100%,#41ac53_0%,transparent_55%)] opacity-20 max-md:opacity-[0.12]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,#fed74c_0%,transparent_55%)] opacity-25 max-md:opacity-[0.12]" />
        </div>

        <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10 pt-8 pb-10 lg:pt-12 lg:pb-14">
          <MarketingNavbar />

          <div className="space-y-10">
            {/* Naslov + opis + CTA (levo) i slika (desno) */}
            <div className="flex flex-col md:flex-row items-center md:items-center gap-6 lg:gap-10">
              {/* Leva kolona: tekst */}
              <div className="flex-[1.1] flex flex-col items-start gap-4">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-snug max-w-2xl">
                  {t('hero.titleStart')}{' '}
                  <span className="text-emerald-600">{t('hero.titleAccent')}</span>
                </h1>

                <p className="text-base sm:text-lg text-gray-700 max-w-2xl">
                  {t('hero.subtitle')}
                </p>

                <p className="text-sm text-gray-600 max-w-xl">
                  {t('hero.support')}
                </p>

                <a
                  href="/kontakt"
                  className="inline-flex items-center justify-center px-8 py-3 rounded-full text-sm sm:text-base font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/30 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  {t('hero.cta')}
                </a>
              </div>

              {/* Desna kolona: slika */}
              <div className="flex-[0.9] flex justify-center md:justify-end">
                <div className="max-w-md sm:max-w-lg lg:max-w-xl xl:max-w-2xl">
                  <img
                    src="https://res.cloudinary.com/dfvxp5rza/image/upload/v1773786067/na_vrhu_prikaz_aplikacije_na_laptopu_i_telefonu_kp9o1u.png"
                    alt={t('alts.heroProduct')}
                    className="rounded-3xl w-full h-auto object-contain"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
  )
}