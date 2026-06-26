import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import type { GPSPoint } from '@beleg/shared'

export const ADVENTURE_LOCATION_TASK = 'planiner-adventure-location'
const POINTS_STORAGE_KEY = 'adventure:locationPoints'
const HEARTBEAT_KEY = 'adventure:heartbeat'
const HEARTBEAT_INTERVAL_MS = 15_000
const KILLED_THRESHOLD_MS = 45_000

type PointListener = (points: GPSPoint[]) => void

let memoryPoints: GPSPoint[] = []
const listeners = new Set<PointListener>()

function notify() {
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
    if (Array.isArray(parsed)) memoryPoints = parsed
  } catch {
    memoryPoints = []
  }
}

function locationToPoint(loc: Location.LocationObject): GPSPoint {
  const hasAltitude = loc.coords.altitude != null
  // #region agent log
  if (memoryPoints.length % 5 === 0) {
    fetch('http://127.0.0.1:7774/ingest/4b4823e8-e059-45d4-bd4e-f7b6e10474eb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '6cb8dd' },
      body: JSON.stringify({
        sessionId: '6cb8dd',
        runId: 'pre-fix',
        hypothesisId: 'A',
        location: 'adventureLocationTask.ts:locationToPoint',
        message: 'gps point sampled',
        data: {
          pointIndex: memoryPoints.length,
          hasAltitude,
          altitude: hasAltitude ? Math.round(loc.coords.altitude! * 10) / 10 : null,
          accuracy: loc.coords.accuracy != null ? Math.round(loc.coords.accuracy) : null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
  }
  // #endregion
  return {
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    altitude: loc.coords.altitude ?? undefined,
    accuracy: loc.coords.accuracy ?? undefined,
    recordedAt: new Date(loc.timestamp).toISOString(),
  }
}

if (!TaskManager.isTaskDefined(ADVENTURE_LOCATION_TASK)) {
  TaskManager.defineTask(ADVENTURE_LOCATION_TASK, async ({ data, error }) => {
    if (error) return
    const payload = data as { locations?: Location.LocationObject[] } | undefined
    const locations = payload?.locations ?? []
    if (locations.length === 0) return
    for (const loc of locations) {
      memoryPoints.push(locationToPoint(loc))
    }
    await persistPoints()
    notify()
    await AsyncStorage.setItem(HEARTBEAT_KEY, String(Date.now()))
  })
}

export function subscribeAdventurePoints(listener: PointListener): () => void {
  listeners.add(listener)
  listener([...memoryPoints])
  return () => listeners.delete(listener)
}

export function getAdventurePoints(): GPSPoint[] {
  return [...memoryPoints]
}

export async function clearAdventurePoints(): Promise<void> {
  memoryPoints = []
  await AsyncStorage.multiRemove([POINTS_STORAGE_KEY, HEARTBEAT_KEY])
  notify()
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

export async function startAdventureLocationTracking(): Promise<void> {
  await loadPersistedPoints()
  const fg = await Location.requestForegroundPermissionsAsync()
  if (fg.status !== 'granted') {
    throw new Error('Dozvola za lokaciju nije dodeljena.')
  }
  const bg = await Location.requestBackgroundPermissionsAsync()
  if (bg.status !== 'granted') {
    throw new Error('Dozvola za lokaciju u pozadini je potrebna za avanturu.')
  }

  const running = await Location.hasStartedLocationUpdatesAsync(ADVENTURE_LOCATION_TASK)
  if (running) {
    await Location.stopLocationUpdatesAsync(ADVENTURE_LOCATION_TASK)
  }

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
  await touchAdventureHeartbeat()
}

export async function stopAdventureLocationTracking(): Promise<void> {
  const running = await Location.hasStartedLocationUpdatesAsync(ADVENTURE_LOCATION_TASK)
  if (running) {
    await Location.stopLocationUpdatesAsync(ADVENTURE_LOCATION_TASK)
  }
}

let heartbeatTimer: ReturnType<typeof setInterval> | null = null

export function startAdventureHeartbeat(): void {
  if (heartbeatTimer) return
  heartbeatTimer = setInterval(() => {
    void touchAdventureHeartbeat()
  }, HEARTBEAT_INTERVAL_MS)
}

export function stopAdventureHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}
