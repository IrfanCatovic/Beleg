import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { ActionSignupUiState } from '@beleg/shared'
import { Button, Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'

interface ActionDetailBottomBarProps {
  visible: boolean
  isPendingSignup: boolean
  isRegistered: boolean
  isCompleted: boolean
  isCancelled?: boolean
  signupUi: ActionSignupUiState
  canCancel: boolean
  saving: boolean
  onSave: () => void
  onCancelSignup: () => void
  onCancelPrijava: () => void
}

export function ActionDetailBottomBar({
  visible,
  isPendingSignup,
  isRegistered,
  isCompleted,
  isCancelled = false,
  signupUi,
  canCancel,
  saving,
  onSave,
  onCancelSignup,
  onCancelPrijava,
}: ActionDetailBottomBarProps) {
  const insets = useSafeAreaInsets()
  if (!visible || isCompleted || isCancelled) return null

  const showPrimary = !isRegistered && !isPendingSignup
  const showSave = isRegistered
  const showCancelSignup = isPendingSignup
  const showCancelPrijava = isRegistered && canCancel

  if (!showPrimary && !showSave && !showCancelSignup && !showCancelPrijava && !signupUi.showCancelledNotice) {
    return null
  }

  const primaryLabel = signupUi.showCancelledNotice
    ? 'Pošalji novi zahtev'
    : 'Pošalji zahtev za prijavu'

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.sm }]}>
      {signupUi.showCancelledNotice ? (
        <Text variant="small" color={colors.textMuted} style={styles.notice}>
          Prethodna prijava je otkazana. Možeš poslati novi zahtev dok su prijave otvorene.
        </Text>
      ) : null}
      {showPrimary ? (
        signupUi.showCapacityFullNotice ? (
          <Text variant="small" color={colors.textMuted} style={styles.notice}>
            Sva mesta su popunjena.
          </Text>
        ) : (
          <Button
            title={primaryLabel}
            loading={saving}
            disabled={signupUi.isSignupPrimaryDisabled || saving}
            onPress={onSave}
            fullWidth
          />
        )
      ) : null}
      {showSave ? (
        <Button title="Sačuvaj izbore" loading={saving} onPress={onSave} fullWidth />
      ) : null}
      {showCancelSignup ? (
        <>
          <Text variant="small" color={colors.textMuted} style={styles.notice}>
            Zahtev na čekanju odobrenja
          </Text>
          <Button title="Sačuvaj izmene" loading={saving} onPress={onSave} fullWidth />
          <Button title="Otkaži zahtev" variant="secondary" onPress={onCancelSignup} fullWidth />
        </>
      ) : null}
      {showCancelPrijava ? (
        <Button title="Otkaži prijavu" variant="secondary" onPress={onCancelPrijava} fullWidth />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  notice: { textAlign: 'center' },
})
