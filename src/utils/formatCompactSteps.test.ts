import { describe, expect, it } from 'vitest'
import { formatCompactSteps } from './formatCompactSteps'

describe('formatCompactSteps', () => {
  it('formats small values without suffix', () => {
    expect(formatCompactSteps(0)).toBe('0')
    expect(formatCompactSteps(9)).toBe('9')
    expect(formatCompactSteps(95)).toBe('95')
    expect(formatCompactSteps(950)).toBe('950')
    expect(formatCompactSteps(999)).toBe('999')
  })

  it('formats thousands with k', () => {
    expect(formatCompactSteps(1000)).toBe('1k')
    expect(formatCompactSteps(1240)).toBe('1.24k')
    expect(formatCompactSteps(1256)).toBe('1.26k')
    expect(formatCompactSteps(9999)).toBe('10k')
    expect(formatCompactSteps(10000)).toBe('10k')
    expect(formatCompactSteps(12400)).toBe('12.4k')
    expect(formatCompactSteps(12560)).toBe('12.6k')
    expect(formatCompactSteps(99999)).toBe('100k')
    expect(formatCompactSteps(100000)).toBe('100k')
    expect(formatCompactSteps(123000)).toBe('123k')
    expect(formatCompactSteps(125600)).toBe('126k')
  })

  it('rolls over to m at ~1e6', () => {
    expect(formatCompactSteps(999900)).toBe('1m')
    expect(formatCompactSteps(1000000)).toBe('1m')
    expect(formatCompactSteps(1240000)).toBe('1.24m')
    expect(formatCompactSteps(12400000)).toBe('12.4m')
    expect(formatCompactSteps(123000000)).toBe('123m')
  })

  it('formats billions and trillions', () => {
    expect(formatCompactSteps(999999999)).toBe('1b')
    expect(formatCompactSteps(1000000000)).toBe('1b')
  })

  it('handles invalid values as 0', () => {
    expect(formatCompactSteps(null)).toBe('0')
    expect(formatCompactSteps(undefined)).toBe('0')
    expect(formatCompactSteps(Number.NaN)).toBe('0')
    expect(formatCompactSteps(Number.POSITIVE_INFINITY)).toBe('0')
    expect(formatCompactSteps(-100)).toBe('0')
  })

  it('rounds decimals to integer before compacting', () => {
    expect(formatCompactSteps(1240.4)).toBe('1.24k')
    expect(formatCompactSteps(1240.6)).toBe('1.24k')
  })
})
