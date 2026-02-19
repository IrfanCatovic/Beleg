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
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ime i prezime</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Korisničko ime</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uloga</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Datum pridruživanja</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {korisnici.map((k) => (
                  <tr key={k.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{k.fullName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{k.username}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        k.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {k.role === 'admin' ? 'Admin' : 'Član'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(k.createdAt).toLocaleDateString('sr-RS')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}