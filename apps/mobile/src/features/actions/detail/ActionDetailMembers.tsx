import { StyleSheet, View } from 'react-native'
import type { Prijava } from '@beleg/shared'
import { Avatar, Card, Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'

interface ActionDetailMembersProps {
  prijave: Prijava[]
}

export function ActionDetailMembers({ prijave }: ActionDetailMembersProps) {
  if (prijave.length === 0) return null

  return (
    <Card style={styles.card}>
      <Text variant="label">Prijavljeni ({prijave.length})</Text>
      <View style={styles.grid}>
        {prijave.slice(0, 24).map((p) => {
          const name = p.fullName || p.korisnik || 'Član'
          return (
            <View key={p.id} style={styles.member}>
              <Avatar uri={p.avatarUrl} name={name} size={36} />
              <Text variant="small" numberOfLines={1} style={styles.name}>
                {name}
              </Text>
            </View>
          )
        })}
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  member: { width: 72, alignItems: 'center', gap: 4 },
  name: { textAlign: 'center', fontSize: 10 },
})
