import { Link } from 'react-router-dom'
import {
  LanguageIcon,
  MapPinIcon,
  PhoneIcon,
  StarIcon,
  UserIcon,
} from '@heroicons/react/24/outline'
import type { TFunction } from 'i18next'
import type { GuideNearbyPublic } from '../../services/guidesPublic'
import { ProfiGuideBadge } from './ProfiGuideBadge'
import {
  formatGuideRating,
  guideDisplayName,
} from '../ferrate/GuideNearbyCard'

function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '')
  return digits ? `tel:${digits}` : `tel:${phone.trim()}`
}

function formatLocation(g: GuideNearbyPublic): string {
  const parts = [g.grad, g.region, g.drzava].map((x) => (x ?? '').trim()).filter(Boolean)
  return parts.join(', ') || '—'
}

export function GuideCatalogCard({
  guide: g,
  tGuide,
}: {
  guide: GuideNearbyPublic
  tGuide: TFunction<'guideProfiles'>
}) {
  const name = guideDisplayName(g)
  const username = g.user?.username?.trim()
  const avatar = g.user?.avatarUrl?.trim()
  const phone = g.user?.telefon?.trim()
  const location = formatLocation(g)
  const tourTypes = (g.tourTypes ?? []).slice(0, 5)
  const jezici = (g.jezici ?? []).filter(Boolean).slice(0, 4)
  const hasRating = (g.brojOcena ?? 0) > 0
  const toursCount = g.brojVodjenihTura ?? 0
  const opis = (g.opis ?? '').trim()
  const profileTo = username ? `/korisnik/${username}` : null

  const cardContent = (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white p-4 shadow-sm ring-1 ring-black/[0.02] transition hover:border-emerald-200 hover:shadow-md">
      <div className="flex gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 ring-1 ring-gray-100/80">
          {avatar ? (
            <img src={avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-emerald-300">
              <UserIcon className="h-8 w-8" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                <h3 className="truncate text-base font-bold text-gray-900">{name}</h3>
                <ProfiGuideBadge size={20} className="shrink-0" />
              </div>
              {g.naslov && g.naslov !== name && (
                <p className="mt-0.5 truncate text-xs text-gray-500">{g.naslov}</p>
              )}
            </div>
            {profileTo && (
              <span className="shrink-0 text-xs font-bold text-emerald-700">
                {tGuide('catalog.viewProfile')} →
              </span>
            )}
          </div>

          <p className="mt-1.5 flex min-w-0 items-center gap-1 text-xs text-gray-600">
            <MapPinIcon className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
            <span className="truncate">
              <span className="font-medium text-gray-500">{tGuide('catalog.location')}: </span>
              {location}
            </span>
          </p>
        </div>
      </div>

      {opis && (
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-gray-600">{opis}</p>
      )}

      {tourTypes.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            {tGuide('catalog.leadsTours')}
          </p>
          <p className="mt-1 line-clamp-2 text-xs leading-snug text-gray-700">
            {tourTypes.map((tt) => tGuide(`tourTypes.${tt}` as never)).join(' • ')}
          </p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-gray-800">
        {hasRating && (
          <span className="inline-flex items-center gap-1">
            <StarIcon className="h-3.5 w-3.5 text-amber-400" aria-hidden />
            {tGuide('catalog.rating', {
              avg: formatGuideRating(g.prosecnaOcena),
              count: g.brojOcena ?? 0,
            })}
          </span>
        )}
        {toursCount > 0 && (
          <span className="font-medium text-gray-600">
            {tGuide('catalog.toursLed', { count: toursCount })}
          </span>
        )}
      </div>

      {jezici.length > 0 && (
        <p className="mt-2 flex items-start gap-1 text-xs text-gray-600">
          <LanguageIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
          <span>
            <span className="font-medium text-gray-500">{tGuide('catalog.languages')}: </span>
            {jezici.join(', ')}
          </span>
        </p>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-gray-100 pt-3 mt-4">
        {phone ? (
          <a
            href={telHref(phone)}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-emerald-700"
          >
            <PhoneIcon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{phone}</span>
          </a>
        ) : (
          <span className="text-xs text-gray-400">{tGuide('catalog.noContact')}</span>
        )}
        <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700/80">
          {tGuide('catalog.contact')}
        </span>
      </div>
    </article>
  )

  if (profileTo) {
    return (
      <Link to={profileTo} className="block h-full min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-2xl">
        {cardContent}
      </Link>
    )
  }

  return <div className="h-full min-w-0">{cardContent}</div>
}
