const DATE_LOCALE = 'sr-Latn-RS'

/** Parsira YYYY-MM-DD kao lokalni datum (bez UTC pomaka). */
export function parseLocalDate(value: string | number | Date | null | undefined): Date | null {
  if (value == null) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'string') {
    const ymd = value.trim().slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
      const [y, m, day] = ymd.split('-').map(Number)
      const d = new Date(y, m - 1, day)
      return Number.isNaN(d.getTime()) ? null : d
    }
  }
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Prikaz datuma akcije: npr. „22. jun 2025.” */
export function formatActionDate(
  value: string | number | Date | null | undefined,
  fallback = '—',
): string {
  const d = parseLocalDate(value)
  if (!d) return fallback
  return d.toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Kratak prikaz: npr. „22.6.2025.” */
export function formatActionDateShort(
  value: string | number | Date | null | undefined,
  fallback = '',
): string {
  const d = parseLocalDate(value)
  if (!d) return fallback
  return d.toLocaleDateString(DATE_LOCALE)
}
