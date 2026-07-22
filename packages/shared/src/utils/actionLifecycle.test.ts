import { describe, expect, it } from 'vitest'
import {
  excludeCancelledActions,
  formatActionCancelledAt,
  getActionLifecycleBadge,
  getCancellationReasonDisplay,
  isActionCancelled,
  isActionLifecycleActive,
  isActionTerminal,
} from './actionLifecycle'

describe('isActionCancelled', () => {
  it('undefined / null → false', () => {
    expect(isActionCancelled(undefined)).toBe(false)
    expect(isActionCancelled(null)).toBe(false)
    expect(isActionCancelled({})).toBe(false)
  })
  it('active → false', () => {
    expect(isActionCancelled({ isCancelled: false })).toBe(false)
  })
  it('cancelled → true', () => {
    expect(isActionCancelled({ isCancelled: true })).toBe(true)
  })
})

describe('isActionTerminal', () => {
  it('active → false', () => {
    expect(isActionTerminal({ isCompleted: false, isCancelled: false })).toBe(false)
    expect(isActionTerminal(undefined)).toBe(false)
  })
  it('completed → true', () => {
    expect(isActionTerminal({ isCompleted: true })).toBe(true)
  })
  it('cancelled → true', () => {
    expect(isActionTerminal({ isCancelled: true })).toBe(true)
  })
  it('completed+cancelled → true', () => {
    expect(isActionTerminal({ isCompleted: true, isCancelled: true })).toBe(true)
  })
})

describe('isActionLifecycleActive', () => {
  it('only non-terminal is active', () => {
    expect(isActionLifecycleActive({ isCompleted: false, isCancelled: false })).toBe(true)
    expect(isActionLifecycleActive({ isCompleted: true })).toBe(false)
    expect(isActionLifecycleActive({ isCancelled: true })).toBe(false)
  })
})

describe('getActionLifecycleBadge', () => {
  it('priority cancelled over completed', () => {
    expect(getActionLifecycleBadge({ isCancelled: true, isCompleted: true })).toBe('cancelled')
    expect(getActionLifecycleBadge({ isCancelled: true })).toBe('cancelled')
    expect(getActionLifecycleBadge({ isCompleted: true })).toBe('completed')
    expect(getActionLifecycleBadge({ isCompleted: false })).toBe(null)
  })
})

describe('getCancellationReasonDisplay', () => {
  it('trims and falls back', () => {
    expect(getCancellationReasonDisplay('  Loši uslovi  ')).toBe('Loši uslovi')
    expect(getCancellationReasonDisplay('')).toBe('Razlog nije naveden.')
    expect(getCancellationReasonDisplay(null)).toBe('Razlog nije naveden.')
    expect(getCancellationReasonDisplay(undefined)).toBe('Razlog nije naveden.')
  })
})

describe('formatActionCancelledAt', () => {
  it('returns empty for missing/invalid', () => {
    expect(formatActionCancelledAt(null)).toBe('')
    expect(formatActionCancelledAt(undefined)).toBe('')
    expect(formatActionCancelledAt('')).toBe('')
    expect(formatActionCancelledAt('not-a-date')).toBe('')
  })
  it('formats valid ISO without crashing', () => {
    const s = formatActionCancelledAt('2026-07-22T10:30:00Z')
    expect(s.length).toBeGreaterThan(0)
    expect(s).not.toMatch(/Invalid|undefined|null/i)
  })
})

describe('excludeCancelledActions', () => {
  it('drops cancelled from list caches', () => {
    const items = [
      { id: 1, isCancelled: true },
      { id: 2, isCompleted: true },
      { id: 3 },
    ]
    expect(excludeCancelledActions(items).map((a) => a.id)).toEqual([2, 3])
  })
})
