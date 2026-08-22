import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { getMyGuideProfile, type GuideProfile } from '../../services/guideProfiles'
import { UserNameWithProfiBadge } from '../../components/users/UserNameWithProfiBadge'
import type { GuideRatingSummary } from '../../services/guideRatings'
import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  fetchFollowCounts as loadFollowCounts,
  fetchKorisnikByIdOrUsername,
  fetchKorisnikStatistika,
  fetchKorisnikPopeoSe,
  fetchKorisnikVodio,
  fetchKorisnici,
  fetchKorisnikPopeoSeById,
  updateMyCoverPosition,
  updateMyCover,
  updateMyAvatar,
} from '../../services/users'
import { syncAvatarAfterSuccessfulUpload } from './syncAvatarAfterSuccessfulUpload'
import { fetchUserFollowingList, fetchUserFollowersList } from '../../services/follows'
import { useAuth } from '../../context/AuthContext'
import FollowListModal, { type FollowListUser } from '../../components/modals/FollowListModal'
import { formatDate } from '../../utils/dateUtils'
import { computeRank, formatRankDisplayName } from '../../utils/rankingUtils'
import { ProfileActionGrid, ProfileActionGridSkeleton } from '../../components/profile/ProfileActionGrid'
import { ProfileHeaderActions } from '../../components/profile/ProfileHeaderActions'
import { ProfileImageActionModal } from '../../components/profile/ProfileImageActionModal'
import { ProfileClubIdentity } from '../../components/profile/ProfileClubIdentity'
import { ProfiGuideRatingChip } from '../../components/guides/ProfiGuideRatingChip'
import BlockUserButton from '../../components/buttons/BlockUserButton'
import type { MemberPdfData } from '../../utils/generateMemberPdf'
import {
  ProfileActionsEmpty,
  ProfileSectionError,
  ProfileStatsSkeleton,
} from '../../components/profile/ProfileSectionStates'
import { buildPassportKpis } from '../../utils/profilePassportKpis'
import { shouldShowGuidedActionsTab } from '../../utils/profileEmptyStates'
import {
  PLANINER_RANK_HINT,
  PLANINER_RANK_LABEL,
  resolveSameClub,
  shouldShowPublicContactPills,
} from '../../utils/profileIdentity'
import { isOwnProfile } from '../../utils/profileOwnership'
import { mergeOwnProfileFromSession } from '../../utils/profileSettingsIntegration'
import { XMarkIcon, EllipsisHorizontalIcon, PencilSquareIcon } from '@heroicons/react/24/outline'

