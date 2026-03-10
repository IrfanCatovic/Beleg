import { useParams, Link } from 'react-router-dom'
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

interface KorisnikStatistika {
  ukupnoKm: number
  ukupnoMetaraUspona: number
  brojPopeoSe: number
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

const tezinaConfig: Record<string, { bg: string; text: string; label: string; border: string }> = {
  lako: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Lako' },
  srednje: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Srednje' },
  tesko: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', label: 'Teško' },
  'teško': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', label: 'Teško' },
  alpinizam: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', label: 'Alpinizam' },
}

function getTezinaStyle(tezina?: string) {
  if (!tezina) return { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200', label: 'Nepoznato' }
  return tezinaConfig[tezina.toLowerCase()] ?? { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200', label: tezina }
}

export default function UserProfile() {
  const { id } = useParams<{ id: string }>()
  const { user: currentUser } = useAuth()

  const [korisnik, setKorisnik] = useState<Korisnik | null>(null)
  const [uspesneAkcije, setUspesneAkcije] = useState<UspesnaAkcija[]>([])
  const [statistika, setStatistika] = useState<KorisnikStatistika>({
    ukupnoKm: 0,
    ukupnoMetaraUspona: 0,
    brojPopeoSe: 0,
  })
  const rank = useRanking({
    uspesneAkcije,
    ukupnoKm: statistika.ukupnoKm,
    ukupnoMetaraUspona: statistika.ukupnoMetaraUspona,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false)
  const [top30Position, setTop30Position] = useState<number | null>(null)

  useEffect(() => {
    const fetchProfilData = async () => {
      setLoading(true)
      try {
        const resKorisnik = await api.get(`/api/korisnici/${id}`)
        setKorisnik(resKorisnik.data)

        const resStats = await api.get(`/api/korisnici/${id}/statistika`)
        const stats = resStats.data.statistika || {}
        setStatistika({
          ukupnoKm: stats.ukupnoKm || 0,
          ukupnoMetaraUspona: stats.ukupnoMetaraUspona || 0,
          brojPopeoSe: stats.brojPopeoSe || 0,
        })

        const resAkcije = await api.get(`/api/korisnici/${id}/popeo-se`)
        setUspesneAkcije(resAkcije.data.uspesneAkcije || [])
      } catch (err: any) {
        console.error('Greška pri učitavanju profila:', err)
        setError(err.response?.data?.error || 'Greška pri učitavanju profila')
      } finally {
        setLoading(false)
      }
    }

    fetchProfilData()
  }, [id])

  useEffect(() => {
    setAvatarLoadFailed(false)
  }, [id])

  useEffect(() => {
    const loadTop30Position = async () => {
      if (!korisnik?.id) {
        setTop30Position(null)
        return
      }
      try {
        const res = await api.get('/api/korisnici')
        const lista = (res.data.korisnici || []) as Array<{
          id: number
          ukupnoKm?: number
          ukupnoMetaraUspona?: number
        }>
        const sorted = lista
          .map((k) => ({
            ...k,
            rank: computeRank({
              ukupnoKm: k.ukupnoKm ?? 0,
              ukupnoMetaraUspona: k.ukupnoMetaraUspona ?? 0,
            }),
          }))
          .sort((a, b) => b.rank.mmr - a.rank.mmr)
        const index = sorted.findIndex((k) => k.id === korisnik.id)
        if (index >= 0 && index < 30) {
          setTop30Position(index + 1)
        } else {
          setTop30Position(null)
        }
      } catch {
        setTop30Position(null)
      }
    }
    loadTop30Position()
  }, [korisnik?.id])

  if (loading) return <div className="text-center py-20">Učitavanje profila...</div>
  if (error || !korisnik) return <div className="text-center py-20 text-red-600">{error || 'Korisnik nije pronađen'}</div>

  const isOwnProfile = currentUser?.username === korisnik.username
  const hasCover = !!korisnik.cover_image_url
  const effectiveCoverPositionY = korisnik.cover_position_y ?? 0.5

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-6 pb-16">
      <ProfileActionButtons
        userId={String(korisnik.id)}
        isOwnProfile={!!isOwnProfile}
        currentUser={currentUser}
        onPrintClick={() => korisnik && generateMemberPdf(korisnik as unknown as MemberPdfData)}
      />

      {/* ═══════ Cover ═══════ */}
      <div className="relative h-52 sm:h-64 md:h-72 lg:h-80 xl:h-[360px] 2xl:h-[400px] select-none">
        {hasCover ? (
          <img
            src={korisnik.cover_image_url}
            alt="Cover"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: `center ${effectiveCoverPositionY * 100}%` }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-emerald-900 to-teal-800" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-black/10 pointer-events-none" />
      </div>

      {/* ═══════ Profile info + sidebar (desktop two-column) ═══════ */}
      <div className="relative bg-white">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-16">
          <div className="flex flex-col lg:flex-row gap-0 lg:gap-10">
            {/* Left column: profile identity */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-6 -mt-14 sm:-mt-16 pb-6 pt-0">
                {/* Avatar */}
                <div className="relative w-28 h-28 sm:w-32 sm:h-32 lg:w-36 lg:h-36 rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-5xl ring-4 ring-white shadow-2xl flex-shrink-0">
                  {korisnik.avatar_url && !avatarLoadFailed ? (
                    <img
                      src={korisnik.avatar_url}
                      alt={korisnik.fullName || korisnik.username || ''}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={() => setAvatarLoadFailed(true)}
                    />
                  ) : null}
                  <span className={korisnik.avatar_url && !avatarLoadFailed ? 'invisible' : ''}>
                    {(korisnik.fullName || korisnik.username || '?').charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Name + meta */}
                <div className="flex-1 min-w-0 text-center sm:text-left pb-0 sm:pb-1">
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-[42px] font-extrabold text-gray-900 tracking-tight leading-tight truncate">
                    {korisnik.fullName || korisnik.username}
                  </h1>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1.5 mt-2">
                    <span className="text-sm text-gray-400 font-medium">@{korisnik.username}</span>
                    <span className="hidden sm:inline w-1 h-1 rounded-full bg-gray-300" />
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wide uppercase ${getRoleStyle(korisnik.role)}`}>
                      {getRoleLabel(korisnik.role)}
                    </span>
                    <span className="hidden sm:inline w-1 h-1 rounded-full bg-gray-300" />
                    <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 font-medium">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                      </svg>
                      Član od {formatDate(korisnik.createdAt)}
                    </span>
                  </div>

                  {currentUser && (korisnik.email || korisnik.telefon) && (
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
                      {korisnik.email && (
                        <a
                          href={`mailto:${korisnik.email}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/50 text-xs text-gray-600 hover:text-emerald-700 font-medium transition-all duration-200"
                        >
                          <svg className="w-3.5 h-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                          </svg>
                          {korisnik.email}
                        </a>
                      )}
                      {korisnik.telefon && (
                        <a
                          href={`tel:${korisnik.telefon}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/50 text-xs text-gray-600 hover:text-emerald-700 font-medium transition-all duration-200"
                        >
                          <svg className="w-3.5 h-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                          </svg>
                          {korisnik.telefon}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right column: rank + stats (desktop sidebar) */}
            <div className="hidden lg:flex flex-col items-end gap-4 pt-6 pb-6 flex-shrink-0 w-72 xl:w-80">
              {/* Rank badge */}
              <div
                className="relative flex items-center gap-3 w-full px-5 py-4 rounded-2xl shadow-lg overflow-hidden"
                style={{
                  backgroundColor: rank.boja,
                  color: rank.boja === '#000000' ? '#FFD700' : 'white',
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/15 to-transparent" />
                <div className="relative flex-1">
                  <p className="text-[10px] uppercase tracking-widest opacity-70 font-semibold mb-0.5">Rang</p>
                  <p className="text-lg font-extrabold tracking-wide leading-tight">
                    {formatRankDisplayName(rank, top30Position)}
                  </p>
                </div>
                <div className="relative text-right">
                  <p className="text-2xl font-extrabold">{rank.mmr}</p>
                  <p className="text-[10px] uppercase tracking-wider opacity-70 font-semibold">MMR</p>
                </div>
              </div>

              {/* Stats mini cards */}
              <div className="grid grid-cols-3 gap-3 w-full">
                <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-white border border-emerald-100/60 p-3 text-center">
                  <p className="text-lg xl:text-xl font-extrabold text-gray-900">
                    {statistika.ukupnoMetaraUspona.toLocaleString('sr-RS')}
                  </p>
                  <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider mt-0.5">m uspona</p>
                </div>
                <div className="rounded-xl bg-gradient-to-br from-sky-50 to-white border border-sky-100/60 p-3 text-center">
                  <p className="text-lg xl:text-xl font-extrabold text-gray-900">
                    {statistika.ukupnoKm.toLocaleString('sr-RS', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  </p>
                  <p className="text-[9px] text-sky-600 font-bold uppercase tracking-wider mt-0.5">km staza</p>
                </div>
                <div className="rounded-xl bg-gradient-to-br from-amber-50 to-white border border-amber-100/60 p-3 text-center">
                  <p className="text-lg xl:text-xl font-extrabold text-gray-900">{statistika.brojPopeoSe}</p>
                  <p className="text-[9px] text-amber-600 font-bold uppercase tracking-wider mt-0.5">osvojenih</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ Mobile stats bar (only visible < lg) ═══════ */}
      <div className="lg:hidden bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {/* Mobile rank */}
          <div className="flex justify-center py-4 border-b border-white/10">
            <div
              className="relative flex items-center gap-3 px-5 py-3 rounded-2xl shadow-lg overflow-hidden"
              style={{
                backgroundColor: rank.boja,
                color: rank.boja === '#000000' ? '#FFD700' : 'white',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/15 to-transparent" />
              <span className="relative text-sm tracking-wide leading-tight font-extrabold">
                {formatRankDisplayName(rank, top30Position)}
              </span>
              <span className="relative text-[10px] opacity-80 font-semibold">
                MMR {rank.mmr}
              </span>
            </div>
          </div>

          {/* Mobile stats */}
          <div className="grid grid-cols-3 divide-x divide-white/10">
            <div className="flex flex-col items-center py-5">
              <span className="text-lg sm:text-2xl font-extrabold text-white tracking-tight">
                {statistika.ukupnoMetaraUspona.toLocaleString('sr-RS')}
                <span className="text-xs font-semibold text-emerald-400 ml-0.5">m</span>
              </span>
              <p className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1">Uspon</p>
            </div>
            <div className="flex flex-col items-center py-5">
              <span className="text-lg sm:text-2xl font-extrabold text-white tracking-tight">
                {statistika.ukupnoKm.toLocaleString('sr-RS', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                <span className="text-xs font-semibold text-sky-400 ml-0.5">km</span>
              </span>
              <p className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1">Staza</p>
            </div>
            <div className="flex flex-col items-center py-5">
              <span className="text-lg sm:text-2xl font-extrabold text-white tracking-tight">
                {statistika.brojPopeoSe}
              </span>
              <p className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1">Osvojenih</p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ Akcije ═══════ */}
      <div className="bg-gray-50 min-h-[40vh]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-16 py-8 sm:py-10 lg:py-12">
          <div className="flex items-center gap-3 mb-6 sm:mb-8">
            <div className="w-1.5 h-7 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
            <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
              Akcije na koje se popeo
            </h2>
            {uspesneAkcije.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-[24px] h-[24px] px-2 rounded-full text-[11px] font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm">
                {uspesneAkcije.length}
              </span>
            )}
          </div>

          {uspesneAkcije.length === 0 ? (
            <div className="relative overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-sm p-12 sm:p-16 text-center max-w-2xl mx-auto">
              <div className="absolute top-0 left-0 w-40 h-40 bg-gradient-to-br from-emerald-50/60 to-transparent rounded-br-[80px]" />
              <div className="relative">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 mb-4">
                  <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 6v12.75c0 1.243 1.007 2.25 2.25 2.25z" />
                  </svg>
                </div>
                <p className="text-gray-400 text-sm font-medium">
                  Još nije označen kao uspešno završen ni na jednoj akciji.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-5">
              {uspesneAkcije.map((akcija) => {
                const mmrZaAkciju = computeMMRForAkcija({
                  duzinaStazeKm: akcija.duzinaStazeKm,
                  kumulativniUsponM: akcija.kumulativniUsponM,
                  visinaVrhM: akcija.visinaVrhM,
                  zimskiUspon: akcija.zimskiUspon,
                  tezina: akcija.tezina,
                  datum: akcija.datum,
                })
                const tz = getTezinaStyle(akcija.tezina)

                return (
                  <Link
                    key={akcija.id}
                    to={`/akcije/${akcija.id}`}
                    className="group relative bg-white rounded-xl border border-gray-100/80 shadow-sm overflow-hidden hover:shadow-lg hover:border-gray-200 hover:-translate-y-0.5 transition-all duration-300 hover:no-underline"
                  >
                    <div className="relative w-full h-40 sm:h-44 overflow-hidden bg-gray-100">
                      <img
                        src={akcija.slikaUrl || 'https://via.placeholder.com/600x400?text=Bez+slike'}
                        alt={akcija.naziv}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          e.currentTarget.src = 'https://via.placeholder.com/600x400?text=Slika+nije+dostupna'
                          e.currentTarget.onerror = null
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
                      <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between">
                        <span className="text-white/90 text-[11px] font-semibold bg-white/15 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10">
                          {formatDateShort(akcija.datum)}
                        </span>
                        <span className="text-white text-[11px] font-bold bg-gradient-to-r from-emerald-500 to-teal-500 px-2.5 py-1 rounded-lg shadow-sm">
                          +{mmrZaAkciju} MMR
                        </span>
                      </div>
                    </div>

                    <div className="p-4">
                      <h4 className="text-sm font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-emerald-600 transition-colors duration-200">
                        {akcija.naziv}
                      </h4>

                      <div className="space-y-1 text-[11px] text-gray-400 font-medium">
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3 h-3 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                          </svg>
                          <span className="truncate">{akcija.planina ? `${akcija.planina} — ${akcija.vrh}` : akcija.vrh}</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-gray-500">
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                            </svg>
                            {akcija.duzinaStazeKm?.toFixed(1) || '0.0'} km
                          </span>
                          <span className="w-0.5 h-3 bg-gray-200 rounded-full" />
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                            </svg>
                            {akcija.kumulativniUsponM?.toLocaleString('sr-RS') || '0'} m
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${tz.bg} ${tz.text} ${tz.border}`}>
                          {tz.label}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Popeo se
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}