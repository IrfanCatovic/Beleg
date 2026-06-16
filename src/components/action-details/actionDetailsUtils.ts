export const PRIJAVA_STATUS_STYLE: Record<string, string> = {
  'popeo se': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'nije uspeo': 'bg-rose-50 text-rose-700 border-rose-200',
  otkazano: 'bg-gray-100 text-gray-500 border-gray-200',
  prijavljen: 'bg-emerald-50 text-emerald-600 border-emerald-200',
}

/** Jedan prevoz po prijavi; ako API vrati više ID-jeva, zadržava poslednji. */
export function singlePrevozIdSet(ids: number[] | undefined): Set<number> {
  const clean = (ids ?? []).map(Number).filter((n) => Number.isFinite(n) && n > 0)
  if (clean.length === 0) return new Set()
  return new Set([clean[clean.length - 1]])
}
