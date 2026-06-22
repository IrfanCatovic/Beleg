import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getApiErrorMessage } from '@beleg/shared'
import {
  createPostComment,
  deletePost,
  deletePostComment,
  fetchPostById,
  fetchPostComments,
  fetchPostLikes,
  togglePostLike,
  updatePostContent,
} from '@beleg/shared/services'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import { PostLikeBar } from '../../components/shared/PostLikeBar'
import { PostLikesModal } from '../../components/shared/PostLikesModal'
import { FeedAspectImage } from '../../components/shared/FeedAspectImage'
import { Avatar, Button, ErrorView, Input, Loader, Screen, Text } from '../../components/ui'
import { colors, fontSize, spacing } from '../../theme'
import type { HomeStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<HomeStackParamList, 'PostDetail'>

export default function PostDetailScreen({ route, navigation }: Props) {
  const { id, focusComment } = route.params
  const { user } = useAuth()
  const { showConfirm, showAlert } = useModal()
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()
  const commentInputRef = useRef<TextInput>(null)
  const [comment, setComment] = useState('')
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [likesOpen, setLikesOpen] = useState(false)
  const [likesLoading, setLikesLoading] = useState(false)
  const [likes, setLikes] = useState<Awaited<ReturnType<typeof fetchPostLikes>>['likes']>([])

  const postQuery = useQuery({
    queryKey: ['post', id],
    queryFn: () => fetchPostById(client, id),
  })

  const commentsQuery = useQuery({
    queryKey: ['post', id, 'comments'],
    queryFn: () => fetchPostComments(client, id, 50, 0),
  })

  useEffect(() => {
    if (!focusComment) return
    const t = setTimeout(() => commentInputRef.current?.focus(), 350)
    return () => clearTimeout(t)
  }, [focusComment])

  const likeMutation = useMutation({
    mutationFn: () => togglePostLike(client, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['post', id] })
      void queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
  })

  const commentMutation = useMutation({
    mutationFn: (content: string) => createPostComment(client, id, content),
    onSuccess: () => {
      setComment('')
      void queryClient.invalidateQueries({ queryKey: ['post', id, 'comments'] })
      void queryClient.invalidateQueries({ queryKey: ['post', id] })
      void queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Komentar nije sačuvan.')),
  })

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: number) => deletePostComment(client, id, commentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['post', id, 'comments'] })
      void queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (content: string) => updatePostContent(client, id, content),
    onSuccess: () => {
      setEditing(false)
      void queryClient.invalidateQueries({ queryKey: ['post', id] })
      void queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Izmena nije uspela.')),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deletePost(client, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['posts'] })
      navigation.goBack()
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Brisanje nije uspelo.')),
  })

  const openLikes = async () => {
    const count = postQuery.data?.likeCount ?? 0
    if (count <= 0) return
    setLikesOpen(true)
    setLikesLoading(true)
    setLikes([])
    try {
      const data = await fetchPostLikes(client, id)
      setLikes(data.likes)
    } catch (err) {
      setLikesOpen(false)
      await showAlert('Greška', getApiErrorMessage(err, 'Lajkovi nisu učitani.'))
    } finally {
      setLikesLoading(false)
    }
  }

  const submitComment = () => {
    const trimmed = comment.trim()
    if (trimmed) commentMutation.mutate(trimmed)
  }

  if (postQuery.isLoading) {
    return (
      <Screen edges={['left', 'right']}>
        <Loader />
      </Screen>
    )
  }

  if (postQuery.isError || !postQuery.data) {
    return (
      <Screen edges={['left', 'right']}>
        <ErrorView message="Objava nije učitana." onRetry={() => postQuery.refetch()} />
      </Screen>
    )
  }

  const post = postQuery.data
  const author = post.author
  const authorName = author?.fullName || author?.username || 'Korisnik'
  const isOwner = !!author?.username && user?.username === author.username
  const comments = commentsQuery.data?.comments ?? []
  const canSend = comment.trim().length > 0 && !commentMutation.isPending

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 44 : 0}
      >
        <FlatList
          data={comments}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          ListHeaderComponent={
            <View style={styles.postBlock}>
              <Pressable
                style={styles.authorRow}
                onPress={() => {
                  if (!author?.username) return
                  navigation.navigate('UserProfile', {
                    id: author.id,
                    username: author.username,
                  })
                }}
              >
                <Avatar uri={author?.avatarUrl} name={authorName} />
                <View style={styles.authorText}>
                  <Text variant="label">{authorName}</Text>
                  <Text variant="small" color={colors.textMuted}>
                    {new Date(post.createdAt).toLocaleString('sr-RS')}
                  </Text>
                </View>
              </Pressable>

              {editing ? (
                <View style={styles.editBlock}>
                  <Input value={editContent} onChangeText={setEditContent} multiline />
                  <View style={styles.row}>
                    <Button title="Sačuvaj" onPress={() => updateMutation.mutate(editContent)} loading={updateMutation.isPending} />
                    <Button title="Otkaži" variant="secondary" onPress={() => setEditing(false)} />
                  </View>
                </View>
              ) : (
                <Text style={styles.content}>{post.content}</Text>
              )}

              {post.imageUrl ? (
                <FeedAspectImage uri={post.imageUrl} maxHeight={560} borderRadius={12} style={styles.image} />
              ) : null}

              <PostLikeBar
                likedByMe={post.likedByMe}
                likeCount={post.likeCount}
                commentCount={post.commentCount ?? comments.length}
                onLike={() => likeMutation.mutate()}
                onPressLikeCount={() => void openLikes()}
                onComment={() => commentInputRef.current?.focus()}
              />

              {isOwner ? (
                <View style={styles.ownerActions}>
                  <Button
                    title="Izmeni"
                    variant="secondary"
                    onPress={() => {
                      setEditContent(post.content)
                      setEditing(true)
                    }}
                  />
                  <Button
                    title="Obriši"
                    variant="danger"
                    onPress={async () => {
                      const ok = await showConfirm('Obriši objavu', 'Da li ste sigurni?')
                      if (ok) deleteMutation.mutate()
                    }}
                    loading={deleteMutation.isPending}
                  />
                </View>
              ) : null}

              <Text variant="heading" style={styles.commentsTitle}>
                Komentari
              </Text>
            </View>
          }
          ListEmptyComponent={
            commentsQuery.isLoading ? (
              <Loader />
            ) : (
              <Text variant="muted" style={styles.emptyComments}>
                Nema komentara. Budite prvi.
              </Text>
            )
          }
          renderItem={({ item }) => {
            const canDelete = user?.username === item.user.username
            return (
              <View style={styles.comment}>
                <Avatar uri={item.user.avatarUrl} name={item.user.fullName || item.user.username} size={36} />
                <View style={styles.commentBody}>
                  <Text variant="label">{item.user.fullName || item.user.username}</Text>
                  <Text>{item.content}</Text>
                  {canDelete ? (
                    <Pressable onPress={() => deleteCommentMutation.mutate(item.id)}>
                      <Text variant="small" color={colors.danger}>
                        Obriši
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            )
          }}
        />

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          <TextInput
            ref={commentInputRef}
            placeholder="Napiši komentar..."
            placeholderTextColor={colors.textSubtle}
            value={comment}
            onChangeText={setComment}
            multiline
            style={styles.commentInput}
            textAlignVertical="top"
          />
          <Pressable
            onPress={submitComment}
            disabled={!canSend}
            style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Pošalji komentar"
          >
            {commentMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons name="chatbubble" size={22} color={colors.white} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <PostLikesModal
        visible={likesOpen}
        title="Lajkovi"
        likes={likes}
        loading={likesLoading}
        onClose={() => setLikesOpen(false)}
        onSelectUser={(username) => {
          setLikesOpen(false)
          navigation.navigate('UserProfile', { username })
        }}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: spacing.lg, paddingBottom: spacing.md },
  postBlock: { marginBottom: spacing.lg, gap: spacing.sm },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  authorText: { flex: 1 },
  content: { marginTop: spacing.xs },
  image: { marginTop: spacing.sm },
  ownerActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  editBlock: { gap: spacing.sm },
  commentsTitle: { marginTop: spacing.lg },
  emptyComments: { textAlign: 'center', paddingVertical: spacing.lg },
  comment: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  commentBody: { flex: 1, gap: 2 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  commentInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
})
