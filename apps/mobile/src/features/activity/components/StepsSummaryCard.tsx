import { Pressable, StyleSheet, View } from 'react-native'
import Constants from 'expo-constants'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { Button, Text } from '../../../components/ui'
import { colors, radius, spacing } from '../../../theme'
import type { StepsAccessStatus } from '../services/stepsAccess'
import { formatDistanceKm, formatSteps } from '../../steps/services/stepsFormat'

interface Props {
  steps: number
  goal: number
  progressPercent: number
  distanceKm: number
  activeMinutes: number
  loading?: boolean
  accessStatus?: StepsAccessStatus | 'loading'
  onRequestAccess?: () => void
  onPress: () => void
}

export function StepsSummaryCard({
  steps,
  goal,
  progressPercent,
  distanceKm,
  activeMinutes,
  loading = false,
  accessStatus = 'ready',
  onRequestAccess,
  onPress,
}: Props) {
  const { t } = useTranslation('explore')
  const pct = Math.min(100, progressPercent)
  const isExpoGo = Constants.appOwnership === 'expo'
  const needsAccess =
    accessStatus === 'permission_needed' || accessStatus === 'permission_denied'

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.accent} />
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Ionicons name="footsteps-outline" size={22} color={colors.brand} />
          </View>
          <Text variant="label" style={styles.title}>
            DNEVNI KORACI
          </Text>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </View>

        {loading ? (
          <View style={styles.loadingBody}>
            <Text variant="small" color={colors.textMuted}>
              {t('dailyStepsLoading')}
            </Text>
            <View style={styles.skeletonTrack} />
          </View>
        ) : accessStatus === 'device_unavailable' ? (
          <View style={styles.accessBody}>
            <Text variant="small" color={colors.textMuted}>
              {isExpoGo ? t('dailyStepsExpoGoHint') : t('dailyStepsUnavailable')}
            </Text>
          </View>
        ) : needsAccess ? (
          <View style={styles.accessBody}>
            <Text variant="small" color={colors.textMuted}>
              {accessStatus === 'permission_denied'
                ? t('dailyStepsPermissionDenied')
                : t('dailyStepsPermissionNeeded')}
            </Text>
            {onRequestAccess ? (
              <Button
                title={
                  accessStatus === 'permission_denied'
                    ? t('dailyStepsOpenSettings')
                    : t('dailyStepsEnable')
                }
                variant="secondary"
                onPress={(e) => {
                  e.stopPropagation()
                  onRequestAccess()
                }}
              />
            ) : null}
          </View>
        ) : (
          <>
            <View style={styles.countRow}>
              <Text variant="label" style={styles.count}>
                {formatSteps(steps)}
              </Text>
              <Text variant="small" color={colors.textMuted}>
                / {formatSteps(goal)}
              </Text>
            </View>
            <View style={styles.barRow}>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${pct}%` }]} />
              </View>
              <Text variant="small" color={colors.brand} style={styles.pct}>
                {pct}%
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text variant="small" color={colors.textMuted}>
                ≈ {formatDistanceKm(distanceKm)}
              </Text>
              <Text variant="small" color={colors.textMuted}>
                ≈ {activeMinutes} min aktivno
              </Text>
            </View>
          </>
        )}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  accent: {
    height: 4,
    backgroundColor: colors.navBgMid,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  title: {
    flex: 1,
    letterSpacing: 0.5,
    fontSize: 12,
    color: colors.navBgMid,
  },
  loadingBody: { gap: spacing.sm },
  accessBody: { gap: spacing.sm },
  skeletonTrack: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  count: { fontSize: 22, fontWeight: '700' },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  track: {
    flex: 1,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.brand,
    borderRadius: radius.full,
  },
  pct: { minWidth: 36, textAlign: 'right', fontWeight: '600' },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
})
