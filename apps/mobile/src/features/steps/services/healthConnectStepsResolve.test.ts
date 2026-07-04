import { describe, expect, it } from 'vitest'
import {
  HC_RAW_PREFERRED_THRESHOLD,
  resolveHealthConnectStepsCount,
} from './healthConnectStepsResolve'

describe('resolveHealthConnectStepsCount', () => {
  it('prefers raw when materially higher than aggregate', () => {
    const result = resolveHealthConnectStepsCount(1577, 2793)
    expect(result.steps).toBe(2793)
    expect(result.status).toBe('raw_fallback_used')
    expect(result.source).toBe('health_connect_raw')
  })

  it('keeps aggregate when raw lead is within threshold', () => {
    const result = resolveHealthConnectStepsCount(1577, 1580)
    expect(result.steps).toBe(1577)
    expect(result.status).toBe('ready')
    expect(result.source).toBe('health_connect_aggregate')
  })

  it('uses raw when aggregate is zero', () => {
    const result = resolveHealthConnectStepsCount(0, 2793)
    expect(result.steps).toBe(2793)
    expect(result.status).toBe('raw_fallback_used')
    expect(result.source).toBe('health_connect_raw')
  })

  it('keeps aggregate when it exceeds raw', () => {
    const result = resolveHealthConnectStepsCount(3000, 2793)
    expect(result.steps).toBe(3000)
    expect(result.status).toBe('ready')
    expect(result.source).toBe('health_connect_aggregate')
  })

  it('respects custom threshold at boundary', () => {
    const threshold = HC_RAW_PREFERRED_THRESHOLD
    const atBoundary = resolveHealthConnectStepsCount(1000, 1000 + threshold)
    expect(atBoundary.steps).toBe(1000)
    expect(atBoundary.status).toBe('ready')

    const aboveBoundary = resolveHealthConnectStepsCount(1000, 1000 + threshold + 1)
    expect(aboveBoundary.steps).toBe(1000 + threshold + 1)
    expect(aboveBoundary.status).toBe('raw_fallback_used')
  })
})
