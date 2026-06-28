import type { AxiosInstance } from 'axios'
import type {
  ClubsStepsLeaderboardResponse,
  DailyStepsToday,
  LeaderboardPeriod,
  LeaderboardScope,
  StepsHistoryResponse,
  StepsLeaderboardResponse,
} from '../types/activity'

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

export async function syncDailyStepsBatch(
  client: AxiosInstance,
  payload: { days: { date: string; steps: number }[] },
): Promise<{ synced: number }> {
  const res = await client.post('/api/me/steps/sync-batch', payload)
  return res.data as { synced: number }
}

export async function fetchStepsHistory(
  client: AxiosInstance,
  params: { from: string; to: string },
): Promise<StepsHistoryResponse> {
  const res = await client.get('/api/me/steps/history', { params })
  return res.data as StepsHistoryResponse
}

export async function fetchStepsLeaderboard(
  client: AxiosInstance,
  params: { scope?: LeaderboardScope; period?: LeaderboardPeriod; limit?: number; includeAll?: boolean },
): Promise<StepsLeaderboardResponse> {
  const res = await client.get('/api/leaderboards/steps', { params })
  return res.data as StepsLeaderboardResponse
}

export async function fetchClubsStepsLeaderboard(
  client: AxiosInstance,
  params?: { period?: LeaderboardPeriod },
): Promise<ClubsStepsLeaderboardResponse> {
  const res = await client.get('/api/leaderboards/clubs/steps', { params })
  return res.data as ClubsStepsLeaderboardResponse
}

export async function fetchMyActivityStats(client: AxiosInstance): Promise<{
  ukupnoKoraka: number
  completedCount: number
  totalDistanceM: number
}> {
  const res = await client.get('/api/me/activity-stats')
  return res.data
}
