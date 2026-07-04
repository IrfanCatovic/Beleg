import { describe, expect, it } from 'vitest'
import {
  computeGaps,
  inferSyncStatuses,
  pickPrimaryStatus,
  SYNC_GAP_THRESHOLD,
} from './stepsSyncDiagnosticsLogic'

interface RawTodayFixture {
  recordCount: number
  stepSum: number
  origins: { packageName: string; recordCount: number; stepSum: number; isSamsungHealth: boolean }[]
  samsungOriginPresent: boolean
  samsungStepSum: number
  minutesSinceLatestRecordEnd?: number
  minutesSinceLatestModification?: number
}

function emptyRaw(overrides: Partial<RawTodayFixture> = {}): RawTodayFixture {
  return {
    recordCount: 10,
    stepSum: 1000,
    origins: [],
    samsungOriginPresent: true,
    samsungStepSum: 1000,
    minutesSinceLatestRecordEnd: 5,
    minutesSinceLatestModification: 5,
    ...overrides,
  }
}

describe('stepsSyncDiagnostics', () => {
  describe('computeGaps', () => {
    it('computes deltas between display, aggregate, raw and backend', () => {
      const gaps = computeGaps({
        display: 1000,
        aggregateToday: 950,
        rawTodaySum: 1100,
        backendToday: 980,
      })
      expect(gaps.displayVsAggregate).toBe(50)
      expect(gaps.displayVsRaw).toBe(-100)
      expect(gaps.aggregateVsRaw).toBe(-150)
      expect(gaps.backendVsDisplay).toBe(-20)
      expect(gaps.backendVsAggregate).toBe(30)
    })
  })

  describe('inferSyncStatuses', () => {
    const daytime = new Date('2026-07-04T12:00:00')

    it('detects aggregate_lagging_raw_available when raw > aggregate', () => {
      const gaps = computeGaps({
        display: 1000,
        aggregateToday: 800,
        rawTodaySum: 1100,
        backendToday: 1000,
      })
      const inferences = inferSyncStatuses({
        gaps,
        rawToday: emptyRaw({ stepSum: 1100 }),
        display: 1000,
        aggregateToday: 800,
        hasHcPermission: true,
        backendFetched: true,
        now: daytime,
      })
      expect(inferences.some((i) => i.status === 'aggregate_lagging_raw_available')).toBe(true)
    })

    it('detects planiner_state_lagging_hc when display < max HC', () => {
      const gaps = computeGaps({
        display: 500,
        aggregateToday: 900,
        rawTodaySum: 1000,
        backendToday: 500,
      })
      const inferences = inferSyncStatuses({
        gaps,
        rawToday: emptyRaw({ stepSum: 1000 }),
        display: 500,
        aggregateToday: 900,
        hasHcPermission: true,
        backendFetched: true,
        now: daytime,
      })
      expect(inferences.some((i) => i.status === 'planiner_state_lagging_hc')).toBe(true)
    })

    it('detects backend_lagging_local when backend < display', () => {
      const gaps = computeGaps({
        display: 1000,
        aggregateToday: 1000,
        rawTodaySum: 1000,
        backendToday: 900,
      })
      const inferences = inferSyncStatuses({
        gaps,
        rawToday: emptyRaw(),
        display: 1000,
        aggregateToday: 1000,
        hasHcPermission: true,
        backendFetched: true,
        now: daytime,
      })
      expect(inferences.some((i) => i.status === 'backend_lagging_local')).toBe(true)
      expect(gaps.backendVsDisplay).toBeLessThan(-SYNC_GAP_THRESHOLD)
    })

    it('reports hc_in_sync when all sources are close', () => {
      const gaps = computeGaps({
        display: 1000,
        aggregateToday: 1010,
        rawTodaySum: 995,
        backendToday: 1005,
      })
      const inferences = inferSyncStatuses({
        gaps,
        rawToday: emptyRaw({ stepSum: 995 }),
        display: 1000,
        aggregateToday: 1010,
        hasHcPermission: true,
        backendFetched: true,
        now: daytime,
      })
      expect(inferences.some((i) => i.status === 'hc_in_sync')).toBe(true)
      expect(pickPrimaryStatus(inferences)).toBe('hc_in_sync')
    })
  })
})
