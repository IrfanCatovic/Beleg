import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import type { GPSPoint } from '@beleg/shared'
import { validateGPSPoint } from './gpsPointValidator'

export const ADVENTURE_LOCATION_TASK = 'planiner-adventure-location'
const POINTS_STORAGE_KEY = 'adventure:locationPoints'
const HEARTBEAT_KEY = 'adventure:heartbeat'
const HEARTBEAT_INTERVAL_MS = 15_000
const KILLED_THRESHOLD_MS = 45_000
const GPS_WEAK_THRESHOLD_MS = 15_000

export const GPS_USER_MESSAGES = {
  background_tracking_failed:
    'Praćenje u pozadini nije dostupno, ali avantura se nastavlja dok je aplikacija otvorena.',
  gps_weak: 'GPS signal je slab. Pomjeri se na otvoreniji prostor.',
  location_unavailable: 'Lokacija trenutno nije dostupna. Provjeri GPS i dozvole.',
} as const

export type GpsTrackStatus =
  | 'tracking'
  | 'gps_weak'
  | 'background_tracking_failed'
  | 'location_unavailable'

export type AdventureTrackingMode = 'background' | 'foreground_only' | 'stopped'

export type StartTrackingResult =
  | { ok: true; mode: 'background' | 'foreground_only'; userMessage?: string }
  | { ok: false; userMessage: string }

type PointListener = (points: GPSPoint[]) => void
type GpsStatusListener = (status: GpsTrackStatus, message: string | null) => void

let memoryPoints: GPSPoint[] = []
let trackingMode: AdventureTrackingMode = 'stopped'
let lastAcceptedAtMs: number | null = null
let foregroundSubscription: Location.LocationSubscription | null = null
const listeners = new Set<PointListener>()
const statusListeners = new Set<GpsStatusListener>()

function pointTimestampMs(point: GPSPoint): number | null {
  const ms = new Date(point.recordedAt).getTime()
  return Number.isFinite(ms) ? ms : null
}

function computeGpsStatus(): GpsTrackStatus {
  if (trackingMode === 'stopped') return 'tracking'
  if (trackingMode === 'foreground_only') return 'background_tracking_failed'
  if (lastAcceptedAtMs == null || Date.now() - lastAcceptedAtMs > GPS_WEAK_THRESHOLD_MS) {
    return 'gps_weak'
  }
  return 'tracking'
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

async function loadPersistedPoints() {
  const raw = await AsyncStorage.getItem(POINTS_STORAGE_KEY)
  if (!raw) return
  try {
    const parsed = JSON.parse(raw) as GPSPoint[]
    if (Array.isArray(parsed)) {
      memoryPoints = parsed
      const last = parsed[parsed.length - 1]
      if (last) lastAcceptedAtMs = pointTimestampMs(last)
    }
  } catch {
    memoryPoints = []
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

function tryAcceptPoint(point: GPSPoint): boolean {
  const result = validateGPSPoint(point, memoryPoints)
  if (!result.accepted) {
    if (__DEV__) {
      console.log('[gps] rejected', result.reason, {
        accuracy: point.accuracy,
        distanceDeltaM: result.distanceDeltaM,
        speedMps: result.speedMps,
      })
    }
    notifyStatus()
    return false
  }
  memoryPoints.push(point)
  lastAcceptedAtMs = pointTimestampMs(point) ?? Date.now()
  return true
}

async function ingestLocations(locations: Location.LocationObject[]): Promise<boolean> {
  let anyAccepted = false
  for (const loc of locations) {
    if (tryAcceptPoint(locationToPoint(loc))) {
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

if (!TaskManager.isTaskDefined(ADVENTURE_LOCATION_TASK)) {
  TaskManager.defineTask(ADVENTURE_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      if (__DEV__) console.warn('[gps] background task error', error)
      return
    }
    const payload = data as { locations?: Location.LocationObject[] } | undefined
    const locations = payload?.locations ?? []
    if (locations.length === 0) return
    await ingestLocations(locations)
  })
}

async function startForegroundWatch(): Promise<void> {
  if (foregroundSubscription) return
  foregroundSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 10,
    },
    (loc) => {
      void ingestLocations([loc])
    },
  )
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
  lastAcceptedAtMs = null
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

  const servicesOn = await Location.hasServicesEnabledAsync()
  if (!servicesOn) {
    trackingMode = 'stopped'
    notifyStatus()
    return { ok: false, userMessage: GPS_USER_MESSAGES.location_unavailable }
  }

  const fg = await Location.requestForegroundPermissionsAsync()
  if (fg.status !== 'granted') {
    trackingMode = 'stopped'
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
    await Location.startLocationUpdatesAsync(ADVENTURE_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 5000,
      distanceInterval: 10,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Planiner avantura',
        notificationBody: 'Praćenje rute je aktivno.',
      },
    })
    trackingMode = 'background'
    await touchAdventureHeartbeat()
    notifyStatus()
    return { ok: true, mode: 'background' }
  } catch (e) {
    if (__DEV__) {
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
      if (__DEV__) {
        console.warn('[gps] foreground watchPositionAsync failed', fgError)
      }
      trackingMode = 'stopped'
      notifyStatus()
      return { ok: false, userMessage: GPS_USER_MESSAGES.location_unavailable }
    }
  }
}

export async function stopAdventureLocationTracking(): Promise<void> {
  stopForegroundWatch()
  const running = await Location.hasStartedLocationUpdatesAsync(ADVENTURE_LOCATION_TASK)
  if (running) {
    await Location.stopLocationUpdatesAsync(ADVENTURE_LOCATION_TASK)
  }
  trackingMode = 'stopped'
  notifyStatus()
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
