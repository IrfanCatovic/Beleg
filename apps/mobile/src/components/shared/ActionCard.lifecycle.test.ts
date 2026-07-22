import { describe, expect, it } from 'vitest'
import { getActionLifecycleBadge } from '@beleg/shared'

/** Badge priority used by ActionCard / FeedActionCard / detail headers. */
function actionCardLifecycleLabel(
  action: { isCompleted?: boolean; isCancelled?: boolean },
): 'Otkazana' | 'Završena' | null {
  const badge = getActionLifecycleBadge(action)
  if (badge === 'cancelled') return 'Otkazana'
  if (badge === 'completed') return 'Završena'
  return null
}

describe('ActionCard lifecycle badge priority', () => {
  it('prefers cancelled over completed', () => {
    expect(actionCardLifecycleLabel({ isCancelled: true, isCompleted: true })).toBe('Otkazana')
  })

  it('shows cancelled when only isCancelled', () => {
    expect(actionCardLifecycleLabel({ isCancelled: true })).toBe('Otkazana')
  })

  it('shows completed when finished and not cancelled', () => {
    expect(actionCardLifecycleLabel({ isCompleted: true, isCancelled: false })).toBe('Završena')
  })

  it('shows no terminal badge for active actions', () => {
    expect(actionCardLifecycleLabel({ isCompleted: false, isCancelled: false })).toBe(null)
  })
})
