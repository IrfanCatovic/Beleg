import { Linking, Platform } from 'react-native'
import type { StepsReadResult } from '../types/stepsTypes'
import { buildUserPresentation } from './stepsUserMessages'
import {
  extractAggregateCount,
  parseStepCountFromRecord,
} from './healthConnectRecordUtils'

export const HEALTH_CONNECT_PACKAGE = 'com.google.android.apps.healthdata'
export const HEALTH_CONNECT_PLAY_STORE =
  `market://details?id=${HEALTH_CONNECT_PACKAGE}`

export type HealthConnectAvailability =
  | 'available'
  | 'unavailable'
  | 'update_required'
  | 'unsupported_platform'

export interface StepsPeriodTotals {
  today: number
  week: number
  month: number
}

function startOfDay(d = new Date()): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function startOfWeekMonday(d = new Date()): Date {
  const x = startOfDay(d)
  const dow = x.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  x.setDate(x.getDate() + diff)
  return x
}

function startOfMonth(d = new Date()): Date {
  const x = startOfDay(d)
  x.setDate(1)
  return x
}

async function loadHealthConnect() {
  return import('react-native-health-connect')
}

export async function getHealthConnectAvailability(): Promise<HealthConnectAvailability> {
  if (Platform.OS !== 'android') return 'unsupported_platform'
  try {
    const { getSdkStatus, SdkAvailabilityStatus } = await loadHealthConnect()
    const status = await getSdkStatus()
    if (status === SdkAvailabilityStatus.SDK_AVAILABLE) return 'available'
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
      return 'update_required'
    }
    return 'unavailable'
  } catch {
    return 'unavailable'
  }
}

export async function openHealthConnectInstall(): Promise<void> {
  try {
    await Linking.openURL(HEALTH_CONNECT_PLAY_STORE)
  } catch {
    await Linking.openURL(
      `https://play.google.com/store/apps/details?id=${HEALTH_CONNECT_PACKAGE}`,
    )
  }
}

export async function openHealthConnectAppSettings(): Promise<void> {
  try {
    const { openHealthConnectSettings } = await loadHealthConnect()
    openHealthConnectSettings()
  } catch {
    await Linking.openSettings()
  }
}

let initialized = false

export function resetHealthConnectSession(): void {
  initialized = false
}

async function ensureInitialized(): Promise<boolean> {
  const availability = await getHealthConnectAvailability()
  if (availability !== 'available') return false
  if (initialized) return true
  try {
    const { initialize } = await loadHealthConnect()
    initialized = await initialize()
    return initialized
  } catch {
    initialized = false
    return false
  }
}

export async function hasHealthConnectStepsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false
  const ok = await ensureInitialized()
  if (!ok) return false
  try {
    const { getGrantedPermissions } = await loadHealthConnect()
    const perms = await getGrantedPermissions()
    return perms.some((p) => p.recordType === 'Steps' && p.accessType === 'read')
  } catch {
    return false
  }
}

/** Opens the system Health Connect permission screen for step reading. */
export async function requestHealthConnectStepsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false
  const availability = await getHealthConnectAvailability()
  if (availability !== 'available') return false
  const ok = await ensureInitialized()
  if (!ok) return false
  try {
    const { requestPermission } = await loadHealthConnect()
    const granted = await requestPermission([{ accessType: 'read', recordType: 'Steps' }])
    return granted.some((p) => p.recordType === 'Steps' && p.accessType === 'read')
  } catch {
    return false
  }
}

function buildHcResult(
  partial: Pick<
    StepsReadResult,
    'steps' | 'status' | 'source' | 'debugMessage' | 'aggregateSteps' | 'rawStepsTotal'
  >,
): StepsReadResult {
  const presentation = buildUserPresentation(partial.status)
  return {
    ...presentation,
    ...partial,
  }
}

