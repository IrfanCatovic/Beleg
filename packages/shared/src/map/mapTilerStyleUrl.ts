/** MapTiler Cloud — sastavljanje URL-a MapLibre stila. */
export function mapTilerStyleUrl(mapId: string, apiKey: string): string {
  const id = mapId.trim() || 'streets-v4'
  return `https://api.maptiler.com/maps/${encodeURIComponent(id)}/style.json?key=${encodeURIComponent(apiKey)}`
}
