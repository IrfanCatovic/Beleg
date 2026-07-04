import { Platform } from 'react-native'
import {
  getHealthConnectAvailability,
  hasHealthConnectStepsPermission,
  openHealthConnectAppSettings,
  type HealthConnectAvailability,
} from './healthConnectService'
import {
  extractAggregateCount,
  maxIsoTime,
  minutesBetween,
  parseRecordDataOrigin,
  parseRecordEndTime,
  parseRecordLastModifiedTime,
  parseRecordStartTime,
  parseStepCountFromRecord,
} from './healthConnectRecordUtils'

export const SAMSUNG_HEALTH_PACKAGES = new Set([
  'com.sec.android.app.shealth',
  'com.samsung.health',
  'com.samsung.android.app.shealth',
])

export interface HcDebugOriginSummary {
  packageName: string
  recordCount: number
  stepSum: number
  isSamsungHealth: boolean
}

export interface HcDebugRawPeriod {
  recordCount: number
  stepSum: number
  origins: HcDebugOriginSummary[]
  latestRecordStartTime?: string
  latestRecordEndTime?: string
  latestRecordLastModifiedTime?: string
  minutesSinceLatestRecordEnd?: number
  minutesSinceLatestModification?: number
  samsungOriginPresent: boolean
  samsungStepSum: number
}

export interface HealthConnectDebugReport {
  generatedAt: string
  platform: string
  availability: HealthConnectAvailability
  initialized: boolean
  hasReadStepsPermission: boolean
  grantedPermissionLabels: string[]
  dateRanges: {
    todayStartIso: string
    nowIso: string
    weekStartIso: string
    monthStartIso: string
    timezoneOffsetMinutes: number
    timezoneName: string
    localTodayKey: string
  }
  aggregate: {
    today: number
    week: number
    month: number
    readAt: string
  }
  aggregateErrors: string[]
  rawRecords: {
    today: HcDebugRawPeriod
    week: HcDebugRawPeriod
  }
  rawErrors: string[]
  lastError: string
  summary: string
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

function localTodayKey(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function timezoneName(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'unknown'
  }
}

async function loadHealthConnect() {
  return import('react-native-health-connect')
}

let debugInitialized = false

async function ensureDebugInitialized(): Promise<boolean> {
  const availability = await getHealthConnectAvailability()
  if (availability !== 'available') return false
  if (debugInitialized) return true
  try {
    const { initialize } = await loadHealthConnect()
    debugInitialized = await initialize()
    return debugInitialized
  } catch {
    debugInitialized = false
    return false
  }
}

function extractAggregateCountLocal(result: unknown): number {
  return extractAggregateCount(result)
}

async function readAggregateForDebug(
  start: Date,
  end: Date,
  label: string,
  errors: string[],
): Promise<number> {
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
    return extractAggregateCountLocal(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    errors.push(`${label}: ${msg}`)
    return 0
  }
}

function stepCountFromRecord(record: unknown): number {
  return parseStepCountFromRecord(record)
}

function originFromRecord(record: unknown): string {
  return parseRecordDataOrigin(record) ?? 'unknown'
}

function summarizeOrigins(records: unknown[]): HcDebugOriginSummary[] {
  const map = new Map<string, { recordCount: number; stepSum: number }>()
  for (const record of records) {
    const pkg = originFromRecord(record)
    const prev = map.get(pkg) ?? { recordCount: 0, stepSum: 0 }
    prev.recordCount += 1
    prev.stepSum += stepCountFromRecord(record)
    map.set(pkg, prev)
  }
  return [...map.entries()]
    .map(([packageName, stats]) => ({
      packageName,
      recordCount: stats.recordCount,
      stepSum: stats.stepSum,
      isSamsungHealth: SAMSUNG_HEALTH_PACKAGES.has(packageName),
    }))
    .sort((a, b) => b.stepSum - a.stepSum)
}

async function readAllStepsRecordsForDebug(
  start: Date,
  end: Date,
  label: string,
  errors: string[],
): Promise<unknown[]> {
  const records: unknown[] = []
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
      records.push(...page.records)
      pageToken = page.pageToken
    } while (pageToken)
    return records
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    errors.push(`${label}: ${msg}`)
    return records
  }
}

