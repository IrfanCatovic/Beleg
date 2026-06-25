import { Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Text } from '../ui'
import { feedContentPadding } from './feedStyles'
import { colors, spacing } from '../../theme'

interface PostLikeBarProps {
  likedByMe?: boolean
  likeCount?: number
  commentCount?: number
  onLike?: () => void
  onPressLikeCount?: () => void
  onComment?: () => void
  padded?: boolean
}

export function PostLikeBar({
  likedByMe,
  likeCount = 0,
  commentCount = 0,
  onLike,
  onPressLikeCount,
  onComment,
  padded,
}: PostLikeBarProps) {
  const canShowLikes = likeCount > 0

  return (
    <View style={[styles.row, padded && styles.padded]}>
      <Pressable
        onPress={onLike}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
        style={styles.likeBtn}
        accessibilityRole="button"
        accessibilityLabel="Lajkuj objavu"
      >
        <Ionicons
          name={likedByMe ? 'heart' : 'heart-outline'}
          size={28}
          color={likedByMe ? colors.brand : colors.textMuted}
        />
      </Pressable>

      <Pressable
        onPress={canShowLikes ? onPressLikeCount : undefined}
        disabled={!canShowLikes}
        hitSlop={{ top: 12, bottom: 12, left: 4, right: 12 }}
        style={styles.countBtn}
      >
        <Text variant="label" color={canShowLikes ? colors.text : colors.textMuted}>
          {likeCount}
        </Text>
      </Pressable>

      <Pressable
        onPress={onComment}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={styles.commentBtn}
        accessibilityRole="button"
        accessibilityLabel="Komentariši"
      >
        <Ionicons name="chatbubble-outline" size={24} color={colors.textMuted} />
        <Text variant="small" color={colors.textMuted}>
          {commentCount}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  padded: { paddingHorizontal: feedContentPadding },
  likeBtn: {
    padding: spacing.xs,
    backgroundColor: 'transparent',
  },
  countBtn: {
    minWidth: 28,
    paddingVertical: spacing.xs,
    marginRight: spacing.md,
  },
  commentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.xs,
    marginLeft: 'auto',
  },
})
