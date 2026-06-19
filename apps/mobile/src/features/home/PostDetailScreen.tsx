import { useState } from 'react'
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { getApiErrorMessage } from '@beleg/shared'
import {
  createPostComment,
  deletePost,
  deletePostComment,
  fetchPostById,
  fetchPostComments,
  togglePostLike,
  updatePostContent,
} from '@beleg/shared/services'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import { Avatar, Button, ErrorView, Input, Loader, Screen, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { HomeStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<HomeStackParamList, 'PostDetail'>

export default function PostDetailScreen({ route, navigation }: Props) {
  const { id } = route.params
  const { user } = useAuth()
  const { showConfirm, showAlert } = useModal()
  const queryClient = useQueryClient()
  const [comment, setComment] = useState('')
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')

  const postQuery = useQuery({
    queryKey: ['post', id],
    queryFn: () => fetchPostById(client, id),
  })

  const commentsQuery = useQuery({
    queryKey: ['post', id, 'comments'],
    queryFn: () => fetchPostComments(client, id, 50, 0),
  })

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

  if (postQuery.isLoading) {
    return (
      <Screen>
        <Loader />
      </Screen>
    )
  }

  if (postQuery.isError || !postQuery.data) {
    return (
      <Screen>
        <ErrorView message="Objava nije učitana." onRetry={() => postQuery.refetch()} />
      </Screen>
    )
  }

  const post = postQuery.data
  const isOwner = user?.username === post.author.username
  const comments = commentsQuery.data?.comments ?? []

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={88}
      >
        <FlatList
          data={comments}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.postBlock}>
              <Pressable
                style={styles.authorRow}
                onPress={() =>
                  navigation.navigate('UserProfile', {
                    id: post.author.id,
                    username: post.author.username,
                  })
                }
              >
                <Avatar uri={post.author.avatarUrl} name={post.author.fullName || post.author.username} />
                <View style={styles.authorText}>
                  <Text variant="label">{post.author.fullName || post.author.username}</Text>
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
                <Image source={{ uri: post.imageUrl }} style={styles.image} resizeMode="cover" />
              ) : null}

              <View style={styles.actions}>
                <Pressable onPress={() => likeMutation.mutate()}>
                  <Text variant="small" color={post.likedByMe ? colors.brand : colors.textMuted}>
                    ♥ {post.likeCount ?? 0}
                  </Text>
                </Pressable>
                <Text variant="small" color={colors.textMuted}>
                  💬 {post.commentCount ?? comments.length}
                </Text>
              </View>

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

        <View style={styles.composer}>
          <Input
            placeholder="Napiši komentar..."
            value={comment}
            onChangeText={setComment}
            style={styles.commentInput}
          />
          <Button
            title="Pošalji"
            onPress={() => {
              const trimmed = comment.trim()
              if (trimmed) commentMutation.mutate(trimmed)
            }}
            loading={commentMutation.isPending}
            disabled={!comment.trim()}
          />
        </View>
      </KeyboardAvoidingView>
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
  image: { width: '100%', height: 220, borderRadius: 12, marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm },
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
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  commentInput: { flex: 1 },
})
