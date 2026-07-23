import { useEffect, useMemo, useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  canConfirmCancelAction,
  formatCancelModalCount,
  isCancelRefundAckRequired,
  normalizeCancelActionReason,
  type CancelModalCount,
} from '@beleg/shared'
import { Button, Text } from '../../../components/ui'
import { colors, radius, spacing } from '../../../theme'

export interface CancelActionModalProps {
  visible: boolean
  confirmedCount: CancelModalCount
  pendingCount: CancelModalCount
  paidCount: CancelModalCount
  isCompleted?: boolean
  isCancelled?: boolean
  loading?: boolean
  error?: string
  onClose: () => void
  onConfirm: (trimmedReason: string) => void
}

export function CancelActionModal({
  visible,
  confirmedCount,
  pendingCount,
  paidCount,
  isCompleted,
  isCancelled,
  loading = false,
  error = '',
  onClose,
  onConfirm,
}: CancelActionModalProps) {
  const insets = useSafeAreaInsets()
  const [reason, setReason] = useState('')
  const [refundAck, setRefundAck] = useState(false)
  const [localError, setLocalError] = useState('')
  const inFlightRef = useRef(false)

  useEffect(() => {
    if (!loading) inFlightRef.current = false
  }, [loading])

  const normalized = useMemo(() => normalizeCancelActionReason(reason), [reason])
  const refundRequired = isCancelRefundAckRequired(paidCount)
  const canConfirm = canConfirmCancelAction({
    submitting: loading,
    reason,
    refundAckChecked: refundAck,
    paidCount,
    isCompleted,
    isCancelled,
  })

  const reasonError =
    reason.trim().length > 0 && !normalized.isValid
      ? normalized.error
      : localError && !normalized.isValid
        ? localError
        : null
  const displayError = reasonError || error

  const handleRequestClose = () => {
    if (loading || inFlightRef.current) return
    onClose()
  }

  const handleConfirm = () => {
    if (inFlightRef.current || loading) return
    if (
      !canConfirmCancelAction({
        submitting: false,
        reason,
        refundAckChecked: refundAck,
        paidCount,
        isCompleted,
        isCancelled,
      })
    ) {
      if (!normalized.isValid) setLocalError(normalized.error || '')
      return
    }
    inFlightRef.current = true
    setLocalError('')
    onConfirm(normalized.value)
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleRequestClose}
      accessibilityViewIsModal
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.backdrop}>
          <View
            style={[styles.box, { marginBottom: Math.max(insets.bottom, spacing.md) }]}
            accessibilityRole="summary"
            accessibilityLabel="Otkaži akciju"
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text variant="heading" accessibilityRole="header">
                Otkaži akciju
              </Text>
              <Text variant="small" color={colors.textMuted} style={styles.hint}>
                Ova akcija će biti označena kao otkazana. Nove prijave, izmjene i završavanje akcije više neće biti
                dozvoljeni.
              </Text>

              <View style={styles.counts} accessibilityRole="summary">
                <CountRow label="Potvrđeni učesnici" value={formatCancelModalCount(confirmedCount)} />
                <CountRow label="Zahtjevi na čekanju" value={formatCancelModalCount(pendingCount)} />
                <CountRow label="Evidentirane uplate" value={formatCancelModalCount(paidCount)} />
              </View>

              <View style={styles.refundBox}>
                <Text variant="small" color={colors.text}>
                  Otkazivanje akcije ne vrši automatski refund i ne mijenja postojeću evidenciju uplata.
                </Text>
                {paidCount != null && paidCount > 0 ? (
                  <Text variant="small" color={colors.text} style={styles.refundStrong}>
                    Postoji {paidCount} evidentiranih uplata. Potrebno ih je ručno provjeriti i dogovoriti eventualni
                    povrat novca.
                  </Text>
                ) : null}
                {refundRequired ? (
                  <Pressable
                    style={styles.checkboxRow}
                    onPress={() => !loading && setRefundAck((v) => !v)}
                    disabled={loading}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: refundAck, disabled: loading }}
                    accessibilityLabel="Razumijem da refund neće biti izvršen automatski."
                  >
                    <View style={[styles.checkbox, refundAck && styles.checkboxChecked]}>
                      {refundAck ? <Text style={styles.checkmark}>✓</Text> : null}
                    </View>
                    <Text variant="small" color={colors.text} style={styles.checkboxLabel}>
                      Razumijem da refund neće biti izvršen automatski.
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              <Text variant="label">Razlog otkazivanja</Text>
              <TextInput
                style={[styles.input, reasonError ? styles.inputError : null]}
                value={reason}
                onChangeText={(text) => {
                  setReason(text)
                  if (localError) setLocalError('')
                }}
                editable={!loading}
                multiline
                textAlignVertical="top"
                placeholder="Npr. loši vremenski uslovi, bezbjednosni razlozi..."
                placeholderTextColor={colors.textMuted}
                accessibilityLabel="Razlog otkazivanja"
                accessibilityHint="Unesite razlog između 3 i 500 karaktera"
              />
              <View style={styles.reasonMeta}>
                <Text
                  variant="small"
                  color={displayError ? colors.danger : colors.textMuted}
                  style={styles.errorText}
                  accessibilityLiveRegion="polite"
                >
                  {displayError || ' '}
                </Text>
                <Text variant="small" color={colors.textMuted}>
                  {normalized.runeCount} / 500
                </Text>
              </View>

              {isCancelled ? (
                <Text variant="small" color={colors.danger}>
                  Akcija je već otkazana.
                </Text>
              ) : null}
              {isCompleted && !isCancelled ? (
                <Text variant="small" color={colors.danger}>
                  Završena akcija ne može biti otkazana.
                </Text>
              ) : null}

              <View style={styles.actions}>
                <Button title="Odustani" variant="ghost" onPress={handleRequestClose} disabled={loading} />
                <Button
                  title={loading ? 'Otkazivanje...' : 'Potvrdi otkazivanje'}
                  variant="danger"
                  loading={loading}
                  disabled={!canConfirm}
                  onPress={handleConfirm}
                  accessibilityHint="Trajno otkazuje akciju. Refund se ne izvršava automatski."
                  accessibilityState={{ busy: loading, disabled: !canConfirm }}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function CountRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.countRow}>
      <Text variant="small" color={colors.textMuted}>
        {label}
      </Text>
      <Text variant="label">{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  box: {
    backgroundColor: colors.white,
    borderRadius: 16,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  hint: { marginBottom: spacing.xs },
  counts: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.surfaceAlt,
  },
  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  refundBox: {
    borderWidth: 1,
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  refundStrong: { fontWeight: '600' },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    backgroundColor: colors.white,
  },
  checkboxChecked: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  checkmark: { color: colors.white, fontSize: 14, fontWeight: '700' },
  checkboxLabel: { flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    minHeight: 96,
    color: colors.text,
  },
  inputError: { borderColor: colors.danger },
  reasonMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  errorText: { flex: 1 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
    flexWrap: 'wrap',
  },
})
