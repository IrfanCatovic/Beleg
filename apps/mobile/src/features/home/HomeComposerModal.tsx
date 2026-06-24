import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import { HomeComposer } from './HomeComposer'

interface HomeComposerModalProps {
  visible: boolean
  avatarUri?: string | null
  avatarName?: string
  composer: string
  imageUri: string | null
  publishing?: boolean
  onChangeText: (text: string) => void
  onPickImage: () => void
  onRemoveImage: () => void
  onPublish: () => void
  onClose: () => void
}

export function HomeComposerModal({
  visible,
  avatarUri,
  avatarName,
  composer,
  imageUri,
  publishing,
  onChangeText,
  onPickImage,
  onRemoveImage,
  onPublish,
  onClose,
}: HomeComposerModalProps) {
  const { t } = useTranslation('home')

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <Text variant="heading">{t('composerModalTitle')}</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Text color={colors.brand}>{t('composerClose')}</Text>
              </Pressable>
            </View>
            <HomeComposer
              avatarUri={avatarUri}
              avatarName={avatarName}
              composer={composer}
              imageUri={imageUri}
              publishing={publishing}
              onChangeText={onChangeText}
              onPickImage={onPickImage}
              onRemoveImage={onRemoveImage}
              onPublish={onPublish}
              variant="modal"
            />
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
})
