import { describe, expect, it } from 'vitest'
import { accessStatusToStepsReadStatus } from '../services/stepsUserMessages'
import { isReliableStepCount, shouldSyncSteps } from './stepsTypes'

describe('stepsTypes', () => {
  it('isReliableStepCount accepts ready and raw_fallback_used', () => {
    expect(isReliableStepCount({ status: 'ready', steps: 100 } as never)).toBe(true)
    expect(isReliableStepCount({ status: 'raw_fallback_used', steps: 50 } as never)).toBe(true)
    expect(isReliableStepCount({ status: 'no_data', steps: 0 } as never)).toBe(false)
    expect(isReliableStepCount({ status: 'error', steps: 0 } as never)).toBe(false)
  })

  it('shouldSyncSteps requires reliable count and steps > 0', () => {
    expect(shouldSyncSteps({ status: 'ready', steps: 10 } as never)).toBe(true)
    expect(shouldSyncSteps({ status: 'ready', steps: 0 } as never)).toBe(false)
    expect(shouldSyncSteps({ status: 'no_data', steps: 0 } as never)).toBe(false)
  })
})

describe('accessStatusToStepsReadStatus', () => {
  it('maps access statuses', () => {
    expect(accessStatusToStepsReadStatus('ready')).toBeNull()
    expect(accessStatusToStepsReadStatus('permission_needed')).toBe('permission_missing')
    expect(accessStatusToStepsReadStatus('device_unavailable')).toBe(
      'health_connect_unavailable',
    )
    expect(accessStatusToStepsReadStatus('health_connect_update_required')).toBe(
      'health_connect_update_required',
    )
  })
})
