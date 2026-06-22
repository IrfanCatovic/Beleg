export function formatSteps(n: number): string {
  return n.toLocaleString('sr-RS')
}

export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toLocaleString('sr-RS', { maximumFractionDigits: 1 })} km`
}
