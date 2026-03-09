import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import api from '../../../services/api'
import BackButton from '../../../components/BackButton'
import Dropdown from '../../../components/Dropdown'

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
  const [planina, setPlanina] = useState('')
  const [vrh, setVrh] = useState('')
  const [datum, setDatum] = useState('')
  const [opis, setOpis] = useState('')
  const [tezina, setTezina] = useState('')
  const [kumulativniUsponM, setKumulativniUsponM] = useState('')
  const [duzinaStazeKm, setDuzinaStazeKm] = useState('')
  const [visinaVrhM, setVisinaVrhM] = useState('')
  const [zimskiUspon, setZimskiUspon] = useState(false)
  const [vodicId, setVodicId] = useState('')
  const [drugiVodicCheck, setDrugiVodicCheck] = useState(false)
  const [drugiVodicIme, setDrugiVodicIme] = useState('')
  const [dodajUIstorijuKluba, setDodajUIstorijuKluba] = useState(true)
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
    if (!tezina.trim()) {
      setError('Izaberite težinu.')
      return
    }
    const dozvoljeneTezine = ['lako', 'srednje', 'tesko', 'alpinizam']
    if (!dozvoljeneTezine.includes(tezina.trim().toLowerCase())) {
      setError('Izaberi težinu od ponuđenih.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('naziv', naziv)
      formData.append('planina', planina.trim())
      formData.append('vrh', vrh)
      formData.append('datum', datum)
      formData.append('opis', opis)
      formData.append('tezina', tezina)
      formData.append('kumulativniUsponM', kumulativniUsponM)
      formData.append('duzinaStazeKm', duzinaStazeKm)
      formData.append('visinaVrhM', visinaVrhM)
      formData.append('zimskiUspon', String(zimskiUspon))
      if (vodicId) formData.append('vodic_id', vodicId)
      if (drugiVodicCheck && drugiVodicIme.trim()) formData.append('drugi_vodic_ime', drugiVodicIme.trim())
      formData.append('dodaj_u_istoriju_kluba', dodajUIstorijuKluba ? 'true' : 'false')
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
          <label className={labelClass}>Korisnik</label>
          <Dropdown
            aria-label="Izaberi korisnika"
            options={[
              { value: '', label: '— Izaberite korisnika —' },
              ...korisnici.map((k) => ({
                value: String(k.id),
                label: `${k.fullName || k.username} (@${k.username})`,
              })),
            ]}
            value={korisnikId}
            onChange={setKorisnikId}
            fullWidth
          />
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
          <label className={labelClass}>Ime planine</label>
          <input
            type="text"
            value={planina}
            onChange={(e) => setPlanina(e.target.value)}
            className={inputClass}
            placeholder="npr. Kopaonik, Stara planina"
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
            <Dropdown
              aria-label="Izaberi vodiča"
              options={[
                { value: '', label: '— Opciono —' },
                ...vodici.map((v) => ({
                  value: String(v.id),
                  label: `${v.fullName || v.username} (@${v.username})`,
                })),
              ]}
              value={vodicId}
              onChange={setVodicId}
              fullWidth
            />
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
          <Dropdown
            aria-label="Izaberi težinu"
            options={[
              { value: '', label: '— Izaberite —' },
              { value: 'lako', label: 'Lako' },
              { value: 'srednje', label: 'Srednje' },
              { value: 'tesko', label: 'Teško' },
              { value: 'alpinizam', label: 'Alpinizam' },
            ]}
            value={tezina}
            onChange={setTezina}
            fullWidth
          />
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
          <label className={labelClass}>Visina vrha (m)</label>
          <input
            type="number"
            value={visinaVrhM}
            onChange={(e) => setVisinaVrhM(e.target.value)}
            placeholder="npr. 2017"
            className={inputClass}
            min={0}
            step={1}
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="zimski-uspon"
            checked={zimskiUspon}
            onChange={(e) => setZimskiUspon(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-[#41ac53] focus:ring-[#41ac53]"
          />
          <label htmlFor="zimski-uspon" className="text-gray-700 font-medium">
            Zimski uspon
          </label>
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

        <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-50 border border-gray-200">
          <input
            type="checkbox"
            id="dodaj-u-istoriju"
            checked={dodajUIstorijuKluba}
            onChange={(e) => setDodajUIstorijuKluba(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-[#41ac53] focus:ring-[#41ac53]"
          />
          <label htmlFor="dodaj-u-istoriju" className="text-gray-700 font-medium">
            Dodaj u istoriju akcija kluba
          </label>
        </div>
        <p className="text-sm text-gray-500 -mt-2">
          Ako nije čekirano, akcija će se upisati samo na profil člana (progress) i neće se pojaviti u listi završenih akcija kluba.
        </p>

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
