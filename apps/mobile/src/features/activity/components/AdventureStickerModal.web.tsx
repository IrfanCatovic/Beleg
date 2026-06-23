import { useRef } from 'react'
import { Modal, Pressable, StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Button, Text } from '../../../components/ui'
import { colors, radius, spacing } from '../../../theme'
import { AdventureSticker } from './AdventureSticker'

interface Props {
  visible: boolean
  durationSec: number
  distanceM: number
  elevationGainM: number
  steps: number
  dateLabel: string
  onClose: () => void
}

export function AdventureStickerModal({
  visible,
  durationSec,
  distanceM,
  elevationGainM,
  steps,
  dateLabel,
  onClose,
}: Props) {
  const { t } = useTranslation('explore')
  const stickerRef = useRef<View>(null)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text variant="label" style={styles.title}>
            {t('stickerTitle')}
          </Text>
          <Text variant="small" color={colors.textMuted} style={styles.subtitle}>
            {t('stickerSubtitle')}
          </Text>

          <View ref={stickerRef} style={styles.stickerWrap}>
            <AdventureSticker
              durationSec={durationSec}
              distanceM={distanceM}
              elevationGainM={elevationGainM}
              steps={steps}
              dateLabel={dateLabel}
            />
          </View>

          <Text variant="small" color={colors.textSubtle} style={styles.hint}>
            Deljenje i čuvanje stikera nije dostupno u browseru.
          </Text>

          <View style={styles.actions}>
            <Button title={t('stickerClose')} variant="ghost" onPress={onClose} fullWidth />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    maxHeight: '92%',
  },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: spacing.sm },
  stickerWrap: { alignItems: 'center', marginVertical: spacing.sm },
  hint: { textAlign: 'center' },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
})
