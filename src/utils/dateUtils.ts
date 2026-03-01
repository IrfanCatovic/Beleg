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
