import { useEffect, useState } from 'react'
import {
  canEditActionSignupChoices,
  isActivePendingSignup,
  isConfirmedPrijavaStatus,
} from '@beleg/shared'
import {
  cancelSignupRequest,
  fetchMojaPrijavaZaAkciju,
  otkaziPrijavu,
  prijaviNaAkciju,
  updateMojaPrijava,
} from '../../services/actions'
import { getApiErrorMessage } from '../../utils/apiError'
import { singlePrevozIdSet } from '../../components/action-details/actionDetailsUtils'
import type { ConfirmOptions } from '../../context/ModalContext'
import type { User } from '../../context/AuthContext'
import type { Akcija } from '../../types/akcija'

export type MojaPrijava = {
  status: string
  selectedSmestajIds?: number[]
  selectedPrevozIds?: number[]
  selectedRentItems?: Array<{ rentId: number; kolicina: number }>
} | null

export type PendingSignupRequest = {
  id: number
  status: string
  selectedSmestajIds?: number[]
  selectedPrevozIds?: number[]
  selectedRentItems?: Array<{ rentId: number; kolicina: number }>
} | null

export interface UseActionRegistrationParams {
  id: string | undefined
  user: User | null
  akcija: Akcija | null
  inviteToken: string
  reloadAkcija: () => Promise<void>
  refreshPrijave: () => Promise<void>
  showAlert: (message: string, title?: string) => Promise<void>
  showConfirm: (message: string, options?: Partial<ConfirmOptions>) => Promise<boolean>
  t: (key: string, options?: Record<string, unknown>) => string
  /** Osveži prijavu kad korisnik ponovo otvori stranicu (npr. dodat naknadno na završenu akciju). */
  refetchRegistrationOnFocus?: boolean
}

function applyChoicesToState(
  p: {
    selectedSmestajIds?: number[]
    selectedPrevozIds?: number[]
    selectedRentItems?: Array<{ rentId: number; kolicina: number }>
  },
  setSelSmestaj: (v: Set<number>) => void,
  setSelPrevoz: (v: Set<number>) => void,
  setSelRent: (v: Record<number, number>) => void,
) {
  setSelSmestaj(new Set(p.selectedSmestajIds || []))
  setSelPrevoz(singlePrevozIdSet(p.selectedPrevozIds))
  const rentMap: Record<number, number> = {}
  for (const it of p.selectedRentItems || []) {
    if (it.rentId && it.kolicina > 0) rentMap[it.rentId] = it.kolicina
  }
  setSelRent(rentMap)
}

