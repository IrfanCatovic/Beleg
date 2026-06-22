import { resolvePlaninerMapStyle, type ResolvedPlaninerMapStyle } from '@beleg/shared'

export function getMobilePlaninerMapStyle(): ResolvedPlaninerMapStyle | null {
  return resolvePlaninerMapStyle({
    mapStyleUrl: process.env.EXPO_PUBLIC_MAP_STYLE_URL,
    mapTilerApiKey: process.env.EXPO_PUBLIC_MAPTILER_API_KEY,
    mapTilerMapId: process.env.EXPO_PUBLIC_MAPTILER_MAP_ID,
  })
}
