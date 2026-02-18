import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { useNavigate } from 'react-router-dom'

export default function AddAction() {
    const { user } = useAuth()
    const navigate = useNavigate()

  // State za formu
  const [naziv, setNaziv] = useState('')
  const [vrh, setVrh] = useState('')
  const [datum, setDatum] = useState('')
  const [opis, setOpis] = useState('')
  const [tezina, setTezina] = useState('')
  const [slika, setSlika] = useState<File | null>(null) 

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')


  if (user?.role !== 'admin') {
    return <div className="text-center py-10 text-red-600">Samo admin može da dodaje akcije.</div>
  }

        const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        setSuccess('')

        try {
            // Koristi FormData za sliku + tekst
            const formData = new FormData()
            formData.append('naziv', naziv)
            formData.append('vrh', vrh)
            formData.append('datum', datum + 'T00:00:00Z') // dodaje vreme da Go razume
            formData.append('opis', opis)
            formData.append('tezina', tezina)

            // if photo is selected, append it to formData
            if (slika) {
            formData.append('slika', slika) 
            }

            const res = await api.post('/api/akcije', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
            })

            setSuccess('Akcija uspešno dodata! ID: ' + res.data.akcija.id)

            // Reset forme
            setNaziv('')
            setVrh('')
            setDatum('')
            setOpis('')
            setTezina('')
            setSlika(null)
        } catch (err: any) {
            setError(err.response?.data?.error || 'Greška pri dodavanju akcije')
            console.error('Greška:', err)
        } finally {
            setLoading(false)
            navigate('/akcije') 
        }
        }


  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
      <h2 className="text-3xl font-bold text-center mb-8" style={{ color: '#41ac53' }}>
        Dodaj novu akciju
      </h2>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md p-6 space-y-6">
        <div>
          <label className="block text-gray-700 font-medium mb-2">Naziv akcije</label>
          <input
            type="text"
            value={naziv}
            onChange={(e) => setNaziv(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-[#41ac53]"
            required
          />
        </div>

        <div>
          <label className="block text-gray-700 font-medium mb-2">Vrh</label>
          <input
            type="text"
            value={vrh}
            onChange={(e) => setVrh(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-[#41ac53]"
            required
          />
        </div>

        <div>
          <label className="block text-gray-700 font-medium mb-2">Datum akcije</label>
          <input
            type="date"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-[#41ac53]"
            required
          />
        </div>

        <div>
          <label className="block text-gray-700 font-medium mb-2">Opis</label>
          <textarea
            value={opis}
            onChange={(e) => setOpis(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-[#41ac53]"
            rows={4}
          />
        </div>

        <div>
          <label className="block text-gray-700 font-medium mb-2">Težina</label>
          <select
            value={tezina}
            onChange={(e) => setTezina(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-[#41ac53]"
            required
          >
            <option value="">Izaberi težinu</option>
            <option value="lako">Lako</option>
            <option value="srednje">Srednje</option>
            <option value="teško">Teško</option>
          </select>
        </div>

        <div>
          <label className="block text-gray-700 font-medium mb-2">Slika akcije</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setSlika(e.target.files?.[0] || null)}
            className="w-full px-4 py-2 border rounded-lg"
          />
          <p className="text-sm text-gray-500 mt-1">Podržani formati: jpg, png, max 5MB</p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg py-3 font-medium text-white transition-colors duration-200 disabled:opacity-50"
          style={{ backgroundColor: '#41ac53' }}
        >
          {loading ? 'Dodavanje...' : 'Dodaj akciju'}
        </button>

        {error && <p className="text-red-600 text-center mt-4">{error}</p>}
        {success && <p className="text-green-600 text-center mt-4">{success}</p>}
      </form>
    </div>
  )
}