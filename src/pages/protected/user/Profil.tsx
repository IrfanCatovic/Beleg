import { useEffect, useState } from 'react'
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
  email?: string
  adresa?: string
  telefon?: string
  role: string
  createdAt: string
}

const tezinaConfig: Record<string, { bg: string; text: string; label: string }> = {
  lako: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Lako' },
  srednje: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Srednje' },
  tesko: { bg: 'bg-red-50', text: 'text-red-700', label: 'Teško' },
  'teško': { bg: 'bg-red-50', text: 'text-red-700', label: 'Teško' },
  alpinizam: { bg: 'bg-violet-50', text: 'text-violet-700', label: 'Alpinizam' },
}

function getTezinaStyle(tezina?: string) {
  if (!tezina) return { bg: 'bg-gray-50', text: 'text-gray-600', label: 'Nepoznato' }
  return tezinaConfig[tezina.toLowerCase()] ?? { bg: 'bg-gray-50', text: 'text-gray-600', label: tezina }
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
  const [legendLevel, setLegendLevel] = useState<number | null>(null)

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

  if (!isLoggedIn) {
    return <div className="text-center py-10">Morate se ulogovati da biste vidjeli profil.</div>
  }

  if (loading) return <Loader />
  if (error) return <div className="text-center py-20 text-red-600">{error}</div>
  if (!me) return null

  const displayName = me.fullName || user?.fullName || ''
  const displayUsername = me.username || user?.username || ''

  return (
    <div className="pt-2 pb-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto relative">
      <ProfileActionButtons
        userId={me.id}
        isOwnProfile
        currentUser={user}
        onPrintClick={() => generateMemberPdf(me as unknown as MemberPdfData)}
      />

      {/* ═══════ Hero card ═══════ */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Gradient banner */}
        <div className="h-32 sm:h-40 bg-gradient-to-br from-[#41ac53] via-[#4db862] to-[#2e8b4a] relative">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPjwvc3ZnPg==')] opacity-60" />
        </div>

        <div className="px-6 sm:px-10 pb-8 -mt-16 sm:-mt-20 relative">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            {/* Avatar */}
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5">
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden bg-gradient-to-br from-[#41ac53] to-[#2e8b4a] flex items-center justify-center text-white font-bold text-4xl sm:text-5xl ring-4 ring-white shadow-lg flex-shrink-0">
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

              <div className="text-center sm:text-left pb-1">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
                  {displayName}
                </h1>
                <p className="text-base text-gray-500 mt-0.5">@{displayUsername}</p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getRoleStyle(me.role)}`}>
                    {getRoleLabel(me.role)}
                  </span>
                  <span className="text-xs text-gray-400">
                    Član od {formatDate(me.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Rank badge */}
            <div className="flex justify-center sm:justify-end pb-1">
              <div
                className="flex flex-col items-center px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm border border-white/20"
                style={{
                  backgroundColor: rank.boja,
                  color: rank.boja === '#000000' ? '#FFD700' : 'white',
                }}
              >
                <span className="text-sm tracking-wide leading-tight">
                  {formatRankDisplayName(rank, legendLevel)}
                </span>
                <span className="text-[11px] opacity-80 mt-0.5">
                  MMR {rank.mmr}
                </span>
              </div>
            </div>
          </div>

          {/* Contact pills */}
          {(me.email || me.telefon) && (
            <div className="flex flex-wrap items-center gap-3 mt-5 pt-5 border-t border-gray-100">
              {me.email && (
                <a
                  href={`mailto:${me.email}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm text-gray-700 transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  {me.email}
                </a>
              )}
              {me.telefon && (
                <a
                  href={`tel:${me.telefon}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm text-gray-700 transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5 text-center group hover:border-[#41ac53]/30 transition-colors">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-50 text-[#41ac53] mb-3">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
            </svg>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">
            {statistika.ukupnoMetaraUspona.toLocaleString('sr-RS')}
            <span className="text-sm font-medium text-gray-400 ml-1">m</span>
          </p>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">Ukupni uspon</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5 text-center group hover:border-[#41ac53]/30 transition-colors">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-50 text-[#41ac53] mb-3">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
            </svg>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">
            {statistika.ukupnoKm.toLocaleString('sr-RS', {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}
            <span className="text-sm font-medium text-gray-400 ml-1">km</span>
          </p>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">Ukupna dužina staza</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5 text-center group hover:border-[#41ac53]/30 transition-colors">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-50 text-[#41ac53] mb-3">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
            </svg>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{statistika.brojPopeoSe}</p>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">Osvojenih akcija</p>
        </div>
      </div>

      {/* ═══════ Akcije na koje si se popeo ═══════ */}
      <div className="mt-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1 h-7 rounded-full bg-[#41ac53]" />
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            Akcije na koje si se popeo
          </h2>
          {uspesneAkcije.length > 0 && (
            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-[#41ac53]">
              {uspesneAkcije.length}
            </span>
          )}
        </div>

        {uspesneAkcije.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-50 mb-4">
              <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 6v12.75c0 1.243 1.007 2.25 2.25 2.25z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">
              Još nisi označen kao uspešno završen ni na jednoj akciji.
            </p>
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
                  className="group bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-gray-200 transition-all duration-200 hover:no-underline"
                >
                  {/* Image */}
                  <div className="relative w-full h-44 overflow-hidden bg-gray-100">
                    <img
                      src={akcija.slikaUrl || 'https://via.placeholder.com/600x400?text=Bez+slike'}
                      alt={akcija.naziv}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/600x400?text=Slika+nije+dostupna'
                        e.currentTarget.onerror = null
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                      <span className="text-white text-xs font-medium bg-black/30 backdrop-blur-sm px-2 py-1 rounded-md">
                        {formatDateShort(akcija.datum)}
                      </span>
                      <span className="bg-emerald-500 text-white text-[11px] font-bold px-2 py-1 rounded-md shadow">
                        +{mmrZaAkciju} MMR
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-[#41ac53] transition-colors">
                      {akcija.naziv}
                    </h4>

                    <div className="space-y-1.5 text-xs text-gray-500">
                      {akcija.planina && (
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                          </svg>
                          <span>{akcija.planina} — {akcija.vrh}</span>
                        </div>
                      )}
                      {!akcija.planina && (
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                          </svg>
                          <span>Vrh: {akcija.vrh}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <span>{akcija.duzinaStazeKm?.toFixed(1) || '0.0'} km</span>
                        <span className="w-0.5 h-0.5 rounded-full bg-gray-300" />
                        <span>{akcija.kumulativniUsponM?.toLocaleString('sr-RS') || '0'} m</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${tz.bg} ${tz.text}`}>
                        {tz.label}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
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
