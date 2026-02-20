import { useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api from '../services/api'

interface Korisnik {
  id: number
  username: string
  fullName: string
  role: 'admin' | 'clan'
  createdAt: string
  updatedAt: string
}

export default function UserProfile() {
  const { id } = useParams<{ id: string }>()
  const [korisnik, setKorisnik] = useState<Korisnik | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchKorisnik = async () => {
      try {
        const res = await api.get(`/api/korisnici/${id}`)
        setKorisnik(res.data)
      } catch (err: any) {
        setError(err.response?.data?.error || 'Greška pri učitavanju profila')
      } finally {
        setLoading(false)
      }
    }

    fetchKorisnik()
  }, [id])

  if (loading) return <div className="text-center py-20">Učitavanje profila...</div>
  if (error || !korisnik) return <div className="text-center py-20 text-red-600">{error || 'Korisnik nije pronađen'}</div>

  return (
    <div className="py-10 px-4 max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="flex flex-col md:flex-row items-center gap-8">
          {/* Avatar */}
          <div className="w-32 h-32 rounded-full bg-linear-to-br from-[#41ac53] to-[#2e8b4a] flex items-center justify-center text-white font-bold text-5xl">
            {korisnik.fullName.charAt(0).toUpperCase()}
          </div>

          <div className="text-center md:text-left">
            <h1 className="text-4xl font-bold text-gray-900">{korisnik.fullName}</h1>
            <p className="text-xl text-gray-600 mt-2">@{korisnik.username}</p>
            <span className={`inline-block mt-4 px-4 py-1 rounded-full text-sm font-medium ${
              korisnik.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
            }`}>
              {korisnik.role === 'admin' ? 'Admin' : 'Član'}
            </span>
            <p className="text-gray-500 mt-4">
              Pridružio se: {new Date(korisnik.createdAt).toLocaleDateString('sr-RS', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            
          </div>
        </div>

        {/* Kasnije dodaj: lista popeo se vrhova, statistiku... */}
        <div className="mt-12">
          <h3 className="text-2xl font-semibold mb-4">Osvojeni vrhovi</h3>
          <p className="text-gray-600">Uskoro...</p>
        </div>
      </div>
    </div>
  )
}