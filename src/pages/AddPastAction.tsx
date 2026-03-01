import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import BackButton from '../components/BackButton'

interface Korisnik {
  id: number
  username: string
  fullName?: string
  role: string
}

export default function AddPastAction() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [korisnici, setKorisnici] = useState<Korisnik[]>([])
  const [vodici, setVodici] = useState<Korisnik[]>([])
  const [korisnikId, setKorisnikId] = useState('')
  const [naziv, setNaziv] = useState('')
  const [vrh, setVrh] = useState('')
  const [datum, setDatum] = useState('')
  const [opis, setOpis] = useState('')
  const [tezina, setTezina] = useState('')
  const [kumulativniUsponM, setKumulativniUsponM] = useState('')
  const [duzinaStazeKm, setDuzinaStazeKm] = useState('')
  const [vodicId, setVodicId] = useState('')
  const [drugiVodicCheck, setDrugiVodicCheck] = useState(false)
  const [drugiVodicIme, setDrugiVodicIme] = useState('')
  const [slika, setSlika] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      setLoading(true)
      try {
        const res = await api.get<{ korisnici: Korisnik[] }>('/api/korisnici')
        const list = res.data.korisnici || []
        setKorisnici(list)
        setVodici(list.filter((k) => k.role === 'vodic'))
      } catch (err: any) {
        setError(err.response?.data?.error || 'Greška pri učitavanju korisnika')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!korisnikId) {
      setError('Izaberite korisnika.')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
      setError('Datum mora biti u formatu YYYY-MM-DD')
      return
    }
    setError('')
    setSubmitting(true)
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

      await api.post(`/api/korisnici/${korisnikId}/dodaj-proslu-akciju`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      navigate(`/users/${korisnikId}`, { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.error || 'Greška pri dodavanju prošle akcije.')
      setSubmitting(false)
    }
  }

  if (!user || !['admin', 'vodic'].includes(user.role)) {
    return (
      <div className="text-center py-10 text-red-600">
        Samo admin ili vodič mogu da dodaju prošlu akciju.
      </div>
    )
  }

  if (loading) {
    return <div className="text-center py-20">Učitavanje...</div>
  }

  const inputClass = 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#41ac53] focus:border-[#41ac53]'
  const labelClass = 'block text-gray-700 font-medium mb-2'

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <BackButton to="/profil" className="mb-6" />
      <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: '#41ac53' }}>
        Dodaj prošlu akciju
      </h1>
      <p className="text-gray-600 mb-8">
        Unesite podatke o akciji (može biti iz drugog društva ili ranije). Korisniku će biti upisano da se popeo, statistika će se ažurirati i bićete preusmereni na njegov profil.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
        )}

        <div>
          <label htmlFor="korisnik" className={labelClass}>Korisnik</label>
          <select
            id="korisnik"
            value={korisnikId}
            onChange={(e) => setKorisnikId(e.target.value)}
            className={inputClass}
            required
          >
            <option value="">— Izaberite korisnika —</option>
            {korisnici.map((k) => (
              <option key={k.id} value={k.id}>
                {k.fullName || k.username} (@{k.username})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Naziv akcije</label>
          <input
            type="text"
            value={naziv}
            onChange={(e) => setNaziv(e.target.value)}
            className={inputClass}
            required
          />
        </div>

        <div>
          <label className={labelClass}>Vrh</label>
          <input
            type="text"
            value={vrh}
            onChange={(e) => setVrh(e.target.value)}
            className={inputClass}
            required
          />
        </div>

        <div>
          <label className={labelClass}>Datum akcije</label>
          <input
            type="date"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            className={inputClass}
            required
          />
        </div>

        <div>
          <label className={labelClass}>Opis</label>
          <textarea
            value={opis}
            onChange={(e) => setOpis(e.target.value)}
            className={inputClass}
            rows={3}
          />
        </div>

        {!drugiVodicCheck && (
          <div>
            <label className={labelClass}>Vodič</label>
            <select
              value={vodicId}
              onChange={(e) => setVodicId(e.target.value)}
              className={inputClass}
            >
              <option value="">— Opciono —</option>
              {vodici.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.fullName || v.username} (@{v.username})
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
          <label htmlFor="drugi-vodic" className="text-gray-700 font-medium">Drugi vodič</label>
        </div>
        {drugiVodicCheck && (
          <div>
            <label className={labelClass}>Ime drugog vodiča</label>
            <input
              type="text"
              value={drugiVodicIme}
              onChange={(e) => setDrugiVodicIme(e.target.value)}
              placeholder="Ime i prezime"
              className={inputClass}
            />
          </div>
        )}

        <div>
          <label className={labelClass}>Težina</label>
          <select
            value={tezina}
            onChange={(e) => setTezina(e.target.value)}
            className={inputClass}
            required
          >
            <option value="">— Izaberite —</option>
            <option value="lako">Lako</option>
            <option value="srednje">Srednje</option>
            <option value="teško">Teško</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>Kumulativni uspon (m)</label>
          <input
            type="number"
            value={kumulativniUsponM}
            onChange={(e) => setKumulativniUsponM(e.target.value)}
            placeholder="npr. 1250"
            className={inputClass}
            min={0}
            step={1}
            required
          />
        </div>

        <div>
          <label className={labelClass}>Dužina staze (km)</label>
          <input
            type="number"
            value={duzinaStazeKm}
            onChange={(e) => setDuzinaStazeKm(e.target.value)}
            placeholder="npr. 14.5"
            className={inputClass}
            min={0}
            step={0.1}
            required
          />
        </div>

        <div>
          <label className={labelClass}>Slika akcije (opciono)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setSlika(e.target.files?.[0] || null)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-lg font-medium text-white bg-[#41ac53] hover:bg-[#358f43] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Dodavanje...' : 'Dodaj i idi na profil'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/profil')}
            className="px-6 py-2.5 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Odustani
          </button>
        </div>
      </form>
    </div>
  )
}
