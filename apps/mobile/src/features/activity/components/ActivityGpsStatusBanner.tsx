import { StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Text } from '../../../components/ui'
import type { GpsTrackStatus } from '../services/adventureLocationTask'
import { colors, radius, spacing } from '../../../theme'

interface Props {
  status: GpsTrackStatus
  message: string | null
}

export function ActivityGpsStatusBanner({ status, message }: Props) {
  if (!message || status === 'tracking') return null

  const iconName =
    status === 'location_unavailable' ? 'location-outline' : 'navigate-outline'

  return (
    <View style={styles.banner}>
      <Ionicons name={iconName} size={18} color={colors.warning} />
      <Text variant="small" color={colors.warning} style={styles.text}>
        {message}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  text: { flex: 1, lineHeight: 20 },
})
