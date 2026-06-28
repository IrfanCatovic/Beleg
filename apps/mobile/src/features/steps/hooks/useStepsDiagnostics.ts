import { useCallback, useRef, useState } from 'react'
import { Platform } from 'react-native'
import type { StepsAccessStatus } from '../../activity/services/stepsAccess'
import {
  executeStepsDiagnosisAction,
  runStepsDiagnosis,
  type StepsDiagnosis,
} from '../services/stepsTroubleshooter'

export function useStepsDiagnostics(options: {
  accessStatus: StepsAccessStatus | 'loading'
  stepsConnected: boolean
  todaySteps: number
  onRequestPermission: () => Promise<void>
  onOpenSettings: () => Promise<void>
  onInstallHealthConnect: () => Promise<void>
  onRefresh: () => Promise<void>
}) {
  const {
    accessStatus,
    stepsConnected,
    todaySteps,
    onRequestPermission,
    onOpenSettings,
    onInstallHealthConnect,
    onRefresh,
  } = options

  const [diagnosis, setDiagnosis] = useState<StepsDiagnosis | null>(null)
  const [loading, setLoading] = useState(false)
  const runningRef = useRef(false)

  const shouldDiagnose =
    accessStatus !== 'loading' && (!stepsConnected || todaySteps === 0)

  const runDiagnosis = useCallback(async () => {
    if (runningRef.current || accessStatus === 'loading') return
    runningRef.current = true
    setLoading(true)
    try {
      const result = await runStepsDiagnosis({ accessStatus, todaySteps })
      setDiagnosis(result)
    } finally {
      setLoading(false)
      runningRef.current = false
    }
  }, [accessStatus, todaySteps])

  const runDiagnosisWithRefresh = useCallback(async () => {
    await onRefresh()
    await runDiagnosis()
  }, [onRefresh, runDiagnosis])

  const handleAction = useCallback(async () => {
    if (!diagnosis?.actionType) return
    await executeStepsDiagnosisAction(diagnosis.actionType, {
      requestPermission: onRequestPermission,
      openHealthConnectSettings: onOpenSettings,
      installHealthConnect: onInstallHealthConnect,
      refresh: runDiagnosisWithRefresh,
    })
    if (diagnosis.actionType !== 'refresh') {
      await runDiagnosisWithRefresh()
    }
  }, [
    diagnosis?.actionType,
    onInstallHealthConnect,
    onOpenSettings,
    onRequestPermission,
    runDiagnosisWithRefresh,
  ])

  const markConnected = useCallback(() => {
    if (Platform.OS === 'android' && todaySteps === 0) return
    if (!stepsConnected || todaySteps <= 0) return
    setDiagnosis({
      status: 'connected',
      userTitle: 'Koraci su povezani',
      userMessage: 'Koraci su povezani i ažurirani.',
      actionType: 'none',
    })
  }, [stepsConnected, todaySteps])

  return {
    diagnosis,
    loading,
    shouldDiagnose,
    runDiagnosis,
    runDiagnosisWithRefresh,
    handleAction,
    markConnected,
  }
}
