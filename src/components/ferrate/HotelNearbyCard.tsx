import { HomeModernIcon, MapPinIcon } from '@heroicons/react/24/outline'
import { useTranslation } from 'react-i18next'
import type { HotelNearbyPublic } from './FerrataHotelsSection'

function formatDistanceKm(km: number | undefined): string {
  if (km == null || !Number.isFinite(km)) return '-'
  const rounded = Math.round(km * 10) / 10
  return String(rounded).replace(/\.0$/, '')
}

function hotelThumb(h: HotelNearbyPublic): string | null {
  const u = h.slike?.find((x) => x?.trim())
  return u?.trim() ?? null
}

export function HotelNearbyCard(props: { hotel: HotelNearbyPublic; onOpen: () => void }) {
  const { t } = useTranslation('ferrate')
  const { hotel, onOpen } = props
  const thumb = hotelThumb(hotel)
  const title = (hotel.naziv ?? '').trim() || t('detailHotelUnnamed')
  const km = formatDistanceKm(hotel.distanceKm)

  return (
    <li className="min-w-0">
      <article className="overflow-hidden rounded-xl border border-emerald-100/90 bg-white shadow-sm ring-1 ring-black/[0.02] transition hover:border-emerald-200 hover:shadow-md">
        <div className="flex min-w-0 gap-3 p-3">
          <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-slate-100 to-emerald-50/50 sm:h-24 sm:w-28">
            {thumb ? (
              <img src={thumb} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-emerald-300">
                <HomeModernIcon className="h-9 w-9 sm:h-10 sm:w-10" />
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <p className="truncate text-sm font-bold leading-snug text-gray-900">{title}</p>
            <p className="mt-1 flex min-w-0 items-center gap-1 text-xs font-medium text-gray-500">
              <MapPinIcon className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
              <span className="truncate">{t('detailHotelDistanceShort', { km })}</span>
            </p>
          </div>
        </div>

        <div className="border-t border-emerald-50/90 bg-gradient-to-b from-white to-emerald-50/25 px-3 py-2.5">
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex w-full items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs font-bold text-emerald-900 transition hover:border-emerald-300 hover:bg-emerald-100/90 active:scale-[0.99]"
          >
            {t('detailHotelViewCta')}
          </button>
        </div>
      </article>
    </li>
  )
}
