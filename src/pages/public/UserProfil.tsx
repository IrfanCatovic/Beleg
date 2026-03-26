import { useParams, Link, useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import ProfileActionButtons from '../../components/buttons/ProfileActionButtons'
import FollowControls from '../../components/buttons/FollowControls'
import { getRoleLabel, getRoleStyle } from '../../utils/roleUtils'
import { generateMemberPdf, type MemberPdfData } from '../../utils/generateMemberPdf'
import { formatDate, formatDateShort } from '../../utils/dateUtils'
import { useRanking } from '../../hooks/useRanking'
import { computeMMRForAkcija, computeRank, formatRankDisplayName } from '../../utils/rankingUtils'
import { AkcijaImageOrFallback } from '../../components/AkcijaImageFallback'
import { ArrowsUpDownIcon, XMarkIcon } from '@heroicons/react/24/outline'

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
  cover_image_url?: string
  cover_position_y?: number
  /** Vertikalni fokus na uskom ekranu (&lt; md); ako nije sačuvan, koristi se cover_position_y. */
  cover_position_y_mobile?: number
  email?: string
  telefon?: string
  role: 'superadmin' | 'admin' | 'clan' | 'vodic' | 'blagajnik' | 'sekretar' | 'menadzer-opreme'
  createdAt: string
  updatedAt: string
  ukupnoKm: number
  ukupnoMetaraUspona: number
  brojPopeoSe: number
  klubNaziv?: string
  klubLogoUrl?: string
}

