import { useEffect, useState } from 'react'
import api from '../../services/api'
import { useModal } from '../../context/ModalContext'

type Props = {
  targetId: number
  onBlockChange?: (blockedByMe: boolean, blockedByTarget: boolean) => void
}

export default function BlockUserButton({ targetId, onBlockChange }: Props) {
  const { showConfirm, showAlert } = useModal()
  const [blockedByMe, setBlockedByMe] = useState(false)
  const [blockedByTarget, setBlockedByTarget] = useState(false)
  const [busy, setBusy] = useState(false)

  const fetchStatus = async () => {
    try {
      const res = await api.get<{ blockedByMe?: boolean; blockedByTarget?: boolean }>(`/api/blocks/status/${targetId}`)
      const byMe = !!res.data.blockedByMe
      const byThem = !!res.data.blockedByTarget
      setBlockedByMe(byMe)
      setBlockedByTarget(byThem)
      onBlockChange?.(byMe, byThem)
    } catch {
      setBlockedByMe(false)
      setBlockedByTarget(false)
    }
  }

  useEffect(() => {
    void fetchStatus()
  }, [targetId])

  if (blockedByTarget && !blockedByMe) return null

  const onBlock = async () => {
    if (busy) return
    const ok = await showConfirm('Da li želite da blokirate ovog korisnika?', {
      title: 'Blokiraj korisnika',
      confirmLabel: 'Blokiraj',
      cancelLabel: 'Otkaži',
      variant: 'danger',
    })
    if (!ok) return
    setBusy(true)
    try {
      await api.post(`/api/blocks/${targetId}`)
      setBlockedByMe(true)
      onBlockChange?.(true, blockedByTarget)
      await showAlert('Korisnik je blokiran.', 'Blokiranje')
    } catch (err: any) {
      await showAlert(err.response?.data?.error || 'Greška pri blokiranju', 'Blokiranje')
    } finally {
      setBusy(false)
    }
  }

  const onUnblock = async () => {
    if (busy) return
    const ok = await showConfirm('Da li želite da uklonite korisnika sa blok liste?', {
      title: 'Odblokiraj korisnika',
      confirmLabel: 'Odblokiraj',
      cancelLabel: 'Otkaži',
    })
    if (!ok) return
    setBusy(true)
    try {
      await api.delete(`/api/blocks/${targetId}`)
      setBlockedByMe(false)
      onBlockChange?.(false, blockedByTarget)
      await showAlert('Korisnik je uklonjen sa blok liste.', 'Blokiranje')
    } catch (err: any) {
      await showAlert(err.response?.data?.error || 'Greška pri odblokiranju', 'Blokiranje')
    } finally {
      setBusy(false)
    }
  }

  return blockedByMe ? (
    <button
      type="button"
      onClick={() => void onUnblock()}
      disabled={busy}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition disabled:opacity-60"
      title="Odblokiraj"
      aria-label="Odblokiraj"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  ) : (
    <button
      type="button"
      onClick={() => void onBlock()}
      disabled={busy}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 text-rose-700 hover:bg-rose-200 transition disabled:opacity-60"
      title="Blokiraj"
      aria-label="Blokiraj"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
        <circle cx="12" cy="12" r="8" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 15.5l7-7" />
      </svg>
    </button>
  )
}

