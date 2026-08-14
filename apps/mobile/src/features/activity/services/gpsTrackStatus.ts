export type GpsTrackStatus =
  | 'tracking'
  | 'gps_weak'
  | 'background_tracking_failed'
  | 'location_unavailable'

export const GPS_ACQUIRE_GRACE_MS = 20_000
export const GPS_RAW_SILENCE_WEAK_MS = 25_000
export const GPS_ACCEPTED_STALE_WEAK_MS = 45_000

export interface GpsStatusInput {
  trackingMode: 'background' | 'foreground_only' | 'stopped'
  nowMs: number
  trackingStartedAtMs: number | null
  lastRawAtMs: number | null
  lastAcceptedAtMs: number | null
  lastRawAccuracy: number | null
  consecutiveAccuracyRejects: number
}

/**
 * Weak GPS is OS silence or sustained unusable accuracy — not "validator
 * dropped a close/jitter point" and not the first seconds of acquiring a fix.
 */
export function computeAdventureGpsStatus(input: GpsStatusInput): GpsTrackStatus {
  if (input.trackingMode === 'stopped') return 'tracking'
  if (input.trackingMode === 'foreground_only') return 'background_tracking_failed'

  const started = input.trackingStartedAtMs
  if (started != null && input.nowMs - started < GPS_ACQUIRE_GRACE_MS) {
    return 'tracking'
  }

  if (input.lastRawAtMs == null) {
    return 'tracking'
  }

  if (input.nowMs - input.lastRawAtMs > GPS_RAW_SILENCE_WEAK_MS) {
    return 'gps_weak'
  }

  const acceptedStale =
    input.lastAcceptedAtMs == null ||
    input.nowMs - input.lastAcceptedAtMs > GPS_ACCEPTED_STALE_WEAK_MS
  const rawIsPoor = input.lastRawAccuracy != null && input.lastRawAccuracy > 65
  if (acceptedStale && rawIsPoor && input.consecutiveAccuracyRejects >= 4) {
    return 'gps_weak'
  }

  return 'tracking'
}
