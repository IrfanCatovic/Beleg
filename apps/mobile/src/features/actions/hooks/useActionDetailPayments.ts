import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AkcijaDetail, Prijava } from '@beleg/shared'
import { computeClientSaldo, filterTrackedPrijave, getApiErrorMessage } from '@beleg/shared'
import { updatePrijavaPlatio, updatePrijavaStatus, deletePrijava } from '@beleg/shared/services'
import { client } from '../../../api/client'
import { invalidateActionQueries } from './invalidateActionQueries'

export function useActionDetailPayments(options: {
  actionId: number
  akcija: AkcijaDetail | undefined
  prijave: Prijava[]
  canManageHost: boolean
  inviteToken?: string
  showAlert: (title: string, message?: string) => Promise<boolean>
  showConfirm: (
    title: string,
    message?: string,
    opts?: { variant?: 'default' | 'danger'; confirmLabel?: string },
  ) => Promise<boolean>
}) {
  const { actionId, akcija, prijave, canManageHost, inviteToken, showAlert, showConfirm } = options
  const queryClient = useQueryClient()
  const [selectedMember, setSelectedMember] = useState<Prijava | null>(null)
  const [bulkMode, setBulkMode] = useState(false)

  const tracked = useMemo(() => filterTrackedPrijave(prijave), [prijave])
  const paidCount = tracked.filter((p) => !!p.platio).length
  const paidTotal = useMemo(() => {
    if (!akcija) return 0
    return tracked.reduce((acc, p) => acc + (p.platio ? computeClientSaldo(p, akcija) : 0), 0)
  }, [tracked, akcija])
  const expectedTotal = useMemo(() => {
    if (!akcija) return 0
    return tracked.reduce((acc, p) => acc + computeClientSaldo(p, akcija), 0)
  }, [tracked, akcija])

  const invalidate = useCallback(async () => {
    await invalidateActionQueries(queryClient, actionId, inviteToken)
  }, [queryClient, actionId, inviteToken])

  const togglePlatioMutation = useMutation({
    mutationFn: ({ prijavaId, platio }: { prijavaId: number; platio: boolean }) =>
      updatePrijavaPlatio(client, prijavaId, platio),
    onSuccess: async () => {
      await invalidate()
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Ažuriranje uplate nije uspelo.')),
  })

  const statusMutation = useMutation({
    mutationFn: ({ prijavaId, status }: { prijavaId: number; status: string }) =>
      updatePrijavaStatus(client, prijavaId, status),
    onSuccess: async () => {
      await invalidate()
      setSelectedMember(null)
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Promena statusa nije uspela.')),
  })

  const deleteMutation = useMutation({
    mutationFn: (prijavaId: number) => deletePrijava(client, prijavaId),
    onSuccess: async () => {
      await invalidate()
      setSelectedMember(null)
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Uklanjanje nije uspelo.')),
  })

  const bulkMarkPaid = useCallback(async () => {
    if (!canManageHost) return
    const unpaid = tracked.filter((p) => !p.platio)
    if (unpaid.length === 0) {
      await showAlert('Info', 'Svi su već označeni kao platili.')
      return
    }
    const ok = await showConfirm(
      'Označi plaćeno',
      `Označiti ${unpaid.length} članova kao platili?`,
      { confirmLabel: 'Potvrdi' },
    )
    if (!ok) return
    try {
      await Promise.all(unpaid.map((p) => updatePrijavaPlatio(client, p.id, true)))
      await invalidate()
      setBulkMode(false)
    } catch (err) {
      await showAlert('Greška', getApiErrorMessage(err, 'Masovno označavanje nije uspelo.'))
    }
  }, [canManageHost, tracked, showConfirm, showAlert, invalidate])

  const handleRemoveMember = useCallback(
    async (member: Prijava) => {
      const ok = await showConfirm(
        'Ukloni člana',
        `Ukloniti ${member.fullName || member.korisnik} sa akcije?`,
        { variant: 'danger', confirmLabel: 'Ukloni' },
      )
      if (ok) deleteMutation.mutate(member.id)
    },
    [showConfirm, deleteMutation],
  )

  return {
    tracked,
    paidCount,
    paidTotal,
    expectedTotal,
    selectedMember,
    setSelectedMember,
    bulkMode,
    setBulkMode,
    togglePlatioMutation,
    statusMutation,
    deleteMutation,
    bulkMarkPaid,
    handleRemoveMember,
  }
}
