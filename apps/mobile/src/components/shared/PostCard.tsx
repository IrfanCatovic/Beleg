import { Pressable, StyleSheet, View } from 'react-native'
import type { Post } from '@beleg/shared'
import { Avatar, Card, Text } from '../ui'
import { FeedAspectImage } from './FeedAspectImage'
import { PostLikeBar } from './PostLikeBar'
import { feedBlockStyle, feedContentPadding } from './feedStyles'
import { colors, spacing } from '../../theme'

interface PostCardProps {
  post: Post
  variant?: 'card' | 'feed'
  onPress?: () => void
  onPressAuthor?: () => void
  onLike?: () => void
  onPressLikeCount?: () => void
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
  onPressLikeCount,
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
        <FeedAspectImage
          uri={imageUrl}
          borderRadius={isFeed ? 0 : 8}
          style={styles.image}
        />
      ) : null}

      <PostLikeBar
        likedByMe={post.likedByMe}
        likeCount={post.likeCount}
        commentCount={post.commentCount}
        onLike={onLike}
        onPressLikeCount={onPressLikeCount}
        onComment={onComment}
        padded={isFeed}
      />
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
    ...feedBlockStyle,
    paddingBottom: spacing.md,
  },
  feedPadded: { paddingHorizontal: feedContentPadding },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  headerText: { flex: 1 },
  content: { marginBottom: spacing.sm },
  image: { marginBottom: 0 },
})
