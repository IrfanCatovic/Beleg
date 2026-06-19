import { useCallback, useRef, useState } from 'react'
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, View } from 'react-native'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import * as ImagePicker from 'expo-image-picker'
import { getApiErrorMessage } from '@beleg/shared'
import { createPost, fetchPosts, fetchUnreadCount, togglePostLike } from '@beleg/shared/services'
import { client } from '../../api/client'
import { useModal } from '../../context/ModalContext'
import { PostCard } from '../../components/shared/PostCard'
import { AppTopBar } from '../../components/ui/AppTopBar'
import { Button, EmptyState, ErrorView, Input, Loader, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { HomeStackParamList } from '../../navigation/types'

const PAGE = 15

type Props = NativeStackScreenProps<HomeStackParamList, 'Feed'>

export default function HomeScreen({ navigation }: Props) {
  const queryClient = useQueryClient()
  const { showAlert } = useModal()
  const [composer, setComposer] = useState('')
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [showComposer, setShowComposer] = useState(false)
  const listRef = useRef<FlatList>(null)

  const { data: unread = 0 } = useQuery({
    queryKey: ['obavestenja', 'unread'],
    queryFn: () => fetchUnreadCount(client),
    refetchInterval: 60_000,
  })

  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['posts', 'feed'],
    queryFn: ({ pageParam = 0 }) => fetchPosts(client, PAGE, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.posts.length, 0)
      return loaded < last.total ? loaded : undefined
    },
  })

  const likeMutation = useMutation({
    mutationFn: (postId: number) => togglePostLike(client, postId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts'] }),
  })

  const publishMutation = useMutation({
    mutationFn: async () => {
      const content = composer.trim()
      if (!content && !imageUri) throw new Error('Unesite tekst ili dodajte sliku.')
      if (imageUri) {
        const fd = new FormData()
        fd.append('content', content)
        const filename = imageUri.split('/').pop() || 'photo.jpg'
        const match = /\.(\w+)$/.exec(filename)
        const type = match ? `image/${match[1]}` : 'image/jpeg'
        fd.append('image', { uri: imageUri, name: filename, type } as unknown as Blob)
        return createPost(client, fd)
      }
      return createPost(client, { content })
    },
    onSuccess: () => {
      setComposer('')
      setImageUri(null)
      setShowComposer(false)
      void queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Objava nije uspela.')),
  })

  const posts = data?.pages.flatMap((p) => p.posts) ?? []

  const pickImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      await showAlert('Dozvola', 'Potrebna je dozvola za galeriju.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    })
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri)
      setShowComposer(true)
    }
  }, [showAlert])

  const openComposer = useCallback(() => {
    setShowComposer(true)
    listRef.current?.scrollToOffset({ offset: 0, animated: true })
  }, [])

  if (isLoading) {
    return (
      <View style={styles.root}>
        <AppTopBar
          leftIcon="add"
          onLeftPress={openComposer}
          rightIcon="notifications-outline"
          onRightPress={() => navigation.navigate('NotificationsList')}
          rightBadge={unread}
        />
        <Loader />
      </View>
    )
  }

  if (isError) {
    return (
      <View style={styles.root}>
        <AppTopBar
          leftIcon="add"
          onLeftPress={openComposer}
          rightIcon="notifications-outline"
          onRightPress={() => navigation.navigate('NotificationsList')}
          rightBadge={unread}
        />
        <ErrorView message="Feed nije učitan." onRetry={() => refetch()} />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <AppTopBar
        leftIcon="add"
        onLeftPress={openComposer}
        rightIcon="notifications-outline"
        onRightPress={() => navigation.navigate('NotificationsList')}
        rightBadge={unread}
      />

      {showComposer ? (
        <View style={styles.composer}>
          <Input
            placeholder="Šta ima novo?"
            value={composer}
            onChangeText={setComposer}
            multiline
            autoFocus
          />
          {imageUri ? (
            <View style={styles.previewRow}>
              <Image source={{ uri: imageUri }} style={styles.preview} />
              <Pressable onPress={() => setImageUri(null)}>
                <Text variant="small" color={colors.danger}>
                  Ukloni sliku
                </Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.composerActions}>
            <Button title="Slika" variant="secondary" onPress={pickImage} />
            <Button title="Otkaži" variant="ghost" onPress={() => setShowComposer(false)} />
            <Button
              title="Objavi"
              onPress={() => publishMutation.mutate()}
              loading={publishMutation.isPending}
              disabled={!composer.trim() && !imageUri}
            />
          </View>
        </View>
      ) : null}

      <FlatList
        ref={listRef}
        data={posts}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
        }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={<EmptyState title="Nema objava" message="Budite prvi koji nešto objavi." />}
        ListFooterComponent={isFetchingNextPage ? <Loader /> : null}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onPress={() => navigation.navigate('PostDetail', { id: item.id })}
            onPressAuthor={() =>
              navigation.navigate('UserProfile', {
                id: item.author.id,
                username: item.author.username,
              })
            }
            onLike={() => likeMutation.mutate(item.id)}
            onComment={() => navigation.navigate('PostDetail', { id: item.id })}
          />
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  composer: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  composerActions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end', flexWrap: 'wrap' },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  preview: { width: 72, height: 72, borderRadius: 8 },
  list: { padding: spacing.lg, paddingBottom: spacing.xxl },
})
