/** Tri glavna KPI-ja Planinarskog pasoša — isti redoslijed kao na webu. */
export function safeNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

export function formatPassportSummits(value: unknown, locale = 'sr-RS'): string {
  return Math.round(safeNumber(value)).toLocaleString(locale)
}

export function formatPassportKm(value: unknown, locale = 'sr-RS'): string {
  const n = safeNumber(value)
  const rounded = Math.round(n * 10) / 10
  return rounded.toLocaleString(locale, {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    maximumFractionDigits: 1,
  })
}

export function formatPassportAscentM(value: unknown, locale = 'sr-RS'): string {
  return Math.round(safeNumber(value)).toLocaleString(locale)
}

export function shouldShowPublicAdminRoleBadge(role?: string | null): boolean {
  void role
  return false
}
