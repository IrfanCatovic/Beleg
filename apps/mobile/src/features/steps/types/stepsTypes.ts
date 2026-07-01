export type StepsReadStatus =
  | 'ready'
  | 'raw_fallback_used'
  | 'permission_missing'
  | 'health_connect_unavailable'
  | 'health_connect_update_required'
  | 'unsupported_platform'
  | 'no_data'
  | 'error'
  | 'loading'

export type StepsReadSource =
  | 'health_connect_aggregate'
  | 'health_connect_raw'
  | 'ios_pedometer'
  | 'cache'
  | 'backend'
  | 'live_pedometer'
  | 'none'

export type StepsUserAction =
  | 'request_permission'
  | 'install_health_connect'
  | 'open_health_connect_settings'
  | 'refresh'
  | 'none'

export interface StepsReadResult {
  steps: number
  status: StepsReadStatus
  source: StepsReadSource
  userTitle: string
  userMessage: string
  actionLabel?: string
  actionType?: StepsUserAction
  debugMessage?: string
  aggregateSteps?: number
  rawStepsTotal?: number
}

export interface StepsPeriodReadResult {
  today: StepsReadResult
  week: number
  month: number
}

export function isReliableStepCount(result: StepsReadResult): boolean {
  return (
    (result.status === 'ready' || result.status === 'raw_fallback_used') &&
    result.steps >= 0
  )
}

export function shouldSyncSteps(result: StepsReadResult): boolean {
  return isReliableStepCount(result) && result.steps > 0
}

export function createEmptyStepsResult(
  overrides: Partial<StepsReadResult> = {},
): StepsReadResult {
  return {
    steps: 0,
    status: 'loading',
    source: 'none',
    userTitle: '',
    userMessage: '',
    actionType: 'none',
    ...overrides,
  }
}
