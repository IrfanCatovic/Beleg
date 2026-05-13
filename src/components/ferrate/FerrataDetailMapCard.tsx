import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Marker, Popup, type MapRef } from 'react-map-gl/maplibre'
import { PlaninerMapFrame } from '../../map/components/PlaninerMapFrame'
import { FerrataMarkerElement } from '../../map/markers/FerrataMarkerElement'

function googleMapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`
}

function formatCoords(lat: number, lng: number) {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
}

/** Jedna ferata na mapi — centar i zoom fokusirani isključivo na nju. */
const DETAIL_ZOOM = 14.5

export function FerrataDetailMapCard(props: {
  lat: number
  lng: number
  naziv: string
  /** Podnaslov ispod naziva (npr. grad, država); može biti prazan. */
  subtitle: string
}) {
  const { t } = useTranslation('ferrate')
  const mapRef = useRef<MapRef>(null)
  const [popupOpen, setPopupOpen] = useState(true)
  const [copied, setCopied] = useState(false)

  const initialViewState = useMemo(
    () => ({
      longitude: props.lng,
      latitude: props.lat,
      zoom: DETAIL_ZOOM,
    }),
    [props.lat, props.lng],
  )

  const centerOnFerrata = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    map.jumpTo({ center: [props.lng, props.lat], zoom: DETAIL_ZOOM })
  }, [props.lat, props.lng])

  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    if (map.isStyleLoaded()) centerOnFerrata()
    else map.once('load', centerOnFerrata)
    return () => {
      map.off('load', centerOnFerrata)
    }
  }, [centerOnFerrata])

  const coordsText = formatCoords(props.lat, props.lng)

  const copyCoords = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(coordsText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }, [coordsText])

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <h2 className="px-5 pb-2 pt-5 text-sm font-bold uppercase tracking-wider text-emerald-700 sm:px-6 sm:pt-6">
        {t('detailMapTitle')}
      </h2>
      <div className="px-5 pb-4 sm:px-6">
        <div className="relative z-0 h-64 w-full overflow-hidden rounded-xl bg-slate-100/80 ring-1 ring-emerald-900/10 shadow-inner sm:h-72">
          <PlaninerMapFrame ref={mapRef} className="h-full w-full" initialViewState={initialViewState} showZoomControls>
            <Marker longitude={props.lng} latitude={props.lat} anchor="bottom">
              <FerrataMarkerElement />
            </Marker>
            {popupOpen && (
              <Popup
                longitude={props.lng}
                latitude={props.lat}
                anchor="bottom"
                offset={20}
                onClose={() => setPopupOpen(false)}
                closeButton
                closeOnClick={false}
                maxWidth="300px"
              >
                <div className="space-y-3 p-1">
                  <div>
                    <p className="font-bold leading-snug text-gray-900">{props.naziv}</p>
                    {props.subtitle.trim() && <p className="mt-1 text-xs text-gray-600">{props.subtitle}</p>}
                    <p className="mt-2 font-mono text-[11px] text-gray-500">{coordsText}</p>
                  </div>
                  <a
                    href={googleMapsUrl(props.lat, props.lng)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
                  >
                    {t('mapOpenGoogle')}
                  </a>
                </div>
              </Popup>
            )}
          </PlaninerMapFrame>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <a
            href={googleMapsUrl(props.lat, props.lng)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-2.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100/90 sm:flex-none sm:min-w-[10rem]"
          >
            {t('mapOpenGoogle')}
          </a>
          <button
            type="button"
            onClick={() => void copyCoords()}
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold text-gray-800 shadow-sm hover:bg-gray-50 sm:flex-none sm:min-w-[10rem]"
          >
            {copied ? t('mapCoordsCopied') : t('mapCopyCoords')}
          </button>
        </div>
      </div>
    </article>
  )
}
