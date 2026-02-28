import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api from '../services/api'
import { getRoleLabel, getRoleStyle } from '../utils/roleUtils'
import BackButton from '../components/BackButton'

interface KorisnikInfo {
  id: number
  username: string
  fullName?: string
  avatar_url?: string
  email?: string
  telefon?: string
  role: string
  createdAt: string
  updatedAt: string
  ime_roditelja?: string
  pol?: string
  datum_rodjenja?: string | null
  drzavljanstvo?: string
  adresa?: string
  broj_licnog_dokumenta?: string
  broj_planinarske_legitimacije?: string
  broj_planinarske_markice?: string
  datum_uclanjenja?: string | null
  izrecene_disciplinske_kazne?: string
  izbor_u_organe_sportskog_udruzenja?: string
  napomene?: string
  ukupnoKm?: number
  ukupnoMetaraUspona?: number
  brojPopeoSe?: number
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('sr-RS', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatPol(pol: string | undefined): string {
  if (!pol) return '—'
  if (pol === 'M') return 'Muški'
  if (pol === 'Ž') return 'Ženski'
  return pol
}

function InfoRow({ label, value, alwaysShow = false }: { label: string; value: React.ReactNode; alwaysShow?: boolean }) {
  const isEmpty = value === undefined || value === null || value === ''
  if (!alwaysShow && isEmpty) return null
  const displayValue = isEmpty ? '—' : value
  return (
    <div className="flex flex-wrap gap-2 py-2.5 border-b border-gray-100 last:border-0">
      <span className="font-medium text-gray-600 min-w-[200px] shrink-0">{label}</span>
      <span className="text-gray-900">{displayValue}</span>
    </div>
  )
}

export default function UserInfo() {
  const { id } = useParams<{ id: string }>()
  const [korisnik, setKorisnik] = useState<KorisnikInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false)

  useEffect(() => {
    if (!id) return
    const fetchData = async () => {
      setLoading(true)
      try {
        const res = await api.get(`/api/korisnici/${id}`)
        setKorisnik(res.data)
      } catch (err: any) {
        setError(err.response?.data?.error || 'Greška pri učitavanju podataka')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id])

  if (loading) return <div className="text-center py-20">Učitavanje...</div>
  if (error || !korisnik) return <div className="text-center py-20 text-red-600">{error || 'Korisnik nije pronađen'}</div>

  return (
    <div className="pt-4 pb-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden relative">
        <div className="p-6 sm:p-8 border-b border-gray-100">
          <div className="absolute top-6 right-6 flex flex-col items-end gap-2 [&_button]:mb-0">
            <BackButton />
            <Link to={`/users/${id}`} className="text-sm font-medium text-[#41ac53] hover:underline">
              Pogledaj profil
            </Link>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-6 pr-32">
            <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-[#41ac53] to-[#2e8b4a] flex items-center justify-center text-white font-bold text-3xl flex-shrink-0">
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
            <div className="text-center sm:text-left">
              <h1 className="text-2xl font-bold text-gray-900">{korisnik.fullName || korisnik.username}</h1>
              <p className="text-gray-600">@{korisnik.username}</p>
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${getRoleStyle(korisnik.role)}`}>
                {getRoleLabel(korisnik.role)}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-8">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4" style={{ color: '#41ac53' }}>
              Osnovni podaci
            </h2>
            <div className="bg-gray-50 rounded-xl p-4">
              <InfoRow label="ID korisnika" value={korisnik.id} alwaysShow />
              <InfoRow label="Ime i prezime" value={korisnik.fullName} alwaysShow />
              <InfoRow label="Korisničko ime" value={korisnik.username} alwaysShow />
              <InfoRow label="Email" value={korisnik.email ? <a href={`mailto:${korisnik.email}`} className="text-[#41ac53] hover:underline">{korisnik.email}</a> : undefined} alwaysShow />
              <InfoRow label="Telefon" value={korisnik.telefon ? <a href={`tel:${korisnik.telefon}`} className="text-[#41ac53] hover:underline">{korisnik.telefon}</a> : undefined} alwaysShow />
              <InfoRow label="Uloga" value={getRoleLabel(korisnik.role)} alwaysShow />
              <InfoRow label="Datum registracije" value={formatDate(korisnik.createdAt)} alwaysShow />
              <InfoRow label="Poslednja izmena" value={formatDate(korisnik.updatedAt)} alwaysShow />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4" style={{ color: '#41ac53' }}>
              Lični podaci
            </h2>
            <div className="bg-gray-50 rounded-xl p-4">
              <InfoRow label="Ime roditelja" value={korisnik.ime_roditelja} alwaysShow />
              <InfoRow label="Pol" value={formatPol(korisnik.pol)} alwaysShow />
              <InfoRow label="Datum rođenja" value={formatDate(korisnik.datum_rodjenja ?? undefined)} alwaysShow />
              <InfoRow label="Državljanstvo" value={korisnik.drzavljanstvo} alwaysShow />
              <InfoRow label="Adresa" value={korisnik.adresa} alwaysShow />
              <InfoRow label="Broj ličnog dokumenta" value={korisnik.broj_licnog_dokumenta} alwaysShow />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4" style={{ color: '#41ac53' }}>
              Planinarski podaci
            </h2>
            <div className="bg-gray-50 rounded-xl p-4">
              <InfoRow label="Broj planinarske legitimacije" value={korisnik.broj_planinarske_legitimacije} alwaysShow />
              <InfoRow label="Broj planinarske markice" value={korisnik.broj_planinarske_markice} alwaysShow />
              <InfoRow label="Datum učlanjenja" value={formatDate(korisnik.datum_uclanjenja ?? undefined)} alwaysShow />
              <InfoRow label="Ukupno km" value={korisnik.ukupnoKm != null ? `${Number(korisnik.ukupnoKm).toFixed(1)} km` : undefined} alwaysShow />
              <InfoRow label="Ukupno metara uspona" value={korisnik.ukupnoMetaraUspona != null ? `${korisnik.ukupnoMetaraUspona.toLocaleString('sr-RS')} m` : undefined} alwaysShow />
              <InfoRow label="Broj akcija (popeo se)" value={korisnik.brojPopeoSe != null ? String(korisnik.brojPopeoSe) : undefined} alwaysShow />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4" style={{ color: '#41ac53' }}>
              Napomene i ostalo
            </h2>
            <div className="bg-gray-50 rounded-xl p-4">
              <InfoRow label="Izrečene disciplinske kazne" value={korisnik.izrecene_disciplinske_kazne} alwaysShow />
              <InfoRow label="Izbor u organe sportskog udruženja" value={korisnik.izbor_u_organe_sportskog_udruzenja} alwaysShow />
              <InfoRow label="Napomene" value={korisnik.napomene} alwaysShow />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
