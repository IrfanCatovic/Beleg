import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchEligibleExternalUsers, type ExternalUserCandidate } from '../../services/actions'
import { getApiErrorMessage } from '../../utils/apiError'

export type ExternalUserScope = 'other-clubs' | 'no-club'

export interface UseExternalUserSearchOptions {
  actionId: number | string | undefined
  enabled?: boolean
  /** When true, debounced fetch runs on search/scope/offset changes (ActionDetails). When false, call fetchPage manually (AddPastAction). */
  autoFetch?: boolean
  /** When true, scope state is managed internally and passed to the API. */
  withScope?: boolean
  initialScope?: ExternalUserScope
  pageSize?: number
  debounceMs?: number
  errorFallback?: string
  onError?: (message: string) => void
}

export function useExternalUserSearch({
  actionId,
  enabled = true,
  autoFetch = true,
  withScope = false,
  initialScope = 'other-clubs',
  pageSize = 5,
  debounceMs = 250,
  errorFallback = 'Greška pri pretrazi korisnika van kluba.',
  onError,
}: UseExternalUserSearchOptions) {
  const [scope, setScope] = useState<ExternalUserScope>(initialScope)
  const [search, setSearch] = useState('')
  const [candidates, setCandidates] = useState<ExternalUserCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const fetchGenRef = useRef(0)

  const reset = useCallback(() => {
    setCandidates([])
    setOffset(0)
    setHasMore(true)
    setError('')
  }, [])

  const fetchPage = useCallback(
    async (replace: boolean, queryOverride?: string, actionIdOverride?: number | string) => {
      const targetActionId = actionIdOverride ?? actionId
      if (!targetActionId || loading) return
      const q = (queryOverride ?? search).trim()
      const nextOffset = replace ? 0 : offset
      const gen = ++fetchGenRef.current

      setLoading(true)
      setError('')
      try {
        const received = await fetchEligibleExternalUsers(targetActionId, {
          scope: withScope ? scope : 'other-clubs',
          q,
          limit: pageSize,
          offset: nextOffset,
        })
        if (gen !== fetchGenRef.current) return

        setCandidates((prev) => {
          if (replace || nextOffset === 0) return received
          const seen = new Set(prev.map((x) => x.id))
          const merged = [...prev]
          for (const item of received) {
            if (!seen.has(item.id)) merged.push(item)
          }
          return merged
        })
        setOffset(nextOffset + received.length)
        setHasMore(received.length === pageSize)
      } catch (err: unknown) {
        if (gen !== fetchGenRef.current) return
        if (replace || nextOffset === 0) setCandidates([])
        const message = getApiErrorMessage(err, errorFallback)
        setError(message)
        onError?.(message)
      } finally {
        if (gen === fetchGenRef.current) setLoading(false)
      }
    },
    [actionId, loading, search, offset, pageSize, scope, withScope, errorFallback, onError],
  )

  const removeCandidate = useCallback((candidateId: number) => {
    setCandidates((prev) => prev.filter((item) => item.id !== candidateId))
  }, [])

  const markHasMore = useCallback(() => {
    setHasMore(true)
  }, [])

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (loading || !hasMore) return
      const el = e.currentTarget
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      if (distanceFromBottom <= 24) {
        if (withScope && autoFetch) {
          setOffset((prev) => prev + pageSize)
        } else {
          void fetchPage(false)
        }
      }
    },
    [loading, hasMore, withScope, autoFetch, pageSize, fetchPage],
  )

  useEffect(() => {
    if (!withScope || !autoFetch) return
    setCandidates([])
    setOffset(0)
    setHasMore(true)
  }, [scope, search, withScope, autoFetch])

  useEffect(() => {
    if (!withScope || !autoFetch) return
    if (!enabled || !actionId) {
      setCandidates([])
      setError('')
      setOffset(0)
      setHasMore(true)
      return
    }
    if (!hasMore && offset > 0) return

    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError('')
      try {
        const received = await fetchEligibleExternalUsers(actionId, {
          scope,
          q: search.trim(),
          limit: pageSize,
          offset,
        })
        if (cancelled) return
        setCandidates((prev) => {
          if (offset === 0) return received
          const seen = new Set(prev.map((x) => x.id))
          const merged = [...prev]
          for (const item of received) {
            if (!seen.has(item.id)) merged.push(item)
          }
          return merged
        })
        setHasMore(received.length === pageSize)
      } catch (err: unknown) {
        if (!cancelled) {
          if (offset === 0) setCandidates([])
          const message = getApiErrorMessage(err, errorFallback)
          setError(message)
          onError?.(message)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const timeout = window.setTimeout(() => {
      void run()
    }, search.trim() ? debounceMs : 0)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [withScope, autoFetch, enabled, actionId, scope, search, offset, hasMore, pageSize, debounceMs, errorFallback, onError])

  return {
    scope,
    setScope,
    search,
    setSearch,
    candidates,
    setCandidates,
    loading,
    error,
    setError,
    offset,
    setOffset,
    hasMore,
    setHasMore,
    reset,
    fetchPage,
    handleScroll,
    removeCandidate,
    markHasMore,
  }
}
