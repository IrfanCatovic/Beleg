import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import type { FlatList } from 'react-native'
import type { PostsPage } from '@beleg/shared/services'
import { fetchPostById } from '@beleg/shared/services'
import {
  decideFeedPostFocus,
  insertOrMovePostIntoFeedPages,
  normalizeFeedPostId,
  type FeedPostFetchStatus,
} from '@beleg/shared'
import { client } from '../../api/client'
import { scrollFeedToIndex } from './feedScrollHelpers'
import type { HomeListItem } from './homeFeedUtils'

const SCROLL_RETRY_MS = 80

function isNotFoundError(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status
  return status === 404 || status === 403
}

export function useFeedPostFocus(opts: {
  postIdParam: unknown
  listReady: boolean
  homeListItems: HomeListItem[]
  queryClient: QueryClient
  navigation: { setParams: (params: { postId?: undefined }) => void }
  listRef: RefObject<FlatList<HomeListItem> | null>
}) {
  const consumedForRef = useRef<number | null>(null)
  const mountedRef = useRef(true)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fetchingRef = useRef(false)
  const [fetchStatus, setFetchStatus] = useState<FeedPostFetchStatus>('idle')
  const [activePostId, setActivePostId] = useState<number | null>(null)
  const postIdParam = opts.postIdParam

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (retryTimerRef.current != null) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const next = normalizeFeedPostId(postIdParam)
    if (next == null) return
    consumedForRef.current = null
    fetchingRef.current = false
    queueMicrotask(() => {
      if (!mountedRef.current) return
      setActivePostId(next)
      setFetchStatus('idle')
    })
  }, [postIdParam])

  const onScrollToIndexFailed = useCallback(
    (info: {
      index: number
      highestMeasuredFrameIndex: number
      averageItemLength: number
    }) => {
      if (retryTimerRef.current != null) {
        clearTimeout(retryTimerRef.current)
      }
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null
        if (!mountedRef.current) return
        const list = opts.listRef.current
        if (!list) return
        const offset = Math.max(0, info.averageItemLength * info.index)
        try {
          list.scrollToOffset({ offset, animated: true })
        } catch {
          // ignore
        }
      }, SCROLL_RETRY_MS)
    },
    [opts.listRef],
  )

  const clearParam = useCallback(() => {
    try {
      opts.navigation.setParams({ postId: undefined })
    } catch {
      // ignore
    }
  }, [opts.navigation])

  useEffect(() => {
    const postId = activePostId
    if (postId == null) return
    if (consumedForRef.current === postId) return

    const loadedPostIds = opts.homeListItems
      .filter((i): i is Extract<HomeListItem, { kind: 'post' }> => i.kind === 'post')
      .map((i) => i.post.id)

    const decision = decideFeedPostFocus({
      postId,
      alreadyConsumed: false,
      listReady: opts.listReady,
      loadedPostIds,
      fetchStatus,
    })

    if (decision.action === 'wait' || decision.action === 'noop') return

    if (decision.action === 'consume-without-scroll') {
      consumedForRef.current = postId
      queueMicrotask(() => {
        if (!mountedRef.current) return
        setActivePostId(null)
        setFetchStatus('idle')
        clearParam()
      })
      return
    }

    if (decision.action === 'scroll') {
      const listIndex = opts.homeListItems.findIndex(
        (i) => i.kind === 'post' && i.post.id === postId,
      )
      if (listIndex < 0) return
      consumedForRef.current = postId
      queueMicrotask(() => {
        if (!mountedRef.current) return
        scrollFeedToIndex(opts.listRef.current as FlatList<unknown> | null, listIndex)
        setActivePostId(null)
        setFetchStatus('idle')
        clearParam()
      })
      return
    }

    if (decision.action === 'fetch') {
      if (fetchingRef.current) return
      fetchingRef.current = true
      queueMicrotask(() => {
        if (mountedRef.current) setFetchStatus('loading')
      })
      void (async () => {
        try {
          const post = await fetchPostById(client, postId)
          if (!mountedRef.current) return
          opts.queryClient.setQueryData<InfiniteData<PostsPage>>(
            ['posts', 'feed'],
            (prev) => insertOrMovePostIntoFeedPages(prev, post) as InfiniteData<PostsPage>,
          )
          setFetchStatus('found')
        } catch (err) {
          if (!mountedRef.current) return
          setFetchStatus(isNotFoundError(err) ? 'missing' : 'error')
        } finally {
          fetchingRef.current = false
        }
      })()
    }
  }, [
    activePostId,
    fetchStatus,
    opts.homeListItems,
    opts.listReady,
    opts.listRef,
    opts.queryClient,
    clearParam,
  ])

  return { onScrollToIndexFailed }
}
