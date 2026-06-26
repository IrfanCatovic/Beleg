import { StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { Button, Card, Text } from '../../../components/ui'
import { colors, radius, spacing } from '../../../theme'
import type { StepsAccessStatus } from '../../activity/services/stepsAccess'

interface Props {
  accessStatus: StepsAccessStatus | 'loading'
  connected?: boolean
  loading?: boolean
  onRequestAccess: () => void
  onOpenSettings?: () => void
  onInstallHealthConnect?: () => void
}

export function StepsAccessCard({
  accessStatus,
  connected = false,
  loading = false,
  onRequestAccess,
  onOpenSettings,
  onInstallHealthConnect,
}: Props) {
  const { t } = useTranslation('explore')

  if (connected) {
    return (
      <Card style={styles.card}>
        <View style={styles.connectedRow}>
          <View style={styles.connectedIcon}>
            <Ionicons name="checkmark-circle" size={22} color={colors.brand} />
          </View>
          <View style={styles.connectedText}>
            <Text variant="label">{t('stepsConnectedTitle')}</Text>
            <Text variant="small" color={colors.textMuted}>
              {t('stepsConnectedHint')}
            </Text>
          </View>
        </View>
      </Card>
    )
  }

  if (accessStatus === 'device_unavailable' || accessStatus === 'health_connect_update_required') {
    return (
      <Card style={styles.card}>
        <Text variant="label">{t('stepsConnectTitle')}</Text>
        <Text variant="small" color={colors.textMuted} style={styles.body}>
          {accessStatus === 'health_connect_update_required'
            ? t('stepsHcUpdateRequired')
            : t('stepsHcUnavailable')}
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

  if (accessStatus === 'permission_denied') {
    return (
      <Card style={styles.card}>
        <Text variant="label">{t('stepsPermissionDeniedTitle')}</Text>
        <Text variant="small" color={colors.textMuted} style={styles.body}>
          {t('stepsPermissionDeniedBody')}
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
          {t('stepsConnectTitle')}
        </Text>
      </View>
      <Text variant="small" color={colors.textMuted} style={styles.body}>
        {t('stepsConnectBody')}
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
