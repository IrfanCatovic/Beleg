import { Link } from 'react-router-dom'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import { MapPinIcon, PhoneIcon, UserIcon } from '@heroicons/react/24/outline'
import { StarIcon } from '@heroicons/react/24/solid'
import type { TFunction } from 'i18next'
import type { GuideNearbyPublic } from '../../services/guidesPublic'
import { ProfiGuideBadge } from '../guides/ProfiGuideBadge'

export function formatGuideDistanceKm(km: number | undefined): string {
  if (km == null || !Number.isFinite(km)) return '—'
  const rounded = Math.round(km * 10) / 10
  return String(rounded).replace(/\.0$/, '')
}

export function formatGuideRating(avg: number | undefined): string {
  if (avg == null || !Number.isFinite(avg)) return '—'
  const rounded = Math.round(avg * 10) / 10
  return String(rounded).replace(/\.0$/, '')
}

export function guideDisplayName(g: GuideNearbyPublic): string {
  return (g.user?.fullName || g.naslov || g.user?.username || '').trim() || '—'
}

function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '')
  return digits ? `tel:${digits}` : `tel:${phone.trim()}`
}

export function GuideNearbyCard({
  guide: g,
  t,
  tGuide,
  selectable,
  selected,
  onToggle,
}: {
  guide: GuideNearbyPublic
  t: TFunction<'ferrate'>
  tGuide: TFunction<'guideProfiles'>
  selectable?: boolean
  selected?: boolean
  onToggle?: () => void
}) {
  const name = guideDisplayName(g)
  const km = formatGuideDistanceKm(g.distanceKm)
  const username = g.user?.username
  const avatar = g.user?.avatarUrl?.trim()
  const phone = g.user?.telefon?.trim()
  const tourTypes = (g.tourTypes ?? []).slice(0, 4)
  const hasRating = (g.brojOcena ?? 0) > 0
  const toursCount = g.brojVodjenihTura ?? 0
  const showStats = hasRating || toursCount > 0

  const profileButton = username ? (
    <Link
      to={`/korisnik/${username}`}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex w-full items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs font-bold text-emerald-900 transition hover:border-emerald-300 hover:bg-emerald-100/90 active:scale-[0.99]"
    >
      {t('detailGuideViewProfile')}
    </Link>
  ) : null

  const cardInner = (
    <>
      <div className="flex gap-3 p-3">
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
            <MapPinIcon className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
            <span className="truncate">{t('detailGuideDistanceShort', { km })}</span>
          </p>

          {showStats && (
            <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-semibold text-gray-800">
              {hasRating && (
                <>
                  <StarIcon className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
                  <span>{formatGuideRating(g.prosecnaOcena)}</span>
                </>
              )}
              {hasRating && toursCount > 0 && <span className="font-normal text-gray-400">•</span>}
              {toursCount > 0 && (
                <span className="font-medium text-gray-600">{t('detailGuideToursCount', { count: toursCount })}</span>
              )}
            </p>
          )}

          {tourTypes.length > 0 && (
            <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-gray-500">
              {tourTypes.map((tt) => tGuide(`tourTypes.${tt}` as never)).join(' • ')}
            </p>
          )}

          {phone && (
            <a
              href={telHref(phone)}
              onClick={(e) => e.stopPropagation()}
              className="mt-2 inline-flex min-w-0 max-w-full items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-emerald-700"
            >
              <PhoneIcon className="h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden />
              <span className="truncate">{phone}</span>
            </a>
          )}
        </div>

        {selectable && (
          <div className="shrink-0 pt-0.5">
            <CheckCircleIcon
              className={`h-6 w-6 ${selected ? 'text-emerald-600' : 'text-gray-200'}`}
              aria-hidden
            />
          </div>
        )}
      </div>

      {profileButton && (
        <div className="border-t border-emerald-50/90 bg-gradient-to-b from-white to-emerald-50/25 px-3 py-2.5">
          {profileButton}
        </div>
      )}
    </>
  )

  const shellClass = `overflow-hidden rounded-xl border bg-white shadow-sm ring-1 ring-black/[0.02] transition hover:shadow-md ${
    selected
      ? 'border-emerald-400 ring-emerald-400/30 bg-emerald-50/30'
      : 'border-emerald-100/90 hover:border-emerald-200'
  }`

  if (selectable) {
    return (
      <li className="min-w-0 list-none">
        <button type="button" onClick={onToggle} className={`w-full text-left ${shellClass}`}>
          {cardInner}
        </button>
      </li>
    )
  }

  return (
    <li className="min-w-0 list-none">
      <article className={shellClass}>{cardInner}</article>
    </li>
  )
}
