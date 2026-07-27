import { describe, expect, it } from 'vitest'
import { formatCompactSteps } from './formatCompactSteps'

describe('formatCompactSteps (mobile)', () => {
  it('matches approved compact examples', () => {
    expect(formatCompactSteps(950)).toBe('950')
    expect(formatCompactSteps(1240)).toBe('1.24k')
    expect(formatCompactSteps(12400)).toBe('12.4k')
    expect(formatCompactSteps(123000)).toBe('123k')
    expect(formatCompactSteps(1240000)).toBe('1.24m')
    expect(formatCompactSteps(999900)).toBe('1m')
  })

  it('invalid/negative → 0', () => {
    expect(formatCompactSteps(null)).toBe('0')
    expect(formatCompactSteps(undefined)).toBe('0')
    expect(formatCompactSteps(Number.NaN)).toBe('0')
    expect(formatCompactSteps(Number.POSITIVE_INFINITY)).toBe('0')
    expect(formatCompactSteps(-100)).toBe('0')
  })
})
