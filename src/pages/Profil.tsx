import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

interface MojaPrijava {
  AkcijaID: number
  Naziv: string
  Vrh: string
  Datum: string
  Opis?: string
  Tezina?: string
  PrijavljenAt: string
}

export default function Profil() {
  const { isLoggedIn, user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [prijave, setPrijave] = useState<MojaPrijava[]>([])
  const [error, setError] = useState('')

        useEffect(() => {
            if (!isLoggedIn) return

            const fetchMojePrijave = async () => {
                setLoading(true)
                try {
                const res = await api.get('/api/moje-akcije-profil') 


                const mojePrijave = res.data?.prijave || [] 
                setPrijave(mojePrijave)
                } catch (err: any) {
                console.error("Greška:", err)
                setError(err.response?.data?.error || 'Greška pri učitavanju tvojih prijava')
                } finally {
                setLoading(false)
                }
            }

            fetchMojePrijave()
        }, [isLoggedIn])

  if (!isLoggedIn) {
    return <div className="text-center py-10">Morate se ulogovati da biste vidjeli profil.</div>
  }

  if (loading) return <div className="text-center py-10">Učitavanje profila...</div>

  if (error) return <div className="text-center py-10 text-red-600">{error}</div>

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8">
      <h2 className="text-3xl font-bold text-center mb-8" style={{ color: '#41ac53' }}>
        <h2>{user?.fullName} (@{user?.username})</h2>
      </h2>

      <div className="bg-white rounded-xl shadow-md p-6 mb-8">
        <h3 className="text-xl font-semibold mb-4">Tvoje prijave na akcije</h3>

       {prijave.length === 0 ? (
        <p className="text-gray-600">Još nisi se prijavio ni na jednu akciju.</p>
        ) : (
        <div className="space-y-6">
            {prijave.length === 0 ? (
            <p className="text-gray-600">Još nisi se prijavio ni na jednu akciju.</p>
            ) : (
            <div className="space-y-6">
                {prijave.map((p) => (
                <div key={p.AkcijaID} className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-xl font-semibold mb-2">{p.Naziv}</h3>
                    <p className="text-gray-700 mb-1"><strong>Vrh:</strong> {p.Vrh}</p>
                    <p className="text-gray-600 mb-1"><strong>Datum akcije:</strong> {new Date(p.Datum).toLocaleDateString('sr-RS')}</p>
                    <p className="text-gray-600 mb-1"><strong>Prijavljen:</strong> {new Date(p.PrijavljenAt).toLocaleString('sr-RS', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    <p className="text-gray-500 text-sm">{p.Opis}</p>
                    <span className={`inline-block px-3 py-1 mt-3 rounded-full text-sm font-medium ${
                    p.Tezina === 'lako' ? 'bg-green-100 text-green-800' :
                    p.Tezina === 'srednje' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                    }`}>
                    {p.Tezina}
                    </span>
                </div>
                ))}
            </div>
            )}
        </div>
        )}

      </div>
    </div>
  )
}