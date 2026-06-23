import { useCallback, useEffect, useState } from 'react'
import {
  fetchActionSignupRequests,
  respondToActionSignupRequest,
  type ActionSignupRequest,
} from '../../services/actions'
import { getApiErrorMessage } from '../../utils/apiError'

export function useActionSignupRequests(params: {
  actionId: string | undefined
  enabled: boolean
  showAlert: (message: string, title?: string) => Promise<void>
  onChanged: () => Promise<void>
}) {
  const { actionId, enabled, showAlert, onChanged } = params
  const [requests, setRequests] = useState<ActionSignupRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [respondingId, setRespondingId] = useState<number | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled || !actionId) {
      setRequests([])
      return
    }
    setLoading(true)
    try {
      const rows = await fetchActionSignupRequests(actionId, 'pending')
      setRequests(rows)
    } catch {
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [actionId, enabled])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const respond = async (requestId: number, action: 'accept' | 'reject') => {
    if (!actionId) return
    setRespondingId(requestId)
    try {
      await respondToActionSignupRequest(actionId, requestId, action)
      await refresh()
      await onChanged()
    } catch (err: unknown) {
      await showAlert(getApiErrorMessage(err, 'Greška pri obradi zahteva.'), 'Greška')
    } finally {
      setRespondingId(null)
    }
  }

  return {
    signupRequests: requests,
    signupRequestsLoading: loading,
    respondingSignupId: respondingId,
    refreshSignupRequests: refresh,
    respondToSignupRequest: respond,
  }
}
