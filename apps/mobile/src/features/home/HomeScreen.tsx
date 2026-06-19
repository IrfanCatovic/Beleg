import { useCallback, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { fetchPosts, togglePostLike } from '@beleg/shared/services'
import { client } from '../../api/client'
import { PostCard } from '../../components/shared/PostCard'
import { Button, EmptyState, ErrorView, Input, Loader, Screen, Text } from '../../components/ui'
import { spacing } from '../../theme'
import type { HomeStackParamList } from '../../navigation/types'

const PAGE = 15

type Props = NativeStackScreenProps<HomeStackParamList, 'Feed'>

export default function HomeScreen({ navigation }: Props) {
  const queryClient = useQueryClient()
  const [composer, setComposer] = useState('')

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

  const posts = data?.pages.flatMap((p) => p.posts) ?? []

  const onRefresh = useCallback(() => {
    void refetch()
  }, [refetch])

  if (isLoading) {
    return (
      <Screen>
        <Loader />
      </Screen>
    )
  }

  if (isError) {
    return (
      <Screen>
        <ErrorView message="Feed nije učitan." onRetry={() => refetch()} />
      </Screen>
    )
  }

  return (
    <Screen padded={false}>
      <View style={styles.composer}>
        <Input
          placeholder="Šta ima novo?"
          value={composer}
          onChangeText={setComposer}
          multiline
        />
        <Text variant="small">Objava sa slikom dolazi u sledećoj fazi.</Text>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
        }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={<EmptyState title="Nema objava" message="Budite prvi koji nešto objavi." />}
        ListFooterComponent={isFetchingNextPage ? <Loader /> : null}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onPressAuthor={() =>
              navigation.navigate('UserProfile', {
                id: item.author.id,
                username: item.author.username,
              })
            }
            onLike={() => likeMutation.mutate(item.id)}
          />
        )}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  composer: { padding: spacing.lg, gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  list: { padding: spacing.lg, paddingBottom: spacing.xxl },
})