interface UspesnaAkcija {
  id: number
  naziv: string
  tipAkcije?: 'planina' | 'via_ferrata'
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
  isProfiGuide?: boolean
  guideRatingSummary?: GuideRatingSummary
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
  const { t: tGuide } = useTranslation('guideProfiles')
  const { id, username } = useParams<{ id?: string; username?: string }>()
  const { user: currentUser, refreshUser, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [korisnik, setKorisnik] = useState<Korisnik | null>(null)
  const [akcije, setAkcije] = useState<UspesnaAkcija[]>([])
  const [vodeneAkcije, setVodeneAkcije] = useState<UspesnaAkcija[]>([])
  const [profileActionsTab, setProfileActionsTab] = useState<'climbed' | 'guided'>('climbed')
  const [stats, setStats] = useState<{
    ukupnoKm: number
    ukupnoMetaraUspona: number
    brojPopeoSe: number
    ukupnoKoraka?: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState(false)
  const [akcijeLoading, setAkcijeLoading] = useState(false)
  const [akcijeError, setAkcijeError] = useState(false)
  const [vodeneLoading, setVodeneLoading] = useState(false)
  const [vodeneError, setVodeneError] = useState(false)
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
  const [avatarFocus, setAvatarFocus] = useState(false)
  const [coverFocus, setCoverFocus] = useState(false)
  const [imageModalKind, setImageModalKind] = useState<'avatar' | 'cover' | null>(null)
  const [coverMenuOpen, setCoverMenuOpen] = useState(false)

  const [followCounts, setFollowCounts] = useState<{ following: number; followers: number }>({ following: 0, followers: 0 })
  const [blockedEither, setBlockedEither] = useState(false)
  const [followModalOpen, setFollowModalOpen] = useState(false)
  const [followModalMode, setFollowModalMode] = useState<'following' | 'followers'>('following')
  const [followModalUsers, setFollowModalUsers] = useState<FollowListUser[]>([])
  const [followModalLoading, setFollowModalLoading] = useState(false)
  const [myGuideProfile, setMyGuideProfile] = useState<GuideProfile | null | undefined>(undefined)

  const rank = useMemo(
    () =>
      computeRank({
        uspesneAkcije: akcije,
        vodeneAkcije: vodeneAkcije,
        ukupnoKm: stats?.ukupnoKm ?? 0,
        ukupnoMetaraUspona: stats?.ukupnoMetaraUspona ?? 0,
      }),
    [akcije, vodeneAkcije, stats?.ukupnoKm, stats?.ukupnoMetaraUspona],
  )

  const fetchFollowCounts = useCallback(async () => {
    if (!korisnik?.id) return
    try {
      const counts = await loadFollowCounts(korisnik.id)
      setFollowCounts(counts)
    } catch {
      setFollowCounts({ following: 0, followers: 0 })
    }
  }, [korisnik?.id])

  const loadStats = useCallback(async (idOrUsername: string) => {
    setStatsLoading(true)
    setStatsError(false)
    try {
      const statsData = await fetchKorisnikStatistika(idOrUsername)
      setStats(statsData)
    } catch {
      setStatsError(true)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  const loadAkcije = useCallback(async (idOrUsername: string) => {
    setAkcijeLoading(true)
    setAkcijeError(false)
    try {
      const akcijeData = await fetchKorisnikPopeoSe(idOrUsername)
      setAkcije(akcijeData as UspesnaAkcija[])
    } catch {
      setAkcijeError(true)
    } finally {
      setAkcijeLoading(false)
    }
  }, [])

  const loadVodene = useCallback(async (idOrUsername: string) => {
    setVodeneLoading(true)
    setVodeneError(false)
    try {
      const vodeneData = await fetchKorisnikVodio(idOrUsername)
      setVodeneAkcije((vodeneData as UspesnaAkcija[]) ?? [])
    } catch {
      setVodeneError(true)
    } finally {
      setVodeneLoading(false)
    }
  }, [])

  const loadProfile = useCallback(async () => {
    const idOrUsername = id ?? username
    setLoading(true)
    setError('')
    setStats(null)
    setAkcije([])
    setVodeneAkcije([])
    setStatsError(false)
    setAkcijeError(false)
    setVodeneError(false)
    setProfileActionsTab('climbed')
    try {
      if (!idOrUsername) {
        setError(t('notFound'))
        setLoading(false)
        return
      }

      const k = (await fetchKorisnikByIdOrUsername(idOrUsername)) as Korisnik
      setKorisnik(k)
      if (!username && k.username) navigate(`/korisnik/${k.username}`, { replace: true })
      setLoading(false)

      void loadStats(idOrUsername)
      void loadAkcije(idOrUsername)
      void loadVodene(idOrUsername)
    } catch (e: unknown) {
      const apiErr =
        e && typeof e === 'object' && 'response' in e
          ? (e as { response?: { data?: { error?: string }; status?: number } }).response
          : undefined
      setError(apiErr?.data?.error || (apiErr?.status === 404 ? t('notFound') : t('loadError')))
      setLoading(false)
    }
  }, [id, username, navigate, t, loadStats, loadAkcije, loadVodene])

  /* ── data fetching ── */
  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  useEffect(() => {
    const st = location.state as { refreshProfile?: boolean } | null
    if (!st?.refreshProfile) return
    void loadProfile()
    navigate(location.pathname, { replace: true, state: {} })
  }, [location.state, location.pathname, loadProfile, navigate])

  useEffect(() => { setAvatarFail(false) }, [id, username])

  useEffect(() => {
    if (!korisnik?.id || !currentUser) { setTop30(null); return }
    let cancelled = false
    ;(async () => {
      try {
        const baseUsers = await fetchKorisnici()
        const rankedUsers = await Promise.all(
          baseUsers.map(async (k) => {
            try {
              const [akcije, vodene] = await Promise.all([
                fetchKorisnikPopeoSeById(k.id),
                fetchKorisnikVodio(String(k.id)),
              ])
              const rank = computeRank({
                uspesneAkcije: akcije,
                vodeneAkcije: vodene,
                ukupnoKm: k.ukupnoKm ?? 0,
                ukupnoMetaraUspona: k.ukupnoMetaraUspona ?? 0,
              })
              return { ...k, rank }
            } catch {
              return {
                ...k,
                rank: computeRank({
                  ukupnoKm: k.ukupnoKm ?? 0,
                  ukupnoMetaraUspona: k.ukupnoMetaraUspona ?? 0,
                }),
              }
            }
          })
        )
        if (cancelled) return
        const sorted = rankedUsers.sort((a, b) => b.rank.per - a.rank.per)
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
  const isOwn = isOwnProfile({
    viewerUsername: currentUser?.username,
    profileUsername: korisnik?.username,
    profileId: korisnik?.id,
  })

  useEffect(() => {
    if (!isOwn || !currentUser) return
    setKorisnik((prev) => mergeOwnProfileFromSession(prev, currentUser, true))
    // Sync only session-visible fields; full currentUser object identity changes often.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional field deps
  }, [isOwn, currentUser?.username, currentUser?.fullName, currentUser?.avatarUrl])

  const hasCover = !!korisnik?.cover_image_url
  const initial = (korisnik?.fullName || korisnik?.username || '?').charAt(0).toUpperCase()
  const sameClub = resolveSameClub({
    viewerKlubId: currentUser?.klubId,
    profileKlubId: korisnik?.klubId,
  })
  const canShowFollowControls = !!currentUser && !isOwn && !sameClub
  const canShowBlockControls = !!currentUser && !isOwn
  const showContactPills = shouldShowPublicContactPills({
    email: korisnik?.email,
    telefon: korisnik?.telefon,
  })
  const showProfiGuideBadge = !!korisnik?.isProfiGuide
  const showGuidedActionsTab = shouldShowGuidedActionsTab({
    isProfiGuide: showProfiGuideBadge,
    guidedCount: vodeneAkcije.length,
  })
  const passportKpis = buildPassportKpis(stats ?? {}, i18n.language)
  const idOrUsernameKey = String(id ?? username ?? korisnik?.username ?? '')
  const guideRatingSummary: GuideRatingSummary = korisnik?.guideRatingSummary ?? {
    prosecnaOcena: 0,
    brojOcena: 0,
    brojKomentara: 0,
  }
  const renderHeaderActions = (opts?: {
    layout?: 'inline' | 'stacked'
    hideOverflow?: boolean
    showActionLabels?: boolean
  }) =>
    korisnik != null ? (
      <ProfileHeaderActions
        isOwn={!!isOwn}
        userId={korisnik.id}
        currentUser={currentUser}
        korisnikForPdf={korisnik as unknown as MemberPdfData}
        clubName={korisnik.klubNaziv || ''}
        canShowFollow={canShowFollowControls}
        canShowBlock={canShowBlockControls}
        blockedEither={blockedEither}
        onBlockChange={(byMe, byThem) => setBlockedEither(byMe || byThem)}
        onFollowStatusChange={fetchFollowCounts}
        layout={opts?.layout}
        hideOverflow={opts?.hideOverflow}
        showActionLabels={opts?.showActionLabels}
      />
    ) : null

  const dismissImageFocus = useCallback(() => {
    setAvatarFocus(false)
    setCoverFocus(false)
  }, [])

  const handleMobileAvatarPress = () => {
    if (!isOwn) {
      if (korisnik?.avatar_url) setAvatarLightboxOpen(true)
      return
    }
    if (avatarUpdating) return
    if (!avatarFocus) {
      setAvatarFocus(true)
      setCoverFocus(false)
      return
    }
    setImageModalKind('avatar')
  }

  const handleMobileCoverPress = () => {
    if (!isOwn || coverUploading || positioning) return
    if (!coverFocus) {
      setCoverFocus(true)
      setAvatarFocus(false)
      return
    }
    setImageModalKind('cover')
  }

  useEffect(() => {
    if (!isOwn || !currentUser) {
      setMyGuideProfile(undefined)
      return
    }
    let cancelled = false
    void getMyGuideProfile()
      .then((gp) => {
        if (!cancelled) setMyGuideProfile(gp)
      })
      .catch(() => {
        if (!cancelled) setMyGuideProfile(null)
      })
    return () => {
      cancelled = true
    }
  }, [isOwn, currentUser])

  const coverInputRef = useRef<HTMLInputElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const openFollowModal = async (mode: 'following' | 'followers') => {
    if (!korisnik?.id || !currentUser) return
    setFollowModalMode(mode)
    setFollowModalOpen(true)
    setFollowModalLoading(true)
    setFollowModalUsers([])
    try {
      const users = (mode === 'following'
        ? await fetchUserFollowingList(korisnik.id)
        : await fetchUserFollowersList(korisnik.id)) as FollowListUser[]
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
        await updateMyCoverPosition({ coverPositionY: coverYDesktop })
        setKorisnik((k) => (k ? { ...k, cover_position_y: coverYDesktop } : null))
      } else {
        await updateMyCoverPosition({ coverPositionYMobile: coverYMobile })
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
    dismissImageFocus()
    try {
      const formData = new FormData()
      formData.append('coverImage', file)
      const res = await updateMyCover(formData)
      const url = res.cover_image_url
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
      await updateMyCover(formData)
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
    if (!file || !isOwn || avatarUpdating) return
    if (!file.type.startsWith('image/')) return
    setAvatarUpdating(true)
    try {
      const formData = new FormData()
      formData.append('avatar', file)
      const res = await updateMyAvatar(formData)
      await syncAvatarAfterSuccessfulUpload({
        avatarUrl: res.avatar_url,
        applyLocalAvatar: (url) => {
          setKorisnik((k) => (k ? { ...k, avatar_url: url } : null))
          setAvatarFail(false)
        },
        refreshUser,
      })
    } catch {
      /* upload failed — keep previous avatar; do not refresh AuthContext */
    } finally {
      setAvatarUpdating(false)
      e.target.value = ''
    }
  }

  const handleRemoveAvatar = async () => {
    if (!isOwn || !korisnik?.avatar_url || avatarUpdating) return
    setAvatarUpdating(true)
    try {
      const formData = new FormData()
      formData.append('removeAvatar', '1')
      await updateMyAvatar(formData)
      await syncAvatarAfterSuccessfulUpload({
        avatarUrl: undefined,
        removed: true,
        applyLocalAvatar: () => undefined,
        clearLocalAvatar: () => {
          setKorisnik((k) => (k ? { ...k, avatar_url: '' } : null))
          setAvatarLightboxOpen(false)
          setAvatarFail(false)
        },
        refreshUser,
      })
    } catch {
      /* remove failed — keep previous avatar; do not refresh AuthContext */
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
      <div
        className={`relative h-56 sm:h-44 md:h-64 lg:h-80 xl:h-96 overflow-hidden select-none group/cover -mt-6 w-screen left-1/2 -translate-x-1/2 ${
          isOwn && !positioning ? 'md:cursor-default' : ''
        }`}
        onClick={(e) => {
          /* Mobilni: tap cover → focus → modal (kao app). Desktop zadržava pencil. */
          if (window.matchMedia('(min-width: 768px)').matches) return
          if ((e.target as HTMLElement).closest('[data-cover-menu]')) return
          handleMobileCoverPress()
        }}
      >
        {hasCover ? (
          <img
            src={korisnik.cover_image_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover transition-[object-position] duration-300 pointer-events-none"
            style={{ objectPosition: `center ${coverYVisible * 100}%` }}
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 bg-teal-800 md:bg-gradient-to-br md:from-slate-800 md:via-emerald-900/80 md:to-teal-800" />
        )}
        <div className="absolute inset-0 bg-black/20 md:bg-gradient-to-t md:from-black/60 md:via-black/20 md:to-transparent pointer-events-none" />

        {isOwn && coverFocus && !coverUploading && !positioning ? (
          <div className="md:hidden absolute inset-0 z-10 flex items-center justify-center bg-black/35 pointer-events-none">
            <PencilSquareIcon className="h-8 w-8 text-white" aria-hidden />
          </div>
        ) : null}
        {coverUploading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/50 border-t-white" />
          </div>
        ) : null}

        {/* Desktop: pencil otvara pozicioni panel (md+) */}
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
              onClick={(e) => {
                e.stopPropagation()
                setPositioning(true)
              }}
              disabled={coverUploading}
              title={hasCover ? t('cover.replace') : t('cover.add')}
              aria-label={hasCover ? t('cover.replace') : t('cover.add')}
              className="hidden md:flex absolute top-4 left-4 z-20 h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm border border-white/25 shadow-sm hover:bg-black/50 active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed opacity-0 group-hover/cover:opacity-100"
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

        {/* Mobilni: ⋯ meni na coveru (kao app) */}
        {(isOwn || canShowBlockControls) && (
          <div className="md:hidden absolute top-3 right-3 z-20" data-cover-menu>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                dismissImageFocus()
                setCoverMenuOpen((v) => !v)
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-gray-600 shadow-md border border-white/80 backdrop-blur-sm"
              aria-label="Meni profila"
              aria-expanded={coverMenuOpen}
            >
              <EllipsisHorizontalIcon className="h-5 w-5" aria-hidden />
            </button>
            {coverMenuOpen ? (
              <div
                className="absolute right-0 mt-2 min-w-[11rem] rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg"
                role="menu"
              >
                {isOwn ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-rose-700 hover:bg-rose-50"
                    onClick={() => {
                      setCoverMenuOpen(false)
                      logout()
                      navigate('/home', { replace: true })
                    }}
                  >
                    Odjavi se
                  </button>
                ) : null}
                {!isOwn && canShowBlockControls ? (
                  <div className="px-1 py-0.5">
                    <BlockUserButton
                      targetId={Number(korisnik.id)}
                      variant="menuItem"
                      onBlockChange={(byMe, byThem) => {
                        setBlockedEither(byMe || byThem)
                        setCoverMenuOpen(false)
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
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

      {/* Mobilni cover pozicioni sheet — zadržan samo ako se eksplicitno otvori (desktop flow); na mobilnom app-parity koristi modal */}
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="hidden sm:flex absolute top-3 right-4 sm:right-6 lg:right-8 z-20 items-center gap-2">
            {renderHeaderActions({ showActionLabels: true })}
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4 sm:gap-5 -mt-12 sm:-mt-14 pb-3 sm:pb-6">

            {/* mobile layout — usklađen sa mobilnom app */}
            <div className="sm:hidden" onClick={dismissImageFocus}>
              <div className="flex items-start gap-3">
                <div className="relative w-20 h-20 flex-shrink-0 -mt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleMobileAvatarPress()
                    }}
                    disabled={isOwn && avatarUpdating}
                    className="relative h-full w-full rounded-full overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 ring-[3px] ring-white shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                    aria-label={
                      isOwn ? 'Profilna slika, dodirnite za izmjenu' : t('cover.showAvatarFull')
                    }
                  >
                    {korisnik.avatar_url && !avatarFail ? (
                      <img
                        src={korisnik.avatar_url}
                        alt={korisnik.fullName || korisnik.username || ''}
                        className="absolute inset-0 h-full w-full object-cover select-none"
                        draggable={false}
                        onError={() => setAvatarFail(true)}
                      />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-white">
                        {initial}
                      </span>
                    )}
                    {isOwn && avatarFocus && !avatarUpdating ? (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <PencilSquareIcon className="h-6 w-6 text-white" aria-hidden />
                      </span>
                    ) : null}
                    {avatarUpdating ? (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/50 border-t-white" />
                      </span>
                    ) : null}
                  </button>
                </div>

                <div className="min-w-0 flex-1 pt-1">
                  <UserNameWithProfiBadge
                    name={korisnik.fullName || korisnik.username}
                    isProfiGuide={showProfiGuideBadge}
                    badgeSize={26}
                    nameClassName="text-lg font-extrabold text-gray-900 tracking-tight leading-tight"
                  />
                  <p className="text-[13px] text-gray-400 font-semibold truncate -mt-0.5">@{korisnik.username}</p>
                  <div className="flex items-center gap-2 text-[11px] text-gray-400 font-medium mt-1">
                    <svg className="h-3.5 w-3.5 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M4 11h16M5 5h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
                    </svg>
                    <span className="truncate">{t('memberSince')} {formatDate(korisnik.createdAt)}</span>
                  </div>
                </div>
              </div>

              {(korisnik.klubNaziv || (isOwn && !korisnik.klubNaziv) || showProfiGuideBadge) && (
                <div className="mt-2.5 flex items-center justify-between gap-2 min-w-0">
                  <div className="min-w-0 flex-1">
                    {(korisnik.klubNaziv || (isOwn && !korisnik.klubNaziv)) && (
                      <ProfileClubIdentity
                        klubNaziv={korisnik.klubNaziv}
                        klubLogoUrl={korisnik.klubLogoUrl}
                        isAuthenticated={!!currentUser}
                        isOwn={!!isOwn}
                        noClubOwnLabel={t('noClubOwn')}
                      />
                    )}
                  </div>
                  {showProfiGuideBadge ? (
                    <ProfiGuideRatingChip
                      username={korisnik.username}
                      summary={guideRatingSummary}
                      className="shrink-0"
                    />
                  ) : null}
                </div>
              )}

              <div className="mt-3 space-y-2">
                {renderHeaderActions({ layout: 'stacked', hideOverflow: true })}
                {isOwn &&
                !showProfiGuideBadge &&
                (myGuideProfile === null || myGuideProfile?.status === 'rejected') ? (
                  <Link
                    to="/profil/postani-vodic"
                    className="inline-flex w-full items-center justify-center min-h-11 px-4 rounded-xl border border-emerald-500 bg-white text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors"
                  >
                    {myGuideProfile?.status === 'rejected' ? tGuide('status.resubmit') : tGuide('becomeGuide')}
                  </Link>
                ) : null}
              </div>
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
                  <UserNameWithProfiBadge
                    name={korisnik.fullName || korisnik.username}
                    isProfiGuide={showProfiGuideBadge}
                    badgeSize={32}
                    nameClassName="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 tracking-tight leading-tight"
                    className="max-w-full"
                  />

                  <div className="flex flex-wrap items-center justify-start gap-2 mt-0.5">
                    <span className="text-[13px] text-gray-400 font-semibold">@{korisnik.username}</span>
                  </div>

                  <div className="mt-1.5 flex items-end justify-between gap-3 min-w-0">
                    <ProfileClubIdentity
                      klubNaziv={korisnik.klubNaziv}
                      klubLogoUrl={korisnik.klubLogoUrl}
                      isAuthenticated={!!currentUser}
                      isOwn={!!isOwn}
                      noClubOwnLabel={t('noClubOwn')}
                    />
                    {showProfiGuideBadge ? (
                      <ProfiGuideRatingChip
                        username={korisnik.username}
                        summary={guideRatingSummary}
                        className="shrink-0"
                      />
                    ) : null}
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

                {showContactPills && (
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
                {isOwn && myGuideProfile !== undefined && (
                  <GuideOwnProfileCta guideProfile={myGuideProfile} tGuide={tGuide} className="mt-3" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════ STATS BAR ══════════ */}
      <div className="bg-white border-b border-gray-100 -mt-0.5 sm:mt-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top row: premium rank + follow mini panel */}
          <div className="py-2 sm:py-3 border-b border-gray-50">
            <div className="rounded-2xl border border-gray-100 bg-gradient-to-b from-white to-gray-50/70 shadow-[0_10px_30px_rgba(15,23,42,0.06)] px-3 sm:px-4 py-2.5">
              <div className="flex items-center justify-between gap-2.5">
                <div
                  className="relative inline-flex flex-col gap-0.5 rounded-xl px-3.5 py-2.5 overflow-hidden max-w-full"
                  style={{ backgroundColor: rank.boja, color: rankColor }}
                  title={PLANINER_RANK_HINT}
                  aria-label={`${PLANINER_RANK_LABEL}. ${PLANINER_RANK_HINT}`}
                  data-testid="profile-planiner-rank"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
                  <span className="relative text-[9px] font-bold uppercase tracking-[0.14em] opacity-90">
                    {PLANINER_RANK_LABEL}
                  </span>
                  <div className="relative inline-flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-extrabold tracking-wide">{formatRankDisplayName(rank, top30)}</span>
                    <span className="pl-2 ml-1 border-l border-white/25 text-[11px] sm:text-xs font-extrabold tabular-nums">{rank.per} PER</span>
                  </div>
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

          <div
            className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-gray-100"
            data-testid="profile-passport-kpis"
          >
            {statsError && !stats ? (
              <div
                className="col-span-2 sm:col-span-4 flex flex-col items-center justify-center gap-2 py-6 px-4 text-center"
                role="alert"
                data-testid="profile-stats-error"
              >
                <p className="text-sm text-gray-500">{t('statsUnavailable')}</p>
                <button
                  type="button"
                  onClick={() => idOrUsernameKey && void loadStats(idOrUsernameKey)}
                  className="min-h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-emerald-700 hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  {t('retry')}
                </button>
              </div>
            ) : statsLoading && !stats ? (
              <ProfileStatsSkeleton />
            ) : (
              <>
                <StatCell
                  value={passportKpis.ascent.value}
                  unit="m"
                  label={t('ascent')}
                  accent="text-emerald-500"
                  ariaLabel={`${passportKpis.ascent.value} m ${t('ascent')}`}
                />
                <StatCell
                  value={passportKpis.km.value}
                  unit="km"
                  label={t('trail')}
                  accent="text-sky-500"
                  ariaLabel={`${passportKpis.km.value} km ${t('trail')}`}
                />
                <StatCell
                  value={passportKpis.summits.value}
                  label={t('climbedCount')}
                  accent="text-amber-500"
                  ariaLabel={`${passportKpis.summits.value} ${t('climbedCount')}`}
                />
                <StatCell
                  value={(stats?.ukupnoKoraka ?? 0).toLocaleString(i18n.language)}
                  label="Koraci"
                  accent="text-violet-500"
                  ariaLabel={`${(stats?.ukupnoKoraka ?? 0).toLocaleString(i18n.language)} koraka`}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* ══════════ AKCIJE GRID ══════════ */}
      <div className="bg-gray-50/80 min-h-[40vh]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 pb-4 sm:pb-6">
          {showGuidedActionsTab ? (
            <div className="mb-6 sm:mb-7">
              <ProfileActionsToggle
                tab={profileActionsTab}
                climbedCount={akcijeError || akcijeLoading ? null : akcije.length}
                guidedCount={vodeneError || vodeneLoading ? null : vodeneAkcije.length}
                climbedLabel={t('actionsTabClimbed')}
                guidedLabel={t('actionsTabGuided')}
                onChange={setProfileActionsTab}
              />
            </div>
          ) : (
            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-1 h-6 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">{t('completedActions')}</h2>
              {!akcijeLoading && !akcijeError && akcije.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white">
                  {akcije.length}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="pb-8 sm:pb-10" role="tabpanel">
          {(() => {
            const showingGuided = showGuidedActionsTab && profileActionsTab === 'guided'
            const sectionLoading = showingGuided ? vodeneLoading : akcijeLoading
            const sectionError = showingGuided ? vodeneError : akcijeError
            const sectionData = showingGuided ? vodeneAkcije : akcije
            const hasCached = sectionData.length > 0

            if (sectionError && !hasCached) {
              return (
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8" data-testid="profile-history-error">
                  <ProfileSectionError
                    message={t('historyUnavailable')}
                    retryLabel={t('retry')}
                    onRetry={() => {
                      if (!idOrUsernameKey) return
                      if (showingGuided) void loadVodene(idOrUsernameKey)
                      else void loadAkcije(idOrUsernameKey)
                    }}
                  />
                </div>
              )
            }

            if (sectionLoading && !hasCached) {
              return (
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                  <ProfileActionGridSkeleton />
                </div>
              )
            }

            if (sectionData.length === 0) {
              if (showingGuided) {
                return (
                  <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <ProfileActionsEmpty
                      title={isOwn ? t('noGuidedTours') : t('noGuidedToursPublic')}
                      body={isOwn ? t('noGuidedToursBody') : undefined}
                    />
                  </div>
                )
              }
              return (
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                  <ProfileActionsEmpty
                    title={isOwn ? t('noCompletedActions') : t('noCompletedActionsPublic')}
                    body={isOwn ? t('noCompletedActionsBody') : undefined}
                    ctaLabel={isOwn ? t('findAction') : undefined}
                    ctaTo={isOwn ? '/akcije' : undefined}
                  />
                </div>
              )
            }

            return (
              <ProfileActionGrid
                actions={sectionData}
                mode={showingGuided ? 'guided' : 'climbed'}
                ariaLabel={t('actionsHistoryAria')}
              />
            )
          })()}
        </div>
      </div>

      {/* Hidden file inputs (shared: lightbox + mobile modal) */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void handleAvatarImageChange(e)
          setImageModalKind(null)
          dismissImageFocus()
        }}
      />

      <ProfileImageActionModal
        open={imageModalKind === 'avatar'}
        title="Promena profilne slike"
        onClose={() => {
          setImageModalKind(null)
          dismissImageFocus()
        }}
        onPickGallery={() => {
          setImageModalKind(null)
          avatarInputRef.current?.click()
        }}
        onRemove={() => {
          setImageModalKind(null)
          dismissImageFocus()
          void handleRemoveAvatar()
        }}
        canRemove={!!korisnik.avatar_url}
        removeLabel="Ukloni profilnu"
      />
      <ProfileImageActionModal
        open={imageModalKind === 'cover'}
        title="Promena cover fotografije"
        onClose={() => {
          setImageModalKind(null)
          dismissImageFocus()
        }}
        onPickGallery={() => {
          setImageModalKind(null)
          coverInputRef.current?.click()
        }}
        onRemove={() => {
          setImageModalKind(null)
          dismissImageFocus()
          void handleRemoveCover()
        }}
        canRemove={hasCover}
        removeLabel="Ukloni cover"
      />

      {/* Puna veličina profilne slike (tuđi profil / desktop pregled) */}
      {avatarLightboxOpen && korisnik.avatar_url && (
        <div
          className="fixed inset-0 z-[280] flex items-center justify-center bg-black/90 p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={t('cover.avatarImage')}
          onClick={() => setAvatarLightboxOpen(false)}
        >
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

function GuideOwnProfileCta({
  guideProfile,
  tGuide,
  className = 'mt-3',
}: {
  guideProfile: GuideProfile | null
  tGuide: TFunction
  className?: string
}) {
  if (!guideProfile) {
    return (
      <div className={className}>
        <Link
          to="/profil/postani-vodic"
          className="inline-flex items-center justify-center rounded-xl border-2 border-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition"
        >
          {tGuide('becomeGuide')}
        </Link>
      </div>
    )
  }
  if (guideProfile.status === 'pending') {
    return (
      <div className={`${className} rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900`}>
        <p className="font-semibold">{tGuide('status.pendingTitle')}</p>
        <p className="mt-0.5 text-amber-800">{tGuide('status.pendingBody')}</p>
      </div>
    )
  }
  if (guideProfile.status === 'rejected') {
    return (
      <div className={`${className} space-y-2`}>
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
          <p className="font-semibold">{tGuide('status.rejectedTitle')}</p>
          {guideProfile.razlogOdbijanja && (
            <p className="mt-1 whitespace-pre-wrap">{guideProfile.razlogOdbijanja}</p>
          )}
        </div>
        <Link
          to="/profil/postani-vodic"
          className="inline-flex items-center justify-center rounded-xl border-2 border-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition"
        >
          {tGuide('status.resubmit')}
        </Link>
      </div>
    )
  }
  if (guideProfile.status === 'suspended') {
    return (
      <div className={`${className} rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700`}>
        <p className="font-semibold">{tGuide('status.suspendedTitle')}</p>
        <p className="mt-0.5">{tGuide('status.suspendedBody')}</p>
      </div>
    )
  }
  return null
}

function StatCell({
  value,
  unit,
  label,
  accent,
  ariaLabel,
}: {
  value: string
  unit?: string
  label: string
  accent: string
  ariaLabel?: string
}) {
  return (
    <div className="flex flex-col items-center py-4" role="group" aria-label={ariaLabel || `${value}${unit ? ` ${unit}` : ''} ${label}`}>
      <span className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight leading-none tabular-nums">
        {value}
        {unit && <span className={`text-xs font-semibold ${accent} ml-0.5`}>{unit}</span>}
      </span>
      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-1">{label}</p>
    </div>
  )
}

function ProfileActionsToggle({
  tab,
  climbedCount,
  guidedCount,
  climbedLabel,
  guidedLabel,
  onChange,
}: {
  tab: 'climbed' | 'guided'
  climbedCount: number | null
  guidedCount: number | null
  climbedLabel: string
  guidedLabel: string
  onChange: (tab: 'climbed' | 'guided') => void
}) {
  const isClimbed = tab === 'climbed'

  return (
    <div
      className="relative mx-auto w-full max-w-lg rounded-2xl border border-gray-200/90 bg-white p-1 shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
      role="tablist"
      aria-label="Pregled akcija na profilu"
    >
      <div
        className={`pointer-events-none absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl transition-all duration-300 ease-out ${
          isClimbed
            ? 'left-1 bg-gradient-to-br from-emerald-50 to-teal-50/90 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.18)]'
            : 'left-[calc(50%+2px)] bg-gradient-to-br from-violet-50 to-purple-50/90 shadow-[inset_0_0_0_1px_rgba(124,58,237,0.18)]'
        }`}
        aria-hidden
      />

      <div className="relative grid grid-cols-2 items-stretch">
        <button
          type="button"
          role="tab"
          aria-selected={isClimbed}
          onClick={() => onChange('climbed')}
          className={`relative z-[1] flex min-h-[52px] flex-col items-center justify-center gap-0.5 px-3 py-2.5 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-inset sm:min-h-[56px] sm:flex-row sm:gap-2 ${
            isClimbed ? 'text-emerald-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="text-xs font-bold tracking-tight sm:text-sm">{climbedLabel}</span>
          {climbedCount != null ? (
            <span
              className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums sm:text-[11px] ${
                isClimbed ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {climbedCount}
            </span>
          ) : null}
        </button>

        <div className="pointer-events-none absolute left-1/2 top-3 bottom-3 z-[2] w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-gray-200 to-transparent" aria-hidden />

        <button
          type="button"
          role="tab"
          aria-selected={!isClimbed}
          onClick={() => onChange('guided')}
          className={`relative z-[1] flex min-h-[52px] flex-col items-center justify-center gap-0.5 px-3 py-2.5 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-inset sm:min-h-[56px] sm:flex-row sm:gap-2 ${
            !isClimbed ? 'text-violet-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="text-xs font-bold tracking-tight sm:text-sm">{guidedLabel}</span>
          {guidedCount != null ? (
            <span
              className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums sm:text-[11px] ${
                !isClimbed ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {guidedCount}
            </span>
          ) : null}
        </button>
      </div>
    </div>
  )
}

