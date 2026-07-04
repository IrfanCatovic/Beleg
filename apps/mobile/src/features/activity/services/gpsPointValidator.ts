import type { GPSPoint } from '@beleg/shared'
import { haversineDistanceM } from './activityMetrics'

export const DEFAULT_GPS_VALIDATOR_CONFIG = {
  maxAccuracyMeters: 50,
  maxWalkingSpeedMps: 3.5,
  minDistanceMeters: 3,
  minTimeDeltaMs: 2000,
  maxPointAgeMs: 30_000,
  jumpBufferMeters: 20,
} as const

export type GpsValidatorConfig = typeof DEFAULT_GPS_VALIDATOR_CONFIG

export interface GpsPointValidationResult {
  accepted: boolean
  reason?: string
  distanceDeltaM?: number
  speedMps?: number
}

function hasValidCoords(point: GPSPoint): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lng) <= 180
  )
}

function pointTimestampMs(point: GPSPoint): number | null {
  if (!point.recordedAt) return null
  const ms = new Date(point.recordedAt).getTime()
  return Number.isFinite(ms) ? ms : null
}

export function validateGPSPoint(
  point: GPSPoint,
  previousValid: GPSPoint[],
  config: GpsValidatorConfig = DEFAULT_GPS_VALIDATOR_CONFIG,
  nowMs: number = Date.now(),
): GpsPointValidationResult {
  if (!hasValidCoords(point)) {
    return { accepted: false, reason: 'missing_coords' }
  }

  const pointMs = pointTimestampMs(point)
  if (pointMs == null) {
    return { accepted: false, reason: 'missing_timestamp' }
  }

  if (nowMs - pointMs > config.maxPointAgeMs) {
    return { accepted: false, reason: 'stale_timestamp' }
  }

  if (point.accuracy == null || point.accuracy > config.maxAccuracyMeters) {
    return { accepted: false, reason: 'accuracy_too_low' }
  }

  const prev = previousValid[previousValid.length - 1]
  if (!prev) {
    return { accepted: true, distanceDeltaM: 0, speedMps: 0 }
  }

  const prevMs = pointTimestampMs(prev)
  if (prevMs == null) {
    return { accepted: false, reason: 'previous_missing_timestamp' }
  }

  const deltaMs = pointMs - prevMs
  if (deltaMs < config.minTimeDeltaMs) {
    return { accepted: false, reason: 'time_delta_too_small' }
  }

  const deltaSeconds = deltaMs / 1000
  const distanceDeltaM = haversineDistanceM(
    { lat: prev.lat, lng: prev.lng },
    { lat: point.lat, lng: point.lng },
  )

  if (distanceDeltaM < config.minDistanceMeters) {
    return { accepted: false, reason: 'too_close', distanceDeltaM, speedMps: 0 }
  }

  const speedMps = distanceDeltaM / deltaSeconds
  if (speedMps > config.maxWalkingSpeedMps) {
    return { accepted: false, reason: 'speed_too_high', distanceDeltaM, speedMps }
  }

  const maxAllowedDistance =
    config.maxWalkingSpeedMps * deltaSeconds + config.jumpBufferMeters
  if (distanceDeltaM > maxAllowedDistance) {
    return { accepted: false, reason: 'jump_too_large', distanceDeltaM, speedMps }
  }

  return { accepted: true, distanceDeltaM, speedMps }
}
