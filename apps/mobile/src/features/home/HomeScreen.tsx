import { useCallback, useMemo, useRef, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import * as ImagePicker from 'expo-image-picker'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@beleg/shared'
import {
  createPost,
  fetchAkcije,
  fetchKorisnici,
  fetchPosts,
  fetchUnreadCount,
  fetchUserFollowingList,
  togglePostLike,
} from '@beleg/shared/services'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import { PostCard } from '../../components/shared/PostCard'
import { AppTopBar } from '../../components/ui/AppTopBar'
import { EmptyState, ErrorView, Loader, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { AppTabsParamList, HomeStackParamList } from '../../navigation/types'
import { FeedActionCard } from './FeedActionCard'
import { HomeComposer, type HomeComposerHandle } from './HomeComposer'
import { HomeNextActionsRow } from './HomeNextActionsRow'
import { HomeSuggestedUsersRow } from './HomeSuggestedUsersRow'
import {
  buildFeedItems,
  buildUsersById,
  korisniciToMentionUsers,
  mergeAkcijeById,
  pickSledeceAkcije,
  pickSuggestedUsers,
  type FeedItem,
  type MentionUser,
} from './homeFeedUtils'

const PAGE = 15

type Props = NativeStackScreenProps<HomeStackParamList, 'Feed'>

export default function HomeScreen({ navigation }: Props) {
  const tabNavigation = navigation.getParent<BottomTabNavigationProp<AppTabsParamList>>()
  const queryClient = useQueryClient()
  const { showAlert } = useModal()
  const { user } = useAuth()
  const { t } = useTranslation('home')
  const [composer, setComposer] = useState('')
  const [imageUri, setImageUri] = useState<string | null>(null)
  const listRef = useRef<FlatList<FeedItem>>(null)
  const composerRef = useRef<HomeComposerHandle>(null)

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
  const feedItems = useMemo(
    () => buildFeedItems(posts, aktivneAkcije, usersById),
    [posts, aktivneAkcije, usersById],
  )
  const sledeceAkcije = useMemo(() => pickSledeceAkcije(aktivneAkcije), [aktivneAkcije])
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

  const isLoading = postsQuery.isLoading
  const isError = postsQuery.isError
  const isRefetching =
    postsQuery.isRefetching ||
    akcijeQuery.isRefetching ||
    discoverQuery.isRefetching

  const refreshAll = useCallback(() => {
    void postsQuery.refetch()
    void akcijeQuery.refetch()
    void discoverQuery.refetch()
    void followingQuery.refetch()
  }, [postsQuery, akcijeQuery, discoverQuery, followingQuery])

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
      composerRef.current?.focus()
    }
  }, [showAlert, t])

  const openComposer = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true })
    composerRef.current?.focus()
  }, [])

  const navigateToAction = useCallback(
    (id: number) => navigation.navigate('ActionDetail', { id }),
    [navigation],
  )

  const navigateToUser = useCallback(
    (u: MentionUser) => navigation.navigate('UserProfile', { id: u.id, username: u.username }),
    [navigation],
  )

  const navigateToAllActions = useCallback(() => {
    tabNavigation?.navigate('ActionsTab', { screen: 'ActionsList' })
  }, [tabNavigation])

  const renderFeedItem = useCallback(
    ({ item }: { item: FeedItem }) => {
      if (item.kind === 'action') {
        return (
          <FeedActionCard
            action={item.action}
            addedBy={item.addedBy}
            onPress={() => navigateToAction(item.action.id)}
          />
        )
      }
      const post = item.post
      return (
        <PostCard
          post={post}
          onPress={() => navigation.navigate('PostDetail', { id: post.id })}
          onPressAuthor={() =>
            navigation.navigate('UserProfile', {
              id: post.author.id,
              username: post.author.username,
            })
          }
          onLike={() => likeMutation.mutate(post.id)}
          onComment={() => navigation.navigate('PostDetail', { id: post.id })}
        />
      )
    },
    [likeMutation, navigateToAction, navigation],
  )

  const listHeader = useMemo(
    () => (
      <View>
        <View style={styles.headerSection}>
          <HomeNextActionsRow
            actions={sledeceAkcije}
            loading={akcijeQuery.isLoading}
            onPressAction={navigateToAction}
            onPressAll={navigateToAllActions}
          />
        </View>
        <HomeComposer
          ref={composerRef}
          avatarUri={user?.avatarUrl}
          avatarName={user?.fullName || user?.username}
          composer={composer}
          imageUri={imageUri}
          publishing={publishMutation.isPending}
          onChangeText={setComposer}
          onPickImage={() => void pickImage()}
          onRemoveImage={() => setImageUri(null)}
          onPublish={() => publishMutation.mutate()}
        />
        <HomeSuggestedUsersRow users={suggestedUsers} onPressUser={navigateToUser} />
      </View>
    ),
    [
      sledeceAkcije,
      akcijeQuery.isLoading,
      navigateToAction,
      navigateToAllActions,
      user,
      composer,
      imageUri,
      publishMutation.isPending,
      pickImage,
      suggestedUsers,
      navigateToUser,
    ],
  )

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
        <ErrorView message={t('loadError')} onRetry={() => postsQuery.refetch()} />
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

      <FlatList
        ref={listRef}
        data={feedItems}
        keyExtractor={(item) => (item.kind === 'action' ? `action-${item.action.id}` : `post-${item.post.id}`)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refreshAll} />}
        onEndReached={() => {
          if (postsQuery.hasNextPage && !postsQuery.isFetchingNextPage) void postsQuery.fetchNextPage()
        }}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={listHeader}
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
        renderItem={renderFeedItem}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerSection: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  allLoaded: { textAlign: 'center', paddingVertical: spacing.lg },
})
