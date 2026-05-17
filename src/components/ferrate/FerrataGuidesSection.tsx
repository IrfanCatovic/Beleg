import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPinIcon, PhoneIcon, UserIcon } from '@heroicons/react/24/outline'
import { StarIcon } from '@heroicons/react/24/solid'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { listGuidesNearby, type GuideNearbyPublic } from '../../services/guidesPublic'
import { PlaninerIcon } from '../ui/PlaninerIcon'
import { ferrataDetailCardClass } from './ferrataDetailCardStyles'
import { ProfiGuideBadge } from '../guides/ProfiGuideBadge'

function formatDistanceKm(km: number | undefined): string {
  if (km == null || !Number.isFinite(km)) return '—'
  const rounded = Math.round(km * 10) / 10
  return String(rounded).replace(/\.0$/, '')
}

function formatRating(avg: number | undefined): string {
  if (avg == null || !Number.isFinite(avg)) return '—'
  const rounded = Math.round(avg * 10) / 10
  return String(rounded).replace(/\.0$/, '')
}

function displayName(g: GuideNearbyPublic): string {
  return (g.user?.fullName || g.naslov || g.user?.username || '').trim() || '—'
}

function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '')
  return digits ? `tel:${digits}` : `tel:${phone.trim()}`
}

function GuideNearbyCard({
  guide: g,
  t,
  tGuide,
}: {
  guide: GuideNearbyPublic
  t: TFunction<'ferrate'>
  tGuide: TFunction<'guideProfiles'>
}) {
  const name = displayName(g)
  const km = formatDistanceKm(g.distanceKm)
  const username = g.user?.username
  const avatar = g.user?.avatarUrl?.trim()
  const phone = g.user?.telefon?.trim()
  const tourTypes = (g.tourTypes ?? []).slice(0, 4)
  const hasRating = (g.brojOcena ?? 0) > 0
  const toursCount = g.brojVodjenihTura ?? 0
  const showStats = hasRating || toursCount > 0

  return (
    <li className="min-w-0 list-none">
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white p-4 shadow-sm ring-1 ring-black/[0.02] transition hover:border-emerald-100 hover:shadow-md">
        <div className="flex gap-3">
          <div className="h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-emerald-50 to-teal-50 ring-1 ring-gray-100/80">
            {avatar ? (
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-emerald-300">
                <UserIcon className="h-9 w-9" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate text-sm font-bold text-gray-900">{name}</p>
              <ProfiGuideBadge size={20} className="shrink-0" />
            </div>

            <p className="mt-1 flex min-w-0 items-center gap-1 text-xs text-gray-500">
              <MapPinIcon className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
              <span className="truncate">{t('detailGuideDistanceShort', { km })}</span>
            </p>

            {showStats && (
              <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-semibold text-gray-800">
                {hasRating && (
                  <>
                    <StarIcon className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
                    <span>{formatRating(g.prosecnaOcena)}</span>
                  </>
                )}
                {hasRating && toursCount > 0 && <span className="font-normal text-gray-400">•</span>}
                {toursCount > 0 && (
                  <span className="font-medium text-gray-600">
                    {t('detailGuideToursCount', { count: toursCount })}
                  </span>
                )}
              </p>
            )}

            {tourTypes.length > 0 && (
              <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-gray-500">
                {tourTypes.map((tt) => tGuide(`tourTypes.${tt}` as never)).join(' • ')}
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
          {phone ? (
            <a
              href={telHref(phone)}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-emerald-700"
            >
              <PhoneIcon className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
              <span className="truncate">{phone}</span>
            </a>
          ) : (
            <span className="flex-1" aria-hidden />
          )}

          {username ? (
            <Link
              to={`/korisnik/${username}`}
              className="inline-flex shrink-0 items-center gap-0.5 text-xs font-bold text-emerald-700 hover:text-emerald-800"
            >
              {t('detailGuideViewProfile')}
              <span aria-hidden>→</span>
            </Link>
          ) : (
            <span className="text-xs font-bold text-emerald-700">{t('detailGuideViewProfile')} →</span>
          )}
        </div>
      </div>
    </li>
  )
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

  return (
    <article className={`min-w-0 max-w-full ${ferrataDetailCardClass}`}>
      <div className="mb-4 flex items-center gap-3">
        <PlaninerIcon name="guide" variant="solid" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-700">{t('detailLocalGuidesTitle')}</h2>
      </div>
      {loading && <p className="text-sm text-gray-500">…</p>}
      {!loading && list.length === 0 && <p className="text-sm text-gray-500">{t('detailGuidesEmpty')}</p>}
      {!loading && list.length > 0 && (
        <>
          <ul className="grid min-w-0 gap-3">
            {visibleList.map((g) => (
              <GuideNearbyCard key={g.id} guide={g} t={t} tGuide={tGuide} />
            ))}
          </ul>
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
