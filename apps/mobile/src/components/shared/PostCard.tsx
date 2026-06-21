import { Image, Pressable, StyleSheet, View } from 'react-native'
import type { Post } from '@beleg/shared'
import { Avatar, Card, Text } from '../ui'
import { colors, spacing } from '../../theme'

interface PostCardProps {
  post: Post
  variant?: 'card' | 'feed'
  onPress?: () => void
  onPressAuthor?: () => void
  onLike?: () => void
  onComment?: () => void
}

function formatDate(iso?: string) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('sr-RS', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function PostCard({
  post,
  variant = 'card',
  onPress,
  onPressAuthor,
  onLike,
  onComment,
}: PostCardProps) {
  const author = post.author
  const imageUrl = post.imageUrl
  const isFeed = variant === 'feed'

  const content = (
    <>
      <Pressable style={[styles.header, isFeed && styles.feedPadded]} onPress={onPressAuthor}>
        <Avatar uri={author?.avatarUrl} name={author?.fullName || author?.username} />
        <View style={styles.headerText}>
          <Text variant="label">{author?.fullName || author?.username || 'Korisnik'}</Text>
          <Text variant="small" color={colors.textMuted}>
            {formatDate(post.createdAt)}
          </Text>
        </View>
      </Pressable>

      {post.content ? (
        <Text style={[styles.content, isFeed && styles.feedPadded]}>{post.content}</Text>
      ) : null}

      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={[styles.image, isFeed && styles.feedImage]}
          resizeMode="cover"
        />
      ) : null}

      <View style={[styles.actions, isFeed && styles.feedPadded]}>
        <Pressable onPress={onLike} style={styles.actionBtn}>
          <Text variant="small" color={post.likedByMe ? colors.brand : colors.textMuted}>
            ♥ {post.likeCount ?? 0}
          </Text>
        </Pressable>
        <Pressable onPress={onComment} style={styles.actionBtn}>
          <Text variant="small" color={colors.textMuted}>
            💬 {post.commentCount ?? 0}
          </Text>
        </Pressable>
      </View>
    </>
  )

  if (isFeed) {
    return (
      <Pressable onPress={onPress} style={styles.feedWrap}>
        {content}
      </Pressable>
    )
  }

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>{content}</Card>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  feedWrap: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
  },
  feedPadded: { paddingHorizontal: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  headerText: { flex: 1 },
  content: { marginBottom: spacing.sm },
  image: { width: '100%', height: 200, borderRadius: 8, marginBottom: spacing.sm },
  feedImage: { borderRadius: 0, marginBottom: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.lg },
  actionBtn: { paddingVertical: spacing.xs },
})
