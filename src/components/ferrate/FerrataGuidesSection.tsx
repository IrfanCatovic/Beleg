import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PhoneIcon, UserIcon } from '@heroicons/react/24/outline'
import { useTranslation } from 'react-i18next'
import { listGuidesNearby, type GuideNearbyPublic } from '../../services/guidesPublic'
import { PlaninerIcon } from '../ui/PlaninerIcon'
import { ProfiGuideBadge } from '../guides/ProfiGuideBadge'

function formatDistanceKm(km: number | undefined): string {
  if (km == null || !Number.isFinite(km)) return '—'
  const rounded = Math.round(km * 10) / 10
  return String(rounded).replace(/\.0$/, '')
}

function displayName(g: GuideNearbyPublic): string {
  return (g.user?.fullName || g.naslov || g.user?.username || '').trim() || '—'
}

function locationLabel(g: GuideNearbyPublic): string {
  return [g.grad, g.region, g.drzava].filter((x) => x?.trim()).join(', ')
}

function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '')
  return digits ? `tel:${digits}` : `tel:${phone.trim()}`
}

function truncateOpis(text: string, max = 120): string {
  const s = text.trim()
  if (s.length <= max) return s
  return `${s.slice(0, max).trim()}…`
}

export function FerrataGuidesSection(props: {
  ferrataLat: number
  ferrataLng: number
  tourType?: string
}) {
  const { t } = useTranslation('ferrate')
  const { t: tGuide } = useTranslation('guideProfiles')
  const [rows, setRows] = useState<GuideNearbyPublic[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      try {
        const list = await listGuidesNearby({
          lat: props.ferrataLat,
          lng: props.ferrataLng,
          radiusKm: 100,
          limit: 30,
          tourType: props.tourType,
        })
        if (!cancelled) setRows(list)
      } catch {
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [props.ferrataLat, props.ferrataLng, props.tourType])

  useEffect(() => {
    setExpanded(false)
  }, [props.ferrataLat, props.ferrataLng, props.tourType])

  const list = useMemo(
    () =>
      rows.filter((g) => {
        const pin = g.baseLat != null && g.baseLng != null && Number.isFinite(g.baseLat) && Number.isFinite(g.baseLng)
        return pin && displayName(g) !== '—'
      }),
    [rows],
  )

  const visibleList = expanded ? list : list.slice(0, 2)

  function renderGuideRows(items: GuideNearbyPublic[]) {
    return (
      <ul className="grid min-w-0 gap-3">
        {items.map((g) => {
          const name = displayName(g)
          const km = formatDistanceKm(g.distanceKm)
          const loc = locationLabel(g)
          const username = g.user?.username
          const avatar = g.user?.avatarUrl?.trim()
          const tourTypes = (g.tourTypes ?? []).slice(0, 3)

          const cardInner = (
            <>
              <div className="relative h-24 w-28 shrink-0 bg-gradient-to-br from-emerald-50 to-teal-50">
                {avatar ? (
                  <img src={avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-emerald-300">
                    <UserIcon className="h-10 w-10" />
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1">
                  <ProfiGuideBadge size={22} />
                </div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center overflow-hidden py-2 pr-3">
                <p className="truncate text-sm font-bold text-gray-900 group-hover:text-emerald-900">{name}</p>
                <p className="mt-0.5 truncate text-xs font-medium text-gray-600">
                  {t('detailGuideDistanceShort', { km })}
                  {loc ? ` · ${loc}` : ''}
                </p>
                {tourTypes.length > 0 && (
                  <p className="mt-1 truncate text-[10px] font-semibold text-emerald-800">
                    {tourTypes.map((tt) => tGuide(`tourTypes.${tt}` as never)).join(' · ')}
                  </p>
                )}
                {g.opis?.trim() && (
                  <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-gray-500">{truncateOpis(g.opis)}</p>
                )}
                <span className="mt-1.5 inline-flex text-[11px] font-semibold text-emerald-700">
                  {t('detailGuideViewProfile')} →
                </span>
              </div>
            </>
          )

          const cardClass =
            'group flex w-full min-w-0 max-w-full gap-3 overflow-hidden rounded-xl border border-emerald-100/90 bg-white text-left shadow-sm ring-1 ring-black/[0.02] transition hover:border-emerald-200 hover:shadow-md'

          return (
            <li key={g.id} className="min-w-0">
              {username ? (
                <Link to={`/korisnik/${username}`} className={cardClass}>
                  {cardInner}
                </Link>
              ) : (
                <div className={cardClass.replace('group ', '')}>{cardInner}</div>
              )}
              {g.user?.telefon?.trim() && (
                <a
                  href={telHref(g.user.telefon)}
                  className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-gray-600 hover:text-emerald-700"
                >
                  <PhoneIcon className="h-3.5 w-3.5" />
                  {g.user.telefon}
                </a>
              )}
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <article className="min-w-0 max-w-full rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <PlaninerIcon name="guide" variant="solid" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-700">{t('detailLocalGuidesTitle')}</h2>
      </div>
      {loading && <p className="text-sm text-gray-500">…</p>}
      {!loading && list.length === 0 && <p className="text-sm text-gray-500">{t('detailGuidesEmpty')}</p>}
      {!loading && list.length > 0 && (
        <>
          {renderGuideRows(visibleList)}
          {list.length > 2 && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="mt-3 w-full rounded-xl border border-emerald-200 bg-emerald-50/80 py-2.5 text-xs font-bold text-emerald-900 transition hover:bg-emerald-100/90"
            >
              {expanded ? t('detailGuidesShowLess') : t('detailGuidesShowAll')}
            </button>
          )}
        </>
      )}
    </article>
  )
}
