import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { AkcijaDetail, Prijava } from '@beleg/shared'
import { computeClientSaldo } from '@beleg/shared'
import { Avatar, Button, Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'

interface ActionDetailMemberSheetProps {
  visible: boolean
  member: Prijava | null
  akcija: AkcijaDetail
  currency: string
  canManageHost: boolean
  showPaymentControls: boolean
  loading?: boolean
  onClose: () => void
  onTogglePayment: (platio: boolean) => void
  onStatusChange: (status: string) => void
  onRemove: () => void
}

export function ActionDetailMemberSheet({
  visible,
  member,
  akcija,
  currency,
  canManageHost,
  showPaymentControls,
  loading,
  onClose,
  onTogglePayment,
  onStatusChange,
  onRemove,
}: ActionDetailMemberSheetProps) {
  const insets = useSafeAreaInsets()
  if (!member) return null

  const name = member.fullName?.trim() || member.korisnik
  const saldo = computeClientSaldo(member, akcija)
  const fmt = (n: number) => `${n.toLocaleString('sr-RS')} ${currency}`

  const smestajRows = (member.selectedSmestajIds ?? [])
    .map((id) => akcija.smestaj?.find((s) => s.id === id))
    .filter(Boolean)
  const prevozRows = (member.selectedPrevozIds ?? [])
    .map((id) => akcija.prevoz?.find((p) => p.id === id))
    .filter(Boolean)
  const rentRows = (member.selectedRentItems ?? [])
    .map((it) => {
      const r = akcija.opremaRent?.find((x) => x.id === it.rentId)
      return r ? { ...r, qty: it.kolicina } : null
    })
    .filter(Boolean) as Array<{ nazivOpreme: string; cenaPoSetu: number; qty: number }>

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Avatar uri={member.avatarUrl} name={name} size={48} />
          <View style={styles.headerText}>
            <Text variant="heading">{name}</Text>
            <Text variant="small" color={colors.textMuted}>
              @{member.korisnik}
            </Text>
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text variant="label">Zaduženje</Text>
          {smestajRows.map((s) => (
            <Row key={s!.id} label={s!.naziv} value={fmt(s!.cenaPoOsobiUkupno)} />
          ))}
          {prevozRows.map((p) => (
            <Row key={p!.id} label={p!.nazivGrupe} value={fmt(p!.cenaPoOsobi)} />
          ))}
          {rentRows.map((r) => (
            <Row key={r.nazivOpreme} label={`${r.nazivOpreme} × ${r.qty}`} value={fmt(r.cenaPoSetu * r.qty)} />
          ))}
          <View style={styles.total}>
            <Text variant="label">Ukupno</Text>
            <Text variant="label" color={colors.brand}>
              {fmt(saldo)}
            </Text>
          </View>

          {showPaymentControls && canManageHost ? (
            <View style={styles.actions}>
              <Button
                title={member.platio ? 'Označi neplaćeno' : 'Označi plaćeno'}
                variant={member.platio ? 'secondary' : 'primary'}
                loading={loading}
                onPress={() => onTogglePayment(!member.platio)}
                fullWidth
              />
            </View>
          ) : null}

          {canManageHost && !akcija.isCompleted && member.status === 'prijavljen' ? (
            <View style={styles.statusRow}>
              <Button title="Popeo se" loading={loading} onPress={() => onStatusChange('popeo se')} />
              <Button title="Nije uspeo" variant="secondary" loading={loading} onPress={() => onStatusChange('nije uspeo')} />
            </View>
          ) : null}

          {canManageHost && !akcija.isCompleted && (member.status === 'popeo se' || member.status === 'nije uspeo') ? (
            <Button title="Vrati na prijavljen" variant="ghost" loading={loading} onPress={() => onStatusChange('prijavljen')} fullWidth />
          ) : null}

          {canManageHost && !akcija.isCompleted ? (
            <Button title="Ukloni člana" variant="secondary" loading={loading} onPress={onRemove} fullWidth />
          ) : null}
        </ScrollView>

        <Button title="Zatvori" variant="ghost" onPress={onClose} fullWidth />
      </View>
    </Modal>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="small" color={colors.textMuted}>
        {label}
      </Text>
      <Text variant="body">{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  header: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', marginBottom: spacing.md },
  headerText: { flex: 1 },
  scroll: { maxHeight: 360 },
  scrollContent: { gap: spacing.sm, paddingBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  total: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
  actions: { marginTop: spacing.sm },
  statusRow: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
})
