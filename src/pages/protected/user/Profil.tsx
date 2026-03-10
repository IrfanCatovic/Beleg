import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import api from '../../../services/api'
import { getRoleLabel, getRoleStyle } from '../../../utils/roleUtils'
import ProfileActionButtons from '../../../components/ProfileActionButtons'
import { generateMemberPdf, type MemberPdfData } from '../../../utils/generateMemberPdf'
import { formatDate, formatDateShort } from '../../../utils/dateUtils'
import { useRanking } from '../../../hooks/useRanking'
import { computeMMRForAkcija, computeRank, formatRankDisplayName } from '../../../utils/rankingUtils'
import Loader from '../../../components/Loader'

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

interface MeKorisnik {
  id: number
  username: string
  fullName: string
  avatar_url?: string
  cover_image_url?: string
  email?: string
  adresa?: string
  telefon?: string
  role: string
  createdAt: string
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

export default function Profil() {
  const { isLoggedIn, user } = useAuth()
  const [me, setMe] = useState<MeKorisnik | null>(null)
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
  const [coverLoadFailed, setCoverLoadFailed] = useState(false)
  const [legendLevel, setLegendLevel] = useState<number | null>(null)
  const [uploadingCover, setUploadingCover] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isLoggedIn) return

    const fetchProfilData = async () => {
      setLoading(true)
      try {
        const [resMe, resPopeo] = await Promise.all([
          api.get<MeKorisnik>('/api/me'),
          api.get('/api/moje-popeo-se'),
        ])
        setMe(resMe.data)
        setUspesneAkcije(resPopeo.data.uspesneAkcije || [])

        const statsFromMe = {
          ukupnoKm: (resMe.data as any).ukupnoKm ?? 0,
          ukupnoMetaraUspona: (resMe.data as any).ukupnoMetaraUspona ?? 0,
          brojPopeoSe: (resMe.data as any).brojPopeoSe ?? 0,
        }

        setStatistika(statsFromMe)
      } catch (err: any) {
        console.error('Greška:', err)
        setError(err.response?.data?.error || 'Greška pri učitavanju profila')
      } finally {
        setLoading(false)
      }
    }

