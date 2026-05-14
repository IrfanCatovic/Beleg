import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Marker, type MapRef } from 'react-map-gl/maplibre'
import { PlaninerMapFrame } from '../../map/components/PlaninerMapFrame'
import { FerrataMarkerElement } from '../../map/markers/FerrataMarkerElement'
import { resolvePlaninerMapStyleForDetail } from '../../map/style/resolvePlaninerMapStyle'
import { googleMapsPinUrl } from '../../map/utils/externalMapsUrl'
import { PlaninerIcon } from '../ui/PlaninerIcon'

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
  /** Tekstualna putanja / uputstvo ispod mape (superadmin „Kako stići”). */
  routeNote?: string
  /** U modalu smeštaja — bez naslova „Lokacija na mapi“ i spoljašnjeg okvira kartice. */
  embed?: boolean
}) {
  const { t } = useTranslation('ferrate')
  const mapRef = useRef<MapRef>(null)
  const [copied, setCopied] = useState(false)

  const detailStyle = useMemo(() => resolvePlaninerMapStyleForDetail(), [])

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
  const openMapsHref = useMemo(() => googleMapsPinUrl(props.lat, props.lng), [props.lat, props.lng])

  const copyCoords = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(coordsText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }, [coordsText])

  const route = props.routeNote?.trim()
  const embed = !!props.embed

  const inner = (
    <>
      {!embed && (
        <h2 className="flex items-center gap-3 px-5 pb-2 pt-5 text-sm font-bold uppercase tracking-wider text-emerald-700 sm:px-6 sm:pt-6">
          <PlaninerIcon name="map" variant="solid" />
          {t('detailMapTitle')}
        </h2>
      )}
      <div className={embed ? 'p-0' : 'px-5 pb-4 sm:px-6'}>
        <div
          className={`relative z-0 w-full overflow-hidden bg-slate-100/80 ring-1 ring-emerald-900/10 shadow-inner ${
            embed ? 'h-52 rounded-lg sm:h-56' : 'h-64 rounded-xl sm:h-72'
          }`}
        >
          <PlaninerMapFrame
            ref={mapRef}
            className="h-full w-full"
            mapStyleUrl={detailStyle?.styleUrl ?? null}
            initialViewState={initialViewState}
            showZoomControls
          >
            <Marker longitude={props.lng} latitude={props.lat} anchor="bottom">
              <FerrataMarkerElement />
            </Marker>
          </PlaninerMapFrame>
        </div>

        {route && (
          <div className="mt-4 rounded-xl border border-emerald-100/90 bg-emerald-50/60 px-4 py-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800">{t('detailMapRouteTitle')}</h3>
            <p className="mt-2 text-sm text-gray-800 whitespace-pre-line leading-relaxed">{route}</p>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
          <button
            type="button"
            onClick={() => void copyCoords()}
            className="inline-flex w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold text-gray-800 shadow-sm hover:bg-gray-50 sm:w-auto sm:min-w-[10rem]"
          >
            {copied ? t('mapCoordsCopied') : t('mapCopyCoords')}
          </button>
          <a
            href={openMapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-2.5 text-xs font-bold text-emerald-900 shadow-sm transition hover:bg-emerald-100/90 sm:w-auto sm:min-w-[10rem]"
          >
            {t('mapOpenMaps')}
          </a>
        </div>
      </div>
    </>
  )

  if (embed) {
    return (
      <div className="overflow-hidden rounded-xl bg-white" aria-label={props.naziv}>
        {inner}
      </div>
    )
  }

  return (
    <article
      className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
      aria-label={`${props.naziv}${props.subtitle.trim() ? ` — ${props.subtitle.trim()}` : ''}`}
    >
      {inner}
    </article>
  )
}
