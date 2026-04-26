import { useParams, Link, useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import ProfileActionButtons from '../../components/buttons/ProfileActionButtons'
import FollowControls from '../../components/buttons/FollowControls'
import BlockUserButton from '../../components/buttons/BlockUserButton'
import FollowListModal, { type FollowListUser } from '../../components/modals/FollowListModal'
import { getRoleLabel, getRoleStyle, hasVisibleRole } from '../../utils/roleUtils'
import { generateMemberPdf, type MemberPdfData } from '../../utils/generateMemberPdf'
import { formatDate, formatDateShort } from '../../utils/dateUtils'
import { useRanking } from '../../hooks/useRanking'
import { computeMMRForAkcija, computeRank, formatRankDisplayName, mapAkcijaToTura, type AkcijaZaRanking } from '../../utils/rankingUtils'
import { AkcijaImageOrFallback } from '../../components/AkcijaImageFallback'
import { tezinaLabel } from '../../utils/difficultyI18n'
import type { TFunction } from 'i18next'
import { EllipsisHorizontalIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface UspesnaAkcija {
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
  duzinaStazeKm?: number
  kumulativniUsponM?: number
  visinaVrhM?: number
  zimskiUspon?: boolean
}

interface Korisnik {
  id: number
  username: string
  fullName?: string
  avatar_url?: string
  klubId?: number
  cover_image_url?: string
  cover_position_y?: number
  /** Vertikalni fokus na uskom ekranu (&lt; md); ako nije sačuvan, koristi se cover_position_y. */
  cover_position_y_mobile?: number
  email?: string
  telefon?: string
  role: '' | 'superadmin' | 'admin' | 'clan' | 'vodic' | 'blagajnik' | 'sekretar' | 'menadzer-opreme'
  createdAt: string
  updatedAt: string
  ukupnoKm: number
  ukupnoMetaraUspona: number
  brojPopeoSe: number
  klubNaziv?: string
  klubLogoUrl?: string
}

const TEZINA_BORDER: Record<string, { bg: string; text: string; border: string }> = {
  lako: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  srednje: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  tesko: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  teško: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  alpinizam: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
}

function tzProfile(raw: string | undefined, t: TFunction) {
  const fallback = {
    bg: 'bg-gray-50',
    text: 'text-gray-500',
    border: 'border-gray-200',
    label: tezinaLabel(raw, t),
  }
  if (!raw) return fallback
  const k = raw.toLowerCase()
  const row = TEZINA_BORDER[k]
  if (row) return { ...row, label: tezinaLabel(raw, t) }
  return fallback
}

/** Isti breakpoint kao Tailwind `md:` — cover na širem ekranu koristi drugačiju sačuvanu poziciju. */
const COVER_MD_MEDIA = '(min-width: 768px)'

function useIsMdUpForCover() {
  const [mdUp, setMdUp] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(COVER_MD_MEDIA)
    const apply = () => setMdUp(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  return mdUp
}

/* ────────────────────────────────────────────────────────────────────── */

export default function UserProfile() {
  const { t, i18n } = useTranslation('userProfile')
  const { id, username } = useParams<{ id?: string; username?: string }>()
  const { user: currentUser } = useAuth()
  const navigate = useNavigate()

  const [korisnik, setKorisnik] = useState<Korisnik | null>(null)
  const [akcije, setAkcije] = useState<UspesnaAkcija[]>([])
  const [stats, setStats] = useState({ ukupnoKm: 0, ukupnoMetaraUspona: 0, brojPopeoSe: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [avatarFail, setAvatarFail] = useState(false)
  const [top30, setTop30] = useState<number | null>(null)
  const isMdUp = useIsMdUpForCover()
  const [coverYDesktop, setCoverYDesktop] = useState(0.5)
  const [coverYMobile, setCoverYMobile] = useState(0.5)
  const [positioning, setPositioning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)
  const [avatarUpdating, setAvatarUpdating] = useState(false)
  const [avatarLightboxOpen, setAvatarLightboxOpen] = useState(false)
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false)
  const [mobileActionsAnchor, setMobileActionsAnchor] = useState({ top: 68, left: 0 })

  const [followCounts, setFollowCounts] = useState<{ following: number; followers: number }>({ following: 0, followers: 0 })
  const [blockedEither, setBlockedEither] = useState(false)
  const [followModalOpen, setFollowModalOpen] = useState(false)
  const [followModalMode, setFollowModalMode] = useState<'following' | 'followers'>('following')
  const [followModalUsers, setFollowModalUsers] = useState<FollowListUser[]>([])
  const [followModalLoading, setFollowModalLoading] = useState(false)

  const rank = useRanking({
    uspesneAkcije: akcije,
    ukupnoKm: stats.ukupnoKm,
    ukupnoMetaraUspona: stats.ukupnoMetaraUspona,
    createdAt: korisnik?.createdAt,
  })

  const fetchFollowCounts = useCallback(async () => {
    if (!korisnik?.id) return
    try {
      const r = await api.get(`/api/follows/user/${korisnik.id}/counts`)
      const d = r.data as { following?: number; followers?: number }
      setFollowCounts({ following: d.following ?? 0, followers: d.followers ?? 0 })
    } catch {
      setFollowCounts({ following: 0, followers: 0 })
    }
  }, [korisnik?.id])

  /* ── data fetching ── */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const idOrUsername = id ?? username
        if (!idOrUsername) { setError(t('notFound')); setLoading(false); return }

        const [rK, rS, rA] = await Promise.all([
          api.get(`/api/korisnici/${encodeURIComponent(idOrUsername)}`),
          api.get(`/api/korisnici/${encodeURIComponent(idOrUsername)}/statistika`),
          api.get(`/api/korisnici/${encodeURIComponent(idOrUsername)}/popeo-se`),
        ])
        if (cancelled) return

        const k = rK.data as Korisnik
        setKorisnik(k)
        if (!username && k.username) navigate(`/korisnik/${k.username}`, { replace: true })

        const s = rS.data.statistika || {}
        setStats({ ukupnoKm: s.ukupnoKm || 0, ukupnoMetaraUspona: s.ukupnoMetaraUspona || 0, brojPopeoSe: s.brojPopeoSe || 0 })
        setAkcije(rA.data.uspesneAkcije || [])
      } catch (e: any) {
        if (!cancelled) setError(e.response?.data?.error || t('loadError'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id, username, navigate])

  useEffect(() => { setAvatarFail(false) }, [id, username])

  useEffect(() => {
    if (!korisnik?.id || !currentUser) { setTop30(null); return }
    let cancelled = false
    ;(async () => {
      try {
        const r = await api.get('/api/korisnici')
        const baseUsers = (r.data.korisnici || []) as Array<{ id: number; ukupnoKm?: number; ukupnoMetaraUspona?: number }>
        const rankedUsers = await Promise.all(
          baseUsers.map(async (k) => {
            try {
              const actionsRes = await api.get<{ uspesneAkcije?: AkcijaZaRanking[] }>(`/api/korisnici/${k.id}/popeo-se`)
              const akcije = actionsRes.data.uspesneAkcije || []
              const rank = computeRank({
                ture: akcije.map(mapAkcijaToTura),
                ukupnoKm: k.ukupnoKm ?? 0,
                ukupnoMetaraUspona: k.ukupnoMetaraUspona ?? 0,
                createdAt: (k as { createdAt?: string }).createdAt,
              })
              return { ...k, rank }
            } catch {
              return {
                ...k,
                rank: computeRank({
                  ukupnoKm: k.ukupnoKm ?? 0,
                  ukupnoMetaraUspona: k.ukupnoMetaraUspona ?? 0,
                  createdAt: (k as { createdAt?: string }).createdAt,
                }),
              }
            }
          })
        )
        if (cancelled) return
        const sorted = rankedUsers.sort((a, b) => b.rank.mmr - a.rank.mmr)
        const idx = sorted.findIndex(k => k.id === korisnik.id)
        setTop30(idx >= 0 && idx < 30 ? idx + 1 : null)
      } catch {
        if (!cancelled) setTop30(null)
      }
    })()
    return () => { cancelled = true }
  }, [korisnik?.id, currentUser])

  useEffect(() => {
    void fetchFollowCounts()
  }, [fetchFollowCounts])

  useEffect(() => {
    if (!korisnik) return
    const d = korisnik.cover_position_y ?? 0.5
    const m = korisnik.cover_position_y_mobile != null ? korisnik.cover_position_y_mobile : d
    setCoverYDesktop(d)
    setCoverYMobile(m)
  }, [korisnik])

  /* ── derived ── */
  const isOwn = currentUser?.username === korisnik?.username
  const hasCover = !!korisnik?.cover_image_url
  const initial = (korisnik?.fullName || korisnik?.username || '?').charAt(0).toUpperCase()
  const showRoleBadge = !!korisnik && hasVisibleRole(korisnik.role) && (korisnik.role === 'superadmin' || !!korisnik.klubNaziv)
  const sameClub = !!currentUser && typeof currentUser.klubId === 'number' && typeof korisnik?.klubId === 'number' && currentUser.klubId === korisnik.klubId
  const isSuperadmin = currentUser?.role === 'superadmin'
  const isClubAdminOrSecretary = currentUser?.role === 'admin' || currentUser?.role === 'sekretar'
  const canSeeMobileActionsMenu = !!isOwn || !!isSuperadmin || (!!isClubAdminOrSecretary && sameClub)

  const coverInputRef = useRef<HTMLInputElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null)

  const openFollowModal = async (mode: 'following' | 'followers') => {
    if (!korisnik?.id || !currentUser) return
    setFollowModalMode(mode)
    setFollowModalOpen(true)
    setFollowModalLoading(true)
    setFollowModalUsers([])
    try {
      const endpoint = mode === 'following'
        ? `/api/follows/user/${korisnik.id}/following`
        : `/api/follows/user/${korisnik.id}/followers`
      const res = await api.get(endpoint)
      const users = ((res.data as { users?: FollowListUser[] }).users || [])
      setFollowModalUsers(users)
    } catch {
      setFollowModalUsers([])
    } finally {
      setFollowModalLoading(false)
    }
  }

  const saveCoverPos = async (variant: 'desktop' | 'mobile') => {
    setSaving(true)
    try {
      if (variant === 'desktop') {
        await api.patch('/api/me/cover-position', { coverPositionY: coverYDesktop })
        setKorisnik((k) => (k ? { ...k, cover_position_y: coverYDesktop } : null))
      } else {
        await api.patch('/api/me/cover-position', { coverPositionYMobile: coverYMobile })
        setKorisnik((k) => (k ? { ...k, cover_position_y_mobile: coverYMobile } : null))
      }
      setPositioning(false)
    } catch {
      /* ignore */
    } finally {
      setSaving(false)
    }
  }

  const handleCoverImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !korisnik) return
    if (!file.type.startsWith('image/')) return
    setCoverUploading(true)
    try {
      const formData = new FormData()
      formData.append('coverImage', file)
      const res = await api.patch('/api/me/cover', formData)
      const url = (res.data as { cover_image_url?: string }).cover_image_url
      if (url) {
        setKorisnik((k) => (k ? { ...k, cover_image_url: url } : null))
        setPositioning(false)
      }
    } catch { /* ignore */ }
    finally {
      setCoverUploading(false)
      e.target.value = ''
    }
  }

  const handleRemoveCover = async () => {
    if (!korisnik?.cover_image_url) return
    setCoverUploading(true)
    try {
      const formData = new FormData()
      formData.append('removeCover', '1')
      await api.patch('/api/me/cover', formData)
      setKorisnik((k) => (k ? { ...k, cover_image_url: '' } : null))
      setPositioning(false)
    } catch {
      /* ignore */
    } finally {
      setCoverUploading(false)
    }
  }

  const handleAvatarImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !isOwn) return
    if (!file.type.startsWith('image/')) return
    setAvatarUpdating(true)
    try {
      const formData = new FormData()
      formData.append('avatar', file)
      const res = await api.patch('/api/me/avatar', formData)
      const avatarUrl = (res.data as { avatar_url?: string }).avatar_url
      if (avatarUrl) {
        setKorisnik((k) => (k ? { ...k, avatar_url: avatarUrl } : null))
      }
    } catch {
      /* ignore */
    } finally {
      setAvatarUpdating(false)
      e.target.value = ''
    }
  }

  const handleRemoveAvatar = async () => {
    if (!isOwn || !korisnik?.avatar_url) return
    setAvatarUpdating(true)
    try {
      const formData = new FormData()
      formData.append('removeAvatar', '1')
      await api.patch('/api/me/avatar', formData)
      setKorisnik((k) => (k ? { ...k, avatar_url: '' } : null))
      setAvatarLightboxOpen(false)
    } catch {
      /* ignore */
    } finally {
      setAvatarUpdating(false)
    }
  }

  const cancelCoverPositioning = () => {
    if (korisnik) {
      const d = korisnik.cover_position_y ?? 0.5
      const m = korisnik.cover_position_y_mobile != null ? korisnik.cover_position_y_mobile : d
      setCoverYDesktop(d)
      setCoverYMobile(m)
    }
    setPositioning(false)
  }

  const updateMobileActionsAnchor = useCallback(() => {
    const el = mobileMenuButtonRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setMobileActionsAnchor({
      top: rect.bottom + 8,
      left: rect.left + rect.width / 18,
    })
  }, [])

  useEffect(() => {
    if (!positioning) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [positioning])

  useEffect(() => {
    if (!avatarLightboxOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAvatarLightboxOpen(false)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [avatarLightboxOpen])

  useEffect(() => {
    if (!mobileActionsOpen) return
    updateMobileActionsAnchor()
    window.addEventListener('resize', updateMobileActionsAnchor)
    window.addEventListener('scroll', updateMobileActionsAnchor, true)
    return () => {
      window.removeEventListener('resize', updateMobileActionsAnchor)
      window.removeEventListener('scroll', updateMobileActionsAnchor, true)
    }
  }, [mobileActionsOpen, updateMobileActionsAnchor])

  /* ── loading / error ── */
  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-emerald-500 border-t-transparent" />
    </div>
  )
  if (error || !korisnik) return (
    <div className="flex flex-col items-center justify-center py-32 gap-3">
      <div className="h-14 w-14 rounded-2xl bg-red-50 flex items-center justify-center">
        <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      </div>
      <p className="text-sm text-gray-500 font-medium">{error || t('notFound')}</p>
    </div>
  )

  const rankColor = rank.boja === '#000000' ? '#FFD700' : '#fff'
  const coverYVisible = isMdUp ? coverYDesktop : coverYMobile

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 pb-12">

      {/* ══════════ COVER ══════════ */}
      <div className="relative h-56 sm:h-44 md:h-64 lg:h-80 xl:h-96 overflow-hidden select-none group/cover -mt-6 w-screen left-1/2 -translate-x-1/2">
        {hasCover ? (
          <img
            src={korisnik.cover_image_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover transition-[object-position] duration-300 pointer-events-none"
            style={{ objectPosition: `center ${coverYVisible * 100}%` }}
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-emerald-900/80 to-teal-800" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none" />

        {/* Gornji desni ugao: mobilni meni (3 tačke) + desktop akcije */}
        <div className="absolute top-4 right-3 sm:top-3 sm:right-6 md:top-6 md:right-12 z-[260] flex flex-row-reverse items-center gap-2 flex-wrap justify-end pointer-events-auto max-w-[calc(100vw-5rem)]">
          <div className="hidden sm:flex">
            <ProfileActionButtons
              inline
              userId={String(korisnik.id)}
              isOwnProfile={!!isOwn}
              currentUser={currentUser}
              onPrintClick={() =>
                generateMemberPdf({
                  ...(korisnik as unknown as MemberPdfData),
                  clubName: korisnik.klubNaziv || '',
                })
              }
            >
              {!isOwn && currentUser && (
                <FollowControls targetId={korisnik.id} hidden={blockedEither} onStatusChange={fetchFollowCounts} />
              )}
              {!isOwn && currentUser && (
                <BlockUserButton
                  targetId={korisnik.id}
                  onBlockChange={(byMe, byThem) => setBlockedEither(byMe || byThem)}
                />
              )}
            </ProfileActionButtons>
          </div>
          {canSeeMobileActionsMenu && (
            <div className="relative sm:hidden z-[270]">
            <button
              ref={mobileMenuButtonRef}
              type="button"
              onClick={() => {
                if (!mobileActionsOpen) updateMobileActionsAnchor()
                setMobileActionsOpen((v) => !v)
              }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-md text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-transform duration-200 active:scale-95"
              aria-label={mobileActionsOpen ? t('close') : 'Otvori meni akcija'}
              aria-expanded={mobileActionsOpen}
            >
              <span className={`inline-flex transition-transform duration-200 ${mobileActionsOpen ? 'rotate-90' : ''}`}>
                {mobileActionsOpen ? <XMarkIcon className="h-6 w-6" /> : <EllipsisHorizontalIcon className="h-6 w-6" />}
              </span>
            </button>
            </div>
          )}
        </div>

        {/* Gornji levi ugao: otvara panel za cover opcije + poziciju */}
        {isOwn && !positioning && (
          <>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCoverImageChange}
            />
            <button
              type="button"
              onClick={() => setPositioning(true)}
              disabled={coverUploading}
              title={hasCover ? t('cover.replace') : t('cover.add')}
              aria-label={hasCover ? t('cover.replace') : t('cover.add')}
              className="absolute top-4 left-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm border border-white/25 shadow-sm hover:bg-black/50 active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed md:opacity-0 md:group-hover/cover:opacity-100 opacity-100"
            >
              {coverUploading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" />
              ) : (
                <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              )}
            </button>
          </>
        )}

        {/* Desktop: overlay preko covera (md+) */}
        {positioning && (
          <div
            className="hidden md:flex absolute inset-0 z-20 flex-col items-center justify-center gap-4 bg-black/50 backdrop-blur-sm px-4 py-6"
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                disabled={coverUploading}
                className="min-h-11 px-5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-bold transition disabled:opacity-50"
              >
                {hasCover ? t('cover.replace') : t('cover.add')}
              </button>
              {hasCover && (
                <button
                  type="button"
                  onClick={handleRemoveCover}
                  disabled={coverUploading}
                  className="min-h-11 px-5 rounded-xl bg-rose-500/80 hover:bg-rose-600 text-white text-sm font-bold transition disabled:opacity-50"
                >
                  Ukloni cover
                </button>
              )}
            </div>
            <p className="text-white text-center text-sm font-semibold">{t('cover.desktopTitle')}</p>
            <p className="text-white/60 text-center text-[11px] -mt-2 max-w-xs">
              {t('cover.desktopHint')}
            </p>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={coverYDesktop}
              onChange={(e) => setCoverYDesktop(parseFloat(e.target.value))}
              className="w-full max-w-[min(100%,20rem)] accent-emerald-400 cursor-pointer"
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCoverYDesktop((y: number) => Math.max(0, Math.round((y - 0.05) * 100) / 100))}
                className="min-h-11 min-w-11 rounded-xl bg-white/20 text-white text-lg font-bold hover:bg-white/30 active:bg-white/25"
                aria-label={t('cover.moveUp')}
              >
                −
              </button>
              <span className="text-white/70 text-xs tabular-nums w-12 text-center">{Math.round(coverYDesktop * 100)}%</span>
              <button
                type="button"
                onClick={() => setCoverYDesktop((y: number) => Math.min(1, Math.round((y + 0.05) * 100) / 100))}
                className="min-h-11 min-w-11 rounded-xl bg-white/20 text-white text-lg font-bold hover:bg-white/30 active:bg-white/25"
                aria-label={t('cover.moveDown')}
              >
                +
              </button>
            </div>
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => saveCoverPos('desktop')}
                disabled={saving}
                className="min-h-11 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold shadow-lg transition disabled:opacity-50"
              >
                {saving ? t('cover.saving') : t('save')}
              </button>
              <button
                type="button"
                onClick={cancelCoverPositioning}
                className="min-h-11 px-6 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-bold transition"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobilni dropdown akcija — van cover div-a (cover ima transform pa lomi position:fixed) */}
      {mobileActionsOpen && canSeeMobileActionsMenu && (
        <div className="sm:hidden fixed inset-0 z-[290]">
          <button
            type="button"
            className="absolute inset-0 bg-transparent"
            aria-label={t('close')}
            onClick={() => setMobileActionsOpen(false)}
          />
          <div
            className="absolute mobile-actions-dropdown"
            style={{ top: mobileActionsAnchor.top, left: mobileActionsAnchor.left, transform: 'translateX(calc(-60% - 58px))' }}
            onClick={() => window.setTimeout(() => setMobileActionsOpen(false), 0)}
          >
            <ProfileActionButtons
              inline
              userId={String(korisnik.id)}
              isOwnProfile={!!isOwn}
              currentUser={currentUser}
              onPrintClick={() =>
                generateMemberPdf({
                  ...(korisnik as unknown as MemberPdfData),
                  clubName: korisnik.klubNaziv || '',
                })
              }
              direction="column"
              actionOrder={['print', 'info', 'settings']}
              actionClassName="!bg-emerald-600 !text-white hover:!bg-emerald-700 hover:!text-white ring-2 ring-white/40 shadow-xl"
              className=""
            />
          </div>
        </div>
      )}

      {/* Mobilni: donji sheet — van cover div-a da fixed radi (cover ima transform) */}
      {positioning && isOwn && (
        <div
          className="md:hidden fixed inset-0 z-[200] flex flex-col justify-end"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cover-pos-sheet-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label={t('close')}
            onClick={cancelCoverPositioning}
          />
          <div
            className="relative z-10 rounded-t-2xl bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.18)] border-t border-gray-100 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] max-h-[min(55vh,420px)] flex flex-col gap-3 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto h-1 w-10 rounded-full bg-gray-200 shrink-0" aria-hidden />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                disabled={coverUploading}
                className="min-h-11 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
              >
                {hasCover ? t('cover.replace') : t('cover.add')}
              </button>
              <button
                type="button"
                onClick={handleRemoveCover}
                disabled={coverUploading || !hasCover}
                className="min-h-11 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold hover:bg-rose-100 disabled:opacity-40"
              >
                Ukloni cover
              </button>
            </div>
            <h2 id="cover-pos-sheet-title" className="text-center text-sm font-bold text-gray-900">
              {t('cover.mobileTitle')}
            </h2>
            <p className="text-center text-[11px] text-gray-500 -mt-1">
              {t('cover.mobileHint')}
            </p>
            {hasCover && (
              <>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={coverYMobile}
                  onChange={(e) => setCoverYMobile(parseFloat(e.target.value))}
                  className="w-full h-12 accent-emerald-600 cursor-pointer touch-pan-y"
                />
                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => setCoverYMobile((y: number) => Math.max(0, Math.round((y - 0.05) * 100) / 100))}
                    className="min-h-12 min-w-12 rounded-xl bg-gray-100 text-gray-800 text-xl font-bold hover:bg-gray-200 active:bg-gray-300"
                    aria-label={t('cover.moveUp')}
                  >
                    −
                  </button>
                  <span className="text-gray-600 text-sm tabular-nums font-semibold w-14 text-center">{Math.round(coverYMobile * 100)}%</span>
                  <button
                    type="button"
                    onClick={() => setCoverYMobile((y: number) => Math.min(1, Math.round((y + 0.05) * 100) / 100))}
                    className="min-h-12 min-w-12 rounded-xl bg-gray-100 text-gray-800 text-xl font-bold hover:bg-gray-200 active:bg-gray-300"
                    aria-label={t('cover.moveDown')}
                  >
                    +
                  </button>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={cancelCoverPositioning}
                    className="flex-1 min-h-12 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => saveCoverPos('mobile')}
                    disabled={saving}
                    className="flex-1 min-h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50"
                  >
                    {saving ? t('cover.saving') : t('save')}
                  </button>
                </div>
              </>
            )}
            {!hasCover && (
              <button
                type="button"
                onClick={cancelCoverPositioning}
                className="w-full min-h-12 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50"
              >
                {t('cancel')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ══════════ PROFILE HEADER ══════════ */}
      <div className="relative bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4 sm:gap-5 -mt-12 sm:-mt-14 pb-6">

            {/* mobile layout */}
            <div className="sm:hidden">
              <div className="flex items-center gap-3">
                {/* avatar — klik otvara punu sliku (izmena profila: zupčanik gore na coveru) */}
                <div className="relative w-20 h-20 flex-shrink-0">
                  {korisnik.avatar_url && !avatarFail ? (
                    <button
                      type="button"
                      onClick={() => setAvatarLightboxOpen(true)}
                      className="relative h-full w-full rounded-full overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 ring-[3px] ring-white shadow-xl cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                      aria-label={t('cover.showAvatarFull')}
                      title={t('cover.clickForFull')}
                    >
                      <img
                        src={korisnik.avatar_url}
                        alt={korisnik.fullName || korisnik.username || ''}
                        className="absolute inset-0 h-full w-full object-cover select-none"
                        draggable={false}
                        onError={() => setAvatarFail(true)}
                      />
                    </button>
                  ) : (
                    <div className="relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-3xl font-bold text-white ring-[3px] ring-white shadow-xl">
                      <span>{initial}</span>
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-lg font-extrabold text-gray-900 tracking-tight truncate leading-tight">
                    {korisnik.fullName || korisnik.username}
                  </p>
                  <p className="text-[13px] text-gray-400 font-semibold truncate -mt-0.5">@{korisnik.username}</p>
                  <div className="flex items-center gap-2 text-[11px] text-gray-400 font-medium mt-1">
                    <svg className="h-3.5 w-3.5 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M4 11h16M5 5h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
                    </svg>
                    <span className="truncate">{t('memberSince')} {formatDate(korisnik.createdAt)}</span>
                  </div>
                </div>

                {showRoleBadge && (
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`inline-flex items-center px-2 py-[3px] rounded-lg text-[10px] font-extrabold tracking-wide uppercase ring-1 ring-inset ring-black/5 ${getRoleStyle(korisnik.role)}`}>
                      {getRoleLabel(korisnik.role)}
                    </span>
                  </div>
                )}
              </div>

              {/* contact pills */}
              {currentUser && (korisnik.email || korisnik.telefon) && (
                <div className="flex flex-wrap items-center justify-start gap-2 mt-3">
                  {korisnik.email && (
                    <a href={`mailto:${korisnik.email}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/60 text-[11px] text-gray-500 hover:text-emerald-700 font-medium transition-all">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                      {korisnik.email}
                    </a>
                  )}
                  {korisnik.telefon && (
                    <a href={`tel:${korisnik.telefon}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/60 text-[11px] text-gray-500 hover:text-emerald-700 font-medium transition-all">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
                      {korisnik.telefon}
                    </a>
                  )}
                </div>
              )}

              {korisnik.klubNaziv && (
                <div className="mt-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-lg text-[10px] font-extrabold tracking-wide bg-violet-50 text-violet-700 border border-violet-100">
                    {korisnik.klubLogoUrl ? (
                      <img src={korisnik.klubLogoUrl} alt="" className="w-3.5 h-3.5 rounded-sm object-cover" />
                    ) : (
                      <svg className="w-3 h-3 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                      </svg>
                    )}
                    <span className="truncate">{korisnik.klubNaziv}</span>
                  </span>
                </div>
              )}
            </div>

            {/* desktop/tablet layout (existing) */}
            <div className="hidden sm:flex w-full items-end gap-4 sm:gap-5">
              {/* avatar — klik otvara punu sliku (izmena profila: zupčanik gore na coveru) */}
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0">
                {korisnik.avatar_url && !avatarFail ? (
                  <button
                    type="button"
                    onClick={() => setAvatarLightboxOpen(true)}
                    className="relative h-full w-full rounded-full overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 ring-[3px] ring-white shadow-xl cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                    aria-label={t('cover.showAvatarFull')}
                    title={t('cover.clickForFull')}
                  >
                    <img
                      src={korisnik.avatar_url}
                      alt={korisnik.fullName || korisnik.username || ''}
                      className="absolute inset-0 h-full w-full object-cover select-none"
                      draggable={false}
                      onError={() => setAvatarFail(true)}
                    />
                  </button>
                ) : (
                  <div className="relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-4xl font-bold text-white ring-[3px] ring-white shadow-xl">
                    <span>{initial}</span>
                  </div>
                )}
              </div>

              {/* identity */}
              <div className="flex-1 min-w-0 text-left pb-0.5">
                <div className="flex flex-col items-start gap-1">
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 tracking-tight truncate leading-tight">
                    {korisnik.fullName || korisnik.username}
                  </h1>

                  <div className="flex flex-wrap items-center justify-start gap-2 mt-0.5">
                    <span className="text-[13px] text-gray-400 font-semibold">@{korisnik.username}</span>
                    {showRoleBadge && (
                      <span className={`inline-flex items-center px-2 py-[3px] rounded-lg text-[10px] font-extrabold tracking-wide uppercase ring-1 ring-inset ring-black/5 ${getRoleStyle(korisnik.role)}`}>
                        {getRoleLabel(korisnik.role)}
                      </span>
                    )}
                    {korisnik.klubNaziv && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-lg text-[10px] font-extrabold tracking-wide bg-violet-50 text-violet-700 border border-violet-100">
                        {korisnik.klubLogoUrl ? (
                          <img src={korisnik.klubLogoUrl} alt="" className="w-3.5 h-3.5 rounded-sm object-cover" />
                        ) : (
                          <svg className="w-3 h-3 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                          </svg>
                        )}
                        {korisnik.klubNaziv}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-gray-400 font-medium mt-0.5">
                    <span className="inline-flex items-center gap-1">
                      <svg className="h-3.5 w-3.5 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M4 11h16M5 5h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
                      </svg>
                      {t('memberSince')} {formatDate(korisnik.createdAt)}
                    </span>
                  </div>
                </div>

                {/* contact pills */}
                {currentUser && (korisnik.email || korisnik.telefon) && (
                  <div className="flex flex-wrap items-center justify-start gap-2 mt-2.5">
                    {korisnik.email && (
                      <a href={`mailto:${korisnik.email}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/60 text-[11px] text-gray-500 hover:text-emerald-700 font-medium transition-all">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                        {korisnik.email}
                      </a>
                    )}
                    {korisnik.telefon && (
                      <a href={`tel:${korisnik.telefon}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/60 text-[11px] text-gray-500 hover:text-emerald-700 font-medium transition-all">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
                        {korisnik.telefon}
                      </a>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* ══════════ STATS BAR ══════════ */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top row: premium rank + follow mini panel */}
          <div className="py-3 border-b border-gray-50">
            <div className="rounded-2xl border border-gray-100 bg-gradient-to-b from-white to-gray-50/70 shadow-[0_10px_30px_rgba(15,23,42,0.06)] px-3 sm:px-4 py-2.5">
              <div className="flex items-center justify-between gap-2.5">
                <div
                  className="relative inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 overflow-hidden"
                  style={{ backgroundColor: rank.boja, color: rankColor }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />

                  <span className="relative text-xs sm:text-sm font-extrabold tracking-wide">{formatRankDisplayName(rank, top30)}</span>
                  <span className="relative pl-2 ml-1 border-l border-white/25 text-[11px] sm:text-xs font-extrabold tabular-nums">{rank.mmr} MMR</span>
                </div>

                {currentUser ? (
                  <div className="inline-flex items-stretch rounded-xl border border-gray-200/80 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => void openFollowModal('following')}
                      className="group text-center px-3.5 sm:px-5 py-2 hover:bg-emerald-50/60 transition-colors"
                    >
                      <p className="text-sm sm:text-base font-extrabold text-gray-900 group-hover:text-emerald-700 tabular-nums leading-none">
                        {followCounts.following.toLocaleString(i18n.language)}
                      </p>
                      <p className="mt-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400 group-hover:text-emerald-600">
                        {t('following')}
                      </p>
                    </button>
                    <div className="w-px self-stretch bg-gradient-to-b from-transparent via-gray-200 to-transparent" aria-hidden />
                    <button
                      type="button"
                      onClick={() => void openFollowModal('followers')}
                      className="group text-center px-3.5 sm:px-5 py-2 hover:bg-emerald-50/60 transition-colors"
                    >
                      <p className="text-sm sm:text-base font-extrabold text-gray-900 group-hover:text-emerald-700 tabular-nums leading-none">
                        {followCounts.followers.toLocaleString(i18n.language)}
                      </p>
                      <p className="mt-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400 group-hover:text-emerald-600">
                        {t('followers')}
                      </p>
                    </button>
                  </div>
                ) : (
                  <div />
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-gray-100">
            <StatCell value={stats.ukupnoMetaraUspona.toLocaleString(i18n.language)} unit="m" label={t('ascent')} accent="text-emerald-500" />
            <StatCell value={stats.ukupnoKm.toLocaleString(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} unit="km" label={t('trail')} accent="text-sky-500" />
            <StatCell value={String(stats.brojPopeoSe)} label={t('climbedCount')} accent="text-amber-500" />
          </div>
        </div>
      </div>

      {/* ══════════ AKCIJE GRID ══════════ */}
      <div className="bg-gray-50/80 min-h-[40vh]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">

          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-1 h-6 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">{t('completedActions')}</h2>
            {akcije.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white">
                {akcije.length}
              </span>
            )}
          </div>
          {akcije.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 sm:p-16 text-center max-w-xl mx-auto">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gray-50 mb-4">
                <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 6v12.75c0 1.243 1.007 2.25 2.25 2.25z" />
                </svg>
              </div>
              <p className="text-sm text-gray-400">{t('noCompletedActions')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {akcije.map(a => <AkcijaCard key={a.id} akcija={a} />)}
            </div>
          )}
        </div>
      </div>

      {/* Puna veličina profilne slike */}
      {avatarLightboxOpen && korisnik.avatar_url && (
        <div
          className="fixed inset-0 z-[280] flex items-center justify-center bg-black/90 p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={t('cover.avatarImage')}
          onClick={() => setAvatarLightboxOpen(false)}
        >
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarImageChange}
          />
          <button
            type="button"
            className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label={t('close')}
            onClick={(e) => {
              e.stopPropagation()
              setAvatarLightboxOpen(false)
            }}
          >
            <XMarkIcon className="h-7 w-7" strokeWidth={1.5} />
          </button>
          <img
            src={korisnik.avatar_url}
            alt={korisnik.fullName || korisnik.username || ''}
            className="max-h-[min(92vh,100%)] max-w-full rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />
          {isOwn && (
            <div className="absolute inset-x-4 bottom-4 z-10 flex gap-2 sm:justify-center">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  void handleRemoveAvatar()
                }}
                disabled={avatarUpdating}
                className="flex-1 sm:flex-none rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                Ukloni profilnu
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  avatarInputRef.current?.click()
                }}
                disabled={avatarUpdating}
                className="flex-1 sm:flex-none rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-100 disabled:opacity-60"
              >
                Dodaj profilnu
              </button>
            </div>
          )}
        </div>
      )}

      <FollowListModal
        open={followModalOpen}
        title={followModalMode === 'following' ? t('following') : t('followers')}
        users={followModalUsers}
        loading={followModalLoading}
        onClose={() => setFollowModalOpen(false)}
      />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════════════ */

function StatCell({ value, unit, label, accent }: { value: string; unit?: string; label: string; accent: string }) {
  return (
    <div className="flex flex-col items-center py-4">
      <span className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight leading-none">
        {value}
        {unit && <span className={`text-xs font-semibold ${accent} ml-0.5`}>{unit}</span>}
      </span>
      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-1">{label}</p>
    </div>
  )
}

function AkcijaCard({ akcija }: { akcija: UspesnaAkcija }) {
  const { t, i18n } = useTranslation('userProfile')
  const mmr = computeMMRForAkcija({
    duzinaStazeKm: akcija.duzinaStazeKm,
    kumulativniUsponM: akcija.kumulativniUsponM,
    visinaVrhM: akcija.visinaVrhM,
    zimskiUspon: akcija.zimskiUspon,
    tezina: akcija.tezina,
    datum: akcija.datum,
  })
  const difficultyBadge = tzProfile(akcija.tezina, t)

  return (
    <Link
      to={`/akcije/${akcija.id}`}
      className="group bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 hover:no-underline"
    >
      {/* image */}
      <div className="relative w-full aspect-[3/2] overflow-hidden bg-gray-100">
        <AkcijaImageOrFallback
          src={akcija.slikaUrl}
          alt={akcija.naziv}
          imgClassName="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
        <div className="absolute bottom-2 left-2.5 right-2.5 flex items-end justify-between">
          <span className="text-white/90 text-[10px] font-semibold bg-black/25 backdrop-blur-md px-2 py-0.5 rounded-md">
            {formatDateShort(akcija.datum)}
          </span>
          <span className="text-white text-[10px] font-bold bg-emerald-500/90 px-2 py-0.5 rounded-md shadow-sm">
            +{mmr} MMR
          </span>
        </div>
      </div>

      {/* body */}
      <div className="p-3.5">
        <h4 className="text-sm font-bold text-gray-900 mb-1.5 line-clamp-2 group-hover:text-emerald-600 transition-colors leading-snug">
          {akcija.naziv}
        </h4>

        <p className="text-[11px] text-gray-400 font-medium truncate mb-2">
          {akcija.planina ? `${akcija.planina} — ${akcija.vrh}` : akcija.vrh}
        </p>

        <div className="flex items-center gap-2 text-[11px] text-gray-500 font-medium">
          <span className="flex items-center gap-0.5">
            <svg className="w-3 h-3 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
            {akcija.duzinaStazeKm?.toFixed(1) || '0.0'} km
          </span>
          <span className="w-px h-3 bg-gray-200" />
          <span className="flex items-center gap-0.5">
            <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" /></svg>
            {akcija.kumulativniUsponM?.toLocaleString(i18n.language) || '0'} m
          </span>
        </div>

        <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-50">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${difficultyBadge.bg} ${difficultyBadge.text} ${difficultyBadge.border}`}>
            {difficultyBadge.label}
          </span>
          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-500">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
            {t('climbed')}
          </span>
        </div>
      </div>
    </Link>
  )
}
