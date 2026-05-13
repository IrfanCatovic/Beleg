/**
 * MapTiler Cloud — samo sastavljanje URL-a stila (bez lat/lng, bez React-a).
 * @see https://docs.maptiler.com/cloud/api/maps/
 */
export function mapTilerStyleUrl(mapId: string, apiKey: string): string {
  const id = mapId.trim() || 'streets-v4'
  return `https://api.maptiler.com/maps/${encodeURIComponent(id)}/style.json?key=${encodeURIComponent(apiKey)}`
}
