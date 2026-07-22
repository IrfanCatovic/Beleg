import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AkcijaDetail } from '@beleg/shared'
import type { Prijava } from '@beleg/shared'
import {
  buildChoicesPayload,
  computeLogisticsTotals,
  computeParticipantSaldo,
  effectiveBaseCena,
  effectiveIsClanKluba,
  getActionCapacityUsedCount,
  isActionCapacityFull,
  getApiErrorMessage,
  canEditActionSignupChoices,
  deriveActionSignupUiState,
  isActionCancelled,
  isActivePendingSignup,
  isConfirmedPrijavaStatus,
} from '@beleg/shared'
import {
  cancelSignupRequest,
  otkaziPrijavu,
  prijaviNaAkciju,
  updateMojaPrijava,
} from '@beleg/shared/services'
import type { MojaPrijavaResponse } from '@beleg/shared/services'
import { client } from '../../../api/client'
import type { SessionUser } from '@beleg/shared'
import { invalidateActionQueries } from './invalidateActionQueries'

function registrationErrorMessage(err: unknown): string {
  const msg = getApiErrorMessage(err, 'Čuvanje nije uspelo.')
  if (/popunjen|maksimalan|pun/i.test(msg)) {
    return 'Sva mesta su popunjena. Pokušajte kasnije ili izaberite drugu opciju.'
  }
  return msg
}

