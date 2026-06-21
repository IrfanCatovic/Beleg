import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import type { PostLikeUser } from '@beleg/shared'
import { Avatar, Text } from '../ui'
import { colors, spacing } from '../../theme'

interface PostLikesModalProps {
  visible: boolean
  title: string
  likes: PostLikeUser[]
  loading?: boolean
  onClose: () => void
  onSelectUser: (username: string) => void
}

export function PostLikesModal({
  visible,
  title,
  likes,
  loading,
  onClose,
  onSelectUser,
}: PostLikesModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text variant="heading">{title}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text color={colors.brand}>Zatvori</Text>
            </Pressable>
          </View>
          {loading ? (
            <ActivityIndicator color={colors.brand} style={styles.loader} />
          ) : likes.length === 0 ? (
            <Text color={colors.textMuted} style={styles.empty}>
              Nema lajkova.
            </Text>
          ) : (
            <ScrollView style={styles.list}>
              {likes.map((u) => {
                const name = u.fullName || u.username || 'Korisnik'
                return (
                  <Pressable key={u.id} style={styles.userRow} onPress={() => onSelectUser(u.username)}>
                    <Avatar uri={u.avatarUrl} name={name} size={40} />
                    <View style={styles.userText}>
                      <Text variant="label">{name}</Text>
                      <Text variant="small" color={colors.textMuted}>
                        @{u.username}
                      </Text>
                    </View>
                  </Pressable>
                )
              })}
            </ScrollView>
          )}
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
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  loader: { paddingVertical: spacing.xl },
  empty: { paddingVertical: spacing.lg, textAlign: 'center' },
  list: { maxHeight: 400 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  userText: { flex: 1 },
})
