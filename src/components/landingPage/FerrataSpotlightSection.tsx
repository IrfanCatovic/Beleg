import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../services/api'

type FerrataRow = {
  id: number
  slug: string
  naziv: string
  podrucje?: string
  tezina: string
  duzinaM: number
  trajanjeMin: number
  trajanjeMax: number
  coverImage: string
  upcomingActionsCount?: number
}

function difficultyBadgeClass(tezina: string) {
  const s = tezina.toUpperCase()
  if (s.includes('E')) return 'bg-zinc-900 text-white border-zinc-800'
  if (s.includes('D')) return 'bg-rose-600 text-white border-rose-700'
  if (s.includes('C')) return 'bg-amber-500 text-white border-amber-600'
  if (s.includes('B')) return 'bg-sky-600 text-white border-sky-700'
  if (s.includes('A')) return 'bg-emerald-600 text-white border-emerald-700'
  return 'bg-slate-600 text-white border-slate-700'
}

function pickRandomFerrata(rows: FerrataRow[]): FerrataRow | null {
  if (rows.length === 0) return null
  return rows[Math.floor(Math.random() * rows.length)] ?? null
}

export default function FerrataSpotlightSection() {
  const { t } = useTranslation('landing')
  const { t: tFerrate } = useTranslation('ferrate')
  const [ferrata, setFerrata] = useState<FerrataRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      try {
        const res = await api.get<{ ferrate?: FerrataRow[] }>('/api/ferratas')
        const rows = (res.data?.ferrate ?? []).filter((f) => f.slug && f.naziv?.trim())
        if (!cancelled) setFerrata(pickRandomFerrata(rows))
      } catch {
        if (!cancelled) setFerrata(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  if (!loading && !ferrata) return null

  return (
    <section className="bg-white py-12 sm:py-16 border-b border-slate-100">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 sm:mb-10">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 mb-4">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              {t('ferrataSpotlightSection.badge')}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight tracking-tight mb-2">
              {t('ferrataSpotlightSection.title')}
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              {t('ferrataSpotlightSection.subtitle')}
            </p>
          </div>
          <Link
            to="/ferate"
            className="inline-flex shrink-0 items-center justify-center self-start sm:self-auto rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50 transition-colors"
          >
            {t('ferrataSpotlightSection.allFerratas')}
          </Link>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-10 flex justify-center">
            <div className="h-7 w-7 rounded-full border-[2.5px] border-emerald-500 border-t-transparent animate-spin" />
          </div>
        ) : ferrata ? (
          <article className="group grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-lg hover:border-emerald-200/80 transition-all md:grid-cols-[1.1fr_1fr]">
            <Link
              to={`/ferate/${ferrata.slug}`}
              className="relative block min-h-[220px] sm:min-h-[280px] bg-slate-200 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-inset"
            >
              {ferrata.coverImage ? (
                <img
                  src={ferrata.coverImage}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-slate-800 to-slate-950" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/20" />
              <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                <span className="rounded-md bg-emerald-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                  {t('ferrataSpotlightSection.inOffer')}
                </span>
                <span
                  className={`inline-flex min-w-[2.5rem] items-center justify-center rounded-md border px-2 py-1 text-[11px] font-bold shadow-sm ${difficultyBadgeClass(ferrata.tezina)}`}
                >
                  {ferrata.tezina}
                </span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
                <h3 className="text-xl sm:text-2xl font-extrabold text-white leading-tight drop-shadow-sm">
                  {ferrata.naziv}
                </h3>
                {ferrata.podrucje?.trim() && (
                  <p className="mt-1 text-sm text-white/90 line-clamp-2">{ferrata.podrucje.trim()}</p>
                )}
              </div>
            </Link>

            <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700 mb-3">
                {t('ferrataSpotlightSection.pickLabel')}
              </p>
              <div className="flex flex-wrap gap-2 mb-5">
                <span className="inline-flex items-center rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700">
                  {tFerrate('cardLength', { m: ferrata.duzinaM })}
                </span>
                <span className="inline-flex items-center rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700">
                  {tFerrate('cardDuration', {
                    min: Math.round(ferrata.trajanjeMin),
                    max: Math.round(ferrata.trajanjeMax),
                  })}
                </span>
                {Number(ferrata.upcomingActionsCount ?? 0) > 0 && (
                  <span className="inline-flex items-center rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                    {tFerrate('listCardActionsScheduled', { count: ferrata.upcomingActionsCount })}
                  </span>
                )}
              </div>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-6">
                {t('ferrataSpotlightSection.cardHint')}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to={`/ferate/${ferrata.slug}`}
                  className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-700 transition-colors"
                >
                  {t('ferrataSpotlightSection.viewFerrata')}
                </Link>
                <Link
                  to="/mapa"
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                >
                  {t('ferrataSpotlightSection.exploreMap')}
                </Link>
              </div>
            </div>
          </article>
        ) : null}
      </div>
    </section>
  )
}
