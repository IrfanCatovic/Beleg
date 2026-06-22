import { useCallback, useMemo, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import * as ImagePicker from 'expo-image-picker'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@beleg/shared'
import {
  createPost,
  fetchAkcije,
  fetchKorisnici,
  fetchPostLikes,
  fetchPosts,
  fetchPublicFerratas,
  fetchUnreadCount,
  fetchUserFollowingList,
  togglePostLike,
} from '@beleg/shared/services'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import { PostCard } from '../../components/shared/PostCard'
import { PostLikesModal } from '../../components/shared/PostLikesModal'
import { AppTopBar } from '../../components/ui/AppTopBar'
import { EmptyState, ErrorView, Loader, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { HomeStackParamList } from '../../navigation/types'
import { FeedActionCard } from './FeedActionCard'
import { HomeComposerModal } from './HomeComposerModal'
import { HomeFeedFerrataCard } from './HomeFeedFerrataCard'
import { HomeSuggestedUsersRow } from './HomeSuggestedUsersRow'
import {
  buildHomeListItems,
  buildUsersById,
  korisniciToMentionUsers,
  mergeAkcijeById,
  pickRandomFerrata,
  pickSuggestedUsers,
  type HomeListItem,
  type MentionUser,
} from './homeFeedUtils'

const PAGE = 15

type Props = NativeStackScreenProps<HomeStackParamList, 'Feed'>

function homeListKey(item: HomeListItem, index: number): string {
  if (item.kind === 'post') return `post-${item.post.id}`
  if (item.kind === 'action') return `action-${item.action.id}`
  if (item.kind === 'suggested') return 'suggested-users'
  if (item.kind === 'ferrata') return `ferrata-${item.ferrata.id}-${index}`
  return `item-${index}`
}

export default function HomeScreen({ navigation }: Props) {
  const queryClient = useQueryClient()
  const { showAlert } = useModal()
  const { user } = useAuth()
  const { t } = useTranslation('home')
  const [composerOpen, setComposerOpen] = useState(false)
  const [composer, setComposer] = useState('')
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [likesPostId, setLikesPostId] = useState<number | null>(null)
  const [likesLoading, setLikesLoading] = useState(false)
  const [likes, setLikes] = useState<Awaited<ReturnType<typeof fetchPostLikes>>['likes']>([])

  const { data: unread = 0 } = useQuery({
    queryKey: ['obavestenja', 'unread'],
    queryFn: () => fetchUnreadCount(client),
    refetchInterval: 60_000,
  })

  const postsQuery = useInfiniteQuery({
    queryKey: ['posts', 'feed'],
    queryFn: ({ pageParam = 0 }) => fetchPosts(client, PAGE, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.posts.length, 0)
      return loaded < last.total ? loaded : undefined
    },
  })

  const akcijeQuery = useQuery({
    queryKey: ['akcije', 'feed'],
    queryFn: () => fetchAkcije(client),
  })

  const ferratasQuery = useQuery({
    queryKey: ['ferratas', 'home-spotlight'],
    queryFn: () => fetchPublicFerratas(client),
  })

  const discoverQuery = useQuery({
    queryKey: ['korisnici', 'discover'],
    queryFn: () => fetchKorisnici(client, { scope: 'global' }),
  })

  const followingQuery = useQuery({
    queryKey: ['follows', 'following', user?.username],
    queryFn: () => fetchUserFollowingList(client, user!.username),
    enabled: !!user?.username,
  })

  const likeMutation = useMutation({
    mutationFn: (postId: number) => togglePostLike(client, postId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts'] }),
  })

  const publishMutation = useMutation({
    mutationFn: async () => {
      const content = composer.trim()
      if (!content && !imageUri) throw new Error(t('publishError'))
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
      setComposerOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
    onError: (err) => showAlert(t('publishFailedTitle'), getApiErrorMessage(err, t('publishFailed'))),
  })

  const posts = postsQuery.data?.pages.flatMap((p) => p.posts) ?? []
  const aktivneAkcije = useMemo(
    () =>
      mergeAkcijeById(
        akcijeQuery.data?.aktivne ?? [],
        akcijeQuery.data?.vodeneAktivne ?? [],
      ),
    [akcijeQuery.data],
  )
  const mentionUsers = useMemo(
    () => korisniciToMentionUsers(discoverQuery.data ?? []),
    [discoverQuery.data],
  )
  const usersById = useMemo(() => buildUsersById(mentionUsers), [mentionUsers])
  const followingIds = useMemo(
    () =>
      (followingQuery.data ?? [])
        .map((u) => Number(u.id))
        .filter((id) => Number.isFinite(id) && id > 0),
    [followingQuery.data],
  )
  const suggestedUsers = useMemo(
    () => pickSuggestedUsers(mentionUsers, followingIds, user?.klubId, 2),
    [mentionUsers, followingIds, user?.klubId],
  )
  const randomFerrata = useMemo(
    () => pickRandomFerrata(ferratasQuery.data ?? []),
    [ferratasQuery.data, ferratasQuery.dataUpdatedAt],
  )
  const homeListItems = useMemo(
    () => buildHomeListItems(posts, aktivneAkcije, usersById, suggestedUsers, randomFerrata),
    [posts, aktivneAkcije, usersById, suggestedUsers, randomFerrata],
  )

  const isLoading = postsQuery.isLoading
  const isError = postsQuery.isError
  const isRefetching =
    postsQuery.isRefetching ||
    akcijeQuery.isRefetching ||
    ferratasQuery.isRefetching ||
    discoverQuery.isRefetching

  const refreshAll = useCallback(() => {
    void postsQuery.refetch()
    void akcijeQuery.refetch()
    void ferratasQuery.refetch()
    void discoverQuery.refetch()
    void followingQuery.refetch()
  }, [postsQuery, akcijeQuery, ferratasQuery, discoverQuery, followingQuery])

  const pickImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      await showAlert(t('galleryPermissionTitle'), t('galleryPermission'))
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    })
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri)
    }
  }, [showAlert, t])

  const openComposer = useCallback(() => {
    setComposerOpen(true)
  }, [])

  const closeComposer = useCallback(() => {
    setComposerOpen(false)
  }, [])

  const openLikes = useCallback(
    async (postId: number) => {
      setLikesPostId(postId)
      setLikesLoading(true)
      setLikes([])
      try {
        const data = await fetchPostLikes(client, postId)
        setLikes(data.likes)
      } catch (err) {
        setLikesPostId(null)
        await showAlert('Greška', getApiErrorMessage(err, 'Lajkovi nisu učitani.'))
      } finally {
        setLikesLoading(false)
      }
    },
    [showAlert],
  )

  const navigateToAction = useCallback(
    (id: number) => navigation.navigate('ActionDetail', { id }),
    [navigation],
  )

  const navigateToUser = useCallback(
    (u: MentionUser) => navigation.navigate('UserProfile', { id: u.id, username: u.username }),
    [navigation],
  )

  const navigateToFerrata = useCallback(
    (slug: string) => navigation.navigate('FerrataDetail', { slug }),
    [navigation],
  )

  const renderListItem = useCallback(
    ({ item, index }: { item: HomeListItem; index: number }) => {
      if (item.kind === 'suggested') {
        return <HomeSuggestedUsersRow users={item.users} onPressUser={navigateToUser} />
      }
      if (item.kind === 'ferrata') {
        const slug = item.ferrata.slug || String(item.ferrata.id)
        return (
          <HomeFeedFerrataCard
            ferrata={item.ferrata}
            onPress={() => navigateToFerrata(slug)}
          />
        )
      }
      if (item.kind === 'action') {
        return (
          <FeedActionCard
            variant="feed"
            action={item.action}
            addedBy={item.addedBy}
            onPress={() => navigateToAction(item.action.id)}
          />
        )
      }
      const post = item.post
      return (
        <PostCard
          variant="feed"
          post={post}
          onPress={() => navigation.navigate('PostDetail', { id: post.id })}
          onPressAuthor={() => {
            const author = post.author
            if (!author?.username) return
            navigation.navigate('UserProfile', {
              id: author.id,
              username: author.username,
            })
          }}
          onLike={() => likeMutation.mutate(post.id)}
          onPressLikeCount={() => void openLikes(post.id)}
          onComment={() => navigation.navigate('PostDetail', { id: post.id, focusComment: true })}
        />
      )
    },
    [likeMutation, navigateToAction, navigateToFerrata, navigateToUser, navigation, openLikes],
  )

  const topBar = (
    <AppTopBar
      title="PLANINER"
      leftIcon="add"
      onLeftPress={openComposer}
      rightIcon="notifications-outline"
      onRightPress={() => navigation.navigate('NotificationsList')}
      rightBadge={unread}
    />
  )

  if (isLoading) {
    return (
      <View style={styles.root}>
        {topBar}
        <Loader />
      </View>
    )
  }

  if (isError) {
    return (
      <View style={styles.root}>
        {topBar}
        <ErrorView message={t('loadError')} onRetry={() => postsQuery.refetch()} />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      {topBar}

      <FlatList
        data={homeListItems}
        keyExtractor={(item, index) => homeListKey(item, index)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refreshAll} />}
        onEndReached={() => {
          if (postsQuery.hasNextPage && !postsQuery.isFetchingNextPage) void postsQuery.fetchNextPage()
        }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <EmptyState title={t('noPostsTitle')} message={t('noPostsDesc')} />
        }
        ListFooterComponent={
          postsQuery.isFetchingNextPage ? (
            <Loader />
          ) : posts.length > 0 && !postsQuery.hasNextPage ? (
            <Text variant="small" color={colors.textSubtle} style={styles.allLoaded}>
              {t('allLoaded')}
            </Text>
          ) : null
        }
        renderItem={renderListItem}
      />

      <HomeComposerModal
        visible={composerOpen}
        avatarUri={user?.avatarUrl}
        avatarName={user?.fullName || user?.username}
        composer={composer}
        imageUri={imageUri}
        publishing={publishMutation.isPending}
        onChangeText={setComposer}
        onPickImage={() => void pickImage()}
        onRemoveImage={() => setImageUri(null)}
        onPublish={() => publishMutation.mutate()}
        onClose={closeComposer}
      />

      <PostLikesModal
        visible={likesPostId != null}
        title={t('likesTitle')}
        likes={likes}
        loading={likesLoading}
        onClose={() => setLikesPostId(null)}
        onSelectUser={(username) => {
          setLikesPostId(null)
          navigation.navigate('UserProfile', { username })
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  list: { paddingTop: spacing.md, paddingBottom: spacing.xxl },
  allLoaded: { textAlign: 'center', paddingVertical: spacing.lg },
})