    fetchProfilData()
  }, [isLoggedIn])

  useEffect(() => {
    const loadTop30Position = async () => {
      if (!me) {
        setLegendLevel(null)
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
        const index = sorted.findIndex((k) => k.id === me.id)
        if (index >= 0 && index < 30) {
          setLegendLevel(index + 1)
        } else {
          setLegendLevel(null)
        }
      } catch {
        setLegendLevel(null)
      }
    }

    if (isLoggedIn) {
      loadTop30Position()
    }
  }, [isLoggedIn, me])

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !me) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) return

    setUploadingCover(true)
    try {
      const formData = new FormData()
      formData.append('coverImage', file)
      formData.append('username', me.username)
      const res = await api.patch('/api/me', formData)
      const updated = res.data.korisnik
      if (updated?.cover_image_url) {
        setMe((prev) => prev ? { ...prev, cover_image_url: updated.cover_image_url } : prev)
        setCoverLoadFailed(false)
      }
    } catch (err) {
      console.error('Cover upload error:', err)
    } finally {
      setUploadingCover(false)
      if (coverInputRef.current) coverInputRef.current.value = ''
    }
  }

  if (!isLoggedIn) {
    return <div className="text-center py-10">Morate se ulogovati da biste vidjeli profil.</div>
  }

  if (loading) return <Loader />
  if (error) return <div className="text-center py-20 text-red-600">{error}</div>
  if (!me) return null

  const displayName = me.fullName || user?.fullName || ''
  const displayUsername = me.username || user?.username || ''
  const hasCover = me.cover_image_url && !coverLoadFailed

  return (
    <div className="pt-2 pb-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto relative">
      <ProfileActionButtons
        userId={me.id}
        isOwnProfile
        currentUser={user}
        onPrintClick={() => generateMemberPdf(me as unknown as MemberPdfData)}
      />

      {/* ═══════ Hero card ═══════ */}
      <div className="rounded-2xl shadow-sm border border-gray-100/80 overflow-hidden bg-white">
        {/* Cover / banner — standalone, nothing overlaps it */}
        <div className="relative h-36 sm:h-44">
          {hasCover ? (
            <img
              src={me.cover_image_url}
              alt="Cover"
              className="absolute inset-0 w-full h-full object-cover"
              onError={() => setCoverLoadFailed(true)}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-transparent" />

          {/* Cover upload — top-left corner */}
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleCoverUpload}
          />
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            disabled={uploadingCover}
            className="absolute top-3 left-3 z-20 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 backdrop-blur-md text-white text-xs font-medium hover:bg-black/60 transition-colors duration-150 cursor-pointer"
          >
            {uploadingCover ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
            )}
            {uploadingCover ? 'Upload...' : hasCover ? 'Promeni cover' : 'Dodaj cover'}
          </button>
        </div>

        {/* Profile info — completely below cover, no overlap */}
        <div className="px-5 sm:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            {/* Left: Avatar + text */}
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-4">
              <div className="relative w-20 h-20 sm:w-[88px] sm:h-[88px] rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-3xl ring-[3px] ring-gray-100 shadow-md flex-shrink-0">
                {me.avatar_url && !avatarLoadFailed ? (
                  <img
                    src={me.avatar_url}
                    alt={displayName}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={() => setAvatarLoadFailed(true)}
                  />
                ) : null}
                <span className={me.avatar_url && !avatarLoadFailed ? 'invisible' : ''}>
                  {(displayName || displayUsername || '?').charAt(0).toUpperCase()}
                </span>
              </div>

              <div className="text-center sm:text-left">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-tight">
                  {displayName}
                </h1>
                <p className="text-sm text-gray-400 mt-0.5 font-medium">@{displayUsername}</p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wide uppercase ${getRoleStyle(me.role)}`}>
                    {getRoleLabel(me.role)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 font-medium">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                    Član od {formatDate(me.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Rank */}
            <div className="flex justify-center sm:justify-end">
              <div
                className="relative flex flex-col items-center px-5 py-2.5 rounded-xl text-sm font-bold shadow-md overflow-hidden"
                style={{
                  backgroundColor: rank.boja,
                  color: rank.boja === '#000000' ? '#FFD700' : 'white',
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
                <span className="relative text-sm tracking-wide leading-tight">
                  {formatRankDisplayName(rank, legendLevel)}
                </span>
                <span className="relative text-[10px] opacity-75 mt-0.5 font-semibold">
                  MMR {rank.mmr}
                </span>
              </div>
            </div>
          </div>

          {/* Contact */}
          {(me.email || me.telefon) && (
            <div className="flex flex-wrap items-center gap-2.5 mt-5 pt-4 border-t border-gray-100/80">
              {me.email && (
                <a
                  href={`mailto:${me.email}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-gray-50 to-gray-50/50 border border-gray-100 hover:border-emerald-200 hover:from-emerald-50/50 hover:to-emerald-50/30 text-xs text-gray-600 hover:text-emerald-700 font-medium transition-all duration-200"
                >
                  <svg className="w-3.5 h-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  {me.email}
                </a>
              )}
              {me.telefon && (
                <a
                  href={`tel:${me.telefon}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-gray-50 to-gray-50/50 border border-gray-100 hover:border-emerald-200 hover:from-emerald-50/50 hover:to-emerald-50/30 text-xs text-gray-600 hover:text-emerald-700 font-medium transition-all duration-200"
                >
                  <svg className="w-3.5 h-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                  {me.telefon}
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══════ Statistics ═══════ */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-5">
        {/* Uspon */}
        <div className="relative overflow-hidden bg-gradient-to-br from-white to-emerald-50/40 rounded-xl border border-emerald-100/60 shadow-sm p-4 sm:p-5 text-center group hover:shadow-md hover:border-emerald-200/60 transition-all duration-200">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-emerald-100/40 to-transparent rounded-bl-[40px]" />
          <div className="relative">
            <div className="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white mb-2.5 shadow-sm">
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
              </svg>
            </div>
            <p className="text-lg sm:text-2xl font-extrabold text-gray-900 tracking-tight">
              {statistika.ukupnoMetaraUspona.toLocaleString('sr-RS')}
              <span className="text-xs sm:text-sm font-semibold text-emerald-500 ml-0.5">m</span>
            </p>
            <p className="text-[10px] sm:text-xs text-gray-400 font-semibold uppercase tracking-wider mt-1">Ukupni uspon</p>
          </div>
        </div>

        {/* Km */}
        <div className="relative overflow-hidden bg-gradient-to-br from-white to-sky-50/40 rounded-xl border border-sky-100/60 shadow-sm p-4 sm:p-5 text-center group hover:shadow-md hover:border-sky-200/60 transition-all duration-200">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-sky-100/40 to-transparent rounded-bl-[40px]" />
          <div className="relative">
            <div className="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white mb-2.5 shadow-sm">
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
              </svg>
            </div>
            <p className="text-lg sm:text-2xl font-extrabold text-gray-900 tracking-tight">
              {statistika.ukupnoKm.toLocaleString('sr-RS', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
              <span className="text-xs sm:text-sm font-semibold text-sky-500 ml-0.5">km</span>
            </p>
            <p className="text-[10px] sm:text-xs text-gray-400 font-semibold uppercase tracking-wider mt-1">Dužina staza</p>
          </div>
        </div>

        {/* Akcije */}
        <div className="relative overflow-hidden bg-gradient-to-br from-white to-amber-50/40 rounded-xl border border-amber-100/60 shadow-sm p-4 sm:p-5 text-center group hover:shadow-md hover:border-amber-200/60 transition-all duration-200">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-amber-100/40 to-transparent rounded-bl-[40px]" />
          <div className="relative">
            <div className="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white mb-2.5 shadow-sm">
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
              </svg>
            </div>
            <p className="text-lg sm:text-2xl font-extrabold text-gray-900 tracking-tight">{statistika.brojPopeoSe}</p>
            <p className="text-[10px] sm:text-xs text-gray-400 font-semibold uppercase tracking-wider mt-1">Osvojenih</p>
          </div>
        </div>
      </div>

      {/* ═══════ Akcije ═══════ */}
      <div className="mt-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1.5 h-7 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
            Akcije na koje si se popeo
          </h2>
          {uspesneAkcije.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm">
              {uspesneAkcije.length}
            </span>
          )}
        </div>

        {uspesneAkcije.length === 0 ? (
          <div className="relative overflow-hidden bg-gradient-to-br from-white to-gray-50/50 rounded-xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-emerald-50/50 to-transparent rounded-br-[60px]" />
            <div className="relative">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 mb-4">
                <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 6v12.75c0 1.243 1.007 2.25 2.25 2.25z" />
                </svg>
              </div>
              <p className="text-gray-400 text-sm font-medium">
                Još nisi označen kao uspešno završen ni na jednoj akciji.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  {/* Image */}
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

                  {/* Content */}
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
  )
}
