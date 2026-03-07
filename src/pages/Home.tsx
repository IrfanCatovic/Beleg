
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { formatDateShort } from '../utils/dateUtils'
import Loader from '../components/Loader'

interface Akcija {
  id: number
  naziv: string
  planina?: string
  vrh: string
  datum: string
  opis?: string
  tezina?: string
  slikaUrl?: string
  isCompleted: boolean
}

interface Statistika {
  ukupnoKm: number
  ukupnoMetaraUspona: number
  brojPopeoSe: number
}

export default function Home() {
  const { isLoggedIn, user } = useAuth()
  const [aktivneAkcije, setAktivneAkcije] = useState<Akcija[]>([])
  const [zavrseneAkcije, setZavrseneAkcije] = useState<Akcija[]>([])
  const [statistika, setStatistika] = useState<Statistika>({
    ukupnoKm: 0,
    ukupnoMetaraUspona: 0,
    brojPopeoSe: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isLoggedIn) return

    const fetchData = async () => {
      setLoading(true)
      try {
        const [akcijeRes, popeoRes] = await Promise.all([
          api.get('/api/akcije'),
          api.get('/api/moje-popeo-se'),
        ])

        const aktivne = (akcijeRes.data.aktivne || []) as Akcija[]
        const zavrsene = (akcijeRes.data.zavrsene || []) as Akcija[]
        setAktivneAkcije(aktivne)
        setZavrseneAkcije(zavrsene)

        const stats = popeoRes.data.statistika || {}
        setStatistika({
          ukupnoKm: stats.ukupnoKm || 0,
          ukupnoMetaraUspona: stats.ukupnoMetaraUspona || 0,
          brojPopeoSe: stats.brojPopeoSe || 0,
        })
      } catch (err: any) {
        setError(err.response?.data?.error || 'Greška pri učitavanju početne stranice')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [isLoggedIn])

  const sledeceAkcije = useMemo(() => {
    const now = new Date()
    return [...aktivneAkcije]
      .filter((a) => (a.datum ? new Date(a.datum) >= now : true))
      .sort((a, b) => new Date(a.datum).getTime() - new Date(b.datum).getTime())
  }, [aktivneAkcije])

  const nedavneZavrsene = useMemo(
    () =>
      [...zavrseneAkcije].sort(
        (a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime()
      ),
    [zavrseneAkcije]
  )

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Dobrodošli u planinarski klub</h2>
          <p className="text-gray-600 mb-4">
            Ulogujte se da vidite svoje akcije, statistiku i novosti iz kluba.
          </p>
          <p className="text-gray-500 text-sm">
            Ako još nemate nalog, obratite se administratoru kluba.
          </p>
        </div>
      </div>
    )
  }

  if (loading) return <Loader />

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center text-red-600">
          <h2 className="text-xl font-bold mb-2">Greška</h2>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  const displayName = user?.fullName || user?.username || 'planinaru'

  return (
    <div className="relative min-h-screen bg-gray-50 pb-16 md:pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero + statistika */}
        <section className="mb-10 sm:mb-14">
          <div className="bg-white rounded-2xl shadow-lg px-6 sm:px-10 py-8 sm:py-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div>
              <p className="text-sm font-medium text-[#41ac53] uppercase tracking-wide mb-2">
                Dobrodošao nazad
              </p>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-3">
                {displayName},
              </h1>
              <p className="text-gray-600 max-w-xl mb-6">
                Ovde možeš da ispratiš najvažnije novosti iz kluba, sledeće akcije i svoj napredak u
                planinama.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/akcije"
                  className="inline-flex items-center px-5 py-2.5 rounded-full text-sm font-semibold text-white bg-[#41ac53] hover:bg-[#358f43] transition-colors"
                >
                  Pogledaj sve akcije
                </Link>
                <Link
                  to="/profil"
                  className="inline-flex items-center px-5 py-2.5 rounded-full text-sm font-semibold text-[#41ac53] bg-[#e6f6ea] hover:bg-[#d3eddc] transition-colors"
                >
                  Moj profil i statistika
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full lg:w-auto">
              <div className="bg-gray-50 rounded-xl px-4 py-3 text-center">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Ukupna dužina staza
                </p>
                <p className="mt-2 text-2xl font-bold text-[#41ac53]">
                  {statistika.ukupnoKm.toLocaleString('sr-RS', {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}{' '}
                  km
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl px-4 py-3 text-center">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Ukupan uspon
                </p>
                <p className="mt-2 text-2xl font-bold text-[#41ac53]">
                  {statistika.ukupnoMetaraUspona.toLocaleString('sr-RS')} m
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl px-4 py-3 text-center">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Akcije „popeo se”
                </p>
                <p className="mt-2 text-2xl font-bold text-[#41ac53]">
                  {statistika.brojPopeoSe}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Sledeće akcije + novosti */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start mb-10">
          {/* Sledeće akcije */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Sledeće akcije kluba</h2>
              <Link
                to="/akcije"
                className="text-sm font-medium text-[#41ac53] hover:text-[#2e8b4a]"
              >
                Sve akcije
              </Link>
            </div>

            {sledeceAkcije.length === 0 ? (
              <p className="text-gray-600 mt-4">
                Trenutno nema zakazanih akcija. Proveri uskoro ili pogledaj završene ture.
              </p>
            ) : (
              <div className="mt-5 overflow-y-auto max-h-[280px] pr-1 space-y-4 rounded-lg -mr-1">
                {sledeceAkcije.map((akcija) => (
                  <Link
                    key={akcija.id}
                    to={`/akcije/${akcija.id}`}
                    className="block rounded-xl border border-gray-100 hover:border-[#41ac53] shadow-sm hover:shadow-md transition-all bg-white p-4 sm:p-5 shrink-0"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {akcija.naziv}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {[
                            akcija.planina,
                            akcija.vrh,
                            akcija.datum && formatDateShort(akcija.datum),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                        {akcija.opis && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{akcija.opis}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span
                          className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                            akcija.tezina === 'lako'
                              ? 'bg-green-100 text-green-800'
                              : akcija.tezina === 'srednje'
                                ? 'bg-yellow-100 text-yellow-800'
                                : akcija.tezina === 'tesko' || akcija.tezina === 'teško'
                                  ? 'bg-red-100 text-red-800'
                                  : akcija.tezina === 'alpinizam'
                                    ? 'bg-violet-100 text-violet-800'
                                    : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {akcija.tezina === 'tesko' || akcija.tezina === 'teško' ? 'Teško' : akcija.tezina === 'alpinizam' ? 'Alpinizam' : akcija.tezina || 'Nivo nije postavljen'}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Novosti / završene akcije */}
          <div className="bg-white rounded-2xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Novosti iz akcija</h2>
            {nedavneZavrsene.length === 0 ? (
              <p className="text-gray-600">
                Još nema završenih akcija za prikaz. Kada se akcije označe kao završene, ovde će se
                pojaviti novosti.
              </p>
            ) : (
              <ul className="space-y-4 overflow-y-auto max-h-[240px] pr-1 rounded-lg -mr-1">
                {nedavneZavrsene.map((akcija) => (
                  <li key={akcija.id} className="border-b border-gray-100 pb-3 last:border-0 shrink-0">
                    <Link
                      to={`/akcije/${akcija.id}`}
                      className="block hover:no-underline hover:text-inherit"
                    >
                      <p className="text-sm text-gray-500 mb-1">
                        Završena akcija · {formatDateShort(akcija.datum)}
                      </p>
                      <p className="font-semibold text-gray-900">
                        {akcija.naziv}{' '}
                        {akcija.planina ? (
                          <span className="text-gray-600 font-normal">· {akcija.planina}</span>
                        ) : null}
                      </p>
                      {akcija.opis && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{akcija.opis}</p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Vlog / priče sa terena – za sada statičan teaser */}
        <section className="bg-white rounded-2xl shadow-md p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Vlog i priče sa terena</h2>
            <span className="inline-flex items-center rounded-full bg-[#e6f6ea] text-[#2e8b4a] px-3 py-1 text-xs font-semibold">
              Uskoro više sadržaja
            </span>
          </div>
          <p className="text-gray-600 mb-4">
            Planiramo da ovde objavljujemo priče, fotografije i video zapise sa akcija – idealno
            mesto da se prisjetiš tura i inspirišeš za sledeće.
          </p>
          <p className="text-sm text-gray-500">
            Za sada možeš pogledati detalje završених akcija ili posjetiti svoj profil da vidiš na
            kojim si se sve vrhovima već popeo.
          </p>
        </section>
      </div>
    </div>
  )
}