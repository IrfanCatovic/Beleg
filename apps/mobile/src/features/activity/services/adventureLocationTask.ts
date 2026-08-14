import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import type { GPSPoint } from '@beleg/shared'
import { recordGpsDiagEvent } from './gpsDiagnostics'
import { ADVENTURE_GPS_BACKGROUND_OPTIONS, ADVENTURE_GPS_WATCH_OPTIONS } from './gpsLocationConfig'
import {
  emptyGpsFilterState,
  evaluateGpsPoint,
  pointTimestampMs,
  type GpsFilterState,
} from './gpsPointValidator'
import { computeAdventureGpsStatus, type GpsTrackStatus } from './gpsTrackStatus'

export type { GpsTrackStatus }

export const ADVENTURE_LOCATION_TASK = 'planiner-adventure-location'
const POINTS_STORAGE_KEY = 'adventure:locationPoints'
const HEARTBEAT_KEY = 'adventure:heartbeat'
const HEARTBEAT_INTERVAL_MS = 15_000
const KILLED_THRESHOLD_MS = 45_000

export const GPS_USER_MESSAGES = {
  background_tracking_failed:
    'Praćenje u pozadini nije dostupno, ali avantura se nastavlja dok je aplikacija otvorena.',
  gps_weak: 'GPS signal je slab. Pomjeri se na otvoreniji prostor.',
  location_unavailable: 'Lokacija trenutno nije dostupna. Provjeri GPS i dozvole.',
} as const

export type AdventureTrackingMode = 'background' | 'foreground_only' | 'stopped'

export type StartTrackingResult =
  | { ok: true; mode: 'background' | 'foreground_only'; userMessage?: string }
  | { ok: false; userMessage: string }

type PointListener = (points: GPSPoint[]) => void
type GpsStatusListener = (status: GpsTrackStatus, message: string | null) => void

let memoryPoints: GPSPoint[] = []
let filterState: GpsFilterState = emptyGpsFilterState()
let trackingMode: AdventureTrackingMode = 'stopped'
let acceptingPoints = false
let trackingStartedAtMs: number | null = null
let lastAcceptedAtMs: number | null = null
let lastRawAtMs: number | null = null
let lastRawAccuracy: number | null = null
let consecutiveAccuracyRejects = 0
let ingestTail: Promise<void> = Promise.resolve()
let foregroundSubscription: Location.LocationSubscription | null = null
const listeners = new Set<PointListener>()
const statusListeners = new Set<GpsStatusListener>()

function computeGpsStatus(): GpsTrackStatus {
  return computeAdventureGpsStatus({
    trackingMode,
    nowMs: Date.now(),
    trackingStartedAtMs,
    lastRawAtMs,
    lastAcceptedAtMs,
    lastRawAccuracy,
    consecutiveAccuracyRejects,
  })
}

function messageForStatus(status: GpsTrackStatus): string | null {
  switch (status) {
    case 'background_tracking_failed':
      return GPS_USER_MESSAGES.background_tracking_failed
    case 'gps_weak':
      return GPS_USER_MESSAGES.gps_weak
    case 'location_unavailable':
      return GPS_USER_MESSAGES.location_unavailable
    default:
      return null
  }
}

function notifyStatus() {
  const status = computeGpsStatus()
  const message = messageForStatus(status)
  statusListeners.forEach((fn) => fn(status, message))
}

function notifyPoints() {
  const snapshot = [...memoryPoints]
  listeners.forEach((fn) => fn(snapshot))
}

async function persistPoints() {
  await AsyncStorage.setItem(POINTS_STORAGE_KEY, JSON.stringify(memoryPoints))
}

function rebuildFilterFromPoints(points: GPSPoint[]) {
  const last = points[points.length - 1] ?? null
  filterState = { lastAccepted: last, lastPlausible: last }
  lastAcceptedAtMs = last ? pointTimestampMs(last) : null
}

async function loadPersistedPoints() {
  const raw = await AsyncStorage.getItem(POINTS_STORAGE_KEY)
  if (!raw) return
  try {
    const parsed = JSON.parse(raw) as GPSPoint[]
    if (Array.isArray(parsed)) {
      memoryPoints = parsed
      rebuildFilterFromPoints(parsed)
    }
  } catch {
    memoryPoints = []
    filterState = emptyGpsFilterState()
  }
}

