import {
  DEFAULT_MAPTILER_MAP_ID,
  resolvePlaninerMapStyle as resolveShared,
  resolvePlaninerMapStyleForDetail as resolveDetailShared,
  type ResolvedPlaninerMapStyle,
} from '@beleg/shared'

export type { ResolvedPlaninerMapStyle }
export { DEFAULT_MAPTILER_MAP_ID }

function viteMapEnv() {
  return {
    mapStyleUrl: import.meta.env.VITE_MAP_STYLE_URL as string | undefined,
    mapTilerApiKey: import.meta.env.VITE_MAPTILER_API_KEY as string | undefined,
    mapTilerMapId: import.meta.env.VITE_MAPTILER_MAP_ID as string | undefined,
    mapStyleUrlDetail: import.meta.env.VITE_MAP_STYLE_URL_DETAIL as string | undefined,
    mapTilerDetailMapId: import.meta.env.VITE_MAPTILER_DETAIL_MAP_ID as string | undefined,
  }
}

export function resolvePlaninerMapStyle(): ResolvedPlaninerMapStyle | null {
  return resolveShared(viteMapEnv())
}

export function resolvePlaninerMapStyleForDetail(): ResolvedPlaninerMapStyle | null {
  return resolveDetailShared(viteMapEnv())
}
