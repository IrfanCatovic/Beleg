import { Platform } from 'react-native'
import { Pedometer } from 'expo-sensors'

export type StepsOsSource = 'ios_pedometer' | 'android_health_connect' | 'android_watch'

function startOfToday(): Date {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return start
}

async function readIosTodaySteps(): Promise<number | null> {
  const available = await Pedometer.isAvailableAsync()
  if (!available) return null
  const result = await Pedometer.getStepCountAsync(startOfToday(), new Date())
  return Math.max(0, result.steps)
}

let healthConnectReady: boolean | null = null

async function ensureHealthConnect(): Promise<boolean> {
  if (Platform.OS !== 'android') return false
  if (healthConnectReady !== null) return healthConnectReady
  try {
    const { initialize, requestPermission } = await import('react-native-health-connect')
    const ok = await initialize()
    if (!ok) {
      healthConnectReady = false
      return false
    }
    const perms = await requestPermission([{ accessType: 'read', recordType: 'Steps' }])
    healthConnectReady = perms.some((p) => p.recordType === 'Steps' && p.accessType === 'read')
    return healthConnectReady
  } catch {
    healthConnectReady = false
    return false
  }
}

async function readAndroidHealthConnectSteps(): Promise<number | null> {
  const ready = await ensureHealthConnect()
  if (!ready) return null
  try {
    const { readRecords } = await import('react-native-health-connect')
    const end = new Date()
    const start = startOfToday()
    const result = await readRecords('Steps', {
      timeRangeFilter: {
        operator: 'between',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
    })
    const records = Array.isArray(result)
      ? result
      : ((result as { records?: Array<{ count?: number }> }).records ?? [])
    return records.reduce((sum: number, row) => sum + (row.count ?? 0), 0)
  } catch {
    return null
  }
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

  const hcSteps = await readAndroidHealthConnectSteps()
  if (hcSteps != null) {
    return { steps: hcSteps, source: 'android_health_connect' }
  }
  return null
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
  return ensureHealthConnect()
}

export async function isOsStepsReaderAvailable(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    return Pedometer.isAvailableAsync()
  }
  try {
    const { initialize } = await import('react-native-health-connect')
    return initialize()
  } catch {
    return false
  }
}
