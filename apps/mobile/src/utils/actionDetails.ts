import type { Prijava } from '@beleg/shared'

export { countActivePrijave } from '@beleg/shared'

export function buildPrevozOccupancy(prijave: Prijava[]): Map<number, number> {
  const map = new Map<number, number>()
  for (const p of prijave) {
    if (p.status === 'otkazano') continue
    if (p.status && p.status !== 'prijavljen') continue
    for (const pid of p.selectedPrevozIds ?? []) {
      if (pid > 0) map.set(pid, (map.get(pid) ?? 0) + 1)
    }
  }
  return map
}
