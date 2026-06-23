import { Pressable, StyleSheet, View } from 'react-native'
import type { AkcijaDetail, Prijava } from '@beleg/shared'
import { computeClientSaldo } from '@beleg/shared'
import { Avatar, Badge, Card, Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'
import { SectionHeader } from './SectionHeader'

const STATUS_LABELS: Record<string, string> = {
  prijavljen: 'Prijavljen',
  'popeo se': 'Popeo se',
  'nije uspeo': 'Nije uspeo',
}

interface ActionDetailMembersListProps {
  prijave: Prijava[]
  akcija: AkcijaDetail
  currency: string
  canManageHost: boolean
  onPressMember: (member: Prijava) => void
}

export function ActionDetailMembersList({
  prijave,
  akcija,
  currency,
  canManageHost,
  onPressMember,
}: ActionDetailMembersListProps) {
  const visible = prijave.filter((p) => p.status !== 'otkazano')
  if (visible.length === 0) return null

  return (
    <Card style={styles.card}>
      <SectionHeader title="Prijavljeni članovi" count={visible.length} />
      <View style={styles.list}>
        {visible.map((p) => {
          const name = p.fullName?.trim() || p.korisnik || 'Član'
          const saldo = computeClientSaldo(p, akcija)
          const statusLabel = STATUS_LABELS[p.status] || p.status
          const paidBorder = canManageHost && !akcija.isCompleted

          return (
            <Pressable
              key={p.id}
              onPress={() => onPressMember(p)}
              style={[
                styles.row,
                paidBorder && p.platio && styles.rowPaid,
                paidBorder && !p.platio && styles.rowUnpaid,
              ]}
            >
              <Avatar uri={p.avatarUrl} name={name} size={40} />
              <View style={styles.info}>
                <Text variant="label" numberOfLines={1}>
                  {name}
                </Text>
                <Text variant="small" color={colors.textMuted} numberOfLines={1}>
                  @{p.korisnik}
                </Text>
              </View>
              <View style={styles.right}>
                <Badge
                  label={statusLabel}
                  tone={p.status === 'popeo se' ? 'brand' : p.status === 'nije uspeo' ? 'muted' : 'warning'}
                />
                {canManageHost ? (
                  <Text variant="small" color={colors.textMuted}>
                    {saldo.toLocaleString('sr-RS')} {currency}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          )
        })}
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowPaid: { borderColor: '#a7f3d0', backgroundColor: '#f0fdf4' },
  rowUnpaid: { borderColor: '#fecaca', backgroundColor: '#fff1f2' },
  info: { flex: 1, minWidth: 0 },
  right: { alignItems: 'flex-end', gap: 4 },
})
