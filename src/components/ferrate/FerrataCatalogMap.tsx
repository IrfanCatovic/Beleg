import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import { Link } from 'react-router-dom'
import { LatLngBounds } from 'leaflet'

export type CatalogMapMarker = {
  id: number
  slug: string
  naziv: string
  lokacija: string
  lat: number
  lng: number
}

const DEFAULT_CENTER: [number, number] = [44.0165, 21.0059]
const DEFAULT_ZOOM = 7

function FitView({ markers }: { markers: CatalogMapMarker[] }) {
  const map = useMap()
  useEffect(() => {
    if (markers.length === 0) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM)
      return
    }
    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 11)
      return
    }
    const b = new LatLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]))
    map.fitBounds(b, { padding: [28, 28], maxZoom: 12 })
  }, [map, markers])
  return null
}

export function FerrataCatalogMap(props: {
  markers: CatalogMapMarker[]
  emptyHint: string
  className?: string
}) {
  const { t } = useTranslation('ferrate')
  const key = useMemo(() => props.markers.map((m) => m.id).join(','), [props.markers])

  return (
    <div className={props.className ?? ''}>
      <MapContainer
        key={key || 'empty'}
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        className="z-0 h-56 w-full rounded-xl sm:h-64"
        scrollWheelZoom
      >
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitView markers={props.markers} />
        {props.markers.map((m) => (
          <Marker key={m.id} position={[m.lat, m.lng]}>
            <Popup>
              <div className="min-w-[10rem] space-y-1 text-sm">
                <p className="font-bold text-gray-900">{m.naziv}</p>
                <p className="text-xs text-gray-600">{m.lokacija}</p>
                <Link to={`/ferate/${m.slug}`} className="text-xs font-semibold text-emerald-700 hover:underline">
                  {t('listMapPopupDetails')}
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {props.markers.length === 0 && (
        <p className="mt-2 text-center text-xs text-gray-500 px-2">{props.emptyHint}</p>
      )}
    </div>
  )
}
