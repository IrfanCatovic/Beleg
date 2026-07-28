import type { PendingNotificationTarget } from '../features/notifications/pendingNotificationTarget'

export type PendingDeepLinkRecord = {
  url: string
  savedAt: number
}

export type PendingNavigationCandidate =
  | {
      source: 'url'
      savedAt: number
      target: PendingDeepLinkRecord
    }
  | {
      source: 'push'
      savedAt: number
      target: PendingNotificationTarget
    }

export type PendingNavigationSelection = {
  selected: PendingNavigationCandidate
  superseded: PendingNavigationCandidate[]
}

/** Normalize stored savedAt; invalid values become 0 (legacy priority). */
export function normalizeSavedAt(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.trunc(value)
  }
  if (typeof value === 'string' && value.trim()) {
    const n = Number.parseInt(value, 10)
    if (!Number.isNaN(n) && n >= 0) return n
  }
  return 0
}

function candidateSavedAt(candidate: PendingNavigationCandidate): number {
  return candidate.savedAt
}

/**
 * Tie-break when savedAt is equal: push beats URL (direct notification tap).
 * Documented in pendingNavigationSelection.test.ts.
 */
function compareCandidates(
  a: PendingNavigationCandidate,
  b: PendingNavigationCandidate,
): PendingNavigationCandidate {
  const aAt = candidateSavedAt(a)
  const bAt = candidateSavedAt(b)
  if (aAt !== bAt) {
    return aAt > bAt ? a : b
  }
  if (a.source === 'push' && b.source === 'url') return a
  if (a.source === 'url' && b.source === 'push') return b
  return a
}

export function selectPendingNavigation(
  url: PendingDeepLinkRecord | null,
  push: PendingNotificationTarget | null,
): PendingNavigationSelection | null {
  const candidates: PendingNavigationCandidate[] = []
  if (url) {
    candidates.push({
      source: 'url',
      savedAt: normalizeSavedAt(url.savedAt),
      target: { ...url, savedAt: normalizeSavedAt(url.savedAt) },
    })
  }
  if (push) {
    const savedAt = normalizeSavedAt(push.savedAt)
    candidates.push({
      source: 'push',
      savedAt,
      target: { ...push, savedAt },
    })
  }
  if (candidates.length === 0) return null
  if (candidates.length === 1) {
    return { selected: candidates[0]!, superseded: [] }
  }

  let winner = candidates[0]!
  for (let i = 1; i < candidates.length; i++) {
    winner = compareCandidates(winner, candidates[i]!)
  }
  const superseded = candidates.filter((c) => c !== winner)
  return { selected: winner, superseded }
}
