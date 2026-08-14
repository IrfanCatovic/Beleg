import type { GpsTrackStatus } from './gpsTrackStatus'

export interface GpsDiagEvent {
  timestamp: string
  lat: number
  lng: number
  accuracy: number | undefined
  speed: number | undefined
  rawReceived: true
  accepted: boolean
  rejectionReason?: string
  distanceDeltaM?: number
  timeDeltaMs?: number
  gpsStatus: GpsTrackStatus
}

const RING_SIZE = 40
const ring: GpsDiagEvent[] = []

export function recordGpsDiagEvent(event: GpsDiagEvent): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return
  ring.push(event)
  if (ring.length > RING_SIZE) ring.shift()
  console.log('[gps]', {
    t: event.timestamp,
    lat: event.lat,
    lng: event.lng,
    accuracy: event.accuracy,
    speed: event.speed,
    accepted: event.accepted,
    reason: event.rejectionReason,
    dM: event.distanceDeltaM,
    dtMs: event.timeDeltaMs,
    status: event.gpsStatus,
  })
}

export function getGpsDiagRing(): readonly GpsDiagEvent[] {
  return ring
}

export function clearGpsDiagRing(): void {
  ring.length = 0
}
