import { Pressable, StyleSheet, View } from 'react-native'
import { Avatar, Button, Card, Input, SegmentedToggle, Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'
import type { useExternalInvite } from '../hooks/useExternalInvite'

type ExternalInviteState = ReturnType<typeof useExternalInvite>

interface ActionDetailExternalInviteProps {
  state: ExternalInviteState
  onCancelRequest: (requestId: number) => void
}

export function ActionDetailExternalInvite({ state, onCancelRequest }: ActionDetailExternalInviteProps) {
  const pendingCount = state.requests.filter((r) => r.status === 'pending').length

  return (
    <Card style={styles.card}>
      <Text variant="label">Dodaj člana van kluba</Text>
      <Text variant="small" color={colors.textMuted}>
        Pretraži korisnike iz drugih klubova ili bez kluba. Akcija se upisuje tek nakon potvrde.
      </Text>
      <Text variant="small" color={colors.brand}>Pending zahtevi: {pendingCount}</Text>

      <SegmentedToggle
        value={state.scope}
        onChange={(v) => state.setScope(v as 'other-clubs' | 'no-club')}
        options={[
          { value: 'other-clubs', label: 'Drugi klubovi' },
          { value: 'no-club', label: 'Bez kluba' },
        ]}
      />

      <Input
        placeholder="Pretraži korisnika…"
        value={state.search}
        onChangeText={state.setSearch}
        autoCapitalize="none"
      />

      {state.error ? <Text variant="small" color={colors.danger}>{state.error}</Text> : null}

      {state.loading ? <Text variant="small" color={colors.textMuted}>Pretraga…</Text> : null}

      {state.candidates.map((c) => (
        <View key={c.id} style={styles.row}>
          <Avatar uri={c.avatarUrl} name={c.fullName || c.username} size={40} />
          <View style={styles.rowInfo}>
            <Text variant="label">{c.fullName || c.username}</Text>
            <Text variant="small" color={colors.textMuted}>@{c.username}{c.klubNaziv ? ` · ${c.klubNaziv}` : ''}</Text>
          </View>
          <Button
            title="Pošalji"
            onPress={() => void state.sendRequest(c)}
            loading={state.sendingId === c.id}
          />
        </View>
      ))}

      {state.requests.length > 0 ? (
        <View style={styles.pending}>
          <Text variant="label">Poslati zahtevi</Text>
          {state.requests.map((r) => (
            <View key={r.id} style={styles.row}>
              <Text variant="small" style={styles.flex}>
                {r.targetUser.fullName || r.targetUser.username} — {r.status}
              </Text>
              {r.status === 'pending' ? (
                <Pressable onPress={() => onCancelRequest(r.id)}>
                  <Text variant="small" color={colors.danger}>Otkaži</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowInfo: { flex: 1 },
  flex: { flex: 1 },
  pending: { gap: spacing.xs, marginTop: spacing.sm },
})
