import { Platform, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { Button, Card, Text } from '../../../components/ui'
import { colors, radius, spacing } from '../../../theme'
import type { StepsAccessStatus } from '../services/stepsAccess'
import type { StepsReadStatus } from '../../steps/types/stepsTypes'

interface Props {
  accessStatus: StepsAccessStatus | 'loading'
  connected?: boolean
  loading?: boolean
  userTitle?: string
  userMessage?: string
  stepStatus?: StepsReadStatus
  onRequestAccess: () => void
  onOpenSettings?: () => void
  onInstallHealthConnect?: () => void
}

export function StepsAccessCard({
  accessStatus,
  connected = false,
  loading = false,
  userTitle,
  userMessage,
  stepStatus,
  onRequestAccess,
  onOpenSettings,
  onInstallHealthConnect,
}: Props) {
  const { t } = useTranslation('explore')

  const isConnected =
    connected ||
    stepStatus === 'ready' ||
    stepStatus === 'raw_fallback_used'

  if (isConnected) {
    return (
      <Card style={styles.card}>
        <View style={styles.connectedRow}>
          <View style={styles.connectedIcon}>
            <Ionicons name="checkmark-circle" size={22} color={colors.brand} />
          </View>
          <View style={styles.connectedText}>
            <Text variant="label">{userTitle || t('stepsConnectedTitle')}</Text>
            <Text variant="small" color={colors.textMuted}>
              {userMessage || t('stepsConnectedHint')}
            </Text>
          </View>
        </View>
      </Card>
    )
  }

  const isIos = Platform.OS === 'ios'

  if (
    !isIos &&
    (accessStatus === 'device_unavailable' || accessStatus === 'health_connect_update_required')
  ) {
    return (
      <Card style={styles.card}>
        <Text variant="label">{userTitle || t('stepsConnectTitle')}</Text>
        <Text variant="small" color={colors.textMuted} style={styles.body}>
          {userMessage ||
            (accessStatus === 'health_connect_update_required'
              ? t('stepsHcUpdateRequired')
              : t('stepsHcUnavailable'))}
        </Text>
        {onInstallHealthConnect ? (
          <Button
            title={t('stepsHcInstallButton')}
            variant="secondary"
            onPress={onInstallHealthConnect}
          />
        ) : null}
      </Card>
    )
  }

  if (
    isIos &&
    (accessStatus === 'device_unavailable' ||
      stepStatus === 'unsupported_platform' ||
      stepStatus === 'health_connect_unavailable' ||
      stepStatus === 'health_connect_update_required')
  ) {
    return (
      <Card style={styles.card}>
        <Text variant="label">{userTitle || t('stepsStatus.unsupported.title')}</Text>
        <Text variant="small" color={colors.textMuted} style={styles.body}>
          {userMessage || t('stepsStatus.unsupported.message')}
        </Text>
      </Card>
    )
  }

  if (accessStatus === 'permission_denied') {
    return (
      <Card style={styles.card}>
        <Text variant="label">{userTitle || t('stepsPermissionDeniedTitle')}</Text>
        <Text variant="small" color={colors.textMuted} style={styles.body}>
          {userMessage || t('stepsPermissionDeniedBody')}
        </Text>
        <Button
          title={onOpenSettings ? t('stepsOpenPermissions') : t('dailyStepsOpenSettings')}
          variant="secondary"
          onPress={onOpenSettings ?? onRequestAccess}
        />
      </Card>
    )
  }

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Ionicons name="footsteps-outline" size={22} color={colors.brand} />
        </View>
        <Text variant="label" style={styles.title}>
          {userTitle || t('stepsConnectTitle')}
        </Text>
      </View>
      <Text variant="small" color={colors.textMuted} style={styles.body}>
        {userMessage || t('stepsConnectBody')}
      </Text>
      <Button
        title={t('stepsConnectButton')}
        onPress={onRequestAccess}
        loading={loading}
      />
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  title: { flex: 1 },
  body: { lineHeight: 20 },
  connectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  connectedIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  connectedText: { flex: 1, gap: 2 },
})
