/**
 * Datum u formatu YYYY-MM-DD (lokalna vremenska zona, bez UTC pomaka).
 */
export function dateToYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Lokal za prikaz datuma u latinici (meseci tipa „januar“, ne ćirilica). */
const DATE_LOCALE_LATN = 'sr-Latn-RS'

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
  return isNaN(d.getTime())
    ? fallback
    : d.toLocaleDateString(DATE_LOCALE_LATN, { day: 'numeric', month: 'long', year: 'numeric' })
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
  return isNaN(d.getTime()) ? fallback : d.toLocaleDateString(DATE_LOCALE_LATN)
}

/**
 * Datum za bedž nagrade (npr. "15. 06. 2025.") — samo brojevi.
 */
export function formatBadgeDate(
  value: string | number | Date | null | undefined,
  fallback = '—'
): string {
  if (value == null) return fallback
  const d = parseLocalDate(value)
  if (!d) return fallback
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}. ${month}. ${year}.`
}

function parseLocalDate(value: string | number | Date): Date | null {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value
  if (typeof value === 'string') {
    const ymd = value.trim().slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
      const [y, m, day] = ymd.split('-').map(Number)
      const d = new Date(y, m - 1, day)
      return isNaN(d.getTime()) ? null : d
    }
  }
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
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
  return isNaN(d.getTime()) ? fallback : d.toLocaleString(DATE_LOCALE_LATN)
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
