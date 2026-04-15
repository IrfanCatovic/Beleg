import { useParams, Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import { generateActionPdfPrePolaska, generateActionPdfZavrsena } from '../../utils/generateActionPdf'
import {
  downloadSummitSuccessPng,
  getSummitLayoutPreviewDataUrl,
  type SummitAspect,
  type SummitLayout,
} from '../../utils/generateSummitPng'
import { formatDateTime, formatDate } from '../../utils/dateUtils'
import { canManageHostAkcija } from '../../utils/canManageAkcija'
import { AkcijaImageOrFallback } from '../../components/AkcijaImageFallback'
import Dropdown from '../../components/Dropdown'
import { tezinaLabel, prijavaStatusLabel } from '../../utils/difficultyI18n'

interface Akcija {
  id: number
  naziv: string
  planina?: string
  vrh: string
  datum: string
  opis?: string
  tezina?: string
  slikaUrl?: string
  createdAt: string
  updatedAt: string
  isCompleted: boolean
  visinaVrhM?: number
  zimskiUspon?: boolean
  drugiVodicIme?: string
  vodic?: { fullName: string; username: string }
  addedBy?: { fullName: string; username: string }
  prijaveCount?: number
  javna?: boolean
  klubNaziv?: string
  klubId?: number
  limited?: boolean
  kumulativniUsponM?: number
  duzinaStazeKm?: number
}

interface Prijava {
  id: number
  korisnik: string
  fullName?: string
  avatarUrl?: string
  prijavljenAt: string
  status: 'prijavljen' | 'popeo se' | 'nije uspeo' | 'otkazano'
}

interface ClubMember {
  id: number
  username: string
  fullName?: string
}

const TEZINA_STYLE: Record<string, { bg: string; text: string }> = {
  lako: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  srednje: { bg: 'bg-amber-50', text: 'text-amber-700' },
  tesko: { bg: 'bg-rose-50', text: 'text-rose-700' },
  teško: { bg: 'bg-rose-50', text: 'text-rose-700' },
  alpinizam: { bg: 'bg-violet-50', text: 'text-violet-700' },
}

function tzStyle(raw: string | undefined, t: TFunction) {
  if (!raw) return { bg: 'bg-gray-50', text: 'text-gray-500', label: tezinaLabel(raw, t) }
  const k = raw.toLowerCase()
  const style = TEZINA_STYLE[k]
  if (style) return { ...style, label: tezinaLabel(raw, t) }
  return { bg: 'bg-gray-50', text: 'text-gray-500', label: tezinaLabel(raw, t) }
}

const STATUS_STYLE: Record<string, string> = {
  'popeo se':   'bg-emerald-50 text-emerald-700 border-emerald-200',
  'nije uspeo': 'bg-rose-50 text-rose-700 border-rose-200',
  'otkazano':   'bg-gray-100 text-gray-500 border-gray-200',
  'prijavljen': 'bg-emerald-50 text-emerald-600 border-emerald-200',
}

export default function ActionDetails() {
  const { t, i18n } = useTranslation('actionDetails')
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { showConfirm, showAlert } = useModal()
  const navigate = useNavigate()
  const [akcija, setAkcija] = useState<Akcija | null>(null)
  const [prijave, setPrijave] = useState<Prijava[]>([])
  const [canSeePrijave, setCanSeePrijave] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mojaPrijava, setMojaPrijava] = useState<{ status: string } | null | undefined>(undefined)
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  const [addingMemberError, setAddingMemberError] = useState('')
  const [summitShareOpen, setSummitShareOpen] = useState(false)
  const [summitShareStep, setSummitShareStep] = useState<1 | 2>(1)
  const [summitPickedAspect, setSummitPickedAspect] = useState<SummitAspect | null>(null)
  const [summitPreviewBalanced, setSummitPreviewBalanced] = useState<string | null>(null)
  const [summitPreviewStacked, setSummitPreviewStacked] = useState<string | null>(null)
  const [summitPreviewLoading, setSummitPreviewLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const fetchAkcija = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await api.get(`/api/akcije/${id}`)
        if (!cancelled) setAkcija(res.data)
      } catch (err: any) {
        if (!cancelled) setError(err.response?.data?.error || t('loadError'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchAkcija()
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!summitShareOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSummitShareOpen(false)
        setSummitShareStep(1)
        setSummitPickedAspect(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [summitShareOpen])

  useEffect(() => {
    if (summitShareStep !== 2 || !summitPickedAspect || !akcija) {
      setSummitPreviewBalanced(null)
      setSummitPreviewStacked(null)
      setSummitPreviewLoading(false)
      return
    }
    let cancelled = false
    const payload = {
      id: akcija.id,
      planina: akcija.planina,
      vrh: akcija.vrh,
      datum: akcija.datum,
      duzinaStazeKm: akcija.duzinaStazeKm,
      kumulativniUsponM: akcija.kumulativniUsponM,
      visinaVrhM: akcija.visinaVrhM,
      zimskiUspon: akcija.zimskiUspon,
      tezina: akcija.tezina,
    }
    const labels = {
      mountain: t('mountain'),
      peak: t('peak'),
      trail: t('summitPngTrail'),
      ascent: t('summitPngAscent'),
      date: t('date'),
      mmr: t('summitPngMmr'),
    }
    const dateFormatted = formatDate(akcija.datum)
    setSummitPreviewBalanced(null)
    setSummitPreviewStacked(null)
    setSummitPreviewLoading(true)
    void (async () => {
      try {
        const previewW = summitPickedAspect === '9:16' ? 140 : 200
        const [b, s] = await Promise.all([
          getSummitLayoutPreviewDataUrl(payload, summitPickedAspect, 'balanced', labels, dateFormatted, previewW),
          getSummitLayoutPreviewDataUrl(payload, summitPickedAspect, 'stacked', labels, dateFormatted, previewW),
        ])
        if (!cancelled) {
          setSummitPreviewBalanced(b)
          setSummitPreviewStacked(s)
        }
      } catch {
        if (!cancelled) {
          setSummitPreviewBalanced(null)
          setSummitPreviewStacked(null)
        }
      } finally {
        if (!cancelled) setSummitPreviewLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [summitShareStep, summitPickedAspect, akcija, i18n.language, t])

  useEffect(() => {
    if (!user || !id) {
      setMojaPrijava(undefined)
      return
    }
    let cancelled = false
    const run = async () => {
      try {
        const res = await api.get<{ prijava: { status: string } | null }>(`/api/akcije/${id}/moja-prijava`)
        if (!cancelled) setMojaPrijava(res.data.prijava ?? null)
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
    const enrichWithAvatars = async (items: Prijava[]): Promise<Prijava[]> => {
      return Promise.all(
        items.map(async (p) => {
          const existingAvatar = (p as any).avatarUrl || (p as any).avatar_url
          if (existingAvatar) {
            return { ...p, avatarUrl: existingAvatar }
          }
          try {
            if (!p.korisnik) return p
            const res = await api.get(`/api/korisnici/${encodeURIComponent(p.korisnik)}`)
            const avatar = (res.data as any)?.avatar_url
            if (avatar) {
              return { ...p, avatarUrl: avatar }
            }
          } catch {
            // ignore, zadrži bez avatara
          }
          return p
        })
      )
    }

    if (!id || !user || !akcija || akcija.limited) {
      setPrijave([])
      setCanSeePrijave(false)
      return
    }

    const run = async () => {
      try {
        const res = await api.get(`/api/akcije/${id}/prijave`)
        const list: Prijava[] = res.data.prijave || []
        const enriched = await enrichWithAvatars(list)
        setPrijave(enriched)
        setCanSeePrijave(true)
        return
      } catch (err: any) {
        if (err?.response?.status === 403) {
          setPrijave([])
          setCanSeePrijave(false)
          return
        }
        setPrijave([])
        setCanSeePrijave(false)
      }
    }
    void run()
  }, [id, user, akcija])

  useEffect(() => {
    if (!user || !akcija || !canManageHostAkcija(user, akcija.klubId) || !akcija.isCompleted) {
      setClubMembers([])
      setSelectedMemberId('')
      return
    }
    let cancelled = false
    const run = async () => {
      try {
        const res = await api.get<{ korisnici: ClubMember[] }>('/api/korisnici')
        if (!cancelled) setClubMembers(res.data.korisnici || [])
      } catch {
        if (!cancelled) setClubMembers([])
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [user, akcija])

  const handleDelete = async () => {
    const confirmed = await showConfirm(t('deleteConfirmMessage'), { variant: 'danger', confirmLabel: t('delete') })
    if (!confirmed) return
    try {
      await api.delete(`/api/akcije/${id}`)
      await showAlert(t('deleteSuccess'))
      navigate('/akcije')
    } catch (err: any) {
      await showAlert(err.response?.data?.error || t('deleteError'), t('errorTitle'))
    }
  }

  const handleEdit = () => navigate(`/akcije/${id}/izmeni`)

  const handleUpdateStatus = async (prijavaId: number, newStatus: string) => {
    try {
      await api.post(`/api/prijave/${prijavaId}/status`, { status: newStatus })
      const res = await api.get(`/api/akcije/${id}/prijave`)
      const list: Prijava[] = res.data.prijave || []
      // nije neophodno ponovo povlačiti avatare, ali možemo zadržati postojeće
      setPrijave((prev) => {
        const avatarMap = new Map<number, string | undefined>()
        prev.forEach((p) => avatarMap.set(p.id, p.avatarUrl))
        return list.map((p) => ({
          ...p,
          avatarUrl: p.avatarUrl || (p as any).avatar_url || avatarMap.get(p.id),
        }))
      })
    } catch {
      alert(t('updateStatusError'))
    }
  }

  const handleRemoveFromAction = async (prijavaId: number, displayName: string) => {
    const confirmed = await showConfirm(t('removeMemberConfirm', { name: displayName }), {
      title: t('removeMemberTitle'),
      confirmLabel: t('remove'),
      cancelLabel: t('cancel'),
    })
    if (!confirmed) return
    try {
      await api.delete(`/api/prijave/${prijavaId}`)
      const res = await api.get(`/api/akcije/${id}/prijave`)
      const list: Prijava[] = res.data.prijave || []
      setPrijave((prev) => {
        const avatarMap = new Map<number, string | undefined>()
        prev.forEach((p) => avatarMap.set(p.id, p.avatarUrl))
        return list.map((p) => ({
          ...p,
          avatarUrl: p.avatarUrl || (p as any).avatar_url || avatarMap.get(p.id),
        }))
      })
    } catch (err: any) {
      await showAlert(err.response?.data?.error || t('removeMemberError'), t('errorTitle'))
    }
  }

  const handleAddCompletedMember = async () => {
    if (!id || !selectedMemberId) return
    setAddingMemberError('')
    setAddingMember(true)
    try {
      await api.post(`/api/akcije/${id}/dodaj-clana-popeo-se`, { korisnikId: Number(selectedMemberId) })
      const res = await api.get(`/api/akcije/${id}/prijave`)
      const list: Prijava[] = res.data.prijave || []
      setPrijave((prev) => {
        const avatarMap = new Map<number, string | undefined>()
        prev.forEach((p) => avatarMap.set(p.id, p.avatarUrl))
        return list.map((p) => ({
          ...p,
          avatarUrl: p.avatarUrl || (p as any).avatar_url || avatarMap.get(p.id),
        }))
      })
      setSelectedMemberId('')
      await showAlert('Clan je dodat i oznacen kao uspesno popeo se.')
    } catch (err: any) {
      setAddingMemberError(err.response?.data?.error || 'Neuspesno dodavanje clana na zavrsenu akciju.')
    } finally {
      setAddingMember(false)
    }
  }

  const handleZavrsiAkciju = async () => {
    const neoznaceni = prijave.filter((p) => p.status === 'prijavljen')
    if (neoznaceni.length > 0) {
      await showAlert(
        t('finishNeedStatuses'),
        t('markAllMembers')
      )
      return
    }

    const confirmed = await showConfirm(
      t('finishConfirmBody'),
      {
        title: t('finishActionTitle'),
        confirmLabel: t('finishAction'),
        cancelLabel: t('cancel'),
      }
    )
    if (!confirmed) return

    try {
      const res = await api.post(`/api/akcije/${id}/zavrsi`)
      await showAlert(t('finishSuccess'), t('actionFinishedTitle'))
      const updated = res.data?.akcija
      if (updated) setAkcija(updated)
      else setAkcija((prev) => (prev ? { ...prev, isCompleted: true } : null))
    } catch (err: any) {
      await showAlert(err.response?.data?.error || t('finishError'), t('errorTitle'))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-emerald-500 border-t-transparent" />
      </div>
    )
  }
  if (error || !akcija) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <div className="h-14 w-14 rounded-2xl bg-red-50 flex items-center justify-center">
          <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-sm text-gray-500 font-medium">{error || t('notFound')}</p>
      </div>
    )
  }

  const vodicIme = [akcija.vodic?.fullName, akcija.drugiVodicIme].filter(Boolean).join(', ')
  const imenaPolaznika = prijave.map((p) => (p.fullName?.trim() ? p.fullName : p.korisnik)).join(', ')
  const uspesnoPopeli = prijave.filter((p) => p.status === 'popeo se')
  const imenaUspesnoPopeli = uspesnoPopeli.map((p) => (p.fullName?.trim() ? p.fullName : p.korisnik)).join(', ')
  const difficultyBadge = tzStyle(akcija.tezina, t)
  const canManageHost = !!(user && canManageHostAkcija(user, akcija.klubId))
  const isLimitedView = !!akcija.limited
  const memberCount =
    user && canSeePrijave && !isLimitedView ? prijave.length : (akcija.prijaveCount ?? 0)
  const climbedByUsername = new Set(prijave.filter((p) => p.status === 'popeo se').map((p) => p.korisnik))
  const membersToAdd = clubMembers.filter((m) => !climbedByUsername.has(m.username))

  const handlePrintPrePolaska = () => {
    generateActionPdfPrePolaska({
      naziv: akcija.naziv, planina: akcija.planina || '', vrh: akcija.vrh,
      datum: akcija.datum, opis: akcija.opis || '', tezina: akcija.tezina || '',
      vodicIme, addedBy: akcija.addedBy?.fullName || '',
      brojPolaznika: prijave.length, imenaPolaznika,
    })
  }

  const handlePrintZavrsena = () => {
    generateActionPdfZavrsena({
      naziv: akcija.naziv, planina: akcija.planina || '', vrh: akcija.vrh,
      datum: akcija.datum, opis: akcija.opis || '', tezina: akcija.tezina || '',
      vodicIme, addedBy: akcija.addedBy?.fullName || '',
      brojPrijavljenih: prijave.length, brojUspesnoPopeli: uspesnoPopeli.length,
      imenaUspesnoPopeli,
    })
  }

  const showSummitImageCard =
    !!user && mojaPrijava !== undefined && mojaPrijava?.status === 'popeo se'

  const closeSummitShareModal = () => {
    setSummitShareOpen(false)
    setSummitShareStep(1)
    setSummitPickedAspect(null)
  }

  const openSummitShareModal = () => {
    setSummitShareStep(1)
    setSummitPickedAspect(null)
    setSummitShareOpen(true)
  }

  const handleSummitPngDownload = async (aspect: SummitAspect, layout: SummitLayout) => {
    try {
      await downloadSummitSuccessPng(
        {
          id: akcija.id,
          planina: akcija.planina,
          vrh: akcija.vrh,
          datum: akcija.datum,
          duzinaStazeKm: akcija.duzinaStazeKm,
          kumulativniUsponM: akcija.kumulativniUsponM,
          visinaVrhM: akcija.visinaVrhM,
          zimskiUspon: akcija.zimskiUspon,
          tezina: akcija.tezina,
        },
        aspect,
        layout,
        {
          mountain: t('mountain'),
          peak: t('peak'),
          trail: t('summitPngTrail'),
          ascent: t('summitPngAscent'),
          date: t('date'),
          mmr: t('summitPngMmr'),
        },
        formatDate(akcija.datum)
      )
      closeSummitShareModal()
    } catch {
      await showAlert(t('summitPngError'), t('errorTitle'))
    }
  }

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 pb-16 md:pb-10">

      {/* ══════════ COVER IMAGE ══════════ */}
      <div className="relative h-64 sm:h-72 md:h-80 lg:h-[22rem] overflow-hidden -mt-6 w-screen left-1/2 -translate-x-1/2">
        <AkcijaImageOrFallback
          src={akcija.slikaUrl}
          alt={akcija.naziv}
          imgClassName="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 sm:top-5 sm:left-6 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold text-white bg-black/30 hover:bg-black/50 backdrop-blur-md border border-white/10 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          {t('back')}
        </button>

        {/* Cover content */}
        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
              <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-white bg-white/20 backdrop-blur-md border border-white/10">
                {formatDate(akcija.datum)}
              </span>
              <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${difficultyBadge.bg} ${difficultyBadge.text}`}>
                {difficultyBadge.label}
              </span>
              {akcija.zimskiUspon && (
                <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-sky-500/80 text-white backdrop-blur-sm border border-sky-400/30">
                  {t('winterAscent')}
                </span>
              )}
              {akcija.javna && (
                <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-violet-500/80 text-white backdrop-blur-sm border border-violet-400/30">
                  {t('public')}
                </span>
              )}
              {akcija.isCompleted && (
                <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white backdrop-blur-sm border border-white/10">
                  {t('completed')}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight drop-shadow-lg leading-tight max-w-3xl">
              {akcija.naziv}
            </h1>
            <p className="mt-1.5 text-sm sm:text-base text-white/80 font-medium flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-white/50 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              {[akcija.planina, akcija.vrh].filter(Boolean).join(' · ')}
              {akcija.visinaVrhM != null && ` · ${akcija.visinaVrhM} m`}
            </p>
          </div>
        </div>
      </div>

      {/* ══════════ STATS BAR ══════════ */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100">
            {akcija.planina && (
              <StatCell
                icon={<svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 6v12.75c0 1.243 1.007 2.25 2.25 2.25z" /></svg>}
                value={akcija.planina}
                label={t('mountain')}
              />
            )}
            <StatCell
              icon={<svg className="w-4 h-4 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" /></svg>}
              value={akcija.vrh}
              label={t('peak')}
            />
            {akcija.visinaVrhM != null && (
              <StatCell
                icon={<svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" /></svg>}
                value={`${akcija.visinaVrhM}`}
                unit="m"
                label={t('height')}
              />
            )}
            <StatCell
              icon={<svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>}
              value={String(memberCount)}
              label={t('registered')}
            />
          </div>
        </div>
      </div>

      {isLimitedView && (
        <div className="bg-amber-50/70 border-b border-amber-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <p className="text-sm text-amber-800">
              {t('limitedNotice')}
            </p>
          </div>
        </div>
      )}

      {/* ══════════ BODY ══════════ */}
      <div className="bg-gray-50/80 min-h-[40vh]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">

          {/* ── Info grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left: Details */}
            <div className="lg:col-span-2 space-y-6">

              {/* Vodič / Kreator card */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-visible">
                <div className="px-5 sm:px-6 py-4 border-b border-gray-50 flex items-center gap-2.5">
                  <div className="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
                  <h2 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight">{t('actionDetails')}</h2>
                </div>
                <div className="p-5 sm:p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(akcija.vodic || akcija.drugiVodicIme) && (
                      <InfoRow
                        icon={
                          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                          </svg>
                        }
                        iconBg="bg-emerald-50"
                        label={t('guides')}
                        value={vodicIme}
                      />
                    )}
                    {akcija.addedBy && (
                      <InfoRow
                        icon={
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                        }
                        iconBg="bg-gray-50"
                        label={t('createdBy')}
                        value={akcija.addedBy.fullName || `@${akcija.addedBy.username}`}
                      />
                    )}
                    {akcija.javna && akcija.klubNaziv && (
                      <InfoRow
                        icon={
                          <svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                          </svg>
                        }
                        iconBg="bg-violet-50"
                        label={t('club')}
                        value={akcija.klubNaziv}
                      />
                    )}
                    <InfoRow
                      icon={
                        <svg className="w-4 h-4 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                        </svg>
                      }
                      iconBg="bg-sky-50"
                      label={t('date')}
                      value={formatDate(akcija.datum)}
                    />
                    <InfoRow
                      icon={
                        <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                        </svg>
                      }
                      iconBg="bg-amber-50"
                      label={t('difficulty')}
                      value={difficultyBadge.label}
                    />
                  </div>

                  {akcija.opis && (
                    <div className="pt-4 border-t border-gray-50">
                      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">{t('actionDescription')}</h3>
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{akcija.opis}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Prijavljeni članovi ── */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-visible">
                <div className="px-5 sm:px-6 py-4 border-b border-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
                    <h2 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight">{t('registeredMembers')}</h2>
                  </div>
                  <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-[10px] font-bold bg-emerald-500 text-white">
                    {memberCount}
                  </span>
                </div>

                <div className="p-5 sm:p-6">
                  {!user && (
                    <div className="rounded-xl bg-gradient-to-br from-gray-50 to-gray-100/50 border border-gray-100 p-8 text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white shadow-sm border border-gray-100 mb-3">
                        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-500">
                        <Link to="/login" className="text-emerald-600 font-semibold hover:text-emerald-700 transition-colors">{t('loginToSeeMembers')}</Link> {t('loginToSeeMembersSuffix')}
                      </p>
                    </div>
                  )}

                  {user && canSeePrijave && prijave.length === 0 && (
                    <div className="rounded-xl bg-gradient-to-br from-gray-50 to-gray-100/50 border border-gray-100 p-8 text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white shadow-sm border border-gray-100 mb-3">
                        <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-400">{t('noRegisteredMembersYet')}</p>
                    </div>
                  )}

                  {user && !canSeePrijave && !isLimitedView && (
                    <div className="rounded-xl bg-gradient-to-br from-sky-50/80 to-gray-50 border border-sky-100/80 p-5 space-y-3">
                      <p className="text-sm text-gray-600 leading-relaxed">
                        Potpun spisak prijavljenih nije dostupan za ovu akciju. Ukupno prijavljenih:{' '}
                        <span className="font-semibold text-gray-900">{akcija.prijaveCount ?? 0}</span>.
                      </p>
                    </div>
                  )}

                  {user && canSeePrijave && !isLimitedView && prijave.length > 0 && (
                    <div className="space-y-2">
                      {prijave.map((p) => {
                        const displayName = p.fullName?.trim() ? p.fullName : p.korisnik || 'Nepoznat'
                        const initial = displayName.charAt(0).toUpperCase()
                        const statusCls = STATUS_STYLE[p.status] || 'bg-gray-100 text-gray-500 border-gray-200'
                        const avatar = p.avatarUrl || (p as any).avatar_url

                        return (
                          <div
                            key={p.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl bg-gray-50/60 border border-gray-100 hover:border-emerald-200/60 hover:bg-emerald-50/20 transition-all duration-200"
                          >
                            <Link
                              to={`/korisnik/${p.korisnik}`}
                              className="flex items-center gap-3 min-w-0 hover:no-underline group"
                            >
                              <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm ring-2 ring-white shadow-sm flex-shrink-0">
                                {avatar ? (
                                  <img src={avatar} alt={displayName} className="absolute inset-0 w-full h-full object-cover" />
                                ) : null}
                                <span className={avatar ? 'invisible' : ''}>{initial}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-emerald-600 transition-colors">
                                  {displayName}
                                </p>
                                <p className="text-[11px] text-gray-400 font-medium">
                                  @{p.korisnik} · {formatDateTime(p.prijavljenAt)}
                                </p>
                              </div>
                            </Link>

                            <div className="flex items-center gap-2 flex-wrap justify-end">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${statusCls}`}>
                                {prijavaStatusLabel(p.status, t)}
                              </span>
                              {canManageHost && !akcija.isCompleted && (
                                <div className="flex gap-1.5 items-center">
                                  {p.status === 'prijavljen' && (
                                    <>
                                      <button
                                        onClick={() => handleUpdateStatus(p.id, 'popeo se')}
                                        className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-sm"
                                        title={t('markClimbed')}
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                      </button>
                                      <button
                                        onClick={() => handleUpdateStatus(p.id, 'nije uspeo')}
                                        className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-rose-500 text-white hover:bg-rose-600 transition-colors shadow-sm"
                                        title={t('markFailed')}
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                      </button>
                                    </>
                                  )}
                                  <button
                                    onClick={() => handleRemoveFromAction(p.id, displayName)}
                                    className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-gray-200 text-gray-600 hover:bg-rose-100 hover:text-rose-600 transition-colors shadow-sm"
                                    title={t('removeFromAction')}
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {user && canSeePrijave && canManageHost && akcija.isCompleted && !isLimitedView && (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-2.5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Dodaj clana koji se uspesno popeo
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2.5">
                        <div className="flex-1">
                          <Dropdown
                            aria-label="Izaberi clana za dodavanje na zavrsenu akciju"
                            className="z-[60]"
                            options={[
                              { value: '', label: 'Izaberi clana' },
                              ...membersToAdd.map((m) => ({
                                value: String(m.id),
                                label: `${m.fullName?.trim() || m.username} (@${m.username})`,
                              })),
                            ]}
                            value={selectedMemberId}
                            onChange={setSelectedMemberId}
                            fullWidth
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleAddCompletedMember}
                          disabled={!selectedMemberId || addingMember}
                          className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          {addingMember ? 'Dodajem...' : 'Dodaj'}
                        </button>
                      </div>
                      {membersToAdd.length === 0 && (
                        <p className="text-xs text-gray-500">Svi clanovi kluba su vec oznaceni kao uspesno popeo se.</p>
                      )}
                      {addingMemberError && (
                        <p className="text-xs text-rose-600">{addingMemberError}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: sidebar */}
            <div className="space-y-6">

              {/* Status card */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2.5">
                  <div className="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
                  <h3 className="text-sm font-bold text-gray-900 tracking-tight">{t('statusTitle')}</h3>
                </div>
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    {akcija.isCompleted ? (
                      <>
                        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{t('completed')}</p>
                          <p className="text-[11px] text-gray-400">{t('completedHint')}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{t('activeHintTitle')}</p>
                          <p className="text-[11px] text-gray-400">{t('activeHint')}</p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Quick stats in sidebar */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-gray-50/80 border border-gray-100">
                      <span className="text-[11px] text-gray-500 font-medium">{t('registeredCountLabel')}</span>
                      <span className="text-sm font-bold text-gray-900">{memberCount}</span>
                    </div>
                    {akcija.isCompleted && user && canManageHost && (
                      <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-emerald-50/80 border border-emerald-100">
                        <span className="text-[11px] text-emerald-600 font-medium">{t('climbedCountLabel')}</span>
                        <span className="text-sm font-bold text-emerald-700">{uspesnoPopeli.length}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {showSummitImageCard && (
                <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden ring-1 ring-emerald-500/10">
                  <div className="px-5 py-4 border-b border-emerald-50 flex items-center gap-2.5 bg-gradient-to-r from-emerald-50/80 to-teal-50/40">
                    <div className="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-500 to-teal-600" />
                    <h3 className="text-sm font-bold text-gray-900 tracking-tight">{t('summitImageTitle')}</h3>
                  </div>
                  <div className="p-5 space-y-4">
                    <p className="text-[11px] text-gray-500 leading-relaxed">{t('summitImageSubtitle')}</p>
                    <button
                      type="button"
                      onClick={openSummitShareModal}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-500 hover:from-emerald-400 hover:via-teal-500 hover:to-emerald-400 shadow-md shadow-emerald-200/50 border border-emerald-400/30 transition-all"
                    >
                      <svg className="w-5 h-5 shrink-0 opacity-95" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      {t('summitShareButton')}
                    </button>
                  </div>
                </div>
              )}

              {/* ══════════ ADMIN CONTROLS (samo domaćin kluba) ══════════ */}
              {canManageHost && !isLimitedView && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2.5">
                    <div className="w-1 h-5 rounded-full bg-gradient-to-b from-amber-400 to-orange-500" />
                    <h3 className="text-sm font-bold text-gray-900 tracking-tight">{t('managementTitle')}</h3>
                  </div>
                  <div className="p-4 space-y-2">
                    {!akcija.isCompleted && (
                      <button
                        onClick={handleZavrsiAkciju}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 shadow-sm shadow-emerald-200/50 transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        {t('finishAction')}
                      </button>
                    )}
                    <button
                      onClick={handleEdit}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white border border-gray-200 text-gray-700 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/50 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      {t('editAction')}
                    </button>

                    <div className={`${!akcija.isCompleted ? 'pt-2 mt-2 border-t border-gray-100' : ''} space-y-2`}>
                      {!akcija.isCompleted ? (
                        <button
                          onClick={handlePrintPrePolaska}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white border border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/50 transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                          {t('printPdf')}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={handlePrintPrePolaska}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white border border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/50 transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                            {t('printBeforeDeparture')}
                          </button>
                          <button
                            onClick={handlePrintZavrsena}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white border border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/50 transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                            {t('printCompleted')}
                          </button>
                        </>
                      )}
                    </div>

                    <div className="pt-2 mt-2 border-t border-gray-100">
                      <button
                        onClick={handleDelete}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        {t('deleteAction')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {summitShareOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]"
          role="presentation"
          onClick={closeSummitShareModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="summit-share-title"
            className="relative w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50/90 to-teal-50/50">
              <h2 id="summit-share-title" className="text-sm font-bold text-gray-900 tracking-tight">
                {t('summitShareModalTitle')}
              </h2>
              <button
                type="button"
                onClick={closeSummitShareModal}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-white/80 hover:text-gray-800 transition-colors"
                aria-label={t('summitShareClose')}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              {summitShareStep === 1 && (
                <>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('summitStepChooseFormat')}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSummitPickedAspect('9:16')
                        setSummitShareStep(2)
                      }}
                      className="flex flex-col items-center gap-2 px-3 py-4 rounded-xl text-sm font-bold text-white bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 border border-emerald-400/20 shadow-sm transition-all"
                    >
                      <span className="text-lg font-extrabold tabular-nums">9 : 16</span>
                      <span className="text-[10px] font-semibold opacity-90">{t('summitFormatPortraitHint')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSummitPickedAspect('16:9')
                        setSummitShareStep(2)
                      }}
                      className="flex flex-col items-center gap-2 px-3 py-4 rounded-xl text-sm font-bold text-emerald-800 bg-white border-2 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/80 transition-all"
                    >
                      <span className="text-lg font-extrabold tabular-nums">16 : 9</span>
                      <span className="text-[10px] font-semibold text-emerald-700/80">{t('summitFormatLandscapeHint')}</span>
                    </button>
                  </div>
                </>
              )}

              {summitShareStep === 2 && summitPickedAspect && (
                <>
                  <button
                    type="button"
                    onClick={() => setSummitShareStep(1)}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    {t('summitBack')}
                  </button>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('summitStepChooseLayout')}</p>
                  <p className="text-[11px] text-gray-400 leading-snug">{t('summitPreviewTapHint')}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => void handleSummitPngDownload(summitPickedAspect, 'balanced')}
                      disabled={summitPreviewLoading}
                      className="group flex flex-col gap-2 rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 disabled:pointer-events-none"
                      aria-label={t('summitLayoutBalancedTitle')}
                    >
                      <div className="relative rounded-xl overflow-hidden bg-gradient-to-b from-neutral-700 to-neutral-900 ring-2 ring-white/10 shadow-inner group-hover:ring-emerald-400/80 group-focus-visible:ring-emerald-500 transition-all">
                        {summitPreviewLoading ? (
                          <div
                            className="w-full animate-pulse bg-neutral-600"
                            style={{
                              aspectRatio: summitPickedAspect === '9:16' ? '9 / 16' : '16 / 9',
                              minHeight: 120,
                            }}
                          />
                        ) : summitPreviewBalanced ? (
                          <img
                            src={summitPreviewBalanced}
                            alt=""
                            className="w-full h-auto block"
                            draggable={false}
                          />
                        ) : (
                          <div
                            className="w-full flex items-center justify-center text-[10px] text-neutral-400 p-4"
                            style={{ aspectRatio: summitPickedAspect === '9:16' ? '9 / 16' : '16 / 9' }}
                          >
                            —
                          </div>
                        )}
                      </div>
                      <span className="text-center text-[11px] font-bold text-gray-800 group-hover:text-emerald-700">
                        {t('summitLayoutBalancedTitle')}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSummitPngDownload(summitPickedAspect, 'stacked')}
                      disabled={summitPreviewLoading}
                      className="group flex flex-col gap-2 rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 disabled:pointer-events-none"
                      aria-label={t('summitLayoutStackedTitle')}
                    >
                      <div className="relative rounded-xl overflow-hidden bg-gradient-to-b from-neutral-700 to-neutral-900 ring-2 ring-white/10 shadow-inner group-hover:ring-emerald-400/80 group-focus-visible:ring-emerald-500 transition-all">
                        {summitPreviewLoading ? (
                          <div
                            className="w-full animate-pulse bg-neutral-600"
                            style={{
                              aspectRatio: summitPickedAspect === '9:16' ? '9 / 16' : '16 / 9',
                              minHeight: 120,
                            }}
                          />
                        ) : summitPreviewStacked ? (
                          <img
                            src={summitPreviewStacked}
                            alt=""
                            className="w-full h-auto block"
                            draggable={false}
                          />
                        ) : (
                          <div
                            className="w-full flex items-center justify-center text-[10px] text-neutral-400 p-4"
                            style={{ aspectRatio: summitPickedAspect === '9:16' ? '9 / 16' : '16 / 9' }}
                          >
                            —
                          </div>
                        )}
                      </div>
                      <span className="text-center text-[11px] font-bold text-gray-800 group-hover:text-emerald-700">
                        {t('summitLayoutStackedTitle')}
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════════════ */

function StatCell({ icon, value, unit, label }: { icon: React.ReactNode; value: string; unit?: string; label: string }) {
  return (
    <div className="flex flex-col items-center py-4 gap-1.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-sm sm:text-base font-extrabold text-gray-900 leading-none">
          {value}
          {unit && <span className="text-xs font-semibold text-emerald-500 ml-0.5">{unit}</span>}
        </span>
      </div>
      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{label}</p>
    </div>
  )
}

function InfoRow({ icon, iconBg, label, value }: { icon: React.ReactNode; iconBg: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`shrink-0 h-9 w-9 rounded-xl ${iconBg} flex items-center justify-center`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
        <p className="text-sm font-semibold text-gray-900 truncate">{value}</p>
      </div>
    </div>
  )
}
