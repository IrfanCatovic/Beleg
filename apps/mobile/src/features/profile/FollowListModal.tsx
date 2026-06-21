import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import type { FollowingUserRef } from '@beleg/shared/services'
import { Avatar, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'

interface FollowListModalProps {
  visible: boolean
  title: string
  users: FollowingUserRef[]
  loading?: boolean
  onClose: () => void
  onSelectUser: (username: string) => void
}

export function FollowListModal({
  visible,
  title,
  users,
  loading,
  onClose,
  onSelectUser,
}: FollowListModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text variant="heading">{title}</Text>
            <Pressable onPress={onClose}>
              <Text color={colors.brand}>Zatvori</Text>
            </Pressable>
          </View>
          {loading ? (
            <ActivityIndicator color={colors.brand} style={styles.loader} />
          ) : users.length === 0 ? (
            <Text color={colors.textMuted} style={styles.empty}>
              Nema korisnika.
            </Text>
          ) : (
            <ScrollView style={styles.list}>
              {users.map((u) => {
                const name = u.fullName || u.username || 'Korisnik'
                const username = u.username || String(u.id)
                return (
                  <Pressable key={u.id} style={styles.userRow} onPress={() => onSelectUser(username)}>
                    <Avatar uri={u.avatar_url} name={name} size={40} />
                    <View style={styles.userText}>
                      <Text variant="label">{name}</Text>
                      {u.username ? (
                        <Text variant="small" color={colors.textMuted}>
                          @{u.username}
                        </Text>
                      ) : null}
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
