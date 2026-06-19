import { Image, Pressable, StyleSheet, View } from 'react-native'
import type { Post } from '@beleg/shared'
import { Avatar, Card, Text } from '../ui'
import { colors, spacing } from '../../theme'

interface PostCardProps {
  post: Post
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

export function PostCard({ post, onPress, onPressAuthor, onLike, onComment }: PostCardProps) {
  const author = post.author
  const imageUrl = post.imageUrl

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>
        <Pressable style={styles.header} onPress={onPressAuthor}>
          <Avatar uri={author?.avatarUrl} name={author?.fullName || author?.username} />
          <View style={styles.headerText}>
            <Text variant="label">{author?.fullName || author?.username || 'Korisnik'}</Text>
            <Text variant="small" color={colors.textMuted}>
              {formatDate(post.createdAt)}
            </Text>
          </View>
        </Pressable>

        {post.content ? <Text style={styles.content}>{post.content}</Text> : null}

        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        ) : null}

        <View style={styles.actions}>
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
      </Card>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  headerText: { flex: 1 },
  content: { marginBottom: spacing.sm },
  image: { width: '100%', height: 200, borderRadius: 8, marginBottom: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.lg },
  actionBtn: { paddingVertical: spacing.xs },
})
