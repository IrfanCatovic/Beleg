import { useState } from 'react'
import { markPrijavePlatio, updatePrijavaPlatio } from '../../services/actions'
import { getApiErrorMessage } from '../../utils/apiError'
import type { ConfirmOptions } from '../../context/ModalContext'
import type { Prijava } from '../../types/prijava'

export interface UseActionPaymentsParams {
  canManageHost: boolean
  prijave: Prijava[]
  setPrijave: React.Dispatch<React.SetStateAction<Prijava[]>>
  setMemberModal: React.Dispatch<React.SetStateAction<Prijava | null>>
  showAlert: (message: string, title?: string) => Promise<void>
  showConfirm: (message: string, options?: Partial<ConfirmOptions>) => Promise<boolean>
  t: (key: string, options?: Record<string, unknown>) => string
}

export function useActionPayments({
  canManageHost,
  prijave,
  setPrijave,
  setMemberModal,
  showAlert,
  showConfirm,
  t,
}: UseActionPaymentsParams) {
  const [bulkPaymentMode, setBulkPaymentMode] = useState(false)
  const [bulkPaymentSubmitting, setBulkPaymentSubmitting] = useState(false)
  const [bulkSelectedPaymentIds, setBulkSelectedPaymentIds] = useState<Set<number>>(new Set())

  const paymentTrackedPrijave = prijave.filter((p) => p.status !== 'otkazano')
  const unpaidTrackedPrijave = paymentTrackedPrijave.filter((p) => !p.platio)

  const handleTogglePaymentStatus = async (prijavaId: number, nextPlatio: boolean) => {
    if (!canManageHost) return
    try {
      await updatePrijavaPlatio(prijavaId, nextPlatio)
      setPrijave((prev) => prev.map((p) => (p.id === prijavaId ? { ...p, platio: nextPlatio } : p)))
      setMemberModal((prev) => (prev && prev.id === prijavaId ? { ...prev, platio: nextPlatio } : prev))
    } catch (err: unknown) {
      await showAlert(getApiErrorMessage(err, 'Greška pri ažuriranju statusa uplate'), t('errorTitle'))
    }
  }

  const toggleBulkSelectionForUser = (prijava: Prijava) => {
    if (prijava.platio) return
    setBulkSelectedPaymentIds((prev) => {
      const next = new Set(prev)
      if (next.has(prijava.id)) next.delete(prijava.id)
      else next.add(prijava.id)
      return next
    })
  }

  const handleToggleSelectAllBulkPayments = () => {
    const unpaidIds = unpaidTrackedPrijave.map((p) => p.id)
    if (unpaidIds.length === 0) return
    const allSelected = unpaidIds.every((pid) => bulkSelectedPaymentIds.has(pid))
    if (allSelected) {
      setBulkSelectedPaymentIds(new Set())
    } else {
      setBulkSelectedPaymentIds(new Set(unpaidIds))
    }
  }

  const handleBulkMarkAsPaid = async () => {
    if (!canManageHost) return
    const selectedIds = Array.from(bulkSelectedPaymentIds)
    if (selectedIds.length === 0) {
      await showAlert('Označite bar jednog člana.', t('errorTitle'))
      return
    }
    const confirmed = await showConfirm(
      `Označio si ${selectedIds.length} član(a) da je platio. Da li želiš da potvrdiš uplatu?`,
      { title: 'Potvrda', confirmLabel: 'Plati', cancelLabel: t('cancel') },
    )
    if (!confirmed) return

    setBulkPaymentSubmitting(true)
    try {
      const results = await markPrijavePlatio(selectedIds)
      const successIds: number[] = []
      let failed = 0
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') successIds.push(selectedIds[idx])
        else failed++
      })

      if (successIds.length > 0) {
        setPrijave((prev) => prev.map((p) => (successIds.includes(p.id) ? { ...p, platio: true } : p)))
      }
      setBulkSelectedPaymentIds(new Set())
      setBulkPaymentMode(false)

      if (failed > 0) {
        await showAlert(`Uspešno ažurirano: ${successIds.length}. Neuspešno: ${failed}.`, t('errorTitle'))
      }
    } catch (err: unknown) {
      await showAlert(getApiErrorMessage(err, 'Greška pri grupnom ažuriranju uplata.'), t('errorTitle'))
    } finally {
      setBulkPaymentSubmitting(false)
    }
  }

  return {
    bulkPaymentMode,
    setBulkPaymentMode,
    bulkPaymentSubmitting,
    bulkSelectedPaymentIds,
    setBulkSelectedPaymentIds,
    paymentTrackedPrijave,
    unpaidTrackedPrijave,
    handleTogglePaymentStatus,
    toggleBulkSelectionForUser,
    handleToggleSelectAllBulkPayments,
    handleBulkMarkAsPaid,
  }
}