const TEZINA: Record<string, { bg: string; text: string; border: string; label: string }> = {
  lako: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Lako' },
  srednje: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Srednje' },
  tesko: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', label: 'Teško' },
  'teško': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', label: 'Teško' },
  alpinizam: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', label: 'Alpinizam' },
}
const DEFAULT_TEZINA = { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200', label: 'Nepoznato' }

function tz(t?: string) {
  if (!t) return DEFAULT_TEZINA
  return TEZINA[t.toLowerCase()] ?? { ...DEFAULT_TEZINA, label: t }
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
  const [avatarLightboxOpen, setAvatarLightboxOpen] = useState(false)

  const rank = useRanking({ uspesneAkcije: akcije, ukupnoKm: stats.ukupnoKm, ukupnoMetaraUspona: stats.ukupnoMetaraUspona })

  /* ── data fetching ── */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const idOrUsername = id ?? username
        if (!idOrUsername) { setError('Korisnik nije pronađen'); setLoading(false); return }

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
        if (!cancelled) setError(e.response?.data?.error || 'Greška pri učitavanju profila')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id, username, navigate])

  useEffect(() => { setAvatarFail(false) }, [id, username])

  useEffect(() => {
    if (!korisnik?.id || !currentUser) { setTop30(null); return }
    api.get('/api/korisnici').then(r => {
      const sorted = ((r.data.korisnici || []) as Array<{ id: number; ukupnoKm?: number; ukupnoMetaraUspona?: number }>)
        .map(k => ({ ...k, rank: computeRank({ ukupnoKm: k.ukupnoKm ?? 0, ukupnoMetaraUspona: k.ukupnoMetaraUspona ?? 0 }) }))
        .sort((a, b) => b.rank.mmr - a.rank.mmr)
      const idx = sorted.findIndex(k => k.id === korisnik.id)
      setTop30(idx >= 0 && idx < 30 ? idx + 1 : null)
    }).catch(() => setTop30(null))
  }, [korisnik?.id, currentUser])

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

  const coverInputRef = useRef<HTMLInputElement>(null)

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
      if (url) setKorisnik((k) => (k ? { ...k, cover_image_url: url } : null))
    } catch { /* ignore */ }
    finally {
      setCoverUploading(false)
      e.target.value = ''
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
      <p className="text-sm text-gray-500 font-medium">{error || 'Korisnik nije pronađen'}</p>
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

        {/* Gornji desni ugao: pomeranje covera + podešavanja / info / štampa (ne prekrivati celu širinu — inače blokira tap na tel.) */}
        <div className="absolute top-4 right-3 sm:top-3 sm:right-6 md:top-6 md:right-12 z-30 flex flex-row-reverse items-center gap-2 flex-wrap justify-end pointer-events-auto max-w-[calc(100vw-5rem)]">
          {isOwn && hasCover && !positioning && (
            <button
              type="button"
              onClick={() => setPositioning(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-md text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              title="Pomeri prikaz cover slike"
              aria-label="Pomeri prikaz cover slike"
            >
              <ArrowsUpDownIcon className="h-6 w-6" aria-hidden />
            </button>
          )}
          <ProfileActionButtons
            inline
            userId={String(korisnik.id)}
            isOwnProfile={!!isOwn}
            currentUser={currentUser}
            onPrintClick={() => generateMemberPdf(korisnik as unknown as MemberPdfData)}
          >
            {!isOwn && currentUser && <FollowControls targetId={korisnik.id} />}
          </ProfileActionButtons>
        </div>

        {/* Donji levi ugao: samo providna olovka za zamenu covera (kao stil izmene, bez teksta) */}
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
              onClick={() => coverInputRef.current?.click()}
              disabled={coverUploading}
              title={hasCover ? 'Zameni cover sliku' : 'Dodaj cover sliku'}
              aria-label={hasCover ? 'Zameni cover sliku' : 'Dodaj cover sliku'}
              className="absolute bottom-4 left-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm border border-white/25 shadow-sm hover:bg-black/50 active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed md:opacity-0 md:group-hover/cover:opacity-100 opacity-100"
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
            <p className="text-white text-center text-sm font-semibold">Pomeri cover (prikaz na računaru / širem ekranu)</p>
            <p className="text-white/60 text-center text-[11px] -mt-2 max-w-xs">
              Na telefonu je druga visina covera — tamo podešavaj posebno. Ovde se čuva samo prikaz za ekrane šire od 768px.
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
                aria-label="Pomeri prikaz nagore"
              >
                −
              </button>
              <span className="text-white/70 text-xs tabular-nums w-12 text-center">{Math.round(coverYDesktop * 100)}%</span>
              <button
                type="button"
                onClick={() => setCoverYDesktop((y: number) => Math.min(1, Math.round((y + 0.05) * 100) / 100))}
                className="min-h-11 min-w-11 rounded-xl bg-white/20 text-white text-lg font-bold hover:bg-white/30 active:bg-white/25"
                aria-label="Pomeri prikaz nadole"
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
                {saving ? 'Čuvam…' : 'Sačuvaj'}
              </button>
              <button
                type="button"
                onClick={cancelCoverPositioning}
                className="min-h-11 px-6 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-bold transition"
              >
                Otkaži
              </button>
            </div>
          </div>
        )}
      </div>

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
            aria-label="Zatvori"
            onClick={cancelCoverPositioning}
          />
          <div
            className="relative z-10 rounded-t-2xl bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.18)] border-t border-gray-100 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] max-h-[min(55vh,420px)] flex flex-col gap-3 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto h-1 w-10 rounded-full bg-gray-200 shrink-0" aria-hidden />
            <h2 id="cover-pos-sheet-title" className="text-center text-sm font-bold text-gray-900">
              Pomeri cover gore / dole
            </h2>
            <p className="text-center text-[11px] text-gray-500 -mt-1">
              Prikaz za telefon / uže ekrane (&lt; 768px). Na računaru koristi isto dugme na coveru u širem prikazu.
            </p>
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
                aria-label="Pomeri prikaz nagore"
              >
                −
              </button>
              <span className="text-gray-600 text-sm tabular-nums font-semibold w-14 text-center">{Math.round(coverYMobile * 100)}%</span>
              <button
                type="button"
                onClick={() => setCoverYMobile((y: number) => Math.min(1, Math.round((y + 0.05) * 100) / 100))}
                className="min-h-12 min-w-12 rounded-xl bg-gray-100 text-gray-800 text-xl font-bold hover:bg-gray-200 active:bg-gray-300"
                aria-label="Pomeri prikaz nadole"
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
                Otkaži
              </button>
              <button
                type="button"
                onClick={() => saveCoverPos('mobile')}
                disabled={saving}
                className="flex-1 min-h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50"
              >
                {saving ? 'Čuvam…' : 'Sačuvaj'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ PROFILE HEADER ══════════ */}
      <div className="relative bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-5 -mt-12 sm:-mt-14 pb-6">

            {/* avatar — klik otvara punu sliku (izmena profila: zupčanik gore na coveru) */}
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0">
              {korisnik.avatar_url && !avatarFail ? (
                <button
                  type="button"
                  onClick={() => setAvatarLightboxOpen(true)}
                  className="relative h-full w-full rounded-full overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 ring-[3px] ring-white shadow-xl cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                  aria-label="Prikaži profilnu sliku u punoj veličini"
                  title="Klik za punu veličinu"
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
            <div className="flex-1 min-w-0 text-center sm:text-left pb-0 sm:pb-0.5">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 tracking-tight truncate leading-tight">
                {korisnik.fullName || korisnik.username}
              </h1>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2.5 gap-y-1 mt-1.5">
                <span className="text-[13px] text-gray-400 font-medium">@{korisnik.username}</span>
                <span className="hidden sm:inline w-1 h-1 rounded-full bg-gray-200" />
                <span className={`inline-flex items-center px-2 py-[3px] rounded-md text-[10px] font-bold tracking-wide uppercase ${getRoleStyle(korisnik.role)}`}>
                  {getRoleLabel(korisnik.role)}
                </span>
                {korisnik.klubNaziv && (
                  <>
                    <span className="hidden sm:inline w-1 h-1 rounded-full bg-gray-200" />
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-md text-[10px] font-bold tracking-wide bg-violet-50 text-violet-700 border border-violet-100">
                      {korisnik.klubLogoUrl ? (
                        <img src={korisnik.klubLogoUrl} alt="" className="w-3.5 h-3.5 rounded-sm object-cover" />
                      ) : (
                        <svg className="w-3 h-3 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                        </svg>
                      )}
                      {korisnik.klubNaziv}
                    </span>
                  </>
                )}
                <span className="hidden sm:inline w-1 h-1 rounded-full bg-gray-200" />
                <span className="text-[11px] text-gray-400 font-medium">Član od {formatDate(korisnik.createdAt)}</span>
              </div>

              {/* contact pills */}
              {currentUser && (korisnik.email || korisnik.telefon) && (
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2.5">
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

            {/* rank pill (desktop) */}
            <div className="hidden lg:block flex-shrink-0">
              <div
                className="relative flex items-center gap-3 px-5 py-3 rounded-2xl shadow-lg overflow-hidden"
                style={{ backgroundColor: rank.boja, color: rankColor }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/15 to-transparent" />
                <div className="relative">
                  <p className="text-[9px] uppercase tracking-widest opacity-60 font-semibold">Rang</p>
                  <p className="text-base font-extrabold tracking-wide leading-tight">{formatRankDisplayName(rank, top30)}</p>
                </div>
                <div className="relative text-right pl-4 border-l border-white/20">
                  <p className="text-xl font-extrabold leading-none">{rank.mmr}</p>
                  <p className="text-[9px] uppercase tracking-wider opacity-60 font-semibold">MMR</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════ STATS BAR ══════════ */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* mobile rank */}
          <div className="lg:hidden flex justify-center py-3 border-b border-gray-50">
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-extrabold shadow-sm"
              style={{ backgroundColor: rank.boja, color: rankColor }}
            >
              {formatRankDisplayName(rank, top30)}
              <span className="opacity-60 font-semibold text-[10px]">{rank.mmr}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-gray-100">
            <StatCell value={stats.ukupnoMetaraUspona.toLocaleString('sr-RS')} unit="m" label="Uspon" accent="text-emerald-500" />
            <StatCell value={stats.ukupnoKm.toLocaleString('sr-RS', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} unit="km" label="Staza" accent="text-sky-500" />
            <StatCell value={String(stats.brojPopeoSe)} label="Osvojenih" accent="text-amber-500" />
          </div>
        </div>
      </div>

      {/* ══════════ AKCIJE GRID ══════════ */}
      <div className="bg-gray-50/80 min-h-[40vh]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">

          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-1 h-6 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">Osvojene akcije</h2>
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
              <p className="text-sm text-gray-400">Još nema završenih akcija.</p>
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
          aria-label="Profilna slika"
          onClick={() => setAvatarLightboxOpen(false)}
        >
          <button
            type="button"
            className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Zatvori"
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
  const mmr = computeMMRForAkcija({
    duzinaStazeKm: akcija.duzinaStazeKm,
    kumulativniUsponM: akcija.kumulativniUsponM,
    visinaVrhM: akcija.visinaVrhM,
    zimskiUspon: akcija.zimskiUspon,
    tezina: akcija.tezina,
    datum: akcija.datum,
  })
  const t = tz(akcija.tezina)

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
            {akcija.kumulativniUsponM?.toLocaleString('sr-RS') || '0'} m
          </span>
        </div>

        <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-50">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${t.bg} ${t.text} ${t.border}`}>
            {t.label}
          </span>
          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-500">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
            Popeo se
          </span>
        </div>
      </div>
    </Link>
  )
}
