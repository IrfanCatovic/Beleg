import { useTranslation } from 'react-i18next'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import { ferrataMapTiles } from '../../map/ferrataMapTiles'

function googleMapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`
}

export function FerrataDetailMapCard(props: {
  lat: number
  lng: number
  naziv: string
  lokacija: string
}) {
  const { t } = useTranslation('ferrate')
  const center: [number, number] = [props.lat, props.lng]

  return (
    <article className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-700 px-5 sm:px-6 pt-5 sm:pt-6 pb-2">
        {t('detailMapTitle')}
      </h2>
      <div className="px-5 sm:px-6 pb-5 sm:pb-6">
        <MapContainer
          center={center}
          zoom={13}
          className="z-0 h-64 w-full rounded-xl sm:h-72 ring-1 ring-emerald-900/10 shadow-inner bg-slate-100/80"
          scrollWheelZoom
          preferCanvas
        >
          <TileLayer
            attribution={ferrataMapTiles.attribution}
            url={ferrataMapTiles.url}
            {...(ferrataMapTiles.maxZoom != null ? { maxZoom: ferrataMapTiles.maxZoom } : {})}
          />
          <Marker position={center}>
            <Popup>
              <div className="min-w-[12rem] space-y-2">
                <p className="font-bold text-gray-900">{props.naziv}</p>
                <p className="text-xs text-gray-600">{props.lokacija}</p>
                <a
                  href={googleMapsUrl(props.lat, props.lng)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  {t('mapOpenGoogle')}
                </a>
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      </div>
    </article>
  )
}
