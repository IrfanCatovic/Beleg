import { Platform } from 'react-native'
import { Pedometer } from 'expo-sensors'
import {
  hasHealthConnectStepsPermission,
  readAggregateSteps,
  readStepsPeriodTotals,
  type StepsPeriodTotals,
} from '../../steps/services/healthConnectService'

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

async function readIosTodaySteps(): Promise<number | null> {
  const available = await Pedometer.isAvailableAsync()
  if (!available) return null
  const result = await Pedometer.getStepCountAsync(startOfToday(), new Date())
  return Math.max(0, result.steps)
}

async function readAndroidHealthConnectTodaySteps(): Promise<number | null> {
  const hasPerm = await hasHealthConnectStepsPermission()
  if (!hasPerm) return null
  const steps = await readAggregateSteps(startOfToday(), new Date())
  return steps
}

/** Autoritativno čitanje dnevnih koraka iz OS-a (radi i posle restarta app-a). */
export async function readTodayStepsFromOs(): Promise<{
  steps: number
  source: StepsOsSource
} | null> {
  if (Platform.OS === 'ios') {
    const steps = await readIosTodaySteps()
    if (steps == null) return null
    return { steps, source: 'ios_pedometer' }
  }

  const hcSteps = await readAndroidHealthConnectTodaySteps()
  if (hcSteps != null) {
    return { steps: hcSteps, source: 'android_health_connect' }
  }
  return null
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

    if (Platform.OS === 'ios') {
      const available = await Pedometer.isAvailableAsync()
      if (available) {
        const result = await Pedometer.getStepCountAsync(dayStart, dayEnd)
        if (result.steps > 0) map.set(key, result.steps)
      }
    } else {
      const steps = await readAggregateSteps(dayStart, dayEnd)
      if (steps > 0) map.set(key, steps)
    }

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