function locationToPoint(loc: Location.LocationObject): GPSPoint {
  return {
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    altitude: loc.coords.altitude ?? undefined,
    accuracy: loc.coords.accuracy ?? undefined,
    recordedAt: new Date(loc.timestamp).toISOString(),
  }
}

function tryAcceptPoint(point: GPSPoint, speedFromOs?: number | null): boolean {
  const prevAccepted = filterState.lastAccepted
  const { result, state } = evaluateGpsPoint(point, filterState)
  filterState = state

  if (result.reason === 'accuracy_too_low') {
    consecutiveAccuracyRejects += 1
  } else if (result.accepted) {
    consecutiveAccuracyRejects = 0
  }

  const prevMs = prevAccepted ? pointTimestampMs(prevAccepted) : null
  const pointMs = pointTimestampMs(point)
  const timeDeltaMs = prevMs != null && pointMs != null ? pointMs - prevMs : undefined

  recordGpsDiagEvent({
    timestamp: point.recordedAt,
    lat: point.lat,
    lng: point.lng,
    accuracy: point.accuracy,
    speed: speedFromOs ?? result.speedMps,
    rawReceived: true,
    accepted: result.accepted,
    rejectionReason: result.reason,
    distanceDeltaM: result.distanceDeltaM,
    timeDeltaMs,
    gpsStatus: computeGpsStatus(),
  })

  if (!result.accepted) {
    notifyStatus()
    return false
  }
  memoryPoints.push(point)
  lastAcceptedAtMs = pointMs ?? Date.now()
  return true
}

async function ingestLocations(locations: Location.LocationObject[]): Promise<boolean> {
  if (!acceptingPoints || locations.length === 0) return false
  let anyAccepted = false
  for (const loc of locations) {
    lastRawAtMs = Date.now()
    lastRawAccuracy = loc.coords.accuracy ?? null
    if (tryAcceptPoint(locationToPoint(loc), loc.coords.speed)) {
      anyAccepted = true
    }
  }
  if (anyAccepted) {
    await persistPoints()
    notifyPoints()
    await AsyncStorage.setItem(HEARTBEAT_KEY, String(Date.now()))
  }
  notifyStatus()
  return anyAccepted
}

function enqueueIngest(locations: Location.LocationObject[]): Promise<boolean> {
  const run = ingestTail.then(() => ingestLocations(locations))
  ingestTail = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

if (!TaskManager.isTaskDefined(ADVENTURE_LOCATION_TASK)) {
  TaskManager.defineTask(ADVENTURE_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn('[gps] background task error', error)
      return
    }
    const payload = data as { locations?: Location.LocationObject[] } | undefined
    const locations = payload?.locations ?? []
    if (locations.length === 0) return
    await enqueueIngest(locations)
  })
}

async function startForegroundWatch(): Promise<void> {
  if (foregroundSubscription) return
  foregroundSubscription = await Location.watchPositionAsync(ADVENTURE_GPS_WATCH_OPTIONS, (loc) => {
    void enqueueIngest([loc])
  })
}

function stopForegroundWatch(): void {
  foregroundSubscription?.remove()
  foregroundSubscription = null
}

export function subscribeAdventurePoints(listener: PointListener): () => void {
  listeners.add(listener)
  listener([...memoryPoints])
  return () => listeners.delete(listener)
}

export function subscribeGpsStatus(listener: GpsStatusListener): () => void {
  statusListeners.add(listener)
  const status = computeGpsStatus()
  listener(status, messageForStatus(status))
  return () => statusListeners.delete(listener)
}

export function getGpsTrackStatus(): GpsTrackStatus {
  return computeGpsStatus()
}

export function getGpsTrackMessage(): string | null {
  return messageForStatus(computeGpsStatus())
}

export function getAdventurePoints(): GPSPoint[] {
  return [...memoryPoints]
}