export function useActionRegistration({
  id,
  user,
  akcija,
  inviteToken,
  reloadAkcija,
  refreshPrijave,
  showAlert,
  showConfirm,
  t,
  refetchRegistrationOnFocus = false,
}: UseActionRegistrationParams) {
  const [mojaPrijava, setMojaPrijava] = useState<MojaPrijava | undefined>(undefined)
  const [pendingSignup, setPendingSignup] = useState<PendingSignupRequest | undefined>(undefined)
  const [selSmestaj, setSelSmestaj] = useState<Set<number>>(new Set())
  const [selPrevoz, setSelPrevoz] = useState<Set<number>>(new Set())
  const [selRent, setSelRent] = useState<Record<number, number>>({})
  const [selectionsDirty, setSelectionsDirty] = useState(false)
  const [savingSelections, setSavingSelections] = useState(false)
  const [registerOptionsOpen, setRegisterOptionsOpen] = useState(false)

  const loadRegistrationState = async () => {
    if (!id || !user) return
    const res = await fetchMojaPrijavaZaAkciju(id)
    const p = res.prijava ?? null
    const signup = res.signupRequest ?? null
    setMojaPrijava(p)
    setPendingSignup(signup?.status === 'pending' ? signup : null)
    const source =
      signup?.status === 'pending' ? signup : (p ?? null)
    if (source) {
      applyChoicesToState(source, setSelSmestaj, setSelPrevoz, setSelRent)
      setSelectionsDirty(false)
    }
  }

  useEffect(() => {
    if (!user || !id) {
      setMojaPrijava(undefined)
      setPendingSignup(undefined)
      return
    }
    let cancelled = false
    const run = async () => {
      try {
        await loadRegistrationState()
      } catch {
        if (!cancelled) {
          setMojaPrijava(null)
          setPendingSignup(null)
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user])

  useEffect(() => {
    if (!user || !id || !refetchRegistrationOnFocus) return
    const refetch = () => {
      void loadRegistrationState()
    }
    window.addEventListener('focus', refetch)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refetch()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', refetch)
      document.removeEventListener('visibilitychange', onVisibility)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user, refetchRegistrationOnFocus])

  useEffect(() => {
    if (!registerOptionsOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRegisterOptionsOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [registerOptionsOpen])

  const toggleSmestaj = (sid: number) => {
    setSelSmestaj((prev) => {
      const next = new Set(prev)
      if (next.has(sid)) next.delete(sid)
      else next.add(sid)
      return next
    })
    setSelectionsDirty(true)
  }

  const togglePrevoz = (pid: number) => {
    setSelPrevoz((prev) => {
      if (prev.has(pid)) {
        const next = new Set(prev)
        next.delete(pid)
        return next
      }
      return new Set([pid])
    })
    setSelectionsDirty(true)
  }

  const setRentQty = (rentId: number, qty: number) => {
    setSelRent((prev) => {
      const next = { ...prev }
      if (qty <= 0) delete next[rentId]
      else next[rentId] = qty
      return next
    })
    setSelectionsDirty(true)
  }

  const buildChoicesPayload = () => {
    const validSmestaj = new Set((akcija?.smestaj || []).map((s) => s.id))
    const validPrevoz = new Set((akcija?.prevoz || []).map((p) => p.id))
    const validRent = new Map((akcija?.opremaRent || []).map((r) => [r.id, r.dostupnaKolicina]))

    const selectedSmestajIds = Array.from(selSmestaj).filter((sid) => validSmestaj.has(sid))
    const prevFiltered = Array.from(selPrevoz).filter((pid) => validPrevoz.has(pid))
    const selectedPrevozIds = prevFiltered.length <= 1 ? prevFiltered : [prevFiltered[prevFiltered.length - 1]]
    const selectedRentItems = Object.entries(selRent)
      .map(([rentIdRaw, kolicinaRaw]) => {
        const rentId = Number(rentIdRaw)
        const available = validRent.get(rentId)
        if (!available) return null
        const currentHeld = pendingSignup?.selectedRentItems?.find((r) => r.rentId === rentId)?.kolicina ?? 0
        const held = mojaPrijava?.selectedRentItems?.find((r) => r.rentId === rentId)?.kolicina ?? currentHeld
        const maxQty = available + held
        const kolicina = Math.max(0, Math.min(Number(kolicinaRaw) || 0, maxQty))
        if (kolicina <= 0) return null
        return { rentId, kolicina }
      })
      .filter(Boolean) as Array<{ rentId: number; kolicina: number }>

    return {
      selectedSmestajIds,
      selectedPrevozIds,
      selectedRentItems,
    }
  }

  const handleSavePrijavaOrUpdate = async () => {
    if (!id) return
    if (akcija?.isCompleted || akcija?.isCancelled) {
      await showAlert(
        akcija?.isCancelled
          ? 'Akcija je otkazana.'
          : 'Akcija je završena.',
      )
      return
    }
    if (pendingSignup && !selectionsDirty) {
      await showAlert(t('signupPendingMessage', { defaultValue: 'Zahtev za prijavu je na čekanju odobrenja.' }))
      return
    }
    setSavingSelections(true)
    try {
      const payload = buildChoicesPayload()
      const inviteParams = inviteToken ? { params: { inviteToken } } : undefined
      if (isConfirmedPrijavaStatus(mojaPrijava?.status)) {
        try {
          await updateMojaPrijava(id!, payload, inviteParams)
          await showAlert('Izbori su sačuvani.')
        } catch (err: unknown) {
          const status = (err as { response?: { status?: number } })?.response?.status
          if (status === 404) {
            await otkaziPrijavu(id!)
            await prijaviNaAkciju(id!, payload, inviteParams)
            await showAlert(t('signupRequestSent', { defaultValue: 'Zahtev za prijavu je poslat na odobrenje.' }))
          } else {
            throw err
          }
        }
      } else {
        await prijaviNaAkciju(id!, payload, inviteParams)
        await showAlert(t('signupRequestSent', { defaultValue: 'Zahtev za prijavu je poslat na odobrenje.' }))
      }
      setSelectionsDirty(false)
      await reloadAkcija()
      await refreshPrijave()
      await loadRegistrationState()
    } catch (err: unknown) {
      const apiError = getApiErrorMessage(err, '')
      const friendly =
        apiError && (/maksimalan broj/i.test(apiError) || /popunjen/i.test(apiError))
          ? t('registrationFullFriendly')
          : (apiError || 'Greška pri čuvanju izbora')
      const isFull = friendly === t('registrationFullFriendly')
      await showAlert(friendly, isFull ? undefined : t('errorTitle'))
    } finally {
      setSavingSelections(false)
    }
  }

  const handleCancelPrijava = async () => {
    if (!id) return
    if (pendingSignup) {
      const ok = await showConfirm(
        t('confirmCancelSignupRequest', {
          defaultValue: 'Da li želite da otkažete zahtev za prijavu?',
        }),
        { variant: 'danger', confirmLabel: t('cancelJoin', { defaultValue: 'Otkaži' }) },
      )
      if (!ok) return
      try {
        await cancelSignupRequest(id)
        setPendingSignup(null)
        setSelSmestaj(new Set())
        setSelPrevoz(new Set())
        setSelRent({})
        setSelectionsDirty(false)
        await reloadAkcija()
        await refreshPrijave()
        await loadRegistrationState()
      } catch (err: unknown) {
        await showAlert(getApiErrorMessage(err, t('cancelJoinError', { defaultValue: 'Greška' })), t('errorTitle'))
      }
      return
    }
    if (!mojaPrijava) return
    const ok = await showConfirm(
      t('confirmCancelJoin', {
        name: akcija?.naziv ?? '',
        defaultValue: 'Da li želite da otkažete prijavu?',
      }),
      { variant: 'danger', confirmLabel: t('cancelJoin', { defaultValue: 'Otkaži' }) },
    )
    if (!ok) return
    try {
      await otkaziPrijavu(id!)
      setMojaPrijava(null)
      setSelSmestaj(new Set())
      setSelPrevoz(new Set())
      setSelRent({})
      setSelectionsDirty(false)
      await reloadAkcija()
      await refreshPrijave()
    } catch (err: unknown) {
      await showAlert(getApiErrorMessage(err, t('cancelJoinError', { defaultValue: 'Greška' })), t('errorTitle'))
    }
  }

  const isPendingSignup = isActivePendingSignup({
    isCompleted: akcija?.isCompleted,
    isCancelled: akcija?.isCancelled,
    signupRequestStatus: pendingSignup?.status ?? (pendingSignup ? 'pending' : null),
  })
  const isRegistered = isConfirmedPrijavaStatus(mojaPrijava?.status)
  const canEditLogistics =
    canEditActionSignupChoices({
      isCompleted: akcija?.isCompleted,
      isCancelled: akcija?.isCancelled,
      isPendingSignup,
      prijavaStatus: mojaPrijava?.status,
    }) && !!user

  return {
    mojaPrijava,
    pendingSignup,
    isPendingSignup,
    isRegistered,
    canEditLogistics,
    setMojaPrijava,
    setPendingSignup,
    selSmestaj,
    setSelSmestaj,
    selPrevoz,
    setSelPrevoz,
    selRent,
    setSelRent,
    selectionsDirty,
    savingSelections,
    registerOptionsOpen,
    setRegisterOptionsOpen,
    toggleSmestaj,
    togglePrevoz,
    setRentQty,
    handleSavePrijavaOrUpdate,
    handleCancelPrijava,
    refreshRegistrationState: loadRegistrationState,
  }
}
