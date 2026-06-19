import { forwardRef, useImperativeHandle, useRef } from 'react'
import { Image, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Avatar, Button, Text } from '../../components/ui'
import { colors, fontSize, radius, spacing } from '../../theme'

export interface HomeComposerHandle {
  focus: () => void
}

interface HomeComposerProps {
  avatarUri?: string | null
  avatarName?: string
  composer: string
  imageUri: string | null
  publishing?: boolean
  onChangeText: (text: string) => void
  onPickImage: () => void
  onRemoveImage: () => void
  onPublish: () => void
}

export const HomeComposer = forwardRef<HomeComposerHandle, HomeComposerProps>(function HomeComposer(
  {
    avatarUri,
    avatarName,
    composer,
    imageUri,
    publishing,
    onChangeText,
    onPickImage,
    onRemoveImage,
    onPublish,
  },
  ref,
) {
  const { t } = useTranslation('home')
  const inputRef = useRef<TextInput>(null)

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }))

  const canPost = composer.trim().length > 0 || !!imageUri

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Avatar uri={avatarUri} name={avatarName} size={40} />
        <TextInput
          ref={inputRef}
          placeholder={t('composerPlaceholder')}
          placeholderTextColor={colors.textSubtle}
          value={composer}
          onChangeText={onChangeText}
          multiline
          style={styles.input}
        />
      </View>

      {imageUri ? (
        <View style={styles.previewRow}>
          <Image source={{ uri: imageUri }} style={styles.preview} />
          <Pressable onPress={onRemoveImage}>
            <Text variant="small" color={colors.danger}>
              {t('removeImage')}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button title={t('addImage')} variant="secondary" onPress={onPickImage} />
        <Button
          title={t('publish')}
          onPress={onPublish}
          loading={publishing}
          disabled={!canPost}
        />
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  wrap: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    fontSize: fontSize.md,
    color: colors.text,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  preview: { width: 72, height: 72, borderRadius: 8 },
  actions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end', flexWrap: 'wrap' },
})
