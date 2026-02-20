import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { Link } from 'react-router-dom'

interface Korisnik {
  id: number
  username: string
  fullName: string
  role: 'admin' | 'clan'
  createdAt: string
}

export default function Korisnici() {
  const { user } = useAuth()
  const [korisnici, setKorisnici] = useState<Korisnik[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  if (loading) return <div className="text-center py-10">Učitavanje korisnika...</div>
  if (error) return <div className="text-center py-10 text-red-600">{error}</div>

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold" style={{ color: '#41ac53' }}>
          Članovi kluba
        </h2>

        {user?.role === 'admin' && (
          <Link
            to="/dodaj-korisnika"
            className="px-6 py-3 bg-[#41ac53] text-white rounded-lg font-medium hover:bg-[#3a9a4a] transition-colors"
          >
            Dodaj novog korisnika
          </Link>
        )}
      </div>

      {korisnici.length === 0 ? (
        <p className="text-gray-600 text-center">Još nema registrovanih članova.</p>
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {korisnici.map((k) => (
    <div 
      key={k.id} 
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden transform transition-all 
      duration-300 hover:shadow-2xl hover:-translate-y-1 border border-gray-100 dark:border-gray-700"
    >
      <div className="p-6">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#41ac53] to-[#2e8b4a] flex items-center 
          justify-center text-white font-bold text-xl">
            {k.fullName.charAt(0).toUpperCase()}
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {k.fullName}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              @{k.username}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">Uloga:</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        k.role === 'admin' 
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' 
                          : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      }`}>
                        {k.role === 'admin' ? 'Admin' : 'Član'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Pridružio se: {new Date(k.createdAt).toLocaleDateString('sr-RS', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          </div>
        </div>
      )}
    </div>
  )
}