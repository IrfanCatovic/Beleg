/**
 * Compact step count: at most 3 significant digits, lowercase suffix (k/m/b/t).
 * Dot decimal separator; trailing zeros stripped. Invalid/negative → "0".
 */
export function formatCompactSteps(value: unknown): string {
  if (value == null) return '0'
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) return '0'

  const abs = Math.round(n)
  if (abs < 1000) return String(abs)

  const units = [
    { threshold: 1e12, suffix: 't' },
    { threshold: 1e9, suffix: 'b' },
    { threshold: 1e6, suffix: 'm' },
    { threshold: 1e3, suffix: 'k' },
  ] as const

  for (const { threshold, suffix } of units) {
    if (abs >= threshold) {
      const scaled = abs / threshold
      // At most 3 significant digits
      let digits: number
      if (scaled >= 100) digits = 0
      else if (scaled >= 10) digits = 1
      else digits = 2

      const factor = 10 ** digits
      let rounded = Math.round(scaled * factor) / factor

      // Unit rollover: 999.9k → 1m, etc.
      if (rounded >= 1000 && suffix !== 't') {
        const nextIdx = units.findIndex((u) => u.suffix === suffix) - 1
        if (nextIdx >= 0) {
          const next = units[nextIdx]
          rounded = Math.round((abs / next.threshold) * 100) / 100
          return trimCompact(rounded, next.suffix)
        }
      }

      return trimCompact(rounded, suffix)
    }
  }

  return String(abs)
}

function trimCompact(n: number, suffix: string): string {
  // Avoid trailing zeros: 1.00 → 1, 1.20 → 1.2
  const s = n
    .toFixed(2)
    .replace(/\.?0+$/, '')
  // toFixed(2) then strip may leave empty for 0 — shouldn't happen for scaled >= 1
  return `${s || '0'}${suffix}`
}
