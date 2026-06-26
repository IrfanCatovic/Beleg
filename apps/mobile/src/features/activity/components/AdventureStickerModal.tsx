import { useCallback, useRef, useState } from 'react'
import { Modal, Pressable, StyleSheet, View } from 'react-native'
import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import * as MediaLibrary from 'expo-media-library'
import { useTranslation } from 'react-i18next'
import { Button, Text } from '../../../components/ui'
import { colors, radius, spacing } from '../../../theme'
import type { LatLngAlt } from '../services/activityMetrics'
import { AdventureSticker } from './AdventureSticker'

interface Props {
  visible: boolean
  durationSec: number
  distanceM: number
  elevationGainM: number
  steps: number
  dateLabel: string
  routePoints?: LatLngAlt[]
  onClose: () => void
}

export function AdventureStickerModal({
  visible,
  durationSec,
  distanceM,
  elevationGainM,
  steps,
  dateLabel,
  routePoints,
  onClose,
}: Props) {
  const { t } = useTranslation('explore')
  const stickerRef = useRef<View>(null)
  const [busy, setBusy] = useState(false)

  const captureSticker = useCallback(async () => {
    if (!stickerRef.current) return null
    return captureRef(stickerRef, { format: 'png', quality: 1, result: 'tmpfile' })
  }, [])

  const handleShare = useCallback(async () => {
    setBusy(true)
    try {
      const uri = await captureSticker()
      if (!uri) return
      const canShare = await Sharing.isAvailableAsync()
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('stickerShare') })
      }
    } catch {
      // ignore
    } finally {
      setBusy(false)
    }
  }, [captureSticker, t])

  const handleSave = useCallback(async () => {
    setBusy(true)
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync()
      if (status !== 'granted') return
      const uri = await captureSticker()
      if (!uri) return
      await MediaLibrary.saveToLibraryAsync(uri)
    } catch {
      // ignore
    } finally {
      setBusy(false)
    }
  }, [captureSticker])

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

          <View ref={stickerRef} collapsable={false} style={styles.stickerWrap}>
            <AdventureSticker
              durationSec={durationSec}
              distanceM={distanceM}
              elevationGainM={elevationGainM}
              steps={steps}
              dateLabel={dateLabel}
              routePoints={routePoints}
            />
          </View>

          <View style={styles.actions}>
            <Button title={t('stickerShare')} onPress={() => void handleShare()} loading={busy} fullWidth />
            <Button
              title={t('stickerSave')}
              variant="secondary"
              onPress={() => void handleSave()}
              loading={busy}
              fullWidth
            />
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
  actions: { gap: spacing.sm, marginTop: spacing.sm },
})
