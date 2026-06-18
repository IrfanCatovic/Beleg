import type { TFunction } from 'i18next'
import type { Akcija } from '../../types/akcija'
import { AkcijaImageOrFallback } from '../AkcijaImageFallback'
import { HeroMini } from './actionDetailsUi'

export interface ActionDetailsHeaderProps {
  akcija: Akcija
  t: TFunction
  locationSubtitle: string
  showPeakHeight: boolean
  memberCount: number
  effectiveIsClanKluba: boolean
  mojaPrijava: { status: string } | null | undefined
  user: { username?: string } | null
  onBack: () => void
}

export function ActionDetailsHeader({
  akcija,
  t,
  locationSubtitle,
  showPeakHeight,
  memberCount,
  effectiveIsClanKluba,
  mojaPrijava,
  user,
  onBack,
}: ActionDetailsHeaderProps) {
  return (
<>
      {/* â•â•â•â•â•â•â•â•â•â• COVER IMAGE (mobile/tablet) â•â•â•â•â•â•â•â•â•â• */}
      <div className="relative h-64 sm:h-72 md:h-80 lg:hidden overflow-hidden -mt-6 w-screen left-1/2 -translate-x-1/2">
        <AkcijaImageOrFallback
          src={akcija.slikaUrl}
          alt={akcija.naziv}
          imgClassName="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />

        {/* Back button */}
        <button
          onClick={onBack}
          className="absolute top-4 left-4 sm:top-5 sm:left-6 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold text-white bg-black/30 hover:bg-black/50 backdrop-blur-md border border-white/10 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          {t('back')}
        </button>

        {/* Cover content */}
        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
          <div className="max-w-6xl mx-auto">
            {(akcija.zimskiUspon || akcija.javna || akcija.isCompleted) && (
              <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                {akcija.zimskiUspon && (
                  <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-sky-500/80 text-white backdrop-blur-sm border border-sky-400/30">
                    {t('winterAscent')}
                  </span>
                )}
                {akcija.javna && (
                  <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-violet-500/80 text-white backdrop-blur-sm border border-violet-400/30">
                    {t('public')}
                  </span>
                )}
                {akcija.isCompleted && (
                  <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white backdrop-blur-sm border border-white/10">
                    {t('completed')}
                  </span>
                )}
              </div>
            )}
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight drop-shadow-lg leading-tight max-w-3xl">
              {akcija.naziv}
            </h1>
            <p className="mt-1.5 text-sm sm:text-base text-white/80 font-medium flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-white/50 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              {locationSubtitle}
              {showPeakHeight && ` Â· ${akcija.visinaVrhM} m`}
            </p>
          </div>
        </div>
      </div>

      {/* â•â•â•â•â•â•â•â•â•â• DESKTOP HEADER (HERO) â•â•â•â•â•â•â•â•â•â• */}
      <div className="hidden lg:block pt-6 xl:pt-8 relative">
        {/* Ambient background blobs */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -left-20 w-[420px] h-[420px] rounded-full bg-emerald-200/30 blur-3xl" />
          <div className="absolute -top-10 right-0 w-[360px] h-[360px] rounded-full bg-sky-200/30 blur-3xl" />
        </div>

        <div className="relative max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col xl:flex-row gap-7 items-stretch">
            {/* LEFT: main card */}
            <div className="w-full xl:max-w-[50rem] xl:shrink-0 relative rounded-[28px] border border-gray-100 bg-white shadow-[0_12px_40px_-12px_rgba(16,185,129,0.18)] overflow-hidden">
              {/* Accent top bar */}
              <div aria-hidden className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500" />
              {/* Decorative corner icon */}
              <div aria-hidden className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-gradient-to-br from-emerald-100/60 to-teal-50/30 blur-2xl" />

              <div className="relative p-7 xl:p-9">

                {/* Breadcrumb / back */}
                <button
                  onClick={onBack}
                  className="group inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 hover:text-emerald-700 transition-colors mb-5"
                >
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 group-hover:bg-emerald-100 transition-colors">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                  </span>
                  {t('back')}
                </button>

                {/* Badges */}
                {(akcija.zimskiUspon || akcija.javna || akcija.isCompleted) && (
                  <div className="flex flex-wrap items-center gap-2">
                    {akcija.zimskiUspon && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m9-9H3m15.364-6.364l-12.728 12.728M18.364 18.364L5.636 5.636" />
                        </svg>
                        {t('winterAscent')}
                      </span>
                    )}
                    {akcija.javna && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-violet-50 text-violet-700 border border-violet-200">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zM3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18M12 3a15 15 0 000 18" />
                        </svg>
                        {t('public')}
                      </span>
                    )}
                    {akcija.isCompleted && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-700 border border-gray-200">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {t('completed')}
                      </span>
                    )}
                  </div>
                )}

                {/* Title */}
                <h1 className="mt-4 text-4xl xl:text-[2.75rem] font-extrabold tracking-tight leading-[1.08] bg-gradient-to-br from-gray-900 via-gray-800 to-emerald-800 bg-clip-text text-transparent">
                  {akcija.naziv}
                </h1>

                {/* Subtitle: location pill */}
                <div className="mt-3.5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-200">
                    <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                    {locationSubtitle}
                  </span>
                  {showPeakHeight && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                      </svg>
                      {akcija.visinaVrhM} m
                    </span>
                  )}
                  {akcija.klubNaziv && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15" />
                      </svg>
                      {akcija.klubNaziv}
                    </span>
                  )}
                </div>

                {/* Description block */}
                {akcija.opis ? (
                  <div className="mt-6 relative rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/40 shadow-inner overflow-hidden">
                    <div aria-hidden className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-500 via-teal-500 to-sky-500" />
                    <div className="pl-5 pr-5 py-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 shadow-sm">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h12" />
                          </svg>
                        </span>
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-emerald-800">{t('actionDescription')}</p>
                      </div>
                      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                        {akcija.opis}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 p-4 text-center">
                    <p className="text-xs text-gray-400 italic">{t('noDescriptionHint', { defaultValue: 'Domaćin nije dodao opis akcije.' })}</p>
                  </div>
                )}

                {/* Mini stats strip */}
                <div className="mt-6 grid grid-cols-2 xl:grid-cols-4 gap-2.5">
                  {akcija.duzinaStazeKm != null && akcija.duzinaStazeKm > 0 && (
                    <HeroMini
                      color="sky"
                      label={t('summitPngTrail', { defaultValue: 'Dužina' })}
                      value={`${akcija.duzinaStazeKm} km`}
                      icon={
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-4.5-4.5m4.5 4.5l-4.5 4.5" />
                        </svg>
                      }
                    />
                  )}
                  {akcija.kumulativniUsponM != null && akcija.kumulativniUsponM > 0 && (
                    <HeroMini
                      color="amber"
                      label={t('summitPngAscent', { defaultValue: 'Uspon' })}
                      value={`${akcija.kumulativniUsponM} m`}
                      icon={
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909" />
                        </svg>
                      }
                    />
                  )}
                  {akcija.trajanjeSati != null && akcija.trajanjeSati > 0 && (
                    <HeroMini
                      color="indigo"
                      label={t('durationHours', { defaultValue: 'Trajanje' })}
                      value={`${akcija.trajanjeSati} h`}
                      icon={
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m5-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      }
                    />
                  )}
                  {akcija.maxLjudi != null && akcija.maxLjudi > 0 && (
                    <HeroMini
                      color="violet"
                      label="Mesta"
                      value={`${memberCount}/${akcija.maxLjudi}`}
                      icon={
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a7.5 7.5 0 0115 0" />
                        </svg>
                      }
                    />
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT: image card */}
            <div className="w-full xl:flex-1 xl:min-w-0 relative">
              <div className="relative rounded-[28px] overflow-hidden shadow-[0_20px_50px_-15px_rgba(15,118,110,0.35)] ring-1 ring-black/5 bg-gradient-to-br from-emerald-900 via-teal-800 to-sky-900 min-h-[440px] h-full">
                <AkcijaImageOrFallback
                  src={akcija.slikaUrl}
                  alt={akcija.naziv}
                  imgClassName="absolute inset-0 w-full h-full object-cover"
                />
                {/* Gradient overlay */}
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-black/20" />
                <div aria-hidden className="absolute inset-0 ring-1 ring-inset ring-white/10" />

                {/* Top right overlay chips */}
                <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
                  {user && (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider backdrop-blur-md border shadow-sm ${
                      effectiveIsClanKluba
                        ? 'bg-emerald-500/90 text-white border-emerald-300/30'
                        : 'bg-violet-500/90 text-white border-violet-300/30'
                    }`}>
                      {effectiveIsClanKluba ? 'Tvoj klub' : 'Gost'}
                    </span>
                  )}
                  {mojaPrijava && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-white/90 text-emerald-800 backdrop-blur-md border border-white/40 shadow-sm">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Prijavljen
                    </span>
                  )}
                </div>

                {/* Top left: peak altitude (planina) */}
                {showPeakHeight && (
                  <div className="absolute top-4 left-4 px-3 py-2 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 shadow-sm">
                    <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/80">{t('height', { defaultValue: 'Visina' })}</p>
                    <p className="text-xl font-extrabold text-white leading-none mt-0.5">
                      {akcija.visinaVrhM}
                      <span className="text-sm font-bold opacity-80 ml-1">m</span>
                    </p>
                  </div>
                )}

                {/* Bottom overlay: counts */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <div className="rounded-2xl bg-black/35 backdrop-blur-md border border-white/10 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/70">{t('registered', { defaultValue: 'Prijavljeni' })}</p>
                      <p className="text-2xl font-extrabold text-white leading-none mt-0.5">
                        {memberCount}
                        {akcija.maxLjudi != null && akcija.maxLjudi > 0 && (
                          <span className="text-sm font-bold opacity-70 ml-1">/ {akcija.maxLjudi}</span>
                        )}
                      </p>
                    </div>
                    
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
</>
  )
}
