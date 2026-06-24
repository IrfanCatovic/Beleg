import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { InteractionManager, StyleSheet, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { TrackedActivity } from '@beleg/shared'
import { AppTopBar, Button, Loader, Screen, Text } from '../../../components/ui'
import { useModal } from '../../../context/ModalContext'
import { colors, spacing } from '../../../theme'
import type { ExploreStackParamList } from '../../../navigation/types'
import { ActivityLiveStatsBar } from '../components/ActivityLiveStatsBar'
import { ActivityRouteMap } from '../components/ActivityRouteMap'
import { ActivitySummaryStats } from '../components/ActivitySummaryStats'
import { AdventureStickerModal } from '../components/AdventureStickerModal'
import { useActivityTracker } from '../hooks/useActivityTracker'
import { requestActivityPermissions } from '../services/activityPermissions'
import { decodePolyline, formatDuration } from '../services/activityMetrics'

type Props = NativeStackScreenProps<ExploreStackParamList, 'Adventure'>

type ScreenPhase = 'idle' | 'tracking' | 'completed'

function formatActivityDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function AdventureScreen({ navigation }: Props) {
  const { t } = useTranslation('explore')
  const { showAlert, showConfirm } = useModal()
  const queryClient = useQueryClient()
  const tracker = useActivityTracker()
  const [completedActivity, setCompletedActivity] = useState<TrackedActivity | null>(null)
  const [stickerOpen, setStickerOpen] = useState(false)
  const [starting, setStarting] = useState(false)
  const [showRouteMap, setShowRouteMap] = useState(false)
  const finishHandledRef = useRef(false)

  const phase: ScreenPhase = useMemo(() => {
    if (completedActivity) return 'completed'
    if (tracker.status === 'active' || tracker.status === 'paused' || tracker.status === 'finishing') {
      return 'tracking'
    }
    return 'idle'
  }, [completedActivity, tracker.status])

  const routePoints = useMemo(() => {
    if (completedActivity?.routePolyline) {
      return decodePolyline(completedActivity.routePolyline)
    }
    return []
  }, [completedActivity?.routePolyline])

  const handleStart = useCallback(async () => {
    if (tracker.status === 'active' || tracker.status === 'paused') {
      return
    }

    setStarting(true)
    const perms = await requestActivityPermissions()
    if (!perms.ok) {
      await showAlert('Dozvola', perms.message)
      setStarting(false)
      return
    }
    await tracker.start()
    setStarting(false)
  }, [tracker, showAlert])

  const handleStop = useCallback(async () => {
    const ok = await showConfirm(t('adventureStopTitle'), t('adventureStopMessage'), {
      variant: 'danger',
      confirmLabel: t('adventureStopConfirm'),
    })
    if (!ok) return
    const activity = await tracker.finish()
    if (activity) {
      finishHandledRef.current = true
      setCompletedActivity(activity)
      setShowRouteMap(false)
      void queryClient.invalidateQueries({ queryKey: ['activities', 'active'] })
      InteractionManager.runAfterInteractions(() => {
        setShowRouteMap(true)
      })
    }
  }, [tracker, showConfirm, queryClient, t])

  const handleDiscard = useCallback(async () => {
    const ok = await showConfirm(t('adventureDiscardTitle'), t('adventureDiscardMessage'), {
      variant: 'danger',
      confirmLabel: t('adventureDiscardConfirm'),
    })
    if (!ok) return
    await tracker.discard()
    setCompletedActivity(null)
    setStickerOpen(false)
  }, [tracker, showConfirm, t])

  const resetCompleted = useCallback(() => {
    setCompletedActivity(null)
    setStickerOpen(false)
    setShowRouteMap(false)
    finishHandledRef.current = false
    tracker.resetToIdle()
  }, [tracker])

  useEffect(() => {
    if (!tracker.error || completedActivity || finishHandledRef.current) return
    if (tracker.status === 'finishing') return
    void showAlert('Greška', tracker.error)
  }, [tracker.error, tracker.status, completedActivity, showAlert])

  if (tracker.loading && phase === 'idle' && !completedActivity) {
    return (
      <View style={styles.root}>
        <AppTopBar
          title={t('startAdventure')}
          leftIcon="arrow-back"
          onLeftPress={() => navigation.goBack()}
        />
        <Screen edges={['left', 'right']}>
          <Loader />
        </Screen>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <AppTopBar
        title={t('startAdventure')}
        leftIcon="arrow-back"
        onLeftPress={() => navigation.goBack()}
      />

      <Screen scroll edges={['left', 'right']}>
        {phase === 'idle' ? (
          <View style={styles.idle}>
            <View style={styles.heroIcon}>
              <Ionicons name="trail-sign" size={48} color={colors.white} />
            </View>
            <Text variant="title" style={styles.idleTitle}>
              {t('adventureIdleTitle')}
            </Text>
            <Text color={colors.textMuted} style={styles.idleText}>
              {t('adventureIdleBody')}
            </Text>
            <Button
              title={t('adventurePlay')}
              onPress={() => void handleStart()}
              loading={starting || tracker.loading}
              fullWidth
            />
          </View>
        ) : null}

        {phase === 'tracking' ? (
          <View style={styles.tracking}>
            <Text style={styles.timer}>{formatDuration(tracker.elapsedSec)}</Text>
            <Text variant="small" color={colors.textMuted} style={styles.timerLabel}>
              {tracker.status === 'paused' ? t('adventurePaused') : t('adventureActive')}
            </Text>
            <ActivityLiveStatsBar
              elapsedSec={tracker.elapsedSec}
              distanceM={tracker.distanceM}
              elevationGainM={tracker.elevationGainM}
              steps={tracker.steps}
            />
            <View style={styles.trackingActions}>
              {tracker.status === 'paused' ? (
                <Button title={t('adventureResume')} onPress={tracker.resume} fullWidth />
              ) : (
                <Button title={t('adventurePause')} variant="secondary" onPress={tracker.pause} fullWidth />
              )}
              <Button
                title={t('adventureStop')}
                variant="danger"
                onPress={() => void handleStop()}
                loading={tracker.status === 'finishing'}
                fullWidth
              />
              <Button title={t('adventureDiscardConfirm')} variant="ghost" onPress={() => void handleDiscard()} fullWidth />
            </View>
          </View>
        ) : null}

        {phase === 'completed' && completedActivity ? (
          <View style={styles.completed}>
            <Text variant="title" style={styles.completedTitle}>
              {t('adventureCompletedTitle')}
            </Text>
            <ActivitySummaryStats
              durationSec={completedActivity.durationSec}
              distanceM={completedActivity.distanceM}
              elevationGainM={completedActivity.elevationGainM}
              steps={completedActivity.steps}
            />
            <Text variant="label" style={styles.routeTitle}>
              {t('adventureRouteTitle')}
            </Text>
            {showRouteMap ? <ActivityRouteMap points={routePoints} /> : <Loader />}
            <View style={styles.completedActions}>
              <Button title={t('stickerTitle')} onPress={() => setStickerOpen(true)} fullWidth />
              <Button title={t('adventureNew')} variant="secondary" onPress={resetCompleted} fullWidth />
            </View>
          </View>
        ) : null}
      </Screen>

      {completedActivity ? (
        <AdventureStickerModal
          visible={stickerOpen}
          durationSec={completedActivity.durationSec}
          distanceM={completedActivity.distanceM}
          elevationGainM={completedActivity.elevationGainM}
          steps={completedActivity.steps}
          dateLabel={formatActivityDate(completedActivity.endedAt ?? completedActivity.startedAt)}
          onClose={() => setStickerOpen(false)}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  idle: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  heroIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idleTitle: { textAlign: 'center' },
  idleText: { textAlign: 'center', marginBottom: spacing.md },
  tracking: { gap: spacing.lg, paddingVertical: spacing.lg },
  timer: {
    fontSize: 56,
    fontWeight: '800',
    textAlign: 'center',
    color: colors.text,
    letterSpacing: -1,
  },
  timerLabel: { textAlign: 'center', marginTop: -spacing.sm },
  trackingActions: { gap: spacing.sm },
  completed: { gap: spacing.lg, paddingVertical: spacing.md },
  completedTitle: { textAlign: 'center' },
  routeTitle: { marginTop: spacing.sm },
  completedActions: { gap: spacing.sm, marginTop: spacing.md },
})
