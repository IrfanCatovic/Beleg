const METERS_PER_STEP = 0.75
const STEPS_PER_MINUTE = 100

export function deriveDistanceKm(steps: number): number {
  return (steps * METERS_PER_STEP) / 1000
}

export function deriveActiveMinutes(steps: number): number {
  if (steps <= 0) return 0
  return Math.max(1, Math.round(steps / STEPS_PER_MINUTE))
}

export function monthRangeKeys(): { from: string; to: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${d}` }
}

export function computeMonthlyAverage(days: { steps: number }[]): number {
  const active = days.filter((d) => d.steps > 0)
  if (active.length === 0) return 0
  const sum = active.reduce((acc, d) => acc + d.steps, 0)
  return Math.round(sum / active.length)
}
