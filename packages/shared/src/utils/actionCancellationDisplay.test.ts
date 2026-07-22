import { describe, expect, it } from 'vitest'
import {
  formatActionCancelledAt,
  getActionLifecycleBadge,
  getCancellationReasonDisplay,
  isActionCancelled,
  isActionTerminal,
} from '@beleg/shared'

/**
 * Web display contract tests (no React harness): badge priority + banner fallbacks.
 * Full Actions.tsx / ActionDetails.tsx UI is not unit-tested in this repo.
 */
describe('web cancelled action display contract', () => {
  it('active card has no cancelled badge', () => {
    expect(getActionLifecycleBadge({ isCompleted: false, isCancelled: false })).toBe(null)
  })

  it('completed card shows completed, not cancelled', () => {
    expect(getActionLifecycleBadge({ isCompleted: true, isCancelled: false })).toBe('completed')
  })

  it('cancelled card shows cancelled', () => {
    expect(getActionLifecycleBadge({ isCancelled: true, isCompleted: false })).toBe('cancelled')
  })

  it('completed+cancelled prefers cancelled only', () => {
    expect(getActionLifecycleBadge({ isCompleted: true, isCancelled: true })).toBe('cancelled')
  })

  it('banner reason/date fallbacks are safe', () => {
    expect(getCancellationReasonDisplay(undefined)).toBe('Razlog nije naveden.')
    expect(formatActionCancelledAt(null)).toBe('')
    expect(formatActionCancelledAt('bogus')).toBe('')
    expect(isActionCancelled({ isCancelled: true })).toBe(true)
    expect(isActionTerminal({ isCancelled: true, isCompleted: true })).toBe(true)
  })
})
