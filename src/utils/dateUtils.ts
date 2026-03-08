/**
 * Datum u formatu YYYY-MM-DD (lokalna vremenska zona, bez UTC pomaka).
 */
export function dateToYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Formatira datum za prikaz (npr. "15. januar 2025.").
 * Za nevažeći datum vraća fallback (podrazumevano "—").
 */
export function formatDate(
  value: string | number | Date | null | undefined,
  fallback = '—'
): string {
  if (value == null) return fallback
  const d = value instanceof Date ? value : new Date(value)
  return isNaN(d.getTime()) ? fallback : d.toLocaleDateString('sr-RS', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Kratak format datuma (npr. "15.1.2025.").
 */
export function formatDateShort(
  value: string | number | Date | null | undefined,
  fallback = '—'
): string {
  if (value == null) return fallback
  const d = value instanceof Date ? value : new Date(value)
  return isNaN(d.getTime()) ? fallback : d.toLocaleDateString('sr-RS')
}

/**
 * Datum i vreme (npr. "15.1.2025., 14:30").
 */
export function formatDateTime(
  value: string | number | Date | null | undefined,
  fallback = '—'
): string {
  if (value == null) return fallback
  const d = value instanceof Date ? value : new Date(value)
  return isNaN(d.getTime()) ? fallback : d.toLocaleString('sr-RS')
}

/**
 * Relativno vreme za obaveštenja (npr. "Pre 5 minuta", "Pre 1 sat", "Juče").
 */
export function formatRelativeTime(value: string | number | Date | null | undefined): string {
  if (value == null) return '—'
  const d = value instanceof Date ? value : new Date(value)
  if (isNaN(d.getTime())) return '—'
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMin < 1) return 'Upravo'
  if (diffMin < 60) return `Pre ${diffMin} minuta`
  if (diffH < 24) return diffH === 1 ? 'Pre 1 sat' : `Pre ${diffH} sati`
  if (diffDays === 1) return 'Juče'
  if (diffDays < 7) return `Pre ${diffDays} dana`
  return formatDateShort(d)
}
