import type { AxiosInstance } from 'axios'
import type { DailyStepsToday } from '../types/activity'

export async function fetchTodaySteps(client: AxiosInstance): Promise<DailyStepsToday> {
  const res = await client.get('/api/me/steps/today')
  return res.data as DailyStepsToday
}

export async function updateStepGoal(client: AxiosInstance, dailyStepGoal: number): Promise<{ dailyStepGoal: number }> {
  const res = await client.put('/api/me/steps/goal', { dailyStepGoal })
  return res.data as { dailyStepGoal: number }
}

export async function syncDailySteps(
  client: AxiosInstance,
  payload: { date: string; steps: number },
): Promise<{ steps: number; date: string }> {
  const res = await client.post('/api/me/steps/sync', payload)
  return res.data as { steps: number; date: string }
}

export async function fetchMyActivityStats(client: AxiosInstance): Promise<{
  ukupnoKoraka: number
  completedCount: number
  totalDistanceM: number
}> {
  const res = await client.get('/api/me/activity-stats')
  return res.data
}
