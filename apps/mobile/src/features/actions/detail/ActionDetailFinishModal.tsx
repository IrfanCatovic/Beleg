import { useEffect, useMemo, useState } from 'react'
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'

function parseAmount(raw: string): number {
  const s = raw.trim().replace(',', '.')
  if (s === '') return 0
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

interface ActionDetailFinishModalProps {
  visible: boolean
  currency: string
  prihodUkupan: number
  skipClubFinances?: boolean
  loading?: boolean
  error?: string
  onClose: () => void
  onConfirm: (rashodNaAkciji: number) => void
}

export function ActionDetailFinishModal({
  visible,
  currency,
  prihodUkupan,
  skipClubFinances = false,
  loading,
  error,
  onClose,
  onConfirm,
}: ActionDetailFinishModalProps) {
  const insets = useSafeAreaInsets()
  const [rashodStr, setRashodStr] = useState('0')

  useEffect(() => {
    if (visible) setRashodStr('0')
  }, [visible])

  const rashod = useMemo(() => parseAmount(rashodStr), [rashodStr])
  const netPreview = Number.isFinite(rashod) ? prihodUkupan - rashod : null
  const fmt = (n: number) => `${n.toLocaleString('sr-RS')} ${currency}`

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.box, { marginBottom: insets.bottom }]}>
          <Text variant="heading">Završi akciju</Text>
          <Text variant="small" color={colors.textMuted} style={styles.hint}>
            {skipClubFinances
              ? 'Privatna tura vodiča — bez upisa u finansije kluba.'
              : 'Unesite rashod na akciji. Neto ide u finansije kluba.'}
          </Text>

          <View style={styles.stat}>
            <Text variant="small" color={colors.textMuted}>
              Prihod (plaćeni članovi)
            </Text>
            <Text variant="label">{fmt(prihodUkupan)}</Text>
          </View>

          <Text variant="label">Rashod na akciji</Text>
          <TextInput
            style={styles.input}
            value={rashodStr}
            onChangeText={setRashodStr}
            keyboardType="decimal-pad"
            placeholder="0"
          />

          {netPreview != null ? (
            <Text variant="body" style={styles.net}>
              Neto: {fmt(netPreview)}
            </Text>
          ) : null}

          {error ? (
            <Text variant="small" color="#dc2626">
              {error}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Button title="Otkaži" variant="ghost" onPress={onClose} disabled={loading} />
            <Button
              title="Završi"
              loading={loading}
              onPress={() => {
                if (!Number.isFinite(rashod) || rashod < 0) return
                onConfirm(rashod)
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  box: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  hint: { marginBottom: spacing.sm },
  stat: { gap: 4, marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
  },
  net: { fontWeight: '700', color: colors.brand },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md },
})
