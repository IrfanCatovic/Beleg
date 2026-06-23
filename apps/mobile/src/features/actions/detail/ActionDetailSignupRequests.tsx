import { StyleSheet, View } from 'react-native'
import type { ActionSignupRequest, AkcijaDetail } from '@beleg/shared'
import { Button, Card, Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'
import { SectionHeader } from './SectionHeader'

interface ActionDetailSignupRequestsProps {
  requests: ActionSignupRequest[]
  akcija: AkcijaDetail
  loading?: boolean
  onRespond: (requestId: number, action: 'accept' | 'reject') => void
}

export function ActionDetailSignupRequests({
  requests,
  akcija,
  loading,
  onRespond,
}: ActionDetailSignupRequestsProps) {
  if (requests.length === 0) return null

  return (
    <Card style={styles.card}>
      <SectionHeader title="Zahtevi za prijavu" count={requests.length} />
      {requests.map((req) => {
        const name = req.requester.fullName?.trim() || req.requester.username
        const prevozNames = (req.selectedPrevozIds ?? [])
          .map((id) => akcija.prevoz?.find((p) => p.id === id)?.nazivGrupe)
          .filter(Boolean)
        const rentSummary = (req.selectedRentItems ?? [])
          .map((it) => {
            const r = akcija.opremaRent?.find((x) => x.id === it.rentId)
            return r ? `${r.nazivOpreme} × ${it.kolicina}` : null
          })
          .filter(Boolean)

        return (
          <View key={req.id} style={styles.row}>
            <View style={styles.info}>
              <Text variant="label">{name}</Text>
              <Text variant="small" color={colors.textMuted}>
                @{req.requester.username}
              </Text>
              {prevozNames.length > 0 ? (
                <Text variant="small" color={colors.textMuted}>
                  Prevoz: {prevozNames.join(', ')}
                </Text>
              ) : null}
              {rentSummary.length > 0 ? (
                <Text variant="small" color={colors.textMuted}>
                  Oprema: {rentSummary.join(', ')}
                </Text>
              ) : null}
            </View>
            <View style={styles.actions}>
              <Button title="Odbij" variant="ghost" loading={loading} onPress={() => onRespond(req.id, 'reject')} />
              <Button title="Prihvati" loading={loading} onPress={() => onRespond(req.id, 'accept')} />
            </View>
          </View>
        )
      })}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md, gap: spacing.md, borderColor: '#fcd34d', backgroundColor: '#fffbeb' },
  row: { gap: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  info: { gap: 2 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
})
