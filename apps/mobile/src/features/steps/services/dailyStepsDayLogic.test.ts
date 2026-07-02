import { describe, expect, it } from 'vitest'
import {
  isNewDay,
  resolveCommittedSteps,
  resolveOsStepsBaseUpdate,
} from './dailyStepsDayLogic'

describe('dailyStepsDayLogic', () => {
  describe('resolveOsStepsBaseUpdate', () => {
    it('replaces base on first reliable read even when lower than cache', () => {
      const update = resolveOsStepsBaseUpdate(64, 5532, false)
      expect(update.base).toBe(64)
      expect(update.resetLiveBonus).toBe(true)
      expect(update.setDisplayToResult).toBe(true)
      expect(update.markReliable).toBe(true)
    })

    it('monotonically increases base after first reliable read', () => {
      const higher = resolveOsStepsBaseUpdate(120, 64, true)
      expect(higher.base).toBe(120)
      expect(higher.resetLiveBonus).toBe(true)
      expect(higher.markReliable).toBe(false)

      const lower = resolveOsStepsBaseUpdate(50, 120, true)
      expect(lower.base).toBe(120)
      expect(lower.resetLiveBonus).toBe(false)
    })
  })

  describe('resolveCommittedSteps', () => {
    it('allows lower total before first reliable OS read', () => {
      expect(resolveCommittedSteps(64, 5532, false)).toBe(64)
    })

    it('applies Math.max after first reliable OS read within same day', () => {
      expect(resolveCommittedSteps(100, 120, true)).toBe(120)
      expect(resolveCommittedSteps(150, 120, true)).toBe(150)
    })
  })

  describe('isNewDay', () => {
    it('detects day change', () => {
      expect(isNewDay('2026-07-02', '2026-07-01')).toBe(true)
      expect(isNewDay('2026-07-01', '2026-07-01')).toBe(false)
    })
  })
})
