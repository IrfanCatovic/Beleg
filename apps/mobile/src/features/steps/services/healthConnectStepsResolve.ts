import type { StepsReadSource, StepsReadStatus } from '../types/stepsTypes'

/** Prefer raw when it exceeds aggregate by more than this many steps. */
export const HC_RAW_PREFERRED_THRESHOLD = 50

export interface ResolvedHealthConnectSteps {
  steps: number
  status: StepsReadStatus
  source: StepsReadSource
}

/**
 * Chooses the production step count from Health Connect aggregate vs raw sum.
 * Raw is preferred when it is materially higher than aggregate (common HC lag).
 */
export function resolveHealthConnectStepsCount(
  aggregateSteps: number,
  rawStepsTotal: number,
  threshold = HC_RAW_PREFERRED_THRESHOLD,
): ResolvedHealthConnectSteps {
  const aggregate = Math.max(0, Math.round(aggregateSteps))
  const raw = Math.max(0, Math.round(rawStepsTotal))

  if (raw > aggregate + threshold) {
    return {
      steps: raw,
      status: 'raw_fallback_used',
      source: 'health_connect_raw',
    }
  }

  if (aggregate > 0) {
    return {
      steps: aggregate,
      status: 'ready',
      source: 'health_connect_aggregate',
    }
  }

  if (raw > 0) {
    return {
      steps: raw,
      status: 'raw_fallback_used',
      source: 'health_connect_raw',
    }
  }

  return {
    steps: 0,
    status: 'no_data',
    source: 'health_connect_aggregate',
  }
}
