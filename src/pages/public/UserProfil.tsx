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
  email?: string
  telefon?: string
  role: 'admin' | 'clan' | 'vodic' | 'blagajnik' | 'sekretar' | 'menadzer-opreme'
  createdAt: string
  updatedAt: string
  ukupnoKm: number
  ukupnoMetaraUspona: number
  brojPopeoSe: number
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
        // 1. Osnovni podaci korisnika
        const resKorisnik = await api.get(`/api/korisnici/${id}`)
        setKorisnik(resKorisnik.data)

        // 2. Statistika
        const resStats = await api.get(`/api/korisnici/${id}/statistika`)
        const stats = resStats.data.statistika || {}
        setStatistika({
          ukupnoKm: stats.ukupnoKm || 0,
          ukupnoMetaraUspona: stats.ukupnoMetaraUspona || 0,
          brojPopeoSe: stats.brojPopeoSe || 0,
        })

        // 3. Osvojeni vrhovi
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

  return (
    <div className="pt-4 pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative">

      <ProfileActionButtons
        userId={String(korisnik.id)}
        isOwnProfile={!!isOwnProfile}
        currentUser={currentUser}
        onPrintClick={() => korisnik && generateMemberPdf(korisnik as unknown as MemberPdfData)}
      />

      <div className="bg-white rounded-2xl shadow-xl pt-10 px-4 sm:px-8 pb-12 -mt-4 sm:mt-2 -mx-2 sm:mx-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* Avatar ili slika profila */}
            <div className="relative w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-[#41ac53] to-[#2e8b4a] flex items-center justify-center text-white font-bold text-5xl flex-shrink-0">
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

            <div className="text-center md:text-left">
              <h1 className="text-4xl font-bold text-gray-900">{korisnik.fullName || korisnik.username}</h1>
              <p className="text-xl text-gray-600 mt-2">@{korisnik.username}</p>
              <span className={`inline-block mt-4 px-4 py-1 rounded-full text-sm font-medium ${getRoleStyle(korisnik.role)}`}>
                {getRoleLabel(korisnik.role)}
              </span>
            <p className="text-gray-500 mt-4">
              Pridružio se: {formatDate(korisnik.createdAt)}
            </p>
            {currentUser && korisnik.email && (
              <p className="text-gray-600 mt-2 text-sm">
                <span className="font-medium">Email:</span>{' '}
                <a href={`mailto:${korisnik.email}`} className="text-[#41ac53] hover:underline">
                  {korisnik.email}
                </a>
              </p>
            )}
            {currentUser && korisnik.telefon && (
              <p className="text-gray-600 mt-1 text-sm">
                <span className="font-medium">Telefon:</span>{' '}
                <a href={`tel:${korisnik.telefon}`} className="text-[#41ac53] hover:underline">
                  {korisnik.telefon}
                </a>
              </p>
            )}
          </div>
        </div>

        {/* Rank desno, mobile friendly */}
          <div className="mt-6 md:mt-0 flex md:block justify-center md:justify-end">
            <div
              className="inline-block px-8 py-4 rounded-full text-xl font-bold shadow-md"
              style={{ backgroundColor: rank.boja, color: rank.boja === '#000000' ? '#FFD700' : 'white' }}
            >
              {formatRankDisplayName(rank, top30Position)}
            </div>
          </div>
        </div>

        {/* Statistička sekcija */}
        <div className="bg-gray-50 rounded-xl p-6 mt-10">
          <h3 className="text-xl font-semibold mb-6 text-center" style={{ color: '#41ac53' }}>
            Planinarska statistika
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            <div className="p-4 bg-white rounded-lg shadow-sm">
              <p className="text-3xl font-bold text-[#41ac53]">
                {statistika.ukupnoMetaraUspona.toLocaleString('sr-RS')} m
              </p>
              <p className="text-sm text-gray-600 mt-1">Ukupni uspon</p>
            </div>

            <div className="p-4 bg-white rounded-lg shadow-sm">
              <p className="text-3xl font-bold text-[#41ac53]">
                {statistika.ukupnoKm.toLocaleString('sr-RS', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km
              </p>
              <p className="text-sm text-gray-600 mt-1">Ukupna dužina staza</p>
            </div>

            <div className="p-4 bg-white rounded-lg shadow-sm">
              <p className="text-3xl font-bold text-[#41ac53]">
                {statistika.brojPopeoSe}
              </p>
              <p className="text-sm text-gray-600 mt-1">Akcija popeo se</p>
            </div>
          </div>
        </div>

        {/* Lista uspešnih akcija */}
        <div className="mt-12 sm:mt-14">
          <div className="flex items-center justify-center gap-3 mb-6 sm:mb-8">
            <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight" style={{ color: '#41ac53' }}>
              Akcije na koje se popeo
            </h3>
          </div>

          {uspesneAkcije.length === 0 ? (
            <div className="text-center py-14 sm:py-16 bg-gray-50 rounded-2xl border border-gray-200/80">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#41ac53]/10 text-[#41ac53] mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 011.414-1.414L21 7.5" />
                </svg>
              </div>
              <p className="text-gray-600 text-base sm:text-lg font-medium">Još nije označen kao uspešno završen ni na jednoj akciji.</p>
              <p className="text-gray-500 text-sm mt-1">Kada se popne na akciju, ovde će se prikazati.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-8">
              {uspesneAkcije.map((akcija) => {
                const mmrZaAkciju = computeMMRForAkcija({
                  duzinaStazeKm: akcija.duzinaStazeKm,
                  kumulativniUsponM: akcija.kumulativniUsponM,
                  visinaVrhM: akcija.visinaVrhM,
                  zimskiUspon: akcija.zimskiUspon,
                  tezina: akcija.tezina,
                  datum: akcija.datum,
                })

                return (
                <Link
                  key={akcija.id}
                  to={`/akcije/${akcija.id}`}
                  className="block group relative bg-white rounded-2xl border border-gray-200/80 shadow-md overflow-hidden hover:shadow-xl hover:border-[#41ac53]/30 transition-all duration-300 ease-out hover:no-underline"
                >
                  <div className="relative w-full h-44 sm:h-52 overflow-hidden">
                    <img
                      src={akcija.slikaUrl || 'https://via.placeholder.com/600x400?text=Bez+slike'}
                      alt={akcija.naziv}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/600x400?text=Slika+nije+dostupna'
                        e.currentTarget.onerror = null
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <div className="absolute top-3 right-3 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#41ac53] text-white shadow-lg">
                      Popeo ✓
                    </div>
                  </div>

                  <div className="p-4 sm:p-5">
                    <h4 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 line-clamp-2 leading-tight">
                      {akcija.naziv}
                    </h4>
                    <div className="space-y-1 text-sm text-gray-600">
                      {akcija.planina && (
                        <p><strong className="text-gray-700">Planina:</strong> {akcija.planina}</p>
                      )}
                      <p><strong className="text-gray-700">Vrh:</strong> {akcija.vrh}</p>
                      <p><strong className="text-gray-700">Datum:</strong> {formatDateShort(akcija.datum)}</p>
                      <p><strong className="text-gray-700">Dužina staze:</strong> {akcija.duzinaStazeKm?.toFixed(1) || '0.0'} km</p>
                      <p><strong className="text-gray-700">Uspon:</strong> {akcija.kumulativniUsponM?.toLocaleString('sr-RS') || '0'} m</p>
                      <p><strong className="text-gray-700">MMR sa ove akcije:</strong> <span className="font-semibold">{mmrZaAkciju}</span></p>
                    </div>
                    <span className={`inline-flex items-center w-fit px-3 py-1.5 mt-4 rounded-lg text-xs font-semibold ${
                      akcija.tezina === 'lako' ? 'bg-emerald-100 text-emerald-800' :
                      akcija.tezina === 'srednje' ? 'bg-amber-100 text-amber-800' :
                      akcija.tezina === 'tesko' || akcija.tezina === 'teško' ? 'bg-rose-100 text-rose-800' :
                      akcija.tezina === 'alpinizam' ? 'bg-violet-100 text-violet-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {akcija.tezina === 'tesko' || akcija.tezina === 'teško' ? 'Teško' : akcija.tezina === 'alpinizam' ? 'Alpinizam' : akcija.tezina || 'Nije definisano'}
                    </span>
                  </div>
                </Link>
              )})}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}