import { Platform } from 'react-native'
import { Pedometer } from 'expo-sensors'
import {
  hasHealthConnectStepsPermission,
  readHealthConnectSteps,
  readStepsPeriodTotals,
  type StepsPeriodTotals,
} from '../../steps/services/healthConnectService'
import { buildUserPresentation } from '../../steps/services/stepsUserMessages'
import type { StepsReadResult } from '../../steps/types/stepsTypes'
import { isReliableStepCount } from '../../steps/types/stepsTypes'

export type StepsOsSource = 'ios_pedometer' | 'android_health_connect' | 'android_watch'

function startOfToday(): Date {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return start
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
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

async function readIosStepsResult(start: Date, end: Date): Promise<StepsReadResult> {
  let available = false
  try {
    available = await Pedometer.isAvailableAsync()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const presentation = buildUserPresentation('error')
    return {
      steps: 0,
      status: 'error',
      source: 'none',
      ...presentation,
      debugMessage: msg,
    }
  }

  if (!available) {
    const presentation = buildUserPresentation('unsupported_platform')
    return {
      steps: 0,
      status: 'unsupported_platform',
      source: 'none',
      ...presentation,
    }
  }

  const perm = await Pedometer.getPermissionsAsync()
  if (perm.status !== 'granted') {
    const presentation = buildUserPresentation('permission_missing')
    return {
      steps: 0,
      status: 'permission_missing',
      source: 'none',
      ...presentation,
    }
  }

  try {
    const result = await Pedometer.getStepCountAsync(start, end)
    const steps = Math.max(0, result.steps)
    if (steps > 0) {
      const presentation = buildUserPresentation('ready')
      return {
        steps,
        status: 'ready',
        source: 'ios_pedometer',
        ...presentation,
      }
    }
    const presentation = buildUserPresentation('no_data')
    return {
      steps: 0,
      status: 'no_data',
      source: 'ios_pedometer',
      ...presentation,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const presentation = buildUserPresentation('error')
    return {
      steps: 0,
      status: 'error',
      source: 'none',
      ...presentation,
      debugMessage: msg,
    }
  }
}

/** Detailed read for a single day/range from OS. */
export async function readStepsForDay(start: Date, end: Date): Promise<StepsReadResult> {
  if (Platform.OS === 'ios') {
    return readIosStepsResult(start, end)
  }
  return readHealthConnectSteps(start, end)
}

/** Detailed read for today from OS. */
export async function readTodayStepsResultFromOs(): Promise<StepsReadResult> {
  return readStepsForDay(startOfToday(), new Date())
}

function mapSourceToOsSource(result: StepsReadResult): StepsOsSource {
  if (result.source === 'ios_pedometer') return 'ios_pedometer'
  if (result.source === 'health_connect_raw' || result.source === 'health_connect_aggregate') {
    return 'android_health_connect'
  }
  return 'android_health_connect'
}

/** Backward-compatible wrapper for adventure tracker and legacy callers. */
export async function readTodayStepsFromOs(): Promise<{
  steps: number
  source: StepsOsSource
} | null> {
  const result = await readTodayStepsResultFromOs()
  if (!isReliableStepCount(result)) return null
  return { steps: result.steps, source: mapSourceToOsSource(result) }
}

/** Agregirani koraci za danas / sedmicu / mjesec (Android Health Connect). */
export async function readStepsPeriodsFromOs(): Promise<StepsPeriodTotals | null> {
  if (Platform.OS !== 'android') return null
  return readStepsPeriodTotals()
}

/** Dnevni koraci po datumu (YYYY-MM-DD) u zadatom rasponu, uključujući from i to. */
export async function readDailyStepsForRange(from: Date, to: Date): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  const start = startOfDay(from)
  const end = startOfDay(to)
  const now = new Date()
  const todayStart = startOfDay(now)

  const cur = new Date(start)
  while (cur <= end) {
    const dayStart = startOfDay(cur)
    const dayEnd = cur.getTime() === todayStart.getTime() ? now : endOfDay(cur)
    const key = dateKey(cur)
    const result = await readStepsForDay(dayStart, dayEnd)
    if (result.steps > 0) map.set(key, result.steps)
    cur.setDate(cur.getDate() + 1)
  }

  return map
}

/** Live delta dok je app u foreground-u (dopuna, ne jedini izvor). */
export function watchLiveStepDelta(onDelta: (delta: number) => void): () => void {
  let baseline: number | null = null
  const sub = Pedometer.watchStepCount((ev) => {
    if (baseline === null) {
      baseline = ev.steps
      return
    }
    onDelta(Math.max(0, ev.steps - baseline))
  })
  return () => sub.remove()
}

export async function requestOsStepsAccess(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const perm = await Pedometer.requestPermissionsAsync()
    return perm.status === 'granted'
  }
  return hasHealthConnectStepsPermission()
}

export async function isOsStepsReaderAvailable(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    return Pedometer.isAvailableAsync()
  }
  return hasHealthConnectStepsPermission()
}
