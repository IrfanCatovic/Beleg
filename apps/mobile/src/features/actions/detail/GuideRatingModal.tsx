import { useState } from 'react'
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { Button, Text } from '../../../components/ui'
import { colors, radius, spacing } from '../../../theme'

interface GuideRatingModalProps {
  visible: boolean
  guideName: string
  saving?: boolean
  onClose: () => void
  onSkip: () => void
  onSubmit: (payload: { ocena?: number; komentar?: string }) => void | Promise<void>
}

export function GuideRatingModal({
  visible,
  guideName,
  saving,
  onClose,
  onSkip,
  onSubmit,
}: GuideRatingModalProps) {
  const { t } = useTranslation('guideRating')
  const [stars, setStars] = useState<number | null>(null)
  const [komentar, setKomentar] = useState('')

  const canSubmit = stars != null

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text variant="heading">{t('title')}</Text>
          <Text color={colors.textMuted} style={styles.sub}>
            {t('subtitle', { name: guideName })}
          </Text>

          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setStars(n)} disabled={saving}>
                <Ionicons
                  name={stars != null && n <= stars ? 'star' : 'star-outline'}
                  size={36}
                  color="#f59e0b"
                />
              </Pressable>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder={t('commentPlaceholder')}
            placeholderTextColor={colors.textMuted}
            multiline
            value={komentar}
            onChangeText={setKomentar}
            editable={!saving}
          />

          <View style={styles.actions}>
            <Button title={t('skip')} variant="ghost" onPress={onSkip} disabled={saving} />
            <Button
              title={t('submit')}
              onPress={() => void onSubmit({ ocena: stars ?? undefined, komentar: komentar.trim() || undefined })}
              loading={saving}
              disabled={!canSubmit}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sub: { lineHeight: 20 },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 80,
    textAlignVertical: 'top',
    color: colors.text,
  },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
})