export async function clearAdventurePoints(): Promise<void> {
  memoryPoints = []
  filterState = emptyGpsFilterState()
  lastAcceptedAtMs = null
  lastRawAtMs = null
  lastRawAccuracy = null
  consecutiveAccuracyRejects = 0
  await AsyncStorage.multiRemove([POINTS_STORAGE_KEY, HEARTBEAT_KEY])
  notifyPoints()
  notifyStatus()
}

export async function touchAdventureHeartbeat(): Promise<void> {
  await AsyncStorage.setItem(HEARTBEAT_KEY, String(Date.now()))
}

export async function wasAdventureProcessKilled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(HEARTBEAT_KEY)
  if (!raw) return false
  const last = Number(raw)
  if (!Number.isFinite(last)) return false
  return Date.now() - last > KILLED_THRESHOLD_MS
}

export async function startAdventureLocationTracking(): Promise<StartTrackingResult> {
  await loadPersistedPoints()
  acceptingPoints = true
  trackingStartedAtMs = Date.now()
  lastRawAtMs = null
  lastRawAccuracy = null
  consecutiveAccuracyRejects = 0

  const servicesOn = await Location.hasServicesEnabledAsync()
  if (!servicesOn) {
    trackingMode = 'stopped'
    acceptingPoints = false
    notifyStatus()
    return { ok: false, userMessage: GPS_USER_MESSAGES.location_unavailable }
  }

  const fg = await Location.requestForegroundPermissionsAsync()
  if (fg.status !== 'granted') {
    trackingMode = 'stopped'
    acceptingPoints = false
    notifyStatus()
    return { ok: false, userMessage: GPS_USER_MESSAGES.location_unavailable }
  }

  stopForegroundWatch()

  const running = await Location.hasStartedLocationUpdatesAsync(ADVENTURE_LOCATION_TASK)
  if (running) {
    await Location.stopLocationUpdatesAsync(ADVENTURE_LOCATION_TASK)
  }

  try {
    await Location.requestBackgroundPermissionsAsync()
    await Location.startLocationUpdatesAsync(ADVENTURE_LOCATION_TASK, ADVENTURE_GPS_BACKGROUND_OPTIONS)
    trackingMode = 'background'
    await touchAdventureHeartbeat()
    notifyStatus()
    return { ok: true, mode: 'background' }
  } catch (e) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('[gps] startLocationUpdatesAsync failed', e)
    }

    try {
      await startForegroundWatch()
      trackingMode = 'foreground_only'
      await touchAdventureHeartbeat()
      notifyStatus()
      return {
        ok: true,
        mode: 'foreground_only',
        userMessage: GPS_USER_MESSAGES.background_tracking_failed,
      }
    } catch (fgError) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('[gps] foreground watchPositionAsync failed', fgError)
      }
      trackingMode = 'stopped'
      acceptingPoints = false
      notifyStatus()
      return { ok: false, userMessage: GPS_USER_MESSAGES.location_unavailable }
    }
  }
}

export async function stopAdventureLocationTracking(): Promise<void> {
  acceptingPoints = false
  await ingestTail
  stopForegroundWatch()
  const running = await Location.hasStartedLocationUpdatesAsync(ADVENTURE_LOCATION_TASK)
  if (running) {
    await Location.stopLocationUpdatesAsync(ADVENTURE_LOCATION_TASK)
  }
  trackingMode = 'stopped'
  notifyStatus()
}

export async function stopAndGetAdventurePoints(): Promise<GPSPoint[]> {
  await stopAdventureLocationTracking()
  return [...memoryPoints]
}

let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let weakCheckTimer: ReturnType<typeof setInterval> | null = null

export function startAdventureHeartbeat(): void {
  if (heartbeatTimer) return
  heartbeatTimer = setInterval(() => {
    void touchAdventureHeartbeat()
  }, HEARTBEAT_INTERVAL_MS)

  if (!weakCheckTimer) {
    weakCheckTimer = setInterval(() => {
      notifyStatus()
    }, 5000)
  }
}

export function stopAdventureHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
  if (weakCheckTimer) {
    clearInterval(weakCheckTimer)
    weakCheckTimer = null
  }
}
