import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  getApiErrorMessage,
  hotelPublicVisibleSections,
  isValidLatLng,
  normalizeInstagramUrl,
  positiveHotelId,
  safeHttpUrl,
} from '@beleg/shared'
import type { HotelPublicDetail } from '@beleg/shared'
import { fetchHotelById } from '../../services/catalog'
import { FerrataDetailMapCard } from '../../components/ferrate/FerrataDetailMapCard'
import { ferrataDetailCardClass } from '../../components/ferrate/ferrataDetailCardStyles'
import { HomeModernIcon, PhoneIcon } from '@heroicons/react/24/outline'

export default function HotelDetail() {
  const { hotelId: hotelIdParam } = useParams<{ hotelId: string }>()
  const { t } = useTranslation('hotels')
  const { t: tFerrata } = useTranslation('ferrate')
  const hotelId = positiveHotelId(hotelIdParam)
  const [hotel, setHotel] = useState<HotelPublicDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    if (hotelId == null) {
      setHotel(null)
      setErr(t('publicNotFound'))
      setLoading(false)
      return
    }
    setLoading(true)
    setErr('')
    try {
      const data = await fetchHotelById(hotelId)
      const row = (data?.hotel ?? data) as HotelPublicDetail | undefined
      if (!row?.id) {
        setHotel(null)
        setErr(t('publicNotFound'))
        return
      }
      setHotel(row)
    } catch (e) {
      setHotel(null)
      setErr(getApiErrorMessage(e, t('publicLoadError')))
    } finally {
      setLoading(false)
    }
  }, [hotelId, t])

  useEffect(() => {
    void load()
  }, [load])

  const cover = hotel?.slike?.find((u) => u?.trim())?.trim() ?? ''
  const sections = hotel ? hotelPublicVisibleSections(hotel) : null
  const bookingHref = hotel ? safeHttpUrl(hotel.bookingUrl) : null
  const instagramHref = hotel ? normalizeInstagramUrl(hotel.instagramUrl) : null
  const hasMap = hotel ? isValidLatLng(hotel.lat, hotel.lng) : false

  return (
    <div className="pb-20">
      {loading && <p className="px-4 text-sm text-gray-500">…</p>}
      {err && !hotel && <p className="px-4 text-sm text-rose-600">{err}</p>}

      {hotel && (
        <>
          <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 -mt-6 overflow-x-hidden">
            <section className="relative min-h-[220px] sm:min-h-[300px]">
              {cover ? (
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${cover})` }} />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950">
                  <HomeModernIcon className="h-16 w-16 text-emerald-300/70" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30" />
              <div className="relative z-10 mx-auto flex min-h-[220px] max-w-6xl items-end px-4 pb-6 sm:min-h-[300px] sm:px-6">
                <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{hotel.naziv}</h1>
              </div>
            </section>
          </div>

          <div className="mx-auto mt-6 max-w-6xl space-y-4 px-4 sm:px-6">
            {sections?.opis && (
              <article className={ferrataDetailCardClass}>
                <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-700">{t('publicAbout')}</h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-700">{hotel.opis}</p>
              </article>
            )}

            {sections?.gallery && (hotel.slike?.length ?? 0) > 1 && (
              <article className={ferrataDetailCardClass}>
                <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-700">{t('publicGallery')}</h2>
                <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {hotel.slike!.filter((u) => u.trim()).map((u) => (
                    <li key={u} className="overflow-hidden rounded-xl">
                      <img src={u} alt="" className="h-32 w-full object-cover sm:h-40" />
                    </li>
                  ))}
                </ul>
              </article>
            )}

            {hasMap && (
              <FerrataDetailMapCard
                lat={hotel.lat as number}
                lng={hotel.lng as number}
                naziv={hotel.naziv}
                subtitle={t('publicLocation')}
                markerKind="stay"
              />
            )}

            {(sections?.telefon || bookingHref || instagramHref) && (
              <article className={ferrataDetailCardClass}>
                <div className="flex flex-col gap-2">
                  {sections?.telefon && (
                    <a
                      href={`tel:${hotel.telefon!.trim()}`}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800"
                    >
                      <PhoneIcon className="h-4 w-4" />
                      {hotel.telefon}
                    </a>
                  )}
                  {bookingHref && (
                    <a
                      href={bookingHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
                    >
                      {tFerrata('detailHotelBookNow')}
                    </a>
                  )}
                  {instagramHref && (
                    <a
                      href={instagramHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-xl border border-emerald-200 px-3 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
                    >
                      {tFerrata('detailHotelInstagramProfile')}
                    </a>
                  )}
                </div>
              </article>
            )}
          </div>
        </>
      )}
    </div>
  )
}
