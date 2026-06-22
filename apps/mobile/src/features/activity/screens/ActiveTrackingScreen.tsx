import { useEffect, useRef } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AppTopBar, Button, Loader, Screen, Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'
import type { ExploreStackParamList } from '../../../navigation/types'
import { ActivityLiveMap } from '../components/ActivityLiveMap'
import { ActivityLiveStatsBar } from '../components/ActivityLiveStatsBar'
import { useActivityTracker } from '../hooks/useActivityTracker'

type Props = NativeStackScreenProps<ExploreStackParamList, 'ActiveTracking'>

export default function ActiveTrackingScreen({ navigation }: Props) {
  const tracker = useActivityTracker()
  const autoStartedRef = useRef(false)

  useEffect(() => {
    if (tracker.loading || autoStartedRef.current) return
    if (tracker.status === 'idle' && !tracker.activityId) {
      autoStartedRef.current = true
      void tracker.start()
    }
  }, [tracker.loading, tracker.status, tracker.activityId, tracker.start])

  const onFinish = () => {
    Alert.alert('Završi aktivnost', 'Da li želite da sačuvate ovu aktivnost?', [
      { text: 'Otkaži', style: 'cancel' },
      {
        text: 'Završi',
        onPress: () => {
          void (async () => {
            const activity = await tracker.finish()
            if (activity) {
              navigation.replace('ActivitySummary', { activityId: activity.id })
            }
          })()
        },
      },
    ])
  }

  const onDiscard = () => {
    Alert.alert('Odbaci aktivnost', 'Aktivnost neće biti sačuvana.', [
      { text: 'Otkaži', style: 'cancel' },
      {
        text: 'Odbaci',
        style: 'destructive',
        onPress: () => {
          void tracker.discard().then(() => navigation.goBack())
        },
      },
    ])
  }

  if (tracker.loading && tracker.status === 'idle') {
    return (
      <Screen>
        <Loader />
      </Screen>
    )
  }

  return (
    <Screen edges={['left', 'right']} padded={false} style={styles.root}>
      <AppTopBar title="Praćenje aktivnosti" leftIcon="chevron-back" onLeftPress={onDiscard} />
      <View style={styles.mapWrap}>
        <ActivityLiveMap points={tracker.routePoints} follow={tracker.status === 'active'} />
      </View>
      {tracker.error ? (
        <Text variant="small" color={colors.danger} style={styles.error}>
          {tracker.error}
        </Text>
      ) : null}
      <Text variant="small" color={colors.textMuted} style={styles.warning}>
        Držite aplikaciju otvorenom tokom aktivnosti. GPS i mapa rade samo u prvom planu.
      </Text>
      <ActivityLiveStatsBar
        elapsedSec={tracker.elapsedSec}
        distanceM={tracker.distanceM}
        elevationGainM={tracker.elevationGainM}
        steps={tracker.steps}
      />
      <View style={styles.controls}>
        {tracker.status === 'active' ? (
          <Button title="Pauza" variant="secondary" onPress={tracker.pause} />
        ) : (
          <Button title="Nastavi" variant="secondary" onPress={tracker.resume} />
        )}
        <Button title="Završi" onPress={onFinish} disabled={tracker.status === 'finishing'} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  mapWrap: { flex: 1, minHeight: 280 },
  error: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  warning: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  controls: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
})
