import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'

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
}

function formatDuration(min: number, max: number) {
  const a = (min / 60).toFixed(1).replace(/\.0$/, '')
  const b = (max / 60).toFixed(1).replace(/\.0$/, '')
  return `${a}–${b}`
}

export default function FerrataList() {
  const { t } = useTranslation('ferrate')
  const { user } = useAuth()
  const [rows, setRows] = useState<FerrataRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [tezina, setTezina] = useState('')

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

  const isSuperadmin = user?.role === 'superadmin'

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">{t('listTitle')}</h1>
          <p className="text-sm sm:text-base text-gray-600 max-w-2xl">{t('listSubtitle')}</p>
        </div>
        {isSuperadmin && (
          <Link
            to="/superadmin/ferrate"
            className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            {t('listSuperadminCta')}
          </Link>
        )}
      </div>

      {isSuperadmin && (
        <div className="rounded-xl border border-amber-200/90 bg-amber-50 px-4 py-3 text-sm text-amber-950 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="leading-relaxed">{t('listSuperadminBanner')}</p>
          <Link
            to="/superadmin/ferrate"
            className="shrink-0 inline-flex items-center justify-center rounded-lg bg-amber-900 px-3 py-2 text-xs font-bold text-white hover:bg-amber-950"
          >
            {t('superadminAdd')} →
          </Link>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{t('searchPlaceholder')}</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 outline-none"
          />
        </div>
        <div className="sm:w-44">
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{t('filterDifficulty')}</label>
          <input
            value={tezina}
            onChange={(e) => setTezina(e.target.value)}
            placeholder="npr. C/D"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-emerald-400 outline-none"
          />
        </div>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {loading && <p className="text-sm text-gray-500">…</p>}

      {!loading && rows.length === 0 && <p className="text-sm text-gray-600">{t('noResults')}</p>}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((f) => (
          <Link
            key={f.id}
            to={`/ferate/${f.slug}`}
            className="group flex flex-col rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md hover:border-emerald-200/80 transition overflow-hidden"
          >
            <div className="relative aspect-[16/10] bg-slate-200 overflow-hidden">
              {f.coverImage ? (
                <img src={f.coverImage} alt="" className="absolute inset-0 h-full w-full object-cover group-hover:scale-[1.02] transition duration-500" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-700 to-slate-900" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3">
                <p className="text-white text-sm font-bold line-clamp-2 drop-shadow">{f.naziv}</p>
                <p className="text-white/85 text-xs mt-0.5 line-clamp-1">{f.lokacija}</p>
              </div>
            </div>
            <div className="p-4 space-y-2 flex-1 flex flex-col">
              <div className="flex flex-wrap gap-1.5">
                <span className="inline-flex items-center rounded-lg bg-emerald-50 text-emerald-800 text-[11px] font-semibold px-2 py-0.5 border border-emerald-100">
                  {f.tezina}
                </span>
                <span className="inline-flex items-center rounded-lg bg-gray-50 text-gray-700 text-[11px] font-medium px-2 py-0.5 border border-gray-100">
                  {t('cardLength', { m: f.duzinaM })}
                </span>
                <span className="inline-flex items-center rounded-lg bg-gray-50 text-gray-700 text-[11px] font-medium px-2 py-0.5 border border-gray-100">
                  {formatDuration(f.trajanjeMin, f.trajanjeMax)} h
                </span>
              </div>
              <p className="text-xs text-gray-500 flex-1">
                {f.pogodnoZaPocetnike === 'uz_vodica' ? t('cardBeginners') : f.pogodnoZaPocetnike}
              </p>
              {(f.upcomingActionsCount ?? 0) > 0 && (
                <p className="text-xs font-semibold text-emerald-700">
                  {t('cardActionsSoon', { count: f.upcomingActionsCount })}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