export async function readRawStepsSum(
  start: Date,
  end: Date,
): Promise<{ sum: number; error?: string }> {
  if (Platform.OS !== 'android') return { sum: 0 }
  const ok = await ensureInitialized()
  if (!ok) return { sum: 0, error: 'Health Connect not initialized' }
  const hasPerm = await hasHealthConnectStepsPermission()
  if (!hasPerm) return { sum: 0, error: 'READ_STEPS not granted' }

  let sum = 0
  try {
    const { readRecords } = await loadHealthConnect()
    let pageToken: string | undefined
    do {
      const page = await readRecords('Steps', {
        timeRangeFilter: {
          operator: 'between',
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        },
        pageSize: 1000,
        pageToken,
      })
      for (const record of page.records) {
        sum += parseStepCountFromRecord(record)
      }
      pageToken = page.pageToken
    } while (pageToken)
    return { sum }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { sum, error: msg }
  }
}

/** Production read: aggregate first, raw fallback second, with detailed status. */
export async function readHealthConnectSteps(
  start: Date,
  end: Date,
): Promise<StepsReadResult> {
  if (Platform.OS !== 'android') {
    return buildHcResult({
      steps: 0,
      status: 'unsupported_platform',
      source: 'none',
    })
  }

  const availability = await getHealthConnectAvailability()
  if (availability === 'update_required') {
    return buildHcResult({
      steps: 0,
      status: 'health_connect_update_required',
      source: 'none',
    })
  }
  if (availability !== 'available') {
    return buildHcResult({
      steps: 0,
      status: 'health_connect_unavailable',
      source: 'none',
    })
  }

  const initialized = await ensureInitialized()
  if (!initialized) {
    return buildHcResult({
      steps: 0,
      status: 'error',
      source: 'none',
      debugMessage: 'Health Connect initialize() returned false',
    })
  }

  const hasPerm = await hasHealthConnectStepsPermission()
  if (!hasPerm) {
    return buildHcResult({
      steps: 0,
      status: 'permission_missing',
      source: 'none',
    })
  }

  try {
    const { aggregateRecord } = await loadHealthConnect()
    const aggResult = await aggregateRecord({
      recordType: 'Steps',
      timeRangeFilter: {
        operator: 'between',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
    })
    const aggregateSteps = extractAggregateCount(aggResult)

    if (aggregateSteps > 0) {
      return buildHcResult({
        steps: aggregateSteps,
        status: 'ready',
        source: 'health_connect_aggregate',
        aggregateSteps,
        rawStepsTotal: undefined,
      })
    }

    const raw = await readRawStepsSum(start, end)
    if (raw.error && raw.sum === 0) {
      return buildHcResult({
        steps: 0,
        status: 'error',
        source: 'none',
        debugMessage: raw.error,
        aggregateSteps: 0,
        rawStepsTotal: 0,
      })
    }

    if (raw.sum > 0) {
      return buildHcResult({
        steps: raw.sum,
        status: 'raw_fallback_used',
        source: 'health_connect_raw',
        aggregateSteps: 0,
        rawStepsTotal: raw.sum,
      })
    }

    return buildHcResult({
      steps: 0,
      status: 'no_data',
      source: 'health_connect_aggregate',
      aggregateSteps: 0,
      rawStepsTotal: 0,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return buildHcResult({
      steps: 0,
      status: 'error',
      source: 'none',
      debugMessage: msg,
    })
  }
}

export async function readAggregateSteps(start: Date, end: Date): Promise<number> {
  if (Platform.OS !== 'android') return 0
  const ok = await ensureInitialized()
  if (!ok) return 0
  const hasPerm = await hasHealthConnectStepsPermission()
  if (!hasPerm) return 0
  try {
    const { aggregateRecord } = await loadHealthConnect()
    const result = await aggregateRecord({
      recordType: 'Steps',
      timeRangeFilter: {
        operator: 'between',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
    })
    return extractAggregateCount(result)
  } catch {
    return 0
  }
}

export async function readStepsPeriodTotals(): Promise<StepsPeriodTotals | null> {
  if (Platform.OS !== 'android') return null
  const hasPerm = await hasHealthConnectStepsPermission()
  if (!hasPerm) return null
  const now = new Date()
  const [todayResult, weekResult, monthResult] = await Promise.all([
    readHealthConnectSteps(startOfDay(now), now),
    readHealthConnectSteps(startOfWeekMonday(now), now),
    readHealthConnectSteps(startOfMonth(now), now),
  ])
  return {
    today: todayResult.steps,
    week: weekResult.steps,
    month: monthResult.steps,
  }
}
