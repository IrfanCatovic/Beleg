import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { Pedometer } from 'expo-sensors'
import { fetchTodaySteps, syncDailySteps, updateStepGoal } from '@beleg/shared'
import { client } from '../../../api/client'
import {
  SYNC_INTERVAL_MS,
  getStepsBaseline,
  setStepsBaseline,
  todayKey,
} from '../services/activityLocalStore'

export interface DailyStepsState {
  todaySteps: number
  goal: number
  progressPercent: number
  date: string
  available: boolean
  loading: boolean
  syncing: boolean
  error: string | null
  refresh: () => Promise<void>
  setGoal: (goal: number) => Promise<void>
  syncNow: () => Promise<void>
}

export function useDailySteps(): DailyStepsState {
  const [todaySteps, setTodaySteps] = useState(0)
  const [goal, setGoalState] = useState(10000)
  const [progressPercent, setProgressPercent] = useState(0)
  const [date, setDate] = useState(todayKey())
  const [available, setAvailable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rawCountRef = useRef(0)
  const baselineRef = useRef<number | null>(null)

  const applyCount = useCallback((raw: number) => {
    rawCountRef.current = raw
    const baseline = baselineRef.current ?? raw
    const steps = Math.max(0, raw - baseline)
    setTodaySteps(steps)
    setProgressPercent(goal > 0 ? Math.min(100, Math.round((steps / goal) * 100)) : 0)
  }, [goal])

  const ensureBaseline = useCallback(async (raw: number) => {
    const day = todayKey()
    setDate(day)
    let baseline = await getStepsBaseline(day)
    if (baseline == null) {
      baseline = raw
      await setStepsBaseline(day, raw)
    }
    baselineRef.current = baseline
    applyCount(raw)
  }, [applyCount])

  const loadFromServer = useCallback(async () => {
    try {
      const data = await fetchTodaySteps(client)
      setGoalState(data.goal)
      setDate(data.date)
      setProgressPercent(data.progressPercent)
      setTodaySteps((prev) => (data.steps > prev ? data.steps : prev))
      setError(null)
    } catch {
      setError('Koraci nisu učitani sa servera.')
    }
  }, [])

  const syncNow = useCallback(async () => {
    setSyncing(true)
    try {
      await syncDailySteps(client, { date: todayKey(), steps: todaySteps })
      await loadFromServer()
    } catch {
      setError('Sinhronizacija nije uspela.')
    } finally {
      setSyncing(false)
    }
  }, [todaySteps, loadFromServer])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const isAvailable = await Pedometer.isAvailableAsync()
      setAvailable(isAvailable)
      if (isAvailable) {
        const { status } = await Pedometer.requestPermissionsAsync()
        if (status === 'granted') {
          const end = new Date()
          const start = new Date()
          start.setHours(0, 0, 0, 0)
          const result = await Pedometer.getStepCountAsync(start, end)
          await ensureBaseline(result.steps)
        }
      }
      await loadFromServer()
    } catch {
      setError('Brojač koraka nije dostupan.')
    } finally {
      setLoading(false)
    }
  }, [ensureBaseline, loadFromServer])

  const setGoal = useCallback(async (newGoal: number) => {
    const res = await updateStepGoal(client, newGoal)
    setGoalState(res.dailyStepGoal)
    setProgressPercent(
      res.dailyStepGoal > 0 ? Math.min(100, Math.round((todaySteps / res.dailyStepGoal) * 100)) : 0,
    )
  }, [todaySteps])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    let sub: { remove: () => void } | null = null
    void (async () => {
      if (!available) return
      sub = Pedometer.watchStepCount((ev) => {
        void ensureBaseline(ev.steps)
      })
    })()
    return () => sub?.remove()
  }, [available, ensureBaseline])

  useEffect(() => {
    const id = setInterval(() => {
      if (todaySteps > 0) void syncNow()
    }, SYNC_INTERVAL_MS)
    return () => clearInterval(id)
  }, [todaySteps, syncNow])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh()
    })
    return () => sub.remove()
  }, [refresh])

  return {
    todaySteps,
    goal,
    progressPercent,
    date,
    available,
    loading,
    syncing,
    error,
    refresh,
    setGoal,
    syncNow,
  }
}
