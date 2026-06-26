import { Linking, Platform } from 'react-native'

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

function extractStepCount(result: unknown): number {
  if (!result || typeof result !== 'object') return 0
  const row = result as Record<string, unknown>
  const total = row.COUNT_TOTAL ?? row.countTotal ?? row.count
  const n = Number(total)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0
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
    return extractStepCount(result)
  } catch {
    return 0
  }
}

export async function readStepsPeriodTotals(): Promise<StepsPeriodTotals | null> {
  if (Platform.OS !== 'android') return null
  const hasPerm = await hasHealthConnectStepsPermission()
  if (!hasPerm) return null
  const now = new Date()
  const [today, week, month] = await Promise.all([
    readAggregateSteps(startOfDay(now), now),
    readAggregateSteps(startOfWeekMonday(now), now),
    readAggregateSteps(startOfMonth(now), now),
  ])
  return { today, week, month }
}