export function useActionDetailRegistration(options: {
  actionId: number
  akcija: AkcijaDetail | undefined
  prijave?: Prijava[]
  user: SessionUser | null
  inviteToken?: string
  mojaPrijavaData: MojaPrijavaResponse | undefined
  canCancel: boolean
  showAlert: (title: string, message?: string) => Promise<boolean>
  showConfirm: (
    title: string,
    message?: string,
    opts?: { variant?: 'default' | 'danger'; confirmLabel?: string },
  ) => Promise<boolean>
}) {
  const { actionId, akcija, prijave, user, inviteToken, mojaPrijavaData, canCancel, showAlert, showConfirm } =
    options
  const queryClient = useQueryClient()

  const [selSmestaj, setSelSmestaj] = useState<Set<number>>(new Set())
  const [selPrevoz, setSelPrevoz] = useState<Set<number>>(new Set())
  const [selRent, setSelRent] = useState<Record<number, number>>({})
  const [selectionsDirty, setSelectionsDirty] = useState(false)

  const prijava = mojaPrijavaData?.prijava
  const pendingSignup = mojaPrijavaData?.signupRequest
  const isPendingSignup = isActivePendingSignup({
    isCompleted: akcija?.isCompleted,
    isCancelled: akcija?.isCancelled,
    signupRequestStatus: pendingSignup?.status,
  })
  const isRegistered = isConfirmedPrijavaStatus(prijava?.status)

  const heldSource = (isPendingSignup ? pendingSignup : null) ?? prijava

  const isClan = useMemo(
    () => (akcija && user ? effectiveIsClanKluba(user, akcija) : false),
    [akcija, user],
  )

  const baseCena = useMemo(
    () => (akcija ? effectiveBaseCena(akcija, isClan) : 0),
    [akcija, isClan],
  )

  const selections = useMemo(
    () => ({ selSmestaj, selPrevoz, selRent }),
    [selSmestaj, selPrevoz, selRent],
  )

  const priceTotals = useMemo(() => {
    if (!akcija) return { smestaj: 0, prevoz: 0, rent: 0 }
    return computeLogisticsTotals(akcija, selections)
  }, [akcija, selections])

  const totalPrice = useMemo(() => {
    if (!akcija) return 0
    return computeParticipantSaldo(akcija, undefined, isClan, selections, { username: user?.username })
  }, [akcija, user?.username, isClan, selections])

  useEffect(() => {
    const source = (isPendingSignup ? pendingSignup : null) ?? prijava
    if (!source) return
    setSelSmestaj(new Set(source.selectedSmestajIds ?? []))
    const prev = source.selectedPrevozIds ?? []
    setSelPrevoz(prev.length ? new Set([prev[prev.length - 1]]) : new Set())
    const rent: Record<number, number> = {}
    for (const it of source.selectedRentItems ?? []) {
      if (it.rentId && it.kolicina > 0) rent[it.rentId] = it.kolicina
    }
    setSelRent(rent)
    setSelectionsDirty(false)
  }, [prijava, pendingSignup, isPendingSignup])

  const logisticsDisabled = !canEditActionSignupChoices({
    isCompleted: akcija?.isCompleted,
    isCancelled: akcija?.isCancelled,
    isPendingSignup,
    prijavaStatus: prijava?.status,
  })

  const capacityUsedCount = getActionCapacityUsedCount(akcija ?? {}, prijave)
  const isCapacityFull =
    !!akcija &&
    !akcija.isCompleted &&
    !akcija.isCancelled &&
    isActionCapacityFull(akcija.maxLjudi, capacityUsedCount)

  const signupUi = useMemo(
    () =>
      deriveActionSignupUiState({
        prijavaStatus: prijava?.status,
        isPendingSignup,
        selectionsDirty,
        saving: false,
        isCapacityFull,
        isCompleted: !!akcija?.isCompleted,
        isCancelled: !!akcija?.isCancelled,
      }),
    [
      prijava?.status,
      isPendingSignup,
      selectionsDirty,
      isCapacityFull,
      akcija?.isCompleted,
      akcija?.isCancelled,
    ],
  )

  const invalidate = useCallback(async () => {
    await invalidateActionQueries(queryClient, actionId, inviteToken)
  }, [queryClient, actionId, inviteToken])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!akcija) throw new Error('Nema akcije')
      if (isActionCancelled(akcija) || akcija.isCompleted) {
        throw new Error('ACTION_TERMINAL')
      }
      if (!isRegistered && !isPendingSignup && isCapacityFull) {
        throw new Error('CAPACITY_FULL')
      }
      if (isPendingSignup && !selectionsDirty) {
        throw new Error('PENDING_ONLY')
      }
      const payload = buildChoicesPayload(akcija, selections, heldSource)
      const opts = inviteToken ? { inviteToken } : undefined
      if (isRegistered) {
        try {
          return await updateMojaPrijava(client, actionId, payload, opts)
        } catch (err: unknown) {
          const status = (err as { response?: { status?: number } })?.response?.status
          if (status === 404) {
            await otkaziPrijavu(client, actionId)
            return prijaviNaAkciju(client, actionId, payload, opts)
          }
          throw err
        }
      }
      return prijaviNaAkciju(client, actionId, payload, opts)
    },
    onSuccess: async () => {
      await invalidate()
      setSelectionsDirty(false)
      await showAlert(
        'Uspeh',
        isRegistered ? 'Prijava je ažurirana.' : 'Zahtev za prijavu je poslat na odobrenje.',
      )
    },
    onError: async (err) => {
      if (err instanceof Error && err.message === 'ACTION_TERMINAL') {
        await showAlert('Info', 'Akcija nije dostupna za prijave.')
        return
      }
      if (err instanceof Error && err.message === 'PENDING_ONLY') {
        await showAlert('Info', 'Zahtev za prijavu je na čekanju odobrenja.')
        return
      }
      if (err instanceof Error && err.message === 'CAPACITY_FULL') {
        await showAlert('Info', registrationErrorMessage(new Error('Akcija je popunjena.')))
        return
      }
      await showAlert('Greška', registrationErrorMessage(err))
    },
  })

  const otkaziMutation = useMutation({
    mutationFn: () => otkaziPrijavu(client, actionId),
    onSuccess: async () => {
      await invalidate()
      setSelSmestaj(new Set())
      setSelPrevoz(new Set())
      setSelRent({})
      await showAlert('Uspeh', 'Prijava je otkazana.')
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Otkazivanje nije uspelo.')),
  })

  const cancelSignupMutation = useMutation({
    mutationFn: () => cancelSignupRequest(client, actionId),
    onSuccess: async () => {
      await invalidate()
      setSelSmestaj(new Set())
      setSelPrevoz(new Set())
      setSelRent({})
      await showAlert('Uspeh', 'Zahtev za prijavu je otkazan.')
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Otkazivanje nije uspelo.')),
  })

  const markDirty = useCallback(() => setSelectionsDirty(true), [])

  const handleCancelSignup = useCallback(async () => {
    if (!akcija || isActionCancelled(akcija) || akcija.isCompleted) return
    const ok = await showConfirm(
      'Otkaži zahtev',
      `Otkazati zahtev za prijavu na „${akcija.naziv}"?`,
      { variant: 'danger', confirmLabel: 'Otkaži' },
    )
    if (ok) cancelSignupMutation.mutate()
  }, [akcija, showConfirm, cancelSignupMutation])

  const handleCancelPrijava = useCallback(async () => {
    if (!akcija || !canCancel || isActionCancelled(akcija) || akcija.isCompleted) return
    const ok = await showConfirm(
      'Otkaži prijavu',
      `Da li ste sigurni da želite da otkažete prijavu na „${akcija.naziv}"?`,
      { variant: 'danger', confirmLabel: 'Otkaži' },
    )
    if (ok) otkaziMutation.mutate()
  }, [akcija, canCancel, showConfirm, otkaziMutation])

  return {
    selSmestaj,
    setSelSmestaj,
    selPrevoz,
    setSelPrevoz,
    selRent,
    setSelRent,
    selectionsDirty,
    markDirty,
    prijava,
    pendingSignup,
    isPendingSignup,
    isRegistered,
    isCapacityFull,
    signupUi,
    isClan,
    baseCena,
    priceTotals,
    totalPrice,
    logisticsDisabled,
    saveMutation,
    otkaziMutation,
    cancelSignupMutation,
    handleCancelSignup,
    handleCancelPrijava,
    invalidate,
  }
}
