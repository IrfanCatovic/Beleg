import { useEffect, useState } from 'react'
import {
  cancelParticipationRequest,
  createParticipationRequest,
  fetchParticipationRequests,
  type ActionParticipationRequest,
  type ExternalUserCandidate,
} from '../../services/actions'
import { getApiErrorMessage } from '../../utils/apiError'
import { canManageHostAkcija } from '../../utils/canManageAkcija'
import type { ConfirmOptions } from '../../context/ModalContext'
import type { User } from '../../context/AuthContext'
import type { Akcija } from '../../types/akcija'

export interface UseParticipationRequestsParams {
  id: string | undefined
  user: User | null
  akcija: Akcija | null
  showAlert: (message: string, title?: string) => Promise<void>
  showConfirm: (message: string, options?: Partial<ConfirmOptions>) => Promise<boolean>
  t: (key: string, options?: Record<string, unknown>) => string
  removeExternalCandidate: (candidateId: number) => void
  markExternalHasMore: () => void
}

export function useParticipationRequests({
  id,
  user,
  akcija,
  showAlert,
  showConfirm,
  t,
  removeExternalCandidate,
  markExternalHasMore,
}: UseParticipationRequestsParams) {
  const [actionParticipationRequests, setActionParticipationRequests] = useState<ActionParticipationRequest[]>([])
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [sendingExternalRequestId, setSendingExternalRequestId] = useState<number | null>(null)

  useEffect(() => {
    if (!user || !akcija || !canManageHostAkcija(user, {
      klubId: akcija.klubId,
      organizatorTip: akcija.organizatorTip,
      vodicId: akcija.vodicId,
      vodicUsername: akcija.vodic?.username,
    }) || !akcija.isCompleted || !id) {
      setActionParticipationRequests([])
      return
    }
    let cancelled = false
    const run = async () => {
      setRequestsLoading(true)
      try {
        const requests = await fetchParticipationRequests(id!)
        if (!cancelled) setActionParticipationRequests(requests || [])
      } catch {
        if (!cancelled) setActionParticipationRequests([])
      } finally {
        if (!cancelled) setRequestsLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [user, akcija, id])

  const refreshActionParticipationRequests = async () => {
    if (!id) return
    try {
      const requests = await fetchParticipationRequests(id!)
      setActionParticipationRequests(requests)
    } catch {
      // ignore
    }
  }

  const handleSendExternalRequest = async (candidate: ExternalUserCandidate, setExternalError: (msg: string) => void) => {
    if (!id) return
    setSendingExternalRequestId(candidate.id)
    setExternalError('')
    try {
      const created = await createParticipationRequest(id!, candidate.id)
      setActionParticipationRequests((prev) => [created, ...prev.filter((item) => item.id !== created.id)])
      removeExternalCandidate(candidate.id)
      markExternalHasMore()
      await showAlert('Zahtev je poslat. Korisnik će dobiti obaveštenje i potvrditi učešće iz svog dela aplikacije.')
    } catch (err: unknown) {
      setExternalError(getApiErrorMessage(err, 'Slanje zahteva nije uspelo.'))
    } finally {
      setSendingExternalRequestId(null)
    }
  }

  const handleCancelExternalRequest = async (request: ActionParticipationRequest) => {
    if (!id) return
    const targetLabel = request.targetUser.fullName?.trim() || request.targetUser.username
    const confirmed = await showConfirm(`Da li želite da otkažete zahtev za ${targetLabel}?`, {
      title: 'Otkaži zahtev',
      confirmLabel: 'Otkaži zahtev',
      cancelLabel: 'Nazad',
      variant: 'danger',
    })
    if (!confirmed) return
    try {
      await cancelParticipationRequest(id!, request.id)
      await refreshActionParticipationRequests()
    } catch (err: unknown) {
      await showAlert(getApiErrorMessage(err, 'Greška pri otkazivanju zahteva.'), t('errorTitle'))
    }
  }

  return {
    actionParticipationRequests,
    requestsLoading,
    sendingExternalRequestId,
    refreshActionParticipationRequests,
    handleSendExternalRequest,
    handleCancelExternalRequest,
  }
}
