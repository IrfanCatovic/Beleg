export type TrackedActivityStatus = 'active' | 'completed' | 'discarded'

export interface GPSPoint {
  lat: number
  lng: number
  altitude?: number
  accuracy?: number
  recordedAt: string
}

export interface TrackedActivity {
  id: number
  userId: number
  status: TrackedActivityStatus
  startedAt: string
  endedAt?: string
  durationSec: number
  distanceM: number
  elevationGainM: number
  steps: number
  startLat?: number
  startLng?: number
  endLat?: number
  endLng?: number
  routePolyline?: string
  klubId?: number
  createdAt: string
  updatedAt: string
}

export interface DailyStepsToday {
  date: string
  steps: number
  goal: number
  progressPercent: number
}

export interface ActivityStats {
  ukupnoKoraka: number
  completedCount: number
  totalDistanceM: number
}

export interface FinishActivityPayload {
  durationSec: number
  distanceM: number
  elevationGainM: number
  steps: number
  routePolyline?: string
  endLat?: number
  endLng?: number
}

export type LeaderboardScope = 'global' | 'club'
export type LeaderboardPeriod = 'day' | 'week' | 'month'

export interface StepsLeaderboardEntry {
  userId: number
  username: string
  fullName?: string
  avatarUrl?: string
  steps: number
  rank: number
}

export interface StepsLeaderboardResponse {
  entries: StepsLeaderboardEntry[]
  scope: LeaderboardScope
  period: LeaderboardPeriod
}
