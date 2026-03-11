import { useParams, Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import ProfileActionButtons from '../../components/ProfileActionButtons'
import { getRoleLabel, getRoleStyle } from '../../utils/roleUtils'
import { generateMemberPdf, type MemberPdfData } from '../../utils/generateMemberPdf'
import { formatDate, formatDateShort } from '../../utils/dateUtils'
import { useRanking } from '../../hooks/useRanking'
import { computeMMRForAkcija, computeRank, formatRankDisplayName } from '../../utils/rankingUtils'

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
  email?: string
  telefon?: string
  role: 'superadmin' | 'admin' | 'clan' | 'vodic' | 'blagajnik' | 'sekretar' | 'menadzer-opreme'
  createdAt: string
  updatedAt: string
  ukupnoKm: number
  ukupnoMetaraUspona: number
  brojPopeoSe: number
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
  const [coverY, setCoverY] = useState(0.5)
  const [positioning, setPositioning] = useState(false)
  const [saving, setSaving] = useState(false)

  const rank = useRanking({ uspesneAkcije: akcije, ukupnoKm: stats.ukupnoKm, ukupnoMetaraUspona: stats.ukupnoMetaraUspona })

  /* ── data fetching ── */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        let eid = id
        if (!eid && username) {
          const r = await api.get<{ korisnici: Korisnik[] }>('/api/korisnici')
          const found = (r.data.korisnici || []).find(k => k.username === username)
          if (!found) { setError('Korisnik nije pronađen'); setLoading(false); return }
          eid = String(found.id)
        }
        if (!eid) { setError('Korisnik nije pronađen'); setLoading(false); return }

        const [rK, rS, rA] = await Promise.all([
          api.get(`/api/korisnici/${eid}`),
          api.get(`/api/korisnici/${eid}/statistika`),
          api.get(`/api/korisnici/${eid}/popeo-se`),
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
    if (!korisnik?.id) { setTop30(null); return }
    api.get('/api/korisnici').then(r => {
      const sorted = ((r.data.korisnici || []) as Array<{ id: number; ukupnoKm?: number; ukupnoMetaraUspona?: number }>)
        .map(k => ({ ...k, rank: computeRank({ ukupnoKm: k.ukupnoKm ?? 0, ukupnoMetaraUspona: k.ukupnoMetaraUspona ?? 0 }) }))
        .sort((a, b) => b.rank.mmr - a.rank.mmr)
      const idx = sorted.findIndex(k => k.id === korisnik.id)
      setTop30(idx >= 0 && idx < 30 ? idx + 1 : null)
    }).catch(() => setTop30(null))
  }, [korisnik?.id])

  useEffect(() => { if (korisnik) setCoverY(korisnik.cover_position_y ?? 0.5) }, [korisnik])

  /* ── derived ── */
  const isOwn = currentUser?.username === korisnik?.username
  const hasCover = !!korisnik?.cover_image_url
  const initial = (korisnik?.fullName || korisnik?.username || '?').charAt(0).toUpperCase()

  const saveCoverPos = async () => {
    setSaving(true)
    try { await api.patch('/api/me/cover-position', { coverPositionY: coverY }); setPositioning(false) }
    catch { /* ignore */ }
    finally { setSaving(false) }
  }

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

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 pb-12">

      {/* ══════════ COVER ══════════ */}
      <div
        className="relative h-56 sm:h-44 md:h-52 lg:h-56 overflow-hidden select-none group/cover -mt-6 w-screen left-1/2 -translate-x-1/2"
        onDoubleClick={() => { if (isOwn && hasCover) setPositioning(true) }}
      >
        {hasCover ? (
          <img
            src={korisnik.cover_image_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover transition-[object-position] duration-300"
            style={{ objectPosition: `center ${coverY * 100}%` }}
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-emerald-900/80 to-teal-800" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none" />

        {/* action buttons float over the cover */}
        <ProfileActionButtons
          userId={String(korisnik.id)}
          isOwnProfile={!!isOwn}
          currentUser={currentUser}
          onPrintClick={() => generateMemberPdf(korisnik as unknown as MemberPdfData)}
        />

        {/* own profile hint */}
        {isOwn && hasCover && !positioning && (
          <span className="absolute bottom-3 right-4 text-[10px] text-white/50 font-medium opacity-0 group-hover/cover:opacity-100 transition-opacity pointer-events-none">
            Dupli klik za pozicioniranje
          </span>
        )}

        {/* positioning overlay */}
        {positioning && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/50 backdrop-blur-sm"
            onClick={e => e.stopPropagation()}
            onDoubleClick={e => e.stopPropagation()}
          >
            <p className="text-white/80 text-xs font-semibold tracking-wide">Pomeri cover gore / dole</p>
            <input
              type="range" min={0} max={1} step={0.01}
              value={coverY}
              onChange={e => setCoverY(parseFloat(e.target.value))}
              className="w-52 sm:w-72 accent-emerald-400 cursor-pointer"
            />
            <div className="flex gap-2">
              <button
                onClick={saveCoverPos}
                disabled={saving}
                className="px-5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-lg transition disabled:opacity-50"
              >
                {saving ? 'Čuvam…' : 'Sačuvaj'}
              </button>
              <button
                onClick={() => { setCoverY(korisnik.cover_position_y ?? 0.5); setPositioning(false) }}
                className="px-5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition"
              >
                Otkaži
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ══════════ PROFILE HEADER ══════════ */}
      <div className="relative bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-5 -mt-12 sm:-mt-14 pb-6">

            {/* avatar */}
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-4xl ring-[3px] ring-white shadow-xl flex-shrink-0">
              {korisnik.avatar_url && !avatarFail ? (
                <img
                  src={korisnik.avatar_url}
                  alt={korisnik.fullName || korisnik.username || ''}
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={() => setAvatarFail(true)}
                />
              ) : null}
              <span className={korisnik.avatar_url && !avatarFail ? 'invisible' : ''}>{initial}</span>
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
        <img
          src={akcija.slikaUrl || 'https://via.placeholder.com/600x400?text=Bez+slike'}
          alt={akcija.naziv}
          className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
          onError={e => { e.currentTarget.src = 'https://via.placeholder.com/600x400?text=Slika+nije+dostupna'; e.currentTarget.onerror = null }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
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
