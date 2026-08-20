import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { FollowStatusResponse } from '@beleg/shared/services'
import { Text } from '../../components/ui'
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme'

type FollowAction = 'follow' | 'unfollow' | 'cancel' | 'accept' | 'reject'

export function ProfileFollowActions({
  status,
  loading,
  onAction,
}: {
  status: FollowStatusResponse | undefined
  loading: boolean
  onAction: (action: FollowAction) => void
}) {
  const outgoing = status?.outgoing ?? 'none'
  const incoming = status?.incoming ?? 'none'

  if (incoming === 'pending') {
    return (
      <View style={styles.row} accessibilityRole="summary">
        <Pressable
          style={({ pressed }) => [styles.btn, styles.acceptBtn, pressed && styles.pressed, loading && styles.dimmed]}
          onPress={() => onAction('accept')}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Prihvati zahtev za praćenje"
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark" size={18} color={colors.white} />
              <Text style={styles.acceptText} numberOfLines={1}>
                Prihvati zahtev
              </Text>
            </>
          )}
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.btn, styles.rejectBtn, pressed && styles.pressed, loading && styles.dimmed]}
          onPress={() => onAction('reject')}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Odbij zahtev za praćenje"
        >
          {loading ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <>
              <Ionicons name="close" size={18} color={colors.danger} />
              <Text style={styles.rejectText} numberOfLines={1}>
                Odbij zahtev
              </Text>
            </>
          )}
        </Pressable>
      </View>
    )
  }

  if (outgoing === 'pending') {
    return (
      <Pressable
        style={({ pressed }) => [styles.btn, styles.full, styles.cancelBtn, pressed && styles.pressed, loading && styles.dimmed]}
        onPress={() => onAction('cancel')}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Otkaži zahtev za praćenje"
      >
        {loading ? (
          <ActivityIndicator color={colors.danger} />
        ) : (
          <>
            <Ionicons name="close-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.cancelText}>Otkaži zahtev</Text>
          </>
        )}
      </Pressable>
    )
  }

  if (outgoing === 'accepted') {
    return (
      <Pressable
        style={({ pressed }) => [styles.btn, styles.full, styles.unfollowBtn, pressed && styles.pressed, loading && styles.dimmed]}
        onPress={() => onAction('unfollow')}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Otprati korisnika"
      >
        {loading ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <>
            <Ionicons name="person-remove-outline" size={18} color={colors.text} />
            <Text style={styles.unfollowText}>Otprati</Text>
          </>
        )}
      </Pressable>
    )
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.btn, styles.full, styles.followBtn, pressed && styles.pressed, loading && styles.dimmed]}
      onPress={() => onAction('follow')}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel="Zaprati korisnika"
    >
      {loading ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <>
          <Ionicons name="person-add-outline" size={18} color={colors.white} />
          <Text style={styles.followText}>Zaprati</Text>
        </>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 48,
  },
  btn: {
    minHeight: 48,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  full: { alignSelf: 'stretch' },
  acceptBtn: {
    flex: 1,
    backgroundColor: colors.brand,
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: colors.dangerBg,
    borderWidth: 1.5,
    borderColor: '#fecaca',
  },
  cancelBtn: {
    backgroundColor: colors.dangerBg,
    borderWidth: 1.5,
    borderColor: '#fecaca',
  },
  followBtn: {
    backgroundColor: colors.brand,
  },
  unfollowBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  acceptText: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  rejectText: {
    color: colors.danger,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  cancelText: {
    color: colors.danger,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  followText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  unfollowText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  pressed: { opacity: 0.85 },
  dimmed: { opacity: 0.55 },
})
