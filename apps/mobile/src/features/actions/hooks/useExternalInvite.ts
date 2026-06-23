import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createParticipationRequest,
  cancelParticipationRequest,
  fetchActionParticipationRequests,
  fetchEligibleExternalUsers,
  type ActionParticipationRequest,
  type ExternalUserCandidate,
} from '@beleg/shared/services'
import { getApiErrorMessage } from '@beleg/shared'
import { client } from '../../../api/client'

export type ExternalUserScope = 'other-clubs' | 'no-club'

export function useExternalInvite(actionId: number, enabled: boolean) {
  const [scope, setScope] = useState<ExternalUserScope>('other-clubs')
  const [search, setSearch] = useState('')
  const [candidates, setCandidates] = useState<ExternalUserCandidate[]>([])
  const [requests, setRequests] = useState<ActionParticipationRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [error, setError] = useState('')
  const [sendingId, setSendingId] = useState<number | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refreshRequests = useCallback(async () => {
    if (!enabled) return
    setRequestsLoading(true)
    try {
      const list = await fetchActionParticipationRequests(client, actionId)
      setRequests(list)
    } catch {
      setRequests([])
    } finally {
      setRequestsLoading(false)
    }
  }, [actionId, enabled])

  const fetchCandidates = useCallback(
    async (q: string, nextScope: ExternalUserScope) => {
      if (!enabled) return
      setLoading(true)
      setError('')
      try {
        const received = await fetchEligibleExternalUsers(client, actionId, {
          scope: nextScope,
          q: q.trim(),
          limit: 10,
          offset: 0,
        })
        setCandidates(received)
      } catch (err) {
        setCandidates([])
        setError(getApiErrorMessage(err, 'Greška pri pretrazi.'))
      } finally {
        setLoading(false)
      }
    },
    [actionId, enabled],
  )

  useEffect(() => {
    void refreshRequests()
  }, [refreshRequests])

  useEffect(() => {
    if (!enabled) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void fetchCandidates(search, scope)
    }, search.trim() ? 300 : 0)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search, scope, enabled, fetchCandidates])

  const sendRequest = useCallback(
    async (candidate: ExternalUserCandidate) => {
      setSendingId(candidate.id)
      setError('')
      try {
        const created = await createParticipationRequest(client, actionId, candidate.id)
        setRequests((prev) => [created, ...prev.filter((r) => r.id !== created.id)])
        setCandidates((prev) => prev.filter((c) => c.id !== candidate.id))
      } catch (err) {
        setError(getApiErrorMessage(err, 'Slanje zahteva nije uspelo.'))
      } finally {
        setSendingId(null)
      }
    },
    [actionId],
  )

  const cancelRequest = useCallback(
    async (request: ActionParticipationRequest) => {
      try {
        await cancelParticipationRequest(client, actionId, request.id)
        await refreshRequests()
      } catch (err) {
        setError(getApiErrorMessage(err, 'Otkazivanje nije uspelo.'))
      }
    },
    [actionId, refreshRequests],
  )

  return {
    scope,
    setScope,
    search,
    setSearch,
    candidates,
    requests,
    loading,
    requestsLoading,
    error,
    sendingId,
    sendRequest,
    cancelRequest,
  }
}
