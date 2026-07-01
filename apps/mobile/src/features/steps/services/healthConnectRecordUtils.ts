export function parseStepCountFromRecord(record: unknown): number {
  if (!record || typeof record !== 'object') return 0
  const count = (record as { count?: number }).count
  const n = Number(count)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0
}

export function extractAggregateCount(result: unknown): number {
  if (!result || typeof result !== 'object') return 0
  const row = result as Record<string, unknown>
  const total = row.COUNT_TOTAL ?? row.countTotal ?? row.count
  const n = Number(total)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0
}
