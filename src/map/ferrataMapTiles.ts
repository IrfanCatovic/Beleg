/**
 * Podrazumevani sloj: OpenTopoMap — topografski prikaz (reljef, senčenje brda, stil sličan planinarskim kartama).
 * Zamena putem .env:
 *   VITE_MAP_TILE_URL
 *   VITE_MAP_TILE_ATTRIBUTION
 *   VITE_MAP_TILE_MAX_ZOOM (opciono, npr. 19 za druge providere)
 *
 * OpenTopoMap: CC-BY-SA, uključuje OSM + SRTM — pogodno da se brda brže prepoznaju.
 * @see https://wiki.openstreetmap.org/wiki/OpenTopoMap
 */
const DEFAULT_TILE_URL = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'

const DEFAULT_ATTRIBUTION =
  'Kartografski podaci: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
  'doprinosioci, <a href="http://viewfinderpanoramas.org">SRTM</a> | ' +
  'Stil mape: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> ' +
  '(<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'

function parseMaxZoom(): number | undefined {
  const raw = (import.meta.env.VITE_MAP_TILE_MAX_ZOOM as string | undefined)?.trim()
  if (!raw) return undefined
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

const envUrl = (import.meta.env.VITE_MAP_TILE_URL as string | undefined)?.trim()
const envAttr = (import.meta.env.VITE_MAP_TILE_ATTRIBUTION as string | undefined)?.trim()

const usingOpenTopoDefault = !envUrl

export const ferrataMapTiles = {
  url: envUrl || DEFAULT_TILE_URL,
  attribution: envAttr || DEFAULT_ATTRIBUTION,
  /** OTM pločice tipično do ~17; za custom URL postavi VITE_MAP_TILE_MAX_ZOOM ako treba ograničenje. */
  maxZoom: usingOpenTopoDefault ? 17 : parseMaxZoom(),
}
