import type { AxiosInstance } from 'axios'
import type {
  FinishActivityPayload,
  GPSPoint,
  TrackedActivity,
} from '../types/activity'

export async function startActivity(client: AxiosInstance): Promise<{ id: number; startedAt: string; status: string }> {
  const res = await client.post('/api/activities/start')
  return res.data
}

export async function fetchActiveActivity(client: AxiosInstance): Promise<TrackedActivity | null> {
  const res = await client.get('/api/activities/active')
  const data = res.data as { activity: TrackedActivity | null }
  return data.activity ?? null
}

export async function appendActivityPoints(
  client: AxiosInstance,
  activityId: number,
  points: GPSPoint[],
): Promise<{ added: number }> {
  const res = await client.post(`/api/activities/${activityId}/points`, { points })
  return res.data as { added: number }
}

export async function finishActivity(
  client: AxiosInstance,
  activityId: number,
  payload: FinishActivityPayload,
): Promise<{ activity: TrackedActivity }> {
  const res = await client.post(`/api/activities/${activityId}/finish`, payload)
  return res.data as { activity: TrackedActivity }
}

export async function discardActivity(client: AxiosInstance, activityId: number): Promise<void> {
  await client.post(`/api/activities/${activityId}/discard`)
}

export async function fetchActivityById(client: AxiosInstance, activityId: number): Promise<TrackedActivity> {
  const res = await client.get(`/api/activities/${activityId}`)
  const data = res.data as { activity: TrackedActivity }
  return data.activity
}

export async function fetchMyActivities(client: AxiosInstance, limit = 20): Promise<TrackedActivity[]> {
  const res = await client.get('/api/me/activities', { params: { limit } })
  const data = res.data as { activities: TrackedActivity[] }
  return data.activities ?? []
}
