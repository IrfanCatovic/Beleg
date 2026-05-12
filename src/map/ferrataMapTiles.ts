/**
 * Podrazumevani sloj mape za Planiner (svetle kartice, smaragdni akcenti).
 * Možeš zameniti putem .env bez menjanja koda:
 *   VITE_MAP_TILE_URL
 *   VITE_MAP_TILE_ATTRIBUTION (HTML string za atribuciju)
 *
 * Preporuka: Carto Voyager — mekša paleta od OSM „Mapnik“, i dalje besplatno uz atribuciju.
 */
const DEFAULT_TILE_URL =
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'

const DEFAULT_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
  '&copy; <a href="https://carto.com/attributions">CARTO</a>'

export const ferrataMapTiles = {
  url: (import.meta.env.VITE_MAP_TILE_URL as string | undefined)?.trim() || DEFAULT_TILE_URL,
  attribution:
    (import.meta.env.VITE_MAP_TILE_ATTRIBUTION as string | undefined)?.trim() || DEFAULT_ATTRIBUTION,
} as const
