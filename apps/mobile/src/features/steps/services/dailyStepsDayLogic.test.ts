import { describe, expect, it } from 'vitest'

import {

  isNewDay,

  resolveCommittedSteps,

  resolveOsStepsBaseUpdate,

} from './dailyStepsDayLogic'



describe('dailyStepsDayLogic', () => {

  describe('resolveOsStepsBaseUpdate', () => {

    it('replaces base on first reliable read after day rollover even when lower than stale base', () => {

      const update = resolveOsStepsBaseUpdate(64, 5532, false, true)

      expect(update.base).toBe(64)

      expect(update.resetLiveBonus).toBe(true)

      expect(update.setDisplayToResult).toBe(true)

      expect(update.markReliable).toBe(true)

    })



    it('keeps hydrated floor on first reliable read within the same day', () => {

      const update = resolveOsStepsBaseUpdate(526, 836, false, false)

      expect(update.base).toBe(836)

      expect(update.resetLiveBonus).toBe(true)

      expect(update.markReliable).toBe(true)

    })



    it('raises base when OS read exceeds hydrated value on the same day', () => {

      const update = resolveOsStepsBaseUpdate(1200, 836, false, false)

      expect(update.base).toBe(1200)

      expect(update.resetLiveBonus).toBe(true)

      expect(update.markReliable).toBe(true)

    })



    it('resets live bonus on first reliable read of a new day', () => {

      const update = resolveOsStepsBaseUpdate(64, 5532, false, true)

      expect(update.resetLiveBonus).toBe(true)

    })



    it('monotonically increases base after first reliable read', () => {

      const higher = resolveOsStepsBaseUpdate(120, 64, true, false)

      expect(higher.base).toBe(120)

      expect(higher.resetLiveBonus).toBe(true)

      expect(higher.markReliable).toBe(false)



      const lower = resolveOsStepsBaseUpdate(50, 120, true, false)

      expect(lower.base).toBe(120)

      expect(lower.resetLiveBonus).toBe(false)

    })

  })



  describe('resolveCommittedSteps', () => {

    it('allows lower total before first reliable OS read on a new day', () => {

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

