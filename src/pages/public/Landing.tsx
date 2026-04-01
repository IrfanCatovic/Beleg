// Lokalne slike zamenjene Cloudinary URL-ovima direktno u JSX
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import HeroLanding from '../../components/landingPage/HeroLanding'
import WhyPlaniner from '../../components/landingPage/WhyPlaniner'

function IconCheck(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 text-emerald-600"
      {...props}
    >
      <path
        d="M20 7L10 17L4 11"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconSparkles(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 text-yellow-500"
      {...props}
    >
      <path
        d="M5 3L6.5 7.5L11 9L6.5 10.5L5 15L3.5 10.5L-1 9L3.5 7.5L5 3Z"
        transform="translate(8 1)"
        fill="currentColor"
      />
      <circle cx="6" cy="6" r="1" fill="currentColor" />
      <circle cx="18" cy="8" r="1.2" fill="currentColor" />
    </svg>
  )
}

export default function Landing() {

  const navigate = useNavigate()
  const { t } = useTranslation('landing')
  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900">
      
      <HeroLanding />
      <WhyPlaniner />
      

      {/* Mountain band segment sa porukom */}
      <section className="relative w-full bg-slate-900 text-white">
        <div className="relative w-full h-56 sm:h-72 md:h-80 lg:h-96 overflow-hidden">
          <img
            src="https://res.cloudinary.com/dfvxp5rza/image/upload/v1773786066/planinski_pejza%C5%BE_vpdfmb.jpg"
            alt={t('alts.mountainLandscape')}
            className="w-full h-full object-cover"
            style={{ objectPosition: 'center center' }}
          />

          {/* Tamni overlay za čitljiv tekst */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/70 via-slate-900/30 to-slate-900/80" />

          {/* Tekst preko slike */}
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <div className="max-w-3xl text-center">
              <p className="text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase text-emerald-200 mb-3">
                {t('mountainBand.badge')}
              </p>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-3 sm:mb-4 leading-snug">
                {t('mountainBand.title')}
              </h2>
              <p className="text-sm sm:text-base text-slate-100 max-w-2xl mx-auto">
                {t('mountainBand.subtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* Donji cik-cak border prema sledećem delu (belom) */}
        <div className="absolute -bottom-6 left-0 right-0 h-6 overflow-hidden text-white">
          <svg
            viewBox="0 0 100 10"
            preserveAspectRatio="none"
            className="w-full h-full"
          >
            <polygon
              fill="white"
              points="0,0 0,10 5,5 10,10 15,5 20,10 25,5 30,10 35,5 40,10 45,5 50,10 55,5 60,10 65,5 70,10 75,5 80,10 85,5 90,10 95,5 100,10 100,0"
            />
          </svg>
        </div>
      </section>

      <main className="flex-1">
        {/* Problemi -> Rešenja */}
        <section className="py-16 sm:py-20 bg-white relative isolate overflow-hidden">
          <div className="pointer-events-none absolute inset-0 z-0 opacity-40 max-md:opacity-[0.14]">
            <div className="absolute -left-32 max-md:-left-48 top-10 h-64 max-md:h-44 w-64 max-md:w-44 rounded-full bg-emerald-50" />
            <div className="absolute -right-32 max-md:-right-48 bottom-0 h-80 max-md:h-48 w-80 max-md:w-48 rounded-full bg-yellow-50" />
          </div>
          <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold mb-4">{t('solve.title')}</h2>
              <p className="text-gray-600 text-sm sm:text-base max-w-2xl mx-auto">
                {t('solve.subtitle')}
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full bg-red-100">
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-red-500">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                      <line x1="12" y1="8" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <circle cx="12" cy="16.5" r="1.2" fill="currentColor" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-500">{t('solve.problemLabel')}</p>
                </div>
                <p className="text-sm font-semibold mb-3">
                  {t('solve.cards.c1.problemTitle')}
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  {t('solve.cards.c1.problemText')}
                </p>
                <div className="border-t border-dashed border-gray-200 mt-3 pt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100">
                      <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 text-emerald-600">
                        <path d="M20 7L10 17L4 11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold text-emerald-700">{t('solve.solutionLabel')}</p>
                  </div>
                  <p className="text-xs text-gray-600">
                    {t('solve.cards.c1.solutionText')}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full bg-red-100">
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-red-500">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                      <line x1="12" y1="8" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <circle cx="12" cy="16.5" r="1.2" fill="currentColor" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-500">{t('solve.problemLabel')}</p>
                </div>
                <p className="text-sm font-semibold mb-3">
                  {t('solve.cards.c2.problemTitle')}
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  {t('solve.cards.c2.problemText')}
                </p>
                <div className="border-t border-dashed border-gray-200 mt-3 pt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100">
                      <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 text-emerald-600">
                        <path d="M20 7L10 17L4 11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold text-emerald-700">{t('solve.solutionLabel')}</p>
                  </div>
                  <p className="text-xs text-gray-600">
                    {t('solve.cards.c2.solutionText')}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full bg-red-100">
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-red-500">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                      <line x1="12" y1="8" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <circle cx="12" cy="16.5" r="1.2" fill="currentColor" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-500">{t('solve.problemLabel')}</p>
                </div>
                <p className="text-sm font-semibold mb-3">
                  {t('solve.cards.c3.problemTitle')}
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  {t('solve.cards.c3.problemText')}
                </p>
                <div className="border-t border-dashed border-gray-200 mt-3 pt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100">
                      <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 text-emerald-600">
                        <path d="M20 7L10 17L4 11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold text-emerald-700">{t('solve.solutionLabel')}</p>
                  </div>
                  <p className="text-xs text-gray-600">
                    {t('solve.cards.c3.solutionTextStart')} <span className="font-semibold">200 {t('solve.cards.c3.solutionTextHours')}</span>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Za člana: kako radi, zašto je zanimljivo, zajednica, napredak, takmičenje */}
        <section id="za-clana" className="py-16 sm:py-20 bg-gradient-to-b from-slate-50 to-white">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10">
            <div className="text-center mb-12">
              <p className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700 mb-3">
                {t('member.badge')}
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">
                {t('member.title')}
              </h2>
              <p className="text-gray-600 text-sm sm:text-base max-w-2xl mx-auto">
                {t('member.subtitle')}
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {/* Kako koristiš aplikaciju */}
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-100">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-emerald-600">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">{t('member.howForYou')}</h3>
                </div>
                <ul className="space-y-3 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 text-emerald-500 shrink-0" />
                    <span>{t('member.howList.1')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 text-emerald-500 shrink-0" />
                    <span>{t('member.howList.2')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 text-emerald-500 shrink-0" />
                    <span>{t('member.howList.3')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 text-emerald-500 shrink-0" />
                    <span>{t('member.howList.4')}</span>
                  </li>
                </ul>
              </div>

              {/* Interakcija sa ostalim planinarima */}
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-xl bg-blue-100">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-blue-600">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">{t('member.community')}</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  {t('member.communityIntro')}
                </p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 text-blue-500 shrink-0" />
                    <span>{t('member.communityList.1')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 text-blue-500 shrink-0" />
                    <span>{t('member.communityList.2')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 text-blue-500 shrink-0" />
                    <span>{t('member.communityList.3')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 text-blue-500 shrink-0" />
                    <span>{t('member.communityList.4')}</span>
                  </li>
                </ul>
              </div>

              {/* Beleženje napretka i takmičenje */}
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-xl bg-amber-100">
                    <IconSparkles className="h-5 w-5 text-amber-600" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">{t('member.progress')}</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  {t('member.progressIntro')}
                </p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 text-amber-500 shrink-0" />
                    <span>{t('member.progressList.1')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 text-amber-500 shrink-0" />
                    <span>{t('member.progressList.2')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 text-amber-500 shrink-0" />
                    <span>{t('member.progressList.3')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 text-amber-500 shrink-0" />
                    <span>{t('member.progressList.4')}</span>
                  </li>
                </ul>
              </div>
            </div>

            <p className="text-center text-sm text-gray-500 mt-8">
              {t('member.ctaText')}{' '}
              <a href="#cta" className="font-semibold text-emerald-600 hover:text-emerald-700 underline">
                {t('member.ctaLink')}
              </a>
              .
            </p>
          </div>
        </section>

        {/* Ranking i mini takmičenja */}
        <section className="py-16 sm:py-20 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-slate-50">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10">
            <div className="flex flex-col lg:flex-row items-center lg:items-start gap-8 lg:gap-12">
              {/* Tekst levo */}
              <div className="flex-[1.1] max-w-3xl">
                <p className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300 mb-3">
                  <IconSparkles className="h-3.5 w-3.5 text-emerald-300" />
                  {t('ranking.badge')}
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold mb-3">
                  {t('ranking.title')}
                </h2>
                <p className="text-sm sm:text-base text-slate-200 mb-4 max-w-xl">
                  {t('ranking.subtitle')}
                </p>
                <ul className="space-y-2 text-xs sm:text-sm text-slate-200">
                  <li className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
                    <span>
                      {t('ranking.list.1')}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
                    <span>
                      {t('ranking.list.2')}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
                    <span>
                      {t('ranking.list.3')}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
                    <span>
                      {t('ranking.list.4')}
                    </span>
                  </li>
                </ul>
              </div>

              {/* Kartica profila desno (hero slaganje) */}
              <div className="flex-[0.9] flex justify-center lg:justify-end">
                <div className="w-full max-w-sm md:max-w-md rounded-3xl border border-emerald-500/20 bg-slate-900/60 p-4 sm:p-5 shadow-2xl shadow-black/40">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{t('ranking.mock.profileLabel')}</p>
                      <p className="text-sm font-semibold text-slate-50">{t('ranking.mock.name')}</p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300">
                      {t('ranking.mock.rank')}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center mb-4">
                    <div className="rounded-2xl bg-slate-800/70 px-3 py-2">
                      <p className="text-[10px] text-slate-400 mb-1">{t('ranking.mock.totalKm')}</p>
                      <p className="text-sm font-semibold text-slate-50">182</p>
                    </div>
                    <div className="rounded-2xl bg-slate-800/70 px-3 py-2">
                      <p className="text-[10px] text-slate-400 mb-1">{t('ranking.mock.totalAscent')}</p>
                      <p className="text-sm font-semibold text-slate-50">6 450 m</p>
                    </div>
                    <div className="rounded-2xl bg-slate-800/70 px-3 py-2">
                      <p className="text-[10px] text-slate-400 mb-1">{t('ranking.mock.actions')}</p>
                      <p className="text-sm font-semibold text-slate-50">24</p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-800/80 px-3 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] text-slate-400">{t('ranking.mock.season')}</p>
                      <p className="text-xs text-slate-100">{t('ranking.mock.placement')}</p>
                    </div>
                    <button
                      type="button"
                      className="ml-3 inline-flex items-center rounded-full bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-slate-900 hover:bg-emerald-400 transition-colors"
                    >
                      {t('ranking.mock.share')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Ključne funkcionalnosti */}
        <section id="features" className="py-16 sm:py-20 bg-emerald-50/60 relative isolate overflow-hidden">
          <div className="pointer-events-none absolute inset-0 z-0 opacity-50 max-md:opacity-[0.18]">
            <div className="absolute -right-24 max-md:-right-40 -top-10 max-md:-top-6 h-56 max-md:h-36 w-56 max-md:w-36 rounded-full bg-white/60" />
            <div className="absolute -left-24 max-md:-left-40 bottom-0 h-48 max-md:h-32 w-48 max-md:w-32 rounded-full bg-emerald-100/70" />
          </div>
          <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">{t('features.title')}</h2>
              <p className="text-gray-600 text-sm sm:text-base max-w-3xl mx-auto">
                {t('features.subtitle')}
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="group rounded-2xl bg-white shadow-sm border border-emerald-100 p-5 hover:shadow-lg hover:border-emerald-200 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold mb-2 text-emerald-900">{t('features.cards.members.title')}</h3>
                    <p className="text-xs text-gray-600 mb-3">
                      {t('features.cards.members.text1')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {t('features.cards.members.text2')}
                    </p>
                  </div>
                  <div className="shrink-0 inline-flex items-center justify-center h-11 w-11 rounded-xl bg-emerald-100 group-hover:bg-emerald-200 transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-emerald-600">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="group rounded-2xl bg-white shadow-sm border border-blue-100 p-5 hover:shadow-lg hover:border-blue-200 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold mb-2 text-blue-900">{t('features.cards.actions.title')}</h3>
                    <p className="text-xs text-gray-600 mb-3">
                      {t('features.cards.actions.text1')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {t('features.cards.actions.text2')}
                    </p>
                  </div>
                  <div className="shrink-0 inline-flex items-center justify-center h-11 w-11 rounded-xl bg-blue-100 group-hover:bg-blue-200 transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-blue-600">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="group rounded-2xl bg-white shadow-sm border border-amber-100 p-5 hover:shadow-lg hover:border-amber-200 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold mb-2 text-amber-900">{t('features.cards.finance.title')}</h3>
                    <p className="text-xs text-gray-600 mb-3">
                      {t('features.cards.finance.text1')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {t('features.cards.finance.text2')}
                    </p>
                  </div>
                  <div className="shrink-0 inline-flex items-center justify-center h-11 w-11 rounded-xl bg-amber-100 group-hover:bg-amber-200 transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-amber-600">
                      <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
                      <path d="M4 6v12a2 2 0 0 0 2 2h14v-4" />
                      <circle cx="18" cy="14" r="1" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="group rounded-2xl bg-white shadow-sm border border-violet-100 p-5 hover:shadow-lg hover:border-violet-200 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold mb-2 text-violet-900">{t('features.cards.notifications.title')}</h3>
                    <p className="text-xs text-gray-600 mb-3">
                      {t('features.cards.notifications.text1')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {t('features.cards.notifications.text2')}
                    </p>
                  </div>
                  <div className="shrink-0 inline-flex items-center justify-center h-11 w-11 rounded-xl bg-violet-100 group-hover:bg-violet-200 transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-violet-600">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="group rounded-2xl bg-white shadow-sm border border-rose-100 p-5 hover:shadow-lg hover:border-rose-200 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold mb-2 text-rose-900">{t('features.cards.pdf.title')}</h3>
                    <p className="text-xs text-gray-600 mb-3">
                      {t('features.cards.pdf.text1')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {t('features.cards.pdf.text2')}
                    </p>
                  </div>
                  <div className="shrink-0 inline-flex items-center justify-center h-11 w-11 rounded-xl bg-rose-100 group-hover:bg-rose-200 transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-rose-600">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="group rounded-2xl bg-white shadow-sm border border-sky-100 p-5 hover:shadow-lg hover:border-sky-200 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold mb-2 text-sky-900">{t('features.cards.publicProfile.title')}</h3>
                    <p className="text-xs text-gray-600">
                      {t('features.cards.publicProfile.text1')}
                    </p>
                  </div>
                  <div className="shrink-0 inline-flex items-center justify-center h-11 w-11 rounded-xl bg-sky-100 group-hover:bg-sky-200 transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-sky-600">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                      <path d="M16 3l2 2-2 2" fill="none" />
                      <polygon points="22 2 22 6 18 4" fill="currentColor" stroke="none" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Kako funkcioniše */}
        <section id="how-it-works" className="py-16 sm:py-20 bg-white">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">{t('how.title')}</h2>
              <p className="text-gray-600 text-sm sm:text-base max-w-2xl mx-auto">
                {t('how.subtitle')}
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {[
                { title: t('how.steps.1.title'), text: t('how.steps.1.text'), step: '01' },
                { title: t('how.steps.2.title'), text: t('how.steps.2.text'), step: '02' },
                { title: t('how.steps.3.title'), text: t('how.steps.3.text'), step: '03' },
              ].map(({ title, text, step }, i) => {
                const colors = [
                  'bg-emerald-100 text-emerald-800 border-emerald-200',
                  'bg-blue-100 text-blue-800 border-blue-200',
                  'bg-amber-100 text-amber-800 border-amber-200',
                ]
                const borders = [
                  'border-emerald-100 hover:border-emerald-200',
                  'border-blue-100 hover:border-blue-200',
                  'border-amber-100 hover:border-amber-200',
                ]
                return (
                  <div
                    key={step}
                    className={`relative rounded-2xl border p-5 shadow-sm bg-white hover:shadow-md transition-all ${borders[i]}`}
                  >
                    <div className={`absolute -top-3 left-4 inline-flex items-center justify-center h-7 px-3 rounded-full border text-[10px] font-semibold ${colors[i]}`}>
                      {t('how.stepPrefix')} {step}
                    </div>
                    <h3 className="mt-3 mb-2 text-sm font-semibold">{title}</h3>
                    <p className="text-xs text-gray-600">{text}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Komunitet i podrška */}
        <section className="py-16 sm:py-20 bg-slate-50">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10">
            <div className="flex flex-col lg:flex-row items-center lg:items-start gap-8 lg:gap-12">
              {/* Tekst levo */}
              <div className="flex-[1.1]">
                <h2 className="text-2xl sm:text-3xl font-bold mb-4">{t('partner.title')}</h2>
                <p className="text-sm sm:text-base text-gray-600 mb-6">
                  {t('partner.subtitle')}
                </p>

                <div className="space-y-5 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5 inline-flex items-center justify-center h-9 w-9 rounded-xl bg-emerald-100">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5 text-emerald-600">
                        <polyline points="16 18 22 12 16 6" />
                        <polyline points="8 6 2 12 8 18" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 mb-1">{t('partner.items.1.title')}</p>
                      <p className="text-xs text-gray-600">
                        {t('partner.items.1.text')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5 inline-flex items-center justify-center h-9 w-9 rounded-xl bg-blue-100">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5 text-blue-600">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 mb-1">{t('partner.items.2.title')}</p>
                      <p className="text-xs text-gray-600">
                        {t('partner.items.2.text')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5 inline-flex items-center justify-center h-9 w-9 rounded-xl bg-amber-100">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5 text-amber-600">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 mb-1">{t('partner.items.3.title')}</p>
                      <p className="text-xs text-gray-600">
                        {t('partner.items.3.text')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Slika tima desno */}
              <div className="flex-[0.9] flex justify-center lg:justify-end">
                <div className="w-full max-w-sm">
                  <div className="rounded-3xl bg-white border border-slate-100 shadow-md overflow-hidden">
                    <img
                      src="https://res.cloudinary.com/dfvxp5rza/image/upload/v1773786065/teamwork_nfwwcv.jpg"
                      alt={t('alts.partnerTeam')}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-center text-[11px] text-gray-400 mt-2">{t('partner.imageCaption')}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Planinar band segment sa porukom */}
        <section className="relative w-full bg-slate-900 text-white">
          <div className="relative w-full h-56 sm:h-72 md:h-80 lg:h-96 overflow-hidden">
            <img
              src="https://res.cloudinary.com/dfvxp5rza/image/upload/v1773786066/planinar_na_stazi_zaz7p3.jpg"
              alt={t('alts.hikerOnTrail')}
              className="w-full h-full object-cover filter blur-[1px] scale-105"
              style={{ objectPosition: 'center 65%' }}
            />

            {/* Tamni overlay za čitljiv tekst */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/40 to-slate-900/90" />

            {/* Tekst preko slike */}
            <div className="absolute inset-0 flex items-center justify-center px-4">
              <div className="max-w-3xl text-center">
                <p className="text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase text-emerald-200 mb-3">
                  {t('memberBand.badge')}
                </p>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-3 sm:mb-4 leading-snug">
                  {t('memberBand.title')}
                </h2>
                <p className="text-sm sm:text-base text-slate-100 max-w-2xl mx-auto">
                  {t('memberBand.subtitle')}
                </p>
              </div>
            </div>
          </div>

          {/* Donji cik-cak border prema sledećem belom segmentu */}
          <div className="absolute -bottom-6 left-0 right-0 h-6 overflow-hidden text-white">
            <svg
              viewBox="0 0 100 10"
              preserveAspectRatio="none"
              className="w-full h-full"
            >
              <polygon
                fill="white"
                points="0,0 0,10 5,5 10,10 15,5 20,10 25,5 30,10 35,5 40,10 45,5 50,10 55,5 60,10 65,5 70,10 75,5 80,10 85,5 90,10 95,5 100,10 100,0"
              />
            </svg>
          </div>
        </section>

        {/* Brojevi i benefiti */}
        <section className="py-16 sm:py-20 bg-white relative isolate overflow-hidden">
          <div className="pointer-events-none absolute inset-0 z-0 opacity-40 max-md:opacity-[0.14]">
            <div className="absolute -left-28 max-md:-left-44 top-16 max-md:top-8 h-52 max-md:h-36 w-52 max-md:w-36 rounded-full bg-emerald-50" />
            <div className="absolute -right-24 max-md:-right-40 bottom-10 max-md:bottom-4 h-60 max-md:h-40 w-60 max-md:w-40 rounded-full bg-slate-50" />
          </div>
          <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">{t('benefits.title')}</h2>
              <p className="text-gray-600 text-sm sm:text-base max-w-2xl mx-auto">
                {t('benefits.subtitle')}
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 text-center hover:shadow-md transition-shadow">
                <div className="mx-auto mb-3 inline-flex items-center justify-center h-10 w-10 rounded-full bg-emerald-200/60">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-emerald-700">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-emerald-800 mb-1">{t('benefits.cards.time.title')}</p>
                <p className="text-2xl font-extrabold text-emerald-700 mb-1">200+</p>
                <p className="text-[11px] text-emerald-900/80">{t('benefits.cards.time.text')}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-center hover:shadow-md transition-shadow">
                <div className="mx-auto mb-3 inline-flex items-center justify-center h-10 w-10 rounded-full bg-slate-200/60">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-slate-700">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-slate-800 mb-1">{t('benefits.cards.errors.title')}</p>
                <p className="text-2xl font-extrabold text-slate-800 mb-1">0</p>
                <p className="text-[11px] text-slate-900/80">
                  {t('benefits.cards.errors.text')}
                </p>
              </div>
              <div className="rounded-2xl border border-yellow-100 bg-yellow-50 p-5 text-center hover:shadow-md transition-shadow">
                <div className="mx-auto mb-3 inline-flex items-center justify-center h-10 w-10 rounded-full bg-yellow-200/60">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-yellow-800">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-yellow-900 mb-1">{t('benefits.cards.communication.title')}</p>
                <p className="text-2xl font-extrabold text-yellow-900 mb-1">x3</p>
                <p className="text-[11px] text-yellow-900/90">
                  {t('benefits.cards.communication.text')}
                </p>
              </div>
              <div className="rounded-2xl border border-violet-100 bg-violet-50/40 p-5 text-center hover:shadow-md transition-shadow">
                <div className="mx-auto mb-3 inline-flex items-center justify-center h-10 w-10 rounded-full bg-violet-200/60">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-violet-700">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-violet-800 mb-1">{t('benefits.cards.transparency.title')}</p>
                <p className="text-2xl font-extrabold text-violet-700 mb-1">100%</p>
                <p className="text-[11px] text-violet-900/80">
                  {t('benefits.cards.transparency.text')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Social proof  citati korisnika */}
        <section className="py-14 sm:py-18 bg-slate-50 border-y border-slate-100">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 mb-8">{t('testimonials.title')}</p>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
                <div className="flex gap-0.5 mb-3">
                  {[...Array(5)].map((_, i) => <svg key={i} viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-yellow-400"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" /></svg>)}
                </div>
                <p className="text-sm text-gray-700 italic mb-4">
                  {t('testimonials.items.1.quote')}
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700">M</div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{t('testimonials.items.1.name')} <span className="font-normal text-gray-400"> {t('testimonials.items.1.role')}</span></p>
                    <p className="text-[11px] text-gray-400">{t('testimonials.items.1.club')}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
                <div className="flex gap-0.5 mb-3">
                  {[...Array(5)].map((_, i) => <svg key={i} viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-yellow-400"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" /></svg>)}
                </div>
                <p className="text-sm text-gray-700 italic mb-4">
                  {t('testimonials.items.2.quote')}
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-700">J</div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{t('testimonials.items.2.name')} <span className="font-normal text-gray-400"> {t('testimonials.items.2.role')}</span></p>
                    <p className="text-[11px] text-gray-400">{t('testimonials.items.2.club')}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
                <div className="flex gap-0.5 mb-3">
                  {[...Array(5)].map((_, i) => <svg key={i} viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-yellow-400"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" /></svg>)}
                </div>
                <p className="text-sm text-gray-700 italic mb-4">
                  {t('testimonials.items.3.quote')}
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-sky-100 flex items-center justify-center text-xs font-bold text-sky-700">N</div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{t('testimonials.items.3.name')} <span className="font-normal text-gray-400"> {t('testimonials.items.3.role')}</span></p>
                    <p className="text-[11px] text-gray-400">{t('testimonials.items.3.club')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Za koga je */}
        <section id="for-whom" className="py-16 sm:py-20 bg-emerald-50/60">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">{t('audience.title')}</h2>
              <p className="text-gray-600 text-sm sm:text-base max-w-3xl mx-auto">
                {t('audience.subtitle')}
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="group rounded-2xl bg-white border border-emerald-100 p-5 hover:shadow-lg hover:border-emerald-200 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-emerald-700 mb-1">{t('audience.cards.president.title')}</p>
                    <p className="text-sm font-semibold mb-2">
                      {t('audience.cards.president.subtitle')}
                    </p>
                    <p className="text-xs text-gray-600">
                      {t('audience.cards.president.text')}
                    </p>
                  </div>
                  <div className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-xl bg-emerald-100 group-hover:bg-emerald-200 transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5 text-emerald-600">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="group rounded-2xl bg-white border border-blue-100 p-5 hover:shadow-lg hover:border-blue-200 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-blue-700 mb-1">{t('audience.cards.secretary.title')}</p>
                    <p className="text-sm font-semibold mb-2">
                      {t('audience.cards.secretary.subtitle')}
                    </p>
                    <p className="text-xs text-gray-600">
                      {t('audience.cards.secretary.text')}
                    </p>
                  </div>
                  <div className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-xl bg-blue-100 group-hover:bg-blue-200 transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5 text-blue-600">
                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="group rounded-2xl bg-white border border-amber-100 p-5 hover:shadow-lg hover:border-amber-200 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-amber-700 mb-1">{t('audience.cards.guide.title')}</p>
                    <p className="text-sm font-semibold mb-2">
                      {t('audience.cards.guide.subtitle')}
                    </p>
                    <p className="text-xs text-gray-600">
                      {t('audience.cards.guide.text')}
                    </p>
                  </div>
                  <div className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-xl bg-amber-100 group-hover:bg-amber-200 transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5 text-amber-600">
                      <circle cx="12" cy="12" r="10" />
                      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="group rounded-2xl bg-white border border-violet-100 p-5 hover:shadow-lg hover:border-violet-200 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-violet-700 mb-1">{t('audience.cards.treasurer.title')}</p>
                    <p className="text-sm font-semibold mb-2">
                      {t('audience.cards.treasurer.subtitle')}
                    </p>
                    <p className="text-xs text-gray-600">
                      {t('audience.cards.treasurer.text')}
                    </p>
                  </div>
                  <div className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-xl bg-violet-100 group-hover:bg-violet-200 transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5 text-violet-600">
                      <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
                      <path d="M4 6v12a2 2 0 0 0 2 2h14v-4" />
                      <circle cx="18" cy="14" r="1" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* UI preview  premium showcase */}
        <section className="relative isolate py-20 sm:py-28 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 overflow-hidden">
          {/* Ambient glow effects, iza teksta; na mobilu manji i slabiji da ne prekrivaju naslove */}
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 md:left-1/4 md:translate-x-0 w-[min(100vw,280px)] h-[min(100vw,280px)] md:w-[600px] md:h-[600px] bg-emerald-500/10 rounded-full blur-[80px] md:blur-[120px] max-md:opacity-40" />
            <div className="absolute bottom-0 right-1/2 translate-x-1/2 md:right-1/4 md:translate-x-0 w-[min(100vw,240px)] h-[min(100vw,240px)] md:w-[500px] md:h-[500px] bg-sky-500/8 rounded-full blur-[70px] md:blur-[100px] max-md:opacity-35" />
          </div>

          <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10">
            {/* Header */}
            <div className="text-center mb-16 sm:mb-20">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400 mb-3">{t('showcase.badge')}</p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4 tracking-tight">
                {t('showcase.title')}
              </h2>
              <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
                {t('showcase.subtitle')}
              </p>
            </div>

            <div className="space-y-24 sm:space-y-32">

              {/* ── 1. Akcije ── */}
              <div className="grid gap-10 lg:gap-16 lg:grid-cols-[1fr,1.4fr] items-center">
                {/* Tekst levo */}
                <div>
                  <span className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-bold mb-4">1</span>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">{t('showcase.sections.actions.title')}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed mb-5">
                    {t('showcase.sections.actions.text')}
                  </p>
                  <div className="flex gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{t('showcase.desktop')}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-sky-400 bg-sky-500/10 px-3 py-1 rounded-full">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />{t('showcase.mobile')}
                    </span>
                  </div>
                </div>
                {/* Slike desno PC veći, dva mobilna preklapaju */}
                <div className="relative">
                  {/* PC screenshot browser frame */}
                  <div className="rounded-xl overflow-hidden shadow-2xl shadow-black/40 ring-1 ring-white/10">
                    <div className="bg-slate-700 px-4 py-2 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                      <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/80" />
                      <span className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
                      <span className="ml-3 text-[10px] text-slate-400 truncate">{t('showcase.sections.actions.url')}</span>
                    </div>
                    <img src="https://res.cloudinary.com/dfvxp5rza/image/upload/v1774599673/akcije1_oj61lo.png" alt={t('alts.showcaseActionsPc')} className="w-full h-auto" />
                  </div>
                  {/* Mobilni ekrani lebde preko donjeg desnog ugla */}
                  <div className="absolute -bottom-8 -right-2 sm:-right-4 flex gap-2 sm:gap-3">
                    <div className="w-[90px] sm:w-[110px] rounded-xl overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-white/10 bg-slate-800">
                      <img src="https://res.cloudinary.com/dfvxp5rza/image/upload/v1774599687/akcijemob_yom0bu.png" alt={t('alts.showcaseActionsMobile')} className="w-full h-auto" />
                    </div>

                  </div>
                </div>
              </div>

              {/* ── 2. Profili obrnut layout: slike levo, tekst desno ── */}
              <div className="grid gap-10 lg:gap-16 lg:grid-cols-[1.4fr,1fr] items-center">
                {/* Slike levo */}
                <div className="relative order-2 lg:order-1">
                  <div className="rounded-xl overflow-hidden shadow-2xl shadow-black/40 ring-1 ring-white/10">
                    <div className="bg-slate-700 px-4 py-2 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                      <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/80" />
                      <span className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
                      <span className="ml-3 text-[10px] text-slate-400 truncate">{t('showcase.sections.profiles.url')}</span>
                    </div>
                    <img src="https://res.cloudinary.com/dfvxp5rza/image/upload/v1774599671/profil1_cdpfbc.png" alt={t('alts.showcaseProfilesPc')} className="w-full h-auto" />
                  </div>
                  <div className="absolute -bottom-8 -left-2 sm:-left-4 flex gap-2 sm:gap-3">
                    <div className="w-[90px] sm:w-[110px] rounded-xl overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-white/10 bg-slate-800">
                      <img src="https://res.cloudinary.com/dfvxp5rza/image/upload/v1774599686/profil1mob_ayuax1.png" alt={t('alts.showcaseProfilesMobile')} className="w-full h-auto" />
                    </div>
                  </div>
                </div>
                {/* Tekst desno */}
                <div className="order-1 lg:order-2">
                  <span className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-sky-500/20 text-sky-400 text-sm font-bold mb-4">2</span>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">{t('showcase.sections.profiles.title')}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed mb-5">
                    {t('showcase.sections.profiles.text')}
                  </p>
                  <div className="flex gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{t('showcase.desktop')}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-sky-400 bg-sky-500/10 px-3 py-1 rounded-full">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />{t('showcase.mobile')}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── 3. Finansije ── */}
              <div className="grid gap-10 lg:gap-16 lg:grid-cols-[1fr,1.4fr] items-center">
                <div>
                  <span className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-amber-500/20 text-amber-400 text-sm font-bold mb-4">3</span>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">{t('showcase.sections.finance.title')}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed mb-5">
                    {t('showcase.sections.finance.text')}
                  </p>
                  <div className="flex gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{t('showcase.desktop')}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-sky-400 bg-sky-500/10 px-3 py-1 rounded-full">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />{t('showcase.mobile')}
                    </span>
                  </div>
                </div>
                <div className="relative">
                  <div className="rounded-xl overflow-hidden shadow-2xl shadow-black/40 ring-1 ring-white/10">
                    <div className="bg-slate-700 px-4 py-2 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                      <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/80" />
                      <span className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
                      <span className="ml-3 text-[10px] text-slate-400 truncate">{t('showcase.sections.finance.url')}</span>
                    </div>
                    <img src="https://res.cloudinary.com/dfvxp5rza/image/upload/v1774599654/finansije1_hr2nix.png" alt={t('alts.showcaseFinancePc')} className="w-full h-auto" />
                  </div>
                  <div className="absolute -bottom-8 -right-2 sm:-right-4">
                    <div className="w-[90px] sm:w-[110px] rounded-xl overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-white/10 bg-slate-800">
                      <img src="https://res.cloudinary.com/dfvxp5rza/image/upload/v1774599666/finansije1mob_khecis.png" alt={t('alts.showcaseFinanceMobile')} className="w-full h-auto" />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── 4. Zadaci obrnut layout ── */}
              <div className="grid gap-10 lg:gap-16 lg:grid-cols-[1.4fr,1fr] items-center">
                <div className="relative order-2 lg:order-1">
                  <div className="rounded-xl overflow-hidden shadow-2xl shadow-black/40 ring-1 ring-white/10">
                    <div className="bg-slate-700 px-4 py-2 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                      <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/80" />
                      <span className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
                      <span className="ml-3 text-[10px] text-slate-400 truncate">{t('showcase.sections.tasks.url')}</span>
                    </div>
                    <img src="https://res.cloudinary.com/dfvxp5rza/image/upload/v1774599658/zadaci1_cp4vpj.png" alt={t('alts.showcaseTasksPc')} className="w-full h-auto" />
                  </div>
                  <div className="absolute -bottom-8 -left-2 sm:-left-4">
                    <div className="w-[90px] sm:w-[110px] rounded-xl overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-white/10 bg-slate-800">
                      <img src="https://res.cloudinary.com/dfvxp5rza/image/upload/v1774599663/zadaci1mob_mibpje.png" alt={t('alts.showcaseTasksMobile')} className="w-full h-auto" />
                    </div>
                  </div>
                </div>
                <div className="order-1 lg:order-2">
                  <span className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-violet-500/20 text-violet-400 text-sm font-bold mb-4">4</span>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">{t('showcase.sections.tasks.title')}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed mb-5">
                    {t('showcase.sections.tasks.text')}
                  </p>
                  <div className="flex gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{t('showcase.desktop')}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-sky-400 bg-sky-500/10 px-3 py-1 rounded-full">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />{t('showcase.mobile')}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* CTA pri dnu */}
        <section id="cta" className="py-16 sm:py-20 bg-gradient-to-br from-emerald-700 via-emerald-800 to-slate-900 text-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-8 lg:px-10 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              {t('cta.title')}
            </h2>
            <p className="text-sm sm:text-base text-emerald-50 mb-8">
              {t('cta.subtitle')}
            </p>
            <div className="flex flex-wrap gap-4 justify-center mb-3">
              <a
                onClick={() => navigate('/kontakt')}
                className="cursor-pointer inline-flex items-center justify-center px-8 py-3 rounded-full text-sm sm:text-base font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                {t('cta.bookDemo')}
              </a>
              <a
                onClick={() => navigate('/kontakt')}
                className="cursor-pointer inline-flex items-center justify-center px-7 py-3 rounded-full text-sm sm:text-base font-semibold border border-emerald-200 text-emerald-100 bg-transparent hover:bg-emerald-700/30 hover:border-emerald-300 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                {t('cta.sendInquiry')}
              </a>
            </div>
            <p className="text-xs text-emerald-200/60 mb-6">
              {t('cta.note')}
            </p>
            <div className="border-t border-emerald-500/20 pt-5">
              <p className="text-xs text-emerald-100/70 mb-2">{t('cta.wantDemo')}</p>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-300 hover:text-white transition-colors"
              >
                {t('cta.viewDemo')}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
              </button>
              <p className="mt-2 text-[11px] text-emerald-200/80">{t('cta.demoCreds')}</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 bg-slate-900 text-slate-200">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src="/LogoP.jpg" alt={t('common:appName')} className="h-8 w-8 rounded-lg" />
              <div>
                <p className="text-sm font-semibold text-white">{t('common:appName')}</p>
                <p className="text-[11px] text-slate-400">{t('footer.byline')}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-5 text-xs text-slate-400 justify-center sm:justify-end">
              <a href="#hero" className="hover:text-white transition-colors">
                {t('footer.about')}
              </a>
              <a href="#features" className="hover:text-white transition-colors">
                {t('footer.features')}
              </a>
              <a href="/kontakt" className="hover:text-white transition-colors">
                {t('footer.contact')}
              </a>
              <button
                type="button"
                className="hover:text-white transition-colors"
              >
                {t('footer.privacy')}
              </button>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-800 text-center sm:text-left">
            <p className="text-[11px] text-slate-500 mb-2">
              {t('footer.copy', { year: new Date().getFullYear() })}
            </p>
            <p className="text-[11px] text-slate-500">{t('footer.demoCreds')}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

