import AsyncStorage from '@react-native-async-storage/async-storage'

const BASELINE_PREFIX = 'stepsBaseline:'
const ACTIVE_ACTIVITY_KEY = 'activeActivityId'
const SESSION_STEPS_BASELINE_KEY = 'adventureSessionStepsBaseline'
const SYNC_INTERVAL_MS = 5 * 60 * 1000

export function todayKey(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export async function getStepsBaseline(date: string): Promise<number | null> {
  const raw = await AsyncStorage.getItem(`${BASELINE_PREFIX}${date}`)
  if (raw == null) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export async function setStepsBaseline(date: string, baseline: number): Promise<void> {
  await AsyncStorage.setItem(`${BASELINE_PREFIX}${date}`, String(baseline))
}

export async function getStoredActiveActivityId(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(ACTIVE_ACTIVITY_KEY)
  if (raw == null) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export async function setStoredActiveActivityId(id: number | null): Promise<void> {
  if (id == null) {
    await AsyncStorage.multiRemove([ACTIVE_ACTIVITY_KEY, SESSION_STEPS_BASELINE_KEY])
    return
  }
  await AsyncStorage.setItem(ACTIVE_ACTIVITY_KEY, String(id))
}

export async function getSessionStepsBaseline(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(SESSION_STEPS_BASELINE_KEY)
  if (raw == null) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export async function setSessionStepsBaseline(baseline: number): Promise<void> {
  await AsyncStorage.setItem(SESSION_STEPS_BASELINE_KEY, String(baseline))
}

export { SYNC_INTERVAL_MS }
