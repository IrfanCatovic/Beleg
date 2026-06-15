import { Link } from 'react-router-dom'
import { CalendarDaysIcon, ArrowTopRightOnSquareIcon, PhoneIcon, PlusIcon } from '@heroicons/react/24/outline'
import { MapPopupShell } from './MapPopupShell'
import { HotelPhotoCarousel } from './HotelPhotoCarousel'
import { difficultyBadgeClass } from '../utils/difficultyBadgeClass'

const btnPrimary =
  'planiner-map-popup-btn inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98]'
const btnGhost =
  'planiner-map-popup-btn-ghost inline-flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]'

type FerrataPopupProps = {
  ferrata: {
    id: number
    slug: string
    naziv: string
    podrucje: string
    tezina: string
    lat: number
    lng: number
  }
  onClose: () => void
  onBook: () => void
  canCreateGuideAction: boolean
  t: (key: string) => string
}

export function FerrataMapPopup({ ferrata, onClose, onBook, canCreateGuideAction, t }: FerrataPopupProps) {
  return (
    <MapPopupShell variant="ferrata" longitude={ferrata.lng} latitude={ferrata.lat} onClose={onClose}>
      <div className="planiner-map-popup-hero planiner-map-popup-hero--ferrata">
        <div className="planiner-map-popup-hero-icon" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
            <path
              d="M5 18 L9 10 L12 14 L15 8 L19 18 Z"
              fill="currentColor"
              fillOpacity="0.35"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="planiner-map-popup-kicker">{t('mapExplore.layerFerrate')}</p>
          <h3 className="planiner-map-popup-title">{ferrata.naziv}</h3>
          {ferrata.podrucje?.trim() && <p className="planiner-map-popup-sub">{ferrata.podrucje}</p>}
        </div>
      </div>

      <div className="planiner-map-popup-content">
        {ferrata.tezina?.trim() && (
          <div className="planiner-map-popup-stagger planiner-map-popup-stagger-1 flex items-center gap-2.5">
            <span
              className={`inline-flex min-w-[2.5rem] items-center justify-center rounded-xl border px-2.5 py-1 text-xs font-extrabold shadow-sm ${difficultyBadgeClass(ferrata.tezina)}`}
            >
              {ferrata.tezina}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700/70">
              {t('mapExplore.popupFerrataDifficulty')}
            </span>
          </div>
        )}

        <div className="planiner-map-popup-actions">
          <button
            type="button"
            onClick={onBook}
            className={`${btnPrimary} planiner-map-popup-stagger planiner-map-popup-stagger-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-400 hover:to-teal-500`}
          >
            <CalendarDaysIcon className="h-4 w-4" />
            {t('mapExplore.popupBookAction')}
          </button>
          {canCreateGuideAction && (
            <Link
              to={`/dodaj-akciju?tip=via_ferrata&ferrata_id=${ferrata.id}&organizator=vodic`}
              className={`${btnGhost} planiner-map-popup-stagger planiner-map-popup-stagger-3 border-emerald-200/90 bg-white/80 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-50`}
            >
              <PlusIcon className="h-4 w-4" />
              {t('mapExplore.popupCreateAction')}
            </Link>
          )}
          {ferrata.slug && (
            <Link
              to={`/ferate/${ferrata.slug}`}
              className="planiner-map-popup-stagger planiner-map-popup-stagger-4 inline-flex w-full items-center justify-center rounded-lg py-1.5 text-xs font-semibold text-gray-500 transition-colors hover:text-emerald-700"
            >
              {t('mapExplore.popupDetails')} →
            </Link>
          )}
        </div>
      </div>
    </MapPopupShell>
  )
}

type HotelPopupProps = {
  hotel: {
    id: number
    naziv: string
    telefon: string
    bookingUrl: string
    instagramUrl: string
    slike: string[]
    lat: number
    lng: number
  }
  onClose: () => void
  t: (key: string) => string
}

export function HotelMapPopup({ hotel, onClose, t }: HotelPopupProps) {
  const photos = hotel.slike ?? []

  return (
    <MapPopupShell variant="hotel" longitude={hotel.lng} latitude={hotel.lat} onClose={onClose}>
      <div className="planiner-map-popup-hero planiner-map-popup-hero--hotel">
        <div className="planiner-map-popup-hero-icon" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
            <path d="M2 4v16" />
            <path d="M2 8h18a2 2 0 0 1 2 2v10" />
            <path d="M2 17h20" />
            <path d="M6 8v9" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="planiner-map-popup-kicker">{t('mapExplore.popupHotelBadge')}</p>
          <h3 className="planiner-map-popup-title">{hotel.naziv}</h3>
        </div>
      </div>

      <div className="planiner-map-popup-content">
        {photos.length > 0 && <HotelPhotoCarousel photos={photos} title={hotel.naziv} t={t} />}

        {hotel.telefon?.trim() && (
          <a
            href={`tel:${hotel.telefon.trim()}`}
            className={`planiner-map-popup-stagger ${photos.length > 0 ? 'planiner-map-popup-stagger-2' : 'planiner-map-popup-stagger-1'} planiner-map-popup-phone inline-flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs font-semibold text-amber-900 transition hover:border-amber-200 hover:bg-amber-50`}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-200/60 text-amber-800">
              <PhoneIcon className="h-3.5 w-3.5" />
            </span>
            {hotel.telefon}
          </a>
        )}

        {(hotel.bookingUrl?.trim() || hotel.instagramUrl?.trim()) && (
          <div className="planiner-map-popup-actions">
            {hotel.bookingUrl?.trim() && (
              <a
                href={hotel.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${btnPrimary} planiner-map-popup-stagger ${photos.length > 0 ? 'planiner-map-popup-stagger-3' : 'planiner-map-popup-stagger-2'} bg-gradient-to-r from-amber-400 to-orange-500 text-white hover:from-amber-300 hover:to-orange-400`}
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                {t('mapExplore.popupBooking')}
              </a>
            )}
            {hotel.instagramUrl?.trim() && (
              <a
                href={hotel.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${btnGhost} planiner-map-popup-stagger ${photos.length > 0 ? 'planiner-map-popup-stagger-4' : 'planiner-map-popup-stagger-3'} border-amber-200 bg-white/80 text-amber-900 hover:border-amber-300 hover:bg-amber-50`}
              >
                {t('mapExplore.popupInstagram')}
              </a>
            )}
          </div>
        )}
      </div>
    </MapPopupShell>
  )
}

