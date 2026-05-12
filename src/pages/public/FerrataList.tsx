import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  HeartIcon,
  MagnifyingGlassIcon,
  MapIcon,
} from '@heroicons/react/24/outline'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { FerrataCatalogMap, type CatalogMapMarker } from '../../components/ferrate/FerrataCatalogMap'

type FerrataRow = {
  id: number
  slug: string
  naziv: string
  lokacija: string
  tezina: string
  duzinaM: number
  trajanjeMin: number
  trajanjeMax: number
  pogodnoZaPocetnike: string
  coverImage: string
  upcomingActionsCount?: number
  createdAt?: string
  lat?: number | null
  lng?: number | null
}

const PAGE_SIZE = 6

function formatDuration(min: number, max: number) {
  const a = (min / 60).toFixed(1).replace(/\.0$/, '')
  const b = (max / 60).toFixed(1).replace(/\.0$/, '')
  return `${a}–${b}`
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

function audienceLabel(f: FerrataRow, t: (k: string) => string) {
  if (f.pogodnoZaPocetnike === 'uz_vodica') return t('cardBeginnersWithGuide')
  if (f.pogodnoZaPocetnike?.trim()) return f.pogodnoZaPocetnike
  return t('cardBeginners')
}

export default function FerrataList() {
  const { t } = useTranslation('ferrate')
  const { user } = useAuth()
  const [rows, setRows] = useState<FerrataRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [tezina, setTezina] = useState('')
  const [sortBy, setSortBy] = useState<'newest' | 'name'>('newest')
  const [page, setPage] = useState(1)

  const isSuperadmin = user?.role === 'superadmin'

  useEffect(() => {
    setPage(1)
  }, [search, tezina])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const params = new URLSearchParams()
        if (search.trim()) params.set('search', search.trim())
        if (tezina.trim()) params.set('tezina', tezina.trim())
        const res = await api.get(`/api/ferratas?${params.toString()}`)
        if (!cancelled) setRows(res.data?.ferrate ?? [])
      } catch {
        if (!cancelled) setError('Greška pri učitavanju.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [search, tezina])

  const sorted = useMemo(() => {
    const copy = [...rows]
    if (sortBy === 'name') {
      copy.sort((a, b) => a.naziv.localeCompare(b.naziv, 'sr', { sensitivity: 'base' }))
    } else {
      copy.sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : a.id
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : b.id
        return tb - ta
      })
    }
    return copy
  }, [rows, sortBy])

  useEffect(() => {
    const tp = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
    setPage((p) => Math.min(p, tp))
  }, [sorted.length])

  const total = sorted.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const from = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const to = Math.min(safePage * PAGE_SIZE, total)
  const pageSlice = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const catalogMarkers: CatalogMapMarker[] = useMemo(() => {
    return sorted
      .filter((f) => f.lat != null && f.lng != null && Number.isFinite(Number(f.lat)) && Number.isFinite(Number(f.lng)))
      .map((f) => ({
        id: f.id,
        slug: f.slug,
        naziv: f.naziv,
        lokacija: f.lokacija,
        lat: Number(f.lat),
        lng: Number(f.lng),
      }))
  }, [sorted])

  const sel =
    'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 shadow-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/25 outline-none'

  const legend = [
    { key: 'A', className: 'bg-emerald-500', labelKey: 'legendA' as const },
    { key: 'B', className: 'bg-sky-500', labelKey: 'legendB' as const },
    { key: 'C', className: 'bg-amber-500', labelKey: 'legendC' as const },
    { key: 'D', className: 'bg-rose-600', labelKey: 'legendD' as const },
    { key: 'E', className: 'bg-zinc-900', labelKey: 'legendE' as const },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 pt-6 sm:pt-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
        <div className="space-y-2 min-w-0 max-w-3xl">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">{t('listTitle')}</h1>
          <p className="text-sm sm:text-base text-gray-600 leading-relaxed">{t('listSubtitle')}</p>
        </div>
        {isSuperadmin && (
          <Link
            to="/superadmin/ferrate"
            className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-emerald-900/15 hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            {t('listAddFerrata')}
          </Link>
        )}
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 shadow-sm mb-8">
        <div className="grid gap-3 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              {t('searchPlaceholder')}
            </label>
            <div className="relative">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="w-full rounded-xl border border-gray-200 bg-gray-50/80 pl-10 pr-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-400/25 outline-none"
              />
            </div>
          </div>
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">{t('filterDifficulty')}</label>
            <select value={tezina} onChange={(e) => setTezina(e.target.value)} className={sel}>
              <option value="">{t('filterDifficultyAll')}</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
              <option value="E">E</option>
              <option value="C/D">C/D</option>
              <option value="D/E">D/E</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">{t('filterStatus')}</label>
            <select value="active" disabled className={`${sel} opacity-80 cursor-not-allowed bg-gray-50`} aria-label={t('filterStatus')}>
              <option value="active">{t('filterStatusActive')}</option>
            </select>
          </div>
          <div className="lg:col-span-3">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">{t('filterSort')}</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'newest' | 'name')} className={sel}>
              <option value="newest">{t('sortNewest')}</option>
              <option value="name">{t('sortNameAsc')}</option>
            </select>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-rose-600 mb-4">{error}</p>}
      {loading && <p className="text-sm text-gray-500 mb-8">…</p>}

      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-10 lg:items-start">
        <div>
          {!loading && rows.length === 0 && <p className="text-sm text-gray-600 mb-6">{t('noResults')}</p>}

          <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {pageSlice.map((f) => {
              const n = Number(f.upcomingActionsCount ?? 0)
              return (
                <Link
                  key={f.id}
                  to={`/ferate/${f.slug}`}
                  className="group flex flex-col rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md hover:border-emerald-200/90 transition overflow-hidden"
                >
                  <div className="relative aspect-[16/10] bg-slate-200 overflow-hidden">
                    {f.coverImage ? (
                      <img
                        src={f.coverImage}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-slate-800 to-slate-950" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/25" />
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                        {t('listCardActive')}
                      </span>
                    </div>
                    <div className="absolute top-3 right-3 rounded-full bg-white/90 p-1.5 shadow-sm backdrop-blur-sm" aria-hidden>
                      <HeartIcon className="h-4 w-4 text-gray-400" strokeWidth={1.8} />
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-4 sm:p-5">
                    <h2 className="text-base font-bold text-gray-900 leading-snug line-clamp-2 group-hover:text-emerald-800 transition-colors">
                      {f.naziv}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 line-clamp-2">{f.lokacija}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className={`inline-flex min-w-[2.5rem] items-center justify-center rounded-lg border px-2 py-1 text-[11px] font-bold ${difficultyBadgeClass(f.tezina)}`}
                      >
                        {f.tezina}
                      </span>
                      <span className="inline-flex items-center rounded-lg border border-gray-100 bg-gray-50 px-2 py-1 text-[11px] font-semibold text-gray-700">
                        {t('cardLength', { m: f.duzinaM })}
                      </span>
                      <span className="inline-flex items-center rounded-lg border border-gray-100 bg-gray-50 px-2 py-1 text-[11px] font-semibold text-gray-700">
                        {formatDuration(f.trajanjeMin, f.trajanjeMax)} h
                      </span>
                    </div>
                    <div className="mt-3 flex items-start gap-2">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
                      <span className="text-xs font-medium text-gray-700 leading-snug">{audienceLabel(f, t)}</span>
                    </div>
                    <div className="mt-auto pt-4 flex items-center justify-between border-t border-gray-100 text-xs">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                        <CalendarDaysIcon className="h-4 w-4 shrink-0" />
                        {n > 0 ? t('listCardActionsScheduled', { count: n }) : t('listCardNoActions')}
                      </span>
                      <ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-400 group-hover:text-emerald-600 transition-colors" />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>

          {/* Pagination */}
          {!loading && total > 0 && (
            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t border-gray-100 pt-6">
              <p className="text-sm text-gray-600">
                {t('listPaginationShowing', { from, to, total })}
              </p>
              <div className="flex items-center justify-center gap-2 sm:justify-end">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
                  aria-label="Prethodna"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`min-w-[2.25rem] rounded-lg px-2 py-1.5 text-sm font-bold ${
                      p === safePage ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
                  aria-label="Sledeća"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="mt-10 space-y-6 lg:mt-0">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <MapIcon className="h-5 w-5 text-emerald-600" />
                {t('listMapTitle')}
              </div>
              <a
                href="https://www.openstreetmap.org/#map=7/44.2/21.0"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-emerald-700 hover:underline shrink-0"
              >
                {t('listMapShowAll')}
              </a>
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-100 bg-slate-100">
              <FerrataCatalogMap markers={catalogMarkers} emptyHint={t('listMapNoPins')} />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-4">{t('listLegendTitle')}</h3>
            <ul className="space-y-3 text-xs text-gray-700 leading-relaxed">
              {legend.map((item) => (
                <li key={item.key} className="flex gap-3">
                  <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-sm shadow-sm ${item.className}`} />
                  <span>{t(item.labelKey)}</span>
                </li>
              ))}
            </ul>
            <a
              href="https://sr.wikipedia.org/wiki/Via_ferrata"
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block text-xs font-semibold text-emerald-700 hover:underline"
            >
              {t('listLearnMoreGrades')}
            </a>
          </div>
        </aside>
      </div>
    </div>
  )
}
