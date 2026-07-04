import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Platform } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { client } from '../../../api/client'
import { useAuth } from '../../../context/AuthContext'
import type { DailyStepsState } from '../../../context/DailyStepsContext'
import {
  runStepsSyncDiagnostics,
  type StepsSyncDiagnosticReport,
} from '../services/stepsSyncDiagnostics'
import { todayKey } from '../../activity/services/stepsLocalStore'

const APP_ACTIVE_DEBOUNCE_MS = 4_000

function buildPlaninerSnapshot(daily: DailyStepsState) {
  return {
    displayedTodaySteps: daily.todaySteps,
    stepStatus: daily.stepStatus,
    stepSource: daily.stepSource,
    hydratedBaseline: daily.hydratedBaseline,
    lastSuccessfulReadAt: daily.lastSuccessfulReadAt,
    lastSyncToBackendAt: daily.lastSyncToBackendAt,
    lastContextRefreshAt: daily.lastContextRefreshAt,
    localTodayKey: todayKey(),
  }
}

export function useStepsSyncDiagnostics(daily: DailyStepsState) {
  const { isLoggedIn } = useAuth()
  const [report, setReport] = useState<StepsSyncDiagnosticReport | null>(null)
  const [loading, setLoading] = useState(false)
  const runningRef = useRef(false)
  const lastAppActiveRunRef = useRef(0)
  const dailyRef = useRef(daily)
  dailyRef.current = daily

  const runDiagnostics = useCallback(async () => {
    if (Platform.OS !== 'android') return
    if (runningRef.current) return
    runningRef.current = true
    setLoading(true)
    try {
      const next = await runStepsSyncDiagnostics({
        planiner: buildPlaninerSnapshot(dailyRef.current),
        client,
        isLoggedIn,
      })
      setReport(next)
    } finally {
      setLoading(false)
      runningRef.current = false
    }
  }, [isLoggedIn])

  useFocusEffect(
    useCallback(() => {
      void runDiagnostics()
    }, [runDiagnostics]),
  )

  useEffect(() => {
    if (Platform.OS !== 'android') return
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return
      const now = Date.now()
      if (now - lastAppActiveRunRef.current < APP_ACTIVE_DEBOUNCE_MS) return
      lastAppActiveRunRef.current = now
      void runDiagnostics()
    })
    return () => sub.remove()
  }, [runDiagnostics])

  return {
    report,
    loading,
    runDiagnostics,
    enabled: Platform.OS === 'android',
  }
}
