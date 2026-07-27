/** Tri glavna KPI-ja Planinarskog pasoša — isti redoslijed na web i mobile. */
export type PassportKpiKey = 'summits' | 'km' | 'ascent'

export function safeNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

/** Osvojeno — cijeli broj bez nepotrebnih decimala. */
export function formatPassportSummits(value: unknown, locale = 'sr-RS'): string {
  return Math.round(safeNumber(value)).toLocaleString(locale)
}

/** Kilometri — najviše 1 decimala. */
export function formatPassportKm(value: unknown, locale = 'sr-RS'): string {
  const n = safeNumber(value)
  const rounded = Math.round(n * 10) / 10
  return rounded.toLocaleString(locale, {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    maximumFractionDigits: 1,
  })
}

/** Uspon (m) — cijeli metri sa separatorom hiljada. */
export function formatPassportAscentM(value: unknown, locale = 'sr-RS'): string {
  return Math.round(safeNumber(value)).toLocaleString(locale)
}

export function buildPassportKpis(stats: {
  brojPopeoSe?: unknown
  ukupnoKm?: unknown
  ukupnoMetaraUspona?: unknown
}, locale = 'sr-RS') {
  return {
    summits: { value: formatPassportSummits(stats.brojPopeoSe, locale), unit: undefined as string | undefined },
    km: { value: formatPassportKm(stats.ukupnoKm, locale), unit: 'km' as const },
    ascent: { value: formatPassportAscentM(stats.ukupnoMetaraUspona, locale), unit: 'm' as const },
  }
}

/** Administrativne role ne idu u javni planinarski identitet. */
export function shouldShowPublicAdminRoleBadge(role?: string | null): boolean {
  void role
  return false
}
