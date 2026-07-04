import { fetchTodaySteps } from '@beleg/shared'
import type { AxiosInstance } from 'axios'
import type { StepsReadSource, StepsReadStatus } from '../types/stepsTypes'
import {
  runHealthConnectDebugReport,
  SAMSUNG_HEALTH_PACKAGES,
  type HealthConnectDebugReport,
} from './healthConnectDebug'
import {
  computeGaps,
  inferSyncStatuses,
  pickPrimaryStatus,
  statusUserMessage,
  STALE_RECORD_MINUTES,
  type StepsSyncDiagnosticStatus,
  type StepsSyncGaps,
  type StepsSyncInference,
} from './stepsSyncDiagnosticsLogic'

export type {
  StepsSyncDiagnosticStatus,
  StepsSyncGaps,
  StepsSyncInference,
} from './stepsSyncDiagnosticsLogic'

export {
  computeGaps,
  inferSyncStatuses,
  pickPrimaryStatus,
  statusUserMessage,
  SYNC_GAP_THRESHOLD,
  STALE_RECORD_MINUTES,
} from './stepsSyncDiagnosticsLogic'

export interface PlaninerDiagnosticSnapshot {
  displayedTodaySteps: number
  stepStatus: StepsReadStatus
  stepSource: StepsReadSource
  hydratedBaseline: number
  lastSuccessfulReadAt: string | null
  lastSyncToBackendAt: string | null
  lastContextRefreshAt: string | null
  localTodayKey: string
}

export interface BackendDiagnosticSnapshot {
  todaySteps: number | null
  todayDate: string | null
  fetchError?: string
}

export interface StepsSyncDiagnosticReport {
  generatedAt: string
  planiner: PlaninerDiagnosticSnapshot
  backend: BackendDiagnosticSnapshot
  healthConnect: HealthConnectDebugReport | null
  gaps: StepsSyncGaps | null
  inferences: StepsSyncInference[]
  primaryStatus: StepsSyncDiagnosticStatus
  userMessage: string
}

export interface RunStepsSyncDiagnosticsInput {
  planiner: PlaninerDiagnosticSnapshot
  client?: AxiosInstance
  isLoggedIn?: boolean
}

async function fetchBackendToday(
  client: AxiosInstance | undefined,
  isLoggedIn: boolean | undefined,
  localTodayKey: string,
): Promise<BackendDiagnosticSnapshot> {
  if (!client || !isLoggedIn) {
    return { todaySteps: null, todayDate: null }
  }
  try {
    const remote = await fetchTodaySteps(client)
    return {
      todaySteps: remote.date === localTodayKey ? remote.steps : null,
      todayDate: remote.date,
    }
  } catch (e) {
    return {
      todaySteps: null,
      todayDate: null,
      fetchError: e instanceof Error ? e.message : String(e),
    }
  }
}

export async function runStepsSyncDiagnostics(
  input: RunStepsSyncDiagnosticsInput,
): Promise<StepsSyncDiagnosticReport> {
  const generatedAt = new Date().toISOString()
  let healthConnect: HealthConnectDebugReport | null = null

  try {
    healthConnect = await runHealthConnectDebugReport()
  } catch {
    healthConnect = null
  }

  const localTodayKey = input.planiner.localTodayKey
  const backend = await fetchBackendToday(input.client, input.isLoggedIn, localTodayKey)

  if (!healthConnect) {
    return {
      generatedAt,
      planiner: input.planiner,
      backend,
      healthConnect: null,
      gaps: null,
      inferences: [
        {
          status: 'diagnostics_unavailable',
          reason: 'Health Connect debug report nije dostupan.',
        },
      ],
      primaryStatus: 'diagnostics_unavailable',
      userMessage: statusUserMessage('diagnostics_unavailable'),
    }
  }

  const aggregateToday = healthConnect.aggregate.today
  const rawToday = healthConnect.rawRecords.today

  const gaps = computeGaps({
    display: input.planiner.displayedTodaySteps,
    aggregateToday,
    rawTodaySum: rawToday.stepSum,
    backendToday: backend.todaySteps,
  })

  const inferences = inferSyncStatuses({
    gaps,
    rawToday,
    display: input.planiner.displayedTodaySteps,
    aggregateToday,
    hasHcPermission: healthConnect.hasReadStepsPermission,
    backendFetched: backend.todaySteps != null,
  })

  const primaryStatus = pickPrimaryStatus(inferences)

  return {
    generatedAt,
    planiner: input.planiner,
    backend,
    healthConnect,
    gaps,
    inferences,
    primaryStatus,
    userMessage: statusUserMessage(primaryStatus, {
      staleMinutes: rawToday.minutesSinceLatestRecordEnd ?? STALE_RECORD_MINUTES,
    }),
  }
}

export { SAMSUNG_HEALTH_PACKAGES }
