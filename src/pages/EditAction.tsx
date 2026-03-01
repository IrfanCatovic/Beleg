import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { useNavigate, useParams } from 'react-router-dom'
import BackButton from '../components/BackButton'

interface Korisnik {
  id: number
  username: string
  fullName: string
  role: string
}

interface AkcijaData {
  id: number
  naziv: string
  vrh: string
  datum: string
  opis: string
  tezina: string
  slikaUrl?: string
  kumulativniUsponM?: number
  duzinaStazeKm?: number
  vodicId?: number
  drugiVodicIme?: string
  isCompleted?: boolean
}

export default function EditAction() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const [vodici, setVodici] = useState<Korisnik[]>([])
  const [naziv, setNaziv] = useState('')
  const [vrh, setVrh] = useState('')
  const [datum, setDatum] = useState('')
  const [opis, setOpis] = useState('')
  const [tezina, setTezina] = useState('')
  const [slika, setSlika] = useState<File | null>(null)
  const [kumulativniUsponM, setKumulativniUsponM] = useState('')
  const [duzinaStazeKm, setDuzinaStazeKm] = useState('')
  const [vodicId, setVodicId] = useState('')
  const [drugiVodicCheck, setDrugiVodicCheck] = useState(false)
  const [drugiVodicIme, setDrugiVodicIme] = useState('')

  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const fetchVodici = async () => {
      try {
        const res = await api.get('/api/korisnici')
        const korisnici = res.data.korisnici || []
        setVodici(korisnici.filter((k: Korisnik) => k.role === 'vodic'))
      } catch {
        setVodici([])
      }
    }
    fetchVodici()
  }, [])

  useEffect(() => {
    if (!id) return

    const fetchAkcija = async () => {
      setLoadingData(true)
      try {
        const res = await api.get(`/api/akcije/${id}`)
        const a: AkcijaData = res.data

        const datumStr = typeof a.datum === 'string'
          ? a.datum.slice(0, 10)
          : new Date(a.datum).toISOString().slice(0, 10)

        setNaziv(a.naziv || '')
        setVrh(a.vrh || '')
        setDatum(datumStr)
        setOpis(a.opis || '')
        setTezina(a.tezina || '')
        setKumulativniUsponM(a.kumulativniUsponM != null ? String(a.kumulativniUsponM) : '')
        setDuzinaStazeKm(a.duzinaStazeKm != null ? String(a.duzinaStazeKm) : '')
        setVodicId(a.vodicId ? String(a.vodicId) : '')
        setDrugiVodicIme(a.drugiVodicIme || '')
        setDrugiVodicCheck(!!a.drugiVodicIme)
      } catch (err: any) {
        setError(err.response?.data?.error || 'Greška pri učitavanju akcije')
      } finally {
        setLoadingData(false)
      }
    }

    fetchAkcija()
  }, [id])

  if (!user || !['admin', 'vodic'].includes(user.role)) {
    return <div className="text-center py-10 text-red-600">Samo admin ili vodič mogu da izmene akcije.</div>
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    setLoading(true)
    setError('')
    setSuccess('')

    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
      setError('Datum mora biti u formatu YYYY-MM-DD')
      setLoading(false)
      return
    }

    try {
      const formData = new FormData()
      formData.append('naziv', naziv)
      formData.append('vrh', vrh)
      formData.append('datum', datum)
      formData.append('opis', opis)
      formData.append('tezina', tezina)
      formData.append('kumulativniUsponM', kumulativniUsponM)
      formData.append('duzinaStazeKm', duzinaStazeKm)
      if (vodicId) formData.append('vodic_id', vodicId)
      if (drugiVodicCheck && drugiVodicIme.trim()) formData.append('drugi_vodic_ime', drugiVodicIme.trim())
      if (slika) formData.append('slika', slika)

      await api.patch(`/api/akcije/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      setSuccess('Akcija uspešno izmenjena!')
      navigate(`/akcije/${id}`)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Greška pri izmeni akcije')
      console.error('Greška:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loadingData) {
    return (
      <div className="py-8 px-4 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#41ac53] mx-auto mb-4"></div>
        <p className="text-gray-600">Učitavanje akcije...</p>
      </div>
    )
  }

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
      <div className="flex flex-row items-center justify-between gap-4 mb-8">
        <BackButton />
        <h2 className="text-3xl font-bold flex-1 text-center" style={{ color: '#41ac53' }}>
          Izmeni akciju
        </h2>
        <div className="w-14" aria-hidden />
      </div>
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

        {!drugiVodicCheck && (
          <div>
            <label className="block text-gray-700 font-medium mb-2">Vodič</label>
            <select
              value={vodicId}
              onChange={(e) => setVodicId(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-[#41ac53]"
            >
              <option value="">Izaberi vodiča</option>
              {vodici.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.fullName} (@{v.username})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="drugi-vodic"
            checked={drugiVodicCheck}
            onChange={(e) => {
              const checked = e.target.checked
              setDrugiVodicCheck(checked)
              if (checked) setVodicId('')
              else setDrugiVodicIme('')
            }}
            className="w-4 h-4 rounded border-gray-300 text-[#41ac53] focus:ring-[#41ac53]"
          />
          <label htmlFor="drugi-vodic" className="text-gray-700 font-medium">
            Drugi vodič
          </label>
        </div>
        {drugiVodicCheck && (
          <div>
            <label className="block text-gray-700 font-medium mb-2">Upišite ime vodiča</label>
            <input
              type="text"
              value={drugiVodicIme}
              onChange={(e) => setDrugiVodicIme(e.target.value)}
              placeholder="Ime i prezime drugog vodiča"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-[#41ac53]"
            />
          </div>
        )}

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
          <label className="block text-gray-700 font-medium mb-2">Kumulativni uspon (u metrima)</label>
          <input
            type="number"
            value={kumulativniUsponM}
            onChange={(e) => setKumulativniUsponM(e.target.value)}
            placeholder="npr. 1250"
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-[#41ac53]"
            min="0"
            step="1"
          />
        </div>

        <div>
          <label className="block text-gray-700 font-medium mb-2">Dužina staze (u km)</label>
          <input
            type="number"
            value={duzinaStazeKm}
            onChange={(e) => setDuzinaStazeKm(e.target.value)}
            placeholder="npr. 14.5"
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-[#41ac53]"
            min="0"
            step="0.1"
          />
        </div>

        <div>
          <label className="block text-gray-700 font-medium mb-2">Slika akcije</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setSlika(e.target.files?.[0] || null)}
            className="w-full px-4 py-2 border rounded-lg"
          />
          <p className="text-sm text-gray-500 mt-1">Ostavite prazno da zadržite trenutnu sliku. Novi fajl zamenjuje staru.</p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg py-3 font-medium text-white transition-colors duration-200 disabled:opacity-50"
          style={{ backgroundColor: '#41ac53' }}
        >
          {loading ? 'Čuvanje...' : 'Sačuvaj izmene'}
        </button>

        {error && <p className="text-red-600 text-center mt-4">{error}</p>}
        {success && <p className="text-green-600 text-center mt-4">{success}</p>}
      </form>
    </div>
  )
}
