import { Modal, Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Button, Text } from '../../components/ui'
import { colors, radius, spacing } from '../../theme'

interface ProfileImageActionModalProps {
  visible: boolean
  title: string
  subtitle?: string
  onClose: () => void
  onPickGallery: () => void
  onRemove: () => void
  canRemove?: boolean
}

export function ProfileImageActionModal({
  visible,
  title,
  subtitle,
  onClose,
  onPickGallery,
  onRemove,
  canRemove = true,
}: ProfileImageActionModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text variant="heading">{title}</Text>
          {subtitle ? (
            <Text variant="small" color={colors.textMuted}>
              {subtitle}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Pressable style={styles.actionRow} onPress={onPickGallery}>
              <Ionicons name="images-outline" size={20} color={colors.text} />
              <Text variant="label">Dodaj iz galerije</Text>
            </Pressable>
            {canRemove ? (
              <Pressable style={[styles.actionRow, styles.dangerRow]} onPress={onRemove}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
                <Text variant="label" color={colors.danger}>
                  Ukloni sliku
                </Text>
              </Pressable>
            ) : null}
          </View>
          <Button title="Otkaži" variant="ghost" onPress={onClose} fullWidth />
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  actions: { gap: spacing.sm },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dangerRow: {
    borderColor: '#fecaca',
    backgroundColor: colors.dangerBg,
  },
})
