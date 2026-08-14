import type { GPSPoint } from '@beleg/shared'
import {
  computeElevationGainM,
  encodePolyline,
  sumRouteDistanceM,
  type LatLngAlt,
} from './activityMetrics'
import { canonicalAcceptedPoints } from './liveRouteGeometry'

export interface FinishRouteSnapshot {
  points: GPSPoint[]
  latLng: LatLngAlt[]
  distanceM: number
  elevationGainM: number
  routePolyline: string
  endLat: number | undefined
  endLng: number | undefined
}

/** One canonical accepted-point list for polyline, distance, elevation, leftover upload. */
export function buildFinishRouteSnapshot(points: GPSPoint[]): FinishRouteSnapshot {
  const canonical = canonicalAcceptedPoints(points)
  const latLng: LatLngAlt[] = canonical.map((p) => ({
    lat: p.lat,
    lng: p.lng,
    altitude: p.altitude,
  }))
  const last = canonical[canonical.length - 1]
  return {
    points: canonical,
    latLng,
    distanceM: sumRouteDistanceM(latLng),
    elevationGainM: computeElevationGainM(latLng),
    routePolyline: encodePolyline(latLng),
    endLat: last?.lat,
    endLng: last?.lng,
  }
}

export function collectUnsentPoints(
  snapshot: GPSPoint[],
  alreadyQueuedCount: number,
  pendingQueue: GPSPoint[],
): GPSPoint[] {
  return [...pendingQueue, ...snapshot.slice(alreadyQueuedCount)]
}
