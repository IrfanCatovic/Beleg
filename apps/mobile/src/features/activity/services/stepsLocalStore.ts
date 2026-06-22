import AsyncStorage from '@react-native-async-storage/async-storage'

const GOAL_KEY = 'dailyStepGoal'
export const DEFAULT_DAILY_STEP_GOAL = 10000

export function todayKey(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export async function getDailyStepGoal(): Promise<number> {
  const raw = await AsyncStorage.getItem(GOAL_KEY)
  if (raw == null) return DEFAULT_DAILY_STEP_GOAL
  const n = Number(raw)
  return Number.isFinite(n) && n >= 1000 ? n : DEFAULT_DAILY_STEP_GOAL
}

export async function setDailyStepGoal(goal: number): Promise<void> {
  await AsyncStorage.setItem(GOAL_KEY, String(goal))
}
