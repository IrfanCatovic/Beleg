import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  decideFeedPostFocus,
  insertOrMovePostIntoList,
  normalizeFeedPostId,
  scrollPostElementIntoView,
  type FeedPostFetchStatus,
} from '@beleg/shared'
import { fetchPostById } from '../services/posts'
import type { Post } from '../components/PostCard'

function isNotFoundError(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status
  return status === 404 || status === 403
}

function toPost(raw: Awaited<ReturnType<typeof fetchPostById>>): Post {
  return raw as unknown as Post
}

/**
 * One-shot /home?postId= focus: find or fetch, scroll once, strip only postId via replace.
 */
export function useWebFeedPostFocus(opts: {
  posts: Post[]
  setPosts: Dispatch<SetStateAction<Post[]>>
  listReady: boolean
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const postIdParam = searchParams.get('postId')
  const consumedForRef = useRef<number | null>(null)
  const mountedRef = useRef(true)
  const [fetchStatus, setFetchStatus] = useState<FeedPostFetchStatus>('idle')
  const [activePostId, setActivePostId] = useState<number | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const next = normalizeFeedPostId(postIdParam)
    if (next == null) return
    consumedForRef.current = null
    queueMicrotask(() => {
      if (!mountedRef.current) return
      setActivePostId(next)
      setFetchStatus('idle')
    })
  }, [postIdParam])

  const clearPostIdParam = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('postId')
        return next
      },
      { replace: true },
    )
  }

  useEffect(() => {
    const postId = activePostId
    if (postId == null) return
    if (consumedForRef.current === postId) return

    const loadedPostIds = opts.posts.map((p) => p.id)
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
        clearPostIdParam()
      })
      return
    }

    if (decision.action === 'scroll') {
      consumedForRef.current = postId
      queueMicrotask(() => {
        if (!mountedRef.current) return
        const el = document.querySelector(`[data-post-id="${postId}"]`)
        if (el) scrollPostElementIntoView(el)
        clearPostIdParam()
        setActivePostId(null)
        setFetchStatus('idle')
      })
      return
    }

    if (decision.action === 'fetch') {
      queueMicrotask(() => {
        if (mountedRef.current) setFetchStatus('loading')
      })
      void (async () => {
        try {
          const raw = await fetchPostById(postId)
          if (!mountedRef.current) return
          const post = toPost(raw)
          opts.setPosts((prev) => insertOrMovePostIntoList(prev, post))
          setFetchStatus('found')
        } catch (err) {
          if (!mountedRef.current) return
          setFetchStatus(isNotFoundError(err) ? 'missing' : 'error')
        }
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setSearchParams/setPosts stable enough; avoid re-fetch loops
  }, [activePostId, fetchStatus, opts.listReady, opts.posts])
}
