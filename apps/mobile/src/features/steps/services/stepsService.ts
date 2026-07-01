import { Platform } from 'react-native'
import {
  openHealthConnectAppSettings,
  openHealthConnectInstall,
  readHealthConnectSteps,
  readStepsPeriodTotals,
} from './healthConnectService'
import {
  accessStatusToStepsReadStatus,
  buildUserPresentation,
} from './stepsUserMessages'
import type { StepsReadResult, StepsUserAction } from '../types/stepsTypes'
import { createEmptyStepsResult } from '../types/stepsTypes'
import {
  readStepsForDay,
  readTodayStepsResultFromOs,
} from '../../activity/services/stepsProvider'
import {
  type StepsAccessDebug,
  type StepsAccessStatus,
  openStepsAccessSettings,
  requestStepsAccess,
  resolveStepsAccess,
} from '../../activity/services/stepsAccess'

function resultFromAccessDenied(
  accessStatus: StepsAccessStatus,
  debug?: StepsAccessDebug,
): StepsReadResult {
  const status = accessStatusToStepsReadStatus(accessStatus) ?? 'permission_missing'
  const presentation = buildUserPresentation(status)
  return {
    steps: 0,
    status,
    source: 'none',
    ...presentation,
    debugMessage: debug?.error,
  }
}

export async function checkStepsAccess(requestIfNeeded = false): Promise<{
  access: StepsAccessStatus
  debug: StepsAccessDebug
}> {
  const { status, debug } = await resolveStepsAccess(requestIfNeeded)
  return { access: status, debug }
}

export async function requestStepsAccessFlow(): Promise<{
  access: StepsAccessStatus
  debug: StepsAccessDebug
}> {
  const { status, debug } = await requestStepsAccess()
  return { access: status, debug }
}

export async function getTodaySteps(): Promise<StepsReadResult> {
  const { access, debug } = await checkStepsAccess(false)
  if (access !== 'ready') {
    return resultFromAccessDenied(access, debug)
  }
  return readTodayStepsResultFromOs()
}

export async function getStepsForRange(
  from: Date,
  to: Date,
): Promise<Map<string, StepsReadResult>> {
  const { access } = await checkStepsAccess(false)
  if (access !== 'ready') {
    return new Map()
  }

  const map = new Map<string, StepsReadResult>()
  const start = new Date(from)
  start.setHours(0, 0, 0, 0)
  const end = new Date(to)
  end.setHours(0, 0, 0, 0)
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)

  const cur = new Date(start)
  while (cur <= end) {
    const dayStart = new Date(cur)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = cur.getTime() === todayStart.getTime() ? now : endOfDay(cur)
    const key = dateKey(cur)
    const result = await readStepsForDay(dayStart, dayEnd)
    if (result.steps > 0) {
      map.set(key, result)
    }
    cur.setDate(cur.getDate() + 1)
  }

  return map
}

function endOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function getPeriodTotals(): Promise<{
  today: StepsReadResult
  week: number
  month: number
}> {
  const { access, debug } = await checkStepsAccess(false)
  if (access !== 'ready') {
    const denied = resultFromAccessDenied(access, debug)
    return { today: denied, week: 0, month: 0 }
  }

  const today = await readTodayStepsResultFromOs()

  if (Platform.OS !== 'android') {
    return { today, week: today.steps, month: today.steps }
  }

  const periods = await readStepsPeriodTotals()
  return {
    today,
    week: periods?.week ?? 0,
    month: periods?.month ?? 0,
  }
}

export async function executeUserAction(
  action: StepsUserAction,
  accessStatus: StepsAccessStatus,
): Promise<void> {
  switch (action) {
    case 'request_permission':
      await requestStepsAccess()
      break
    case 'install_health_connect':
      await openHealthConnectInstall()
      break
    case 'open_health_connect_settings':
      if (Platform.OS === 'android') {
        await openHealthConnectAppSettings()
      } else {
        await openStepsAccessSettings(accessStatus)
      }
      break
    case 'refresh':
      break
    case 'none':
    default:
      break
  }
}

export function loadingStepsResult(): StepsReadResult {
  return createEmptyStepsResult(buildUserPresentation('loading'))
}

export { readHealthConnectSteps }
