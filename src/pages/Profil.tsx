import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

interface Akcija {
  id: number
  naziv: string
  vrh: string
  datum: string
  opis?: string
  tezina?: string
}

interface Prijava {
  akcijaId: number
  akcija: Akcija // ako backend vrati spojene podatke
  prijavljenAt: string
}

export default function Profil() {
  const { isLoggedIn, user } = useAuth()
  const [prijave, setPrijave] = useState<Prijava[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isLoggedIn) return

    const fetchMojePrijave = async () => {
      try {
        const res = await api.get('/api/moje-prijave')
        const ids = res.data.prijavljeneAkcije || []

        // Ako imaš spojene podatke – možeš fetch-ovati detalje
        // Za sada koristimo samo IDs – kasnije spojimo sa akcijama
        // Primer: ako backend vrati spojene podatke – setPrijave(res.data.prijave)
        // Za sad – placeholder
        setPrijave([]) // zameni kasnije sa pravim podacima
      } catch (err: any) {
        setError('Greška pri učitavanju tvojih prijava')
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
        Profil – {user?.fullName || user?.username}
      </h2>

      <div className="bg-white rounded-xl shadow-md p-6 mb-8">
        <h3 className="text-xl font-semibold mb-4">Tvoje prijave na akcije</h3>

        {prijave.length === 0 ? (
          <p className="text-gray-600">Još nisi se prijavio ni na jednu akciju. Vidi listu akcija i pridruži se!</p>
        ) : (
          <div className="space-y-4">
            {prijave.map((p) => (
              <div key={p.akcijaId} className="border-b pb-4">
                <h4 className="font-medium">{p.akcija?.naziv || `Akcija ID: ${p.akcijaId}`}</h4>
                <p className="text-sm text-gray-600">
                  Prijavljen: {new Date(p.prijavljenAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}