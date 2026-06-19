import { Modal, Pressable, StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Button, Text } from '../ui'
import { colors, radius, spacing } from '../../theme'

interface GuideRequiredModalProps {
  visible: boolean
  onClose: () => void
  onBecomeGuide: () => void
}

export function GuideRequiredModal({ visible, onClose, onBecomeGuide }: GuideRequiredModalProps) {
  const { t } = useTranslation('actions')

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text variant="heading" style={styles.title}>
            {t('guideRequiredTitle')}
          </Text>
          <Text variant="body" color={colors.textMuted} style={styles.message}>
            {t('guideRequiredMessage')}
          </Text>
          <View style={styles.actions}>
            <Button title={t('becomeGuide')} onPress={onBecomeGuide} fullWidth />
            <Button title={t('guideRequiredClose')} variant="ghost" onPress={onClose} fullWidth />
          </View>
        </Pressable>
      </Pressable>
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
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  title: { marginBottom: spacing.xs },
  message: { marginBottom: spacing.md },
  actions: { gap: spacing.sm },
})
