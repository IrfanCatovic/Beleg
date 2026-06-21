import { Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { GuideNearbyPublic } from '@beleg/shared/services'
import { Avatar, Card, Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'

interface FerrataGuidesSectionProps {
  guides: GuideNearbyPublic[]
  loading?: boolean
  onPressGuide?: (guide: GuideNearbyPublic) => void
}

export function FerrataGuidesSection({ guides, loading, onPressGuide }: FerrataGuidesSectionProps) {
  if (loading) {
    return (
      <Card style={styles.card}>
        <SectionTitle icon="people-outline" title="Vodiči u blizini" />
        <Text variant="small" color={colors.textMuted}>
          Učitavanje...
        </Text>
      </Card>
    )
  }

  if (guides.length === 0) return null

  return (
    <Card style={styles.card}>
      <SectionTitle icon="people-outline" title="Vodiči u blizini" />
      {guides.slice(0, 6).map((g) => {
        const name = g.user?.fullName || g.user?.username || g.naslov || 'Vodič'
        return (
          <Pressable key={g.id} style={styles.row} onPress={() => onPressGuide?.(g)}>
            <Avatar uri={g.user?.avatarUrl} name={name} size={40} />
            <View style={styles.info}>
              <Text variant="label">{name}</Text>
              <Text variant="small" color={colors.textMuted}>
                {[g.grad, g.region].filter(Boolean).join(' · ')}
                {g.distanceKm != null ? ` · ${g.distanceKm.toFixed(0)} km` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        )
      })}
    </Card>
  )
}

function SectionTitle({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={styles.titleRow}>
      <Ionicons name={icon} size={18} color={colors.brand} />
      <Text variant="label">{title}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, marginBottom: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  info: { flex: 1 },
})
