import { mapTilerStyleUrl } from './mapTilerStyleUrl'

export type ResolvedPlaninerMapStyle = {
  styleUrl: string
}

export type PlaninerMapStyleEnv = {
  mapStyleUrl?: string
  mapTilerApiKey?: string
  mapTilerMapId?: string
}

export const DEFAULT_MAPTILER_MAP_ID = 'streets-v4'

export function resolvePlaninerMapStyle(env: PlaninerMapStyleEnv): ResolvedPlaninerMapStyle | null {
  const custom = env.mapStyleUrl?.trim()
  if (custom) return { styleUrl: custom }

  const key = env.mapTilerApiKey?.trim()
  if (!key) return null

  const mapId = env.mapTilerMapId?.trim() || DEFAULT_MAPTILER_MAP_ID
  return { styleUrl: mapTilerStyleUrl(mapId, key) }
}

export function resolvePlaninerMapStyleForDetail(
  env: PlaninerMapStyleEnv & {
    mapStyleUrlDetail?: string
    mapTilerDetailMapId?: string
  },
): ResolvedPlaninerMapStyle | null {
  const customDetail = env.mapStyleUrlDetail?.trim()
  if (customDetail) return { styleUrl: customDetail }

  const key = env.mapTilerApiKey?.trim()
  if (!key) return null

  const detailId = env.mapTilerDetailMapId?.trim()
  const globalId = env.mapTilerMapId?.trim()
  const mapId = detailId || globalId || DEFAULT_MAPTILER_MAP_ID
  return { styleUrl: mapTilerStyleUrl(mapId, key) }
}
