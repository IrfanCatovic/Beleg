import { useEffect, useState, useMemo } from 'react'
import { Cog6ToothIcon, InformationCircleIcon, PrinterIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { getRoleLabel, getRoleStyle } from '../utils/roleUtils'
import { Link } from 'react-router-dom'

interface Korisnik {
  id: number
  username: string
  fullName?: string
  avatar_url?: string
  role: string
  createdAt: string
}

export default function Korisnici() {
  const { user } = useAuth()
  const [korisnici, setKorisnici] = useState<Korisnik[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [avatarFailed, setAvatarFailed] = useState<Record<number, boolean>>({})

  useEffect(() => {
    if (!user) return

    const fetchKorisnici = async () => {
      try {
        const res = await api.get('/api/korisnici')
        setKorisnici(res.data.korisnici || [])
      } catch (err: any) {
        setError(err.response?.data?.error || 'Greška pri učitavanju korisnika')
      } finally {
        setLoading(false)
      }
    }

    fetchKorisnici()
  }, [user])

  
  const filteredKorisnici = useMemo(() => {
    if (!searchTerm.trim()) return korisnici

    const lowerSearch = searchTerm.toLowerCase()
    return korisnici.filter(k =>
      (k.username || '').toLowerCase().includes(lowerSearch) ||
      (k.fullName || '').toLowerCase().includes(lowerSearch)
    )
  }, [korisnici, searchTerm])

  if (loading) return <div className="text-center py-10">Učitavanje korisnika...</div>
  if (error) return <div className="text-center py-10 text-red-600">{error}</div>

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-8xl mx-auto">
      
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h2 className="text-3xl font-bold" style={{ color: '#41ac53' }}>
          Članovi kluba
        </h2>

        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Pretraži po imenu ili username-u..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:border-[#41ac53] focus:ring-2
             focus:ring-[#41ac53]/30 outline-none transition-all duration-200"
          />
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {(user?.role === 'admin' || user?.role === 'sekretar') && (
          <Link
            to="/dodaj-korisnika"
            className="px-6 py-3 bg-[#41ac53] text-white rounded-lg font-medium hover:bg-[#3a9a4a] 
            transition-colors whitespace-nowrap"
          >
            Dodaj novog korisnika
          </Link>
        )}
      </div>

      {filteredKorisnici.length === 0 ? (
        <p className="text-gray-600 text-center">
          {searchTerm ? `Nema članova za pretragu "${searchTerm}"` : 'Još nema registrovanih članova.'}
        </p>
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
            {filteredKorisnici.map((k) => (
              <div
                key={k.id}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden transform transition-all 
                duration-300 hover:shadow-2xl hover:-translate-y-1 border border-gray-100 dark:border-gray-700"
              >
                <div className="p-6">
                  <Link to={`/users/${k.id}`} className="block" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-4">
                      <div className="relative w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-[#41ac53] to-[#2e8b4a] flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                        {k.avatar_url && !avatarFailed[k.id] ? (
                          <img
                            src={k.avatar_url}
                            alt={k.fullName || k.username || ''}
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={() => setAvatarFailed((prev) => ({ ...prev, [k.id]: true }))}
                          />
                        ) : null}
                        <span className={k.avatar_url && !avatarFailed[k.id] ? 'invisible' : ''}>
                          {(k.fullName || k.username || '?').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {k.fullName || k.username}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          @{k.username}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Uloga:</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleStyle(k.role)}`}>
                          {getRoleLabel(k.role)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Pridružio se: {new Date(k.createdAt).toLocaleDateString('sr-RS', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                    </div>
                  </Link>

                  {/* Ikonice: podešavanja, lista (info), štampač */}
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end gap-2">
                    {(user?.role === 'admin' || user?.role === 'sekretar' || user?.username === k.username) && (
                      <Link
                        to={user?.username === k.username ? '/profil/podesavanja' : `/profil/podesavanja/${k.id}`}
                        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
                        title="Podešavanja"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Cog6ToothIcon className="w-5 h-5" />
                      </Link>
                    )}
                    {(user?.role === 'admin' || user?.role === 'sekretar') && (
                      <Link
                        to={`/users/${k.id}/info`}
                        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
                        title="Sve informacije o korisniku"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <InformationCircleIcon className="w-5 h-5" />
                      </Link>
                    )}
                    <button
                      type="button"
                      className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer"
                      title="Štampanje (uskoro)"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <PrinterIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}