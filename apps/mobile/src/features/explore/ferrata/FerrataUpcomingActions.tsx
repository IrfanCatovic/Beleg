import { Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { FerrataUpcomingAction } from '@beleg/shared/services'
import { Card, Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'

interface FerrataUpcomingActionsProps {
  actions: FerrataUpcomingAction[]
  onPressAction: (id: number) => void
}

export function FerrataUpcomingActions({ actions, onPressAction }: FerrataUpcomingActionsProps) {
  if (actions.length === 0) return null

  return (
    <Card style={styles.card}>
      <View style={styles.titleRow}>
        <Ionicons name="calendar-outline" size={18} color={colors.brand} />
        <Text variant="label">Zakazane akcije</Text>
      </View>
      {actions.map((a) => (
        <Pressable key={a.id} style={styles.row} onPress={() => onPressAction(a.id)}>
          <View style={styles.info}>
            <Text variant="label">{a.naziv}</Text>
            <Text variant="small" color={colors.textMuted}>
              {[a.klubNaziv, a.startAt || a.datum].filter(Boolean).join(' · ')}
              {a.maxLjudi != null && a.maxLjudi > 0
                ? ` · ${Math.max(0, a.maxLjudi - (a.prijavljeno ?? 0))} slobodnih mesta`
                : ''}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      ))}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, marginBottom: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  info: { flex: 1 },
})
