import { mapTilerStyleUrl } from '../providers/mapTilerStyleUrl'

export type ResolvedPlaninerMapStyle = {
  /** MapLibre style JSON URL (MapTiler, MapLibre, sopstveni tileserver, …). */
  styleUrl: string
}

/**
 * Rešava stil mape isključivo iz env-a — UI i domen ne znaju za MapTiler po imenu.
 * Prioritet: pun `VITE_MAP_STYLE_URL` → MapTiler (`VITE_MAPTILER_API_KEY` + opcioni `VITE_MAPTILER_MAP_ID`).
 */
export function resolvePlaninerMapStyle(): ResolvedPlaninerMapStyle | null {
  const custom = (import.meta.env.VITE_MAP_STYLE_URL as string | undefined)?.trim()
  if (custom) return { styleUrl: custom }

  const key = (import.meta.env.VITE_MAPTILER_API_KEY as string | undefined)?.trim()
  if (!key) return null

  const mapId = (import.meta.env.VITE_MAPTILER_MAP_ID as string | undefined)?.trim() || 'outdoor'
  return { styleUrl: mapTilerStyleUrl(mapId, key) }
}