type PeakPopupProps = {
  peak: {
    id: number
    naziv: string
    planina: string
    visinaM: number
    drzava: string
    grad: string
    lat: number
    lng: number
  }
  onClose: () => void
  onCreateAction: () => void
  canCreatePeakAction: boolean
  t: (key: string) => string
}

export function PeakMapPopup({ peak, onClose, onCreateAction, canCreatePeakAction, t }: PeakPopupProps) {
  const location = [peak.grad, peak.drzava].filter((s) => s?.trim()).join(', ')

  return (
    <MapPopupShell variant="peak" longitude={peak.lng} latitude={peak.lat} onClose={onClose}>
      <div className="planiner-map-popup-hero planiner-map-popup-hero--peak">
        <div className="planiner-map-popup-hero-icon" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
            <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="planiner-map-popup-kicker">{t('mapExplore.popupPeakBadge')}</p>
          <h3 className="planiner-map-popup-title">{peak.naziv}</h3>
          {peak.planina?.trim() && <p className="planiner-map-popup-sub">{peak.planina}</p>}
        </div>
      </div>

      <div className="planiner-map-popup-content">
        {(peak.visinaM > 0 || location) && (
          <dl className="planiner-map-popup-stats planiner-map-popup-stagger planiner-map-popup-stagger-1">
            {peak.visinaM > 0 && (
              <div className="planiner-map-popup-stat">
                <dt>{t('mapExplore.popupPeakHeight')}</dt>
                <dd>{peak.visinaM} m</dd>
              </div>
            )}
            {location && (
              <div className="planiner-map-popup-stat">
                <dt>{t('mapExplore.popupPeakLocation')}</dt>
                <dd className="truncate">{location}</dd>
              </div>
            )}
          </dl>
        )}

        {canCreatePeakAction && (
          <div className="planiner-map-popup-actions">
            <button
              type="button"
              onClick={onCreateAction}
              className={`${btnPrimary} planiner-map-popup-stagger planiner-map-popup-stagger-2 bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:from-indigo-400 hover:to-violet-500`}
            >
              <PlusIcon className="h-4 w-4" />
              {t('mapExplore.popupCreateAction')}
            </button>
          </div>
        )}
      </div>
    </MapPopupShell>
  )
}

/** Kompaktan ferrata popup za katalog listu. */
export function FerrataCatalogMapPopup({
  marker,
  onClose,
  t,
}: {
  marker: { slug: string; naziv: string; subtitle: string; tezina: string; lat: number; lng: number }
  onClose: () => void
  t: (key: string) => string
}) {
  return (
    <MapPopupShell variant="ferrata" longitude={marker.lng} latitude={marker.lat} onClose={onClose} offset={18} maxWidth="280px">
      <div className="planiner-map-popup-hero planiner-map-popup-hero--ferrata planiner-map-popup-hero--compact">
        <div className="min-w-0 flex-1">
          <h3 className="planiner-map-popup-title text-sm">{marker.naziv}</h3>
          {marker.subtitle?.trim() && <p className="planiner-map-popup-sub">{marker.subtitle}</p>}
        </div>
      </div>
      <div className="planiner-map-popup-content">
        <div className="planiner-map-popup-stagger planiner-map-popup-stagger-1 flex items-center gap-2">
          <span
            className={`inline-flex min-w-[2.25rem] items-center justify-center rounded-xl border px-2 py-0.5 text-[11px] font-bold shadow-sm ${difficultyBadgeClass(marker.tezina)}`}
          >
            {marker.tezina}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700/70">
            {t('listMapPopupDifficulty')}
          </span>
        </div>
        <Link
          to={`/ferate/${marker.slug}`}
          className={`${btnPrimary} planiner-map-popup-stagger planiner-map-popup-stagger-2 mt-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-400 hover:to-teal-500`}
        >
          {t('listMapPopupView')}
        </Link>
      </div>
    </MapPopupShell>
  )
}