function buildRawPeriod(records: unknown[], now: Date): HcDebugRawPeriod {
  const stepSum = records.reduce<number>((sum, r) => sum + stepCountFromRecord(r), 0)
  const origins = summarizeOrigins(records)

  let latestRecordStartTime: string | undefined
  let latestRecordEndTime: string | undefined
  let latestRecordLastModifiedTime: string | undefined

  for (const record of records) {
    latestRecordStartTime = maxIsoTime(
      latestRecordStartTime,
      parseRecordStartTime(record),
    )
    latestRecordEndTime = maxIsoTime(latestRecordEndTime, parseRecordEndTime(record))
    latestRecordLastModifiedTime = maxIsoTime(
      latestRecordLastModifiedTime,
      parseRecordLastModifiedTime(record),
    )
  }

  const samsungOrigins = origins.filter((o) => o.isSamsungHealth)
  const samsungStepSum = samsungOrigins.reduce((sum, o) => sum + o.stepSum, 0)

  return {
    recordCount: records.length,
    stepSum,
    origins,
    latestRecordStartTime,
    latestRecordEndTime,
    latestRecordLastModifiedTime,
    minutesSinceLatestRecordEnd: minutesBetween(now, latestRecordEndTime),
    minutesSinceLatestModification: minutesBetween(now, latestRecordLastModifiedTime),
    samsungOriginPresent: samsungOrigins.length > 0,
    samsungStepSum,
  }
}

function buildSummary(report: Omit<HealthConnectDebugReport, 'summary'>): string {
  if (report.platform !== 'android') {
    return 'Health Connect debug je dostupan samo na Androidu.'
  }
  if (report.availability === 'unsupported_platform') {
    return 'Platforma ne podržava Health Connect.'
  }
  if (report.availability === 'unavailable') {
    return 'Health Connect nije dostupan na ovom uređaju (instaliraj ili ažuriraj Health Connect).'
  }
  if (report.availability === 'update_required') {
    return 'Potrebna je ažurirana verzija Health Connect aplikacije.'
  }
  if (!report.initialized) {
    return 'Health Connect SDK se nije uspeo inicijalizovati.'
  }
  if (!report.hasReadStepsPermission) {
    return 'READ_STEPS dozvola nije odobrena Planineru u Health Connect-u.'
  }
  if (report.lastError) {
    return `Health Connect zahtev je pukao: ${report.lastError}`
  }

  const aggTotal =
    report.aggregate.today + report.aggregate.week + report.aggregate.month
  const rawTotal = report.rawRecords.today.stepSum + report.rawRecords.week.stepSum

  if (aggTotal === 0 && rawTotal === 0) {
    return 'Planiner ima dozvolu, ali Health Connect trenutno nema step podatke za ovaj period.'
  }

  const hasSamsungToday = report.rawRecords.today.origins.some((o) => o.isSamsungHealth)
  const hasSamsungWeek = report.rawRecords.week.origins.some((o) => o.isSamsungHealth)

  if (report.rawRecords.today.recordCount > 0 && report.aggregate.today === 0) {
    return `Aggregate za danas vraća 0, ali raw records postoje (${report.rawRecords.today.recordCount} zapisa, zbir ${report.rawRecords.today.stepSum}).`
  }

  if (report.rawRecords.today.stepSum > 0 && !hasSamsungToday && !hasSamsungWeek) {
    const origins = report.rawRecords.today.origins.map((o) => o.packageName).join(', ')
    return `HC ima korake za danas (${report.rawRecords.today.stepSum}), ali ne iz Samsung Health paketa. Origins: ${origins || 'nepoznato'}.`
  }

  if (report.rawRecords.today.stepSum === 0 && report.rawRecords.week.stepSum > 0) {
    return 'Za danas nema raw step zapisa, ali postoje zapisi u tekućoj sedmici — proveri timezone ili da li su današnji koraci stigli u HC.'
  }

  return `Health Connect ima podatke. Aggregate danas: ${report.aggregate.today}, raw danas: ${report.rawRecords.today.stepSum}.`
}

async function loadGrantedPermissionLabels(): Promise<string[]> {
  try {
    const { getGrantedPermissions } = await loadHealthConnect()
    const perms = await getGrantedPermissions()
    return perms.map((p) => `${p.accessType}:${p.recordType}`)
  } catch (e) {
    return [`error:${e instanceof Error ? e.message : String(e)}`]
  }
}

