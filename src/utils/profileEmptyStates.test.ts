import { describe, expect, it } from 'vitest'
import {
  actionCardAccessibilityLabel,
  getClimbedEmptyCopy,
  getGuidedEmptyCopy,
  getHistoryErrorCopy,
  getStatsErrorCopy,
  shouldShowGuidedActionsTab,
} from './profileEmptyStates'

describe('profileEmptyStates', () => {
  it('own climbed empty has CTA label, public does not', () => {
    const own = getClimbedEmptyCopy(true)
    expect(own.title).toContain('uspona')
    expect(own.ctaLabel).toBe('Pronađi akciju')
    const pub = getClimbedEmptyCopy(false)
    expect(pub.ctaLabel).toBeNull()
    expect(pub.title).toContain('javno')
  })

  it('guided empty differs for own vs public guide', () => {
    expect(getGuidedEmptyCopy(true).title).toContain('vođenih')
    expect(getGuidedEmptyCopy(false).title).toContain('vodič')
    expect(getGuidedEmptyCopy(true).ctaLabel).toBeNull()
  })

  it('hides guided tab for non-guide without guided history', () => {
    expect(shouldShowGuidedActionsTab({ isProfiGuide: false, guidedCount: 0 })).toBe(false)
    expect(shouldShowGuidedActionsTab({ isProfiGuide: true, guidedCount: 0 })).toBe(true)
    expect(shouldShowGuidedActionsTab({ isProfiGuide: false, guidedCount: 2 })).toBe(true)
  })

  it('builds action card a11y label with long name and PER', () => {
    const long = 'A'.repeat(80)
    expect(actionCardAccessibilityLabel(long, 12)).toContain('12 PER')
    expect(actionCardAccessibilityLabel(long, 12).startsWith(long)).toBe(true)
    expect(actionCardAccessibilityLabel('', 0)).toBe('Akcija')
  })

  it('exposes stats/history error copy with retry wording elsewhere', () => {
    expect(getStatsErrorCopy()).toMatch(/Statistika/i)
    expect(getHistoryErrorCopy()).toMatch(/istoriju/i)
  })
})
