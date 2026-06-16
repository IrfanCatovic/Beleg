import { useEffect, useState } from 'react'
import {
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
}: UseActionRegistrationParams) {
  const [mojaPrijava, setMojaPrijava] = useState<MojaPrijava | undefined>(undefined)
  const [selSmestaj, setSelSmestaj] = useState<Set<number>>(new Set())
  const [selPrevoz, setSelPrevoz] = useState<Set<number>>(new Set())
  const [selRent, setSelRent] = useState<Record<number, number>>({})
  const [selectionsDirty, setSelectionsDirty] = useState(false)
  const [savingSelections, setSavingSelections] = useState(false)
  const [registerOptionsOpen, setRegisterOptionsOpen] = useState(false)

  useEffect(() => {
    if (!user || !id) {
      setMojaPrijava(undefined)
      return
    }
    let cancelled = false
    const run = async () => {
      try {
        const res = await fetchMojaPrijavaZaAkciju(id!)
        if (!cancelled) {
          const p = res.prijava ?? null
          setMojaPrijava(p)
          if (p) {
            setSelSmestaj(new Set(p.selectedSmestajIds || []))
            setSelPrevoz(singlePrevozIdSet(p.selectedPrevozIds))
            const rentMap: Record<number, number> = {}
            for (const it of p.selectedRentItems || []) {
              if (it.rentId && it.kolicina > 0) rentMap[it.rentId] = it.kolicina
            }
            setSelRent(rentMap)
            setSelectionsDirty(false)
          }
        }
      } catch {
        if (!cancelled) setMojaPrijava(null)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [id, user])

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
        const kolicina = Math.max(0, Math.min(Number(kolicinaRaw) || 0, available))
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
    if (akcija?.isCompleted) {
      await showAlert('Akcija je završena.')
      return
    }
    if (mojaPrijava && mojaPrijava.status !== 'prijavljen') {
      await showAlert('Ne možete menjati izbore nakon što je status prijave promenjen.', t('errorTitle'))
      return
    }
    setSavingSelections(true)
    try {
      const payload = buildChoicesPayload()
      const inviteParams = inviteToken ? { params: { inviteToken } } : undefined
      if (!mojaPrijava) {
        await prijaviNaAkciju(id!, payload, inviteParams)
        await showAlert('Uspešno ste se prijavili!')
      } else {
        try {
          await updateMojaPrijava(id!, payload, inviteParams)
        } catch (err: unknown) {
          const status = (err as { response?: { status?: number } })?.response?.status
          if (status === 404) {
            await otkaziPrijavu(id!)
            await prijaviNaAkciju(id!, payload, inviteParams)
          } else {
            throw err
          }
        }
      }
      setSelectionsDirty(false)
      await reloadAkcija()
      await refreshPrijave()
      const mp = await fetchMojaPrijavaZaAkciju(id!)
      setMojaPrijava(mp.prijava ?? null)
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
    if (!id || !mojaPrijava) return
    const ok = await showConfirm(t('confirmCancelJoin', { defaultValue: 'Da li želite da otkažete prijavu?' }))
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

  return {
    mojaPrijava,
    setMojaPrijava,
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
  }
}