export async function runHealthConnectDebugReport(): Promise<HealthConnectDebugReport> {
  const now = new Date()
  const todayStart = startOfDay(now)
  const weekStart = startOfWeekMonday(now)
  const monthStart = startOfMonth(now)

  const aggregateErrors: string[] = []
  const rawErrors: string[] = []
  const errors: string[] = []

  const base: Omit<HealthConnectDebugReport, 'summary'> = {
    generatedAt: now.toISOString(),
    platform: Platform.OS,
    availability: 'unsupported_platform',
    initialized: false,
    hasReadStepsPermission: false,
    grantedPermissionLabels: [],
    dateRanges: {
      todayStartIso: todayStart.toISOString(),
      nowIso: now.toISOString(),
      weekStartIso: weekStart.toISOString(),
      monthStartIso: monthStart.toISOString(),
      timezoneOffsetMinutes: -now.getTimezoneOffset(),
      timezoneName: timezoneName(),
      localTodayKey: localTodayKey(),
    },
    aggregate: { today: 0, week: 0, month: 0, readAt: now.toISOString() },
    aggregateErrors: [],
    rawRecords: {
      today: {
        recordCount: 0,
        stepSum: 0,
        origins: [],
        samsungOriginPresent: false,
        samsungStepSum: 0,
      },
      week: {
        recordCount: 0,
        stepSum: 0,
        origins: [],
        samsungOriginPresent: false,
        samsungStepSum: 0,
      },
    },
    rawErrors: [],
    lastError: '',
  }

  if (Platform.OS !== 'android') {
    return { ...base, summary: buildSummary(base) }
  }

  try {
    base.availability = await getHealthConnectAvailability()
    if (base.availability !== 'available') {
      return { ...base, summary: buildSummary(base) }
    }

    base.initialized = await ensureDebugInitialized()
    if (!base.initialized) {
      base.lastError = 'initialize() returned false'
      return { ...base, summary: buildSummary(base) }
    }

    base.grantedPermissionLabels = await loadGrantedPermissionLabels()
    base.hasReadStepsPermission = await hasHealthConnectStepsPermission()

    if (!base.hasReadStepsPermission) {
      return { ...base, summary: buildSummary(base) }
    }

    const aggregateReadAt = new Date().toISOString()
    const [aggToday, aggWeek, aggMonth, rawTodayRecords, rawWeekRecords] = await Promise.all([
      readAggregateForDebug(todayStart, now, 'aggregate/today', aggregateErrors),
      readAggregateForDebug(weekStart, now, 'aggregate/week', aggregateErrors),
      readAggregateForDebug(monthStart, now, 'aggregate/month', aggregateErrors),
      readAllStepsRecordsForDebug(todayStart, now, 'raw/today', rawErrors),
      readAllStepsRecordsForDebug(weekStart, now, 'raw/week', rawErrors),
    ])

    base.aggregate = {
      today: aggToday,
      week: aggWeek,
      month: aggMonth,
      readAt: aggregateReadAt,
    }
    base.aggregateErrors = aggregateErrors
    base.rawRecords = {
      today: buildRawPeriod(rawTodayRecords, now),
      week: buildRawPeriod(rawWeekRecords, now),
    }
    base.rawErrors = rawErrors

    const allErrors = [...aggregateErrors, ...rawErrors]
    base.lastError = allErrors.length > 0 ? allErrors.join(' | ') : ''
  } catch (e) {
    base.lastError = e instanceof Error ? e.message : String(e)
    errors.push(base.lastError)
  }

  return { ...base, summary: buildSummary(base) }
}

export { openHealthConnectAppSettings }

/** @deprecated Use runHealthConnectDebugReport */
export async function getHealthConnectDiagnostics() {
  const report = await runHealthConnectDebugReport()
  return {
    marker: 'HC_DEBUG_v3',
    platform: report.platform,
    availability: report.availability,
    initialized: report.initialized,
    hasPermission: report.hasReadStepsPermission,
    today: report.aggregate.today,
    week: report.aggregate.week,
    month: report.aggregate.month,
    error: report.lastError,
  }
}
