import type { GPSPoint } from '@beleg/shared'
import { haversineDistanceM } from './activityMetrics'

export const DEFAULT_GPS_VALIDATOR_CONFIG = {
  maxAccuracyMeters: 50,
  maxWalkingSpeedMps: 3.5,
  minDistanceMeters: 3,
  minTimeDeltaMs: 2000,
  /** First-point orphan cutoff vs ingest now. Delayed delivery of in-order points is allowed. */
  maxOrphanAgeMs: 10 * 60 * 1000,
  jumpBufferMeters: 20,
} as const

export type GpsValidatorConfig = typeof DEFAULT_GPS_VALIDATOR_CONFIG

export interface GpsPointValidationResult {
  accepted: boolean
  reason?: string
  distanceDeltaM?: number
  speedMps?: number
}

export interface GpsFilterState {
  lastAccepted: GPSPoint | null
  lastPlausible: GPSPoint | null
}

export function emptyGpsFilterState(): GpsFilterState {
  return { lastAccepted: null, lastPlausible: null }
}

function hasValidCoords(point: GPSPoint): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lng) <= 180
  )
}

export function pointTimestampMs(point: GPSPoint): number | null {
  if (!point.recordedAt) return null
  const ms = new Date(point.recordedAt).getTime()
  return Number.isFinite(ms) ? ms : null
}

function movementMaxAllowedM(
  from: GPSPoint,
  to: GPSPoint,
  deltaSeconds: number,
  config: GpsValidatorConfig,
): number {
  const accuracyBudget = (from.accuracy ?? 0) + (to.accuracy ?? 0)
  return config.maxWalkingSpeedMps * deltaSeconds + config.jumpBufferMeters + accuracyBudget
}

function evaluateVsAnchor(
  point: GPSPoint,
  pointMs: number,
  anchor: GPSPoint,
  config: GpsValidatorConfig,
): GpsPointValidationResult {
  const prevMs = pointTimestampMs(anchor)
  if (prevMs == null) {
    return { accepted: false, reason: 'previous_missing_timestamp' }
  }

  const deltaMs = pointMs - prevMs
  if (deltaMs < config.minTimeDeltaMs) {
    return { accepted: false, reason: 'time_delta_too_small' }
  }

  const deltaSeconds = deltaMs / 1000
  const distanceDeltaM = haversineDistanceM(
    { lat: anchor.lat, lng: anchor.lng },
    { lat: point.lat, lng: point.lng },
  )

  if (distanceDeltaM < config.minDistanceMeters) {
    return { accepted: false, reason: 'too_close', distanceDeltaM, speedMps: 0 }
  }

  const speedMps = distanceDeltaM / deltaSeconds
  const maxAllowed = movementMaxAllowedM(anchor, point, deltaSeconds, config)
  if (distanceDeltaM > maxAllowed) {
    return {
      accepted: false,
      reason: speedMps > config.maxWalkingSpeedMps ? 'speed_too_high' : 'jump_too_large',
      distanceDeltaM,
      speedMps,
    }
  }

  return { accepted: true, distanceDeltaM, speedMps }
}

export function evaluateGpsPoint(
  point: GPSPoint,
  state: GpsFilterState,
  config: GpsValidatorConfig = DEFAULT_GPS_VALIDATOR_CONFIG,
  nowMs: number = Date.now(),
): { result: GpsPointValidationResult; state: GpsFilterState } {
  if (!hasValidCoords(point)) {
    return { result: { accepted: false, reason: 'missing_coords' }, state }
  }

  const pointMs = pointTimestampMs(point)
  if (pointMs == null) {
    return { result: { accepted: false, reason: 'missing_timestamp' }, state }
  }

  const acceptedMs = state.lastAccepted ? pointTimestampMs(state.lastAccepted) : null
  if (acceptedMs != null && pointMs + 250 < acceptedMs) {
    return { result: { accepted: false, reason: 'stale_timestamp' }, state }
  }

  if (state.lastAccepted == null && nowMs - pointMs > config.maxOrphanAgeMs) {
    return { result: { accepted: false, reason: 'stale_timestamp' }, state }
  }

  const accuracyTooLow = point.accuracy == null || point.accuracy > config.maxAccuracyMeters

  if (!state.lastAccepted) {
    if (accuracyTooLow) {
      return { result: { accepted: false, reason: 'accuracy_too_low' }, state }
    }
    return {
      result: { accepted: true, distanceDeltaM: 0, speedMps: 0 },
      state: { lastAccepted: point, lastPlausible: point },
    }
  }

  if (accuracyTooLow) {
    const anchor = state.lastPlausible ?? state.lastAccepted
    const vsAnchor = evaluateVsAnchor(point, pointMs, anchor, config)
    if (vsAnchor.reason === 'speed_too_high' || vsAnchor.reason === 'jump_too_large') {
      return { result: vsAnchor, state }
    }
    return {
      result: {
        accepted: false,
        reason: 'accuracy_too_low',
        distanceDeltaM: vsAnchor.distanceDeltaM,
      },
      state: { ...state, lastPlausible: point },
    }
  }

  const vsAccepted = evaluateVsAnchor(point, pointMs, state.lastAccepted, config)

  if (vsAccepted.accepted) {
    return { result: vsAccepted, state: { lastAccepted: point, lastPlausible: point } }
  }

  if (vsAccepted.reason === 'too_close' || vsAccepted.reason === 'time_delta_too_small') {
    return { result: vsAccepted, state: { ...state, lastPlausible: point } }
  }

  const plausible = state.lastPlausible
  if (plausible && plausible !== state.lastAccepted) {
    const vsPlausible = evaluateVsAnchor(point, pointMs, plausible, config)
    if (vsPlausible.accepted) {
      return { result: vsPlausible, state: { lastAccepted: point, lastPlausible: point } }
    }
  }

  return { result: vsAccepted, state }
}

/** Backward-compatible helper: no degraded-plausible memory unless passed. */
export function validateGPSPoint(
  point: GPSPoint,
  previousValid: GPSPoint[],
  config: GpsValidatorConfig = DEFAULT_GPS_VALIDATOR_CONFIG,
  nowMs: number = Date.now(),
  lastPlausible?: GPSPoint | null,
): GpsPointValidationResult {
  const lastAccepted = previousValid[previousValid.length - 1] ?? null
  const { result } = evaluateGpsPoint(
    point,
    {
      lastAccepted,
      lastPlausible: lastPlausible === undefined ? lastAccepted : lastPlausible,
    },
    config,
    nowMs,
  )
  return result
}
