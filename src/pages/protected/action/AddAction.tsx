import { useState, useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import api from '../../../services/api'
import { useNavigate } from 'react-router-dom'
import BackButton from '../../../components/BackButton'
import Dropdown from '../../../components/Dropdown'
import CalendarDropdown from '../../../components/CalendarDropdown'

interface Korisnik {
  id: number
  username: string
  fullName: string
  role: string
}

export default function AddAction() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [vodici, setVodici] = useState<Korisnik[]>([])
  const [naziv, setNaziv] = useState('')
  const [planina, setPlanina] = useState('')
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
  const [visinaVrhM, setVisinaVrhM] = useState('')
  const [zimskiUspon, setZimskiUspon] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const todayYmd = (() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  })()

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

  if (!user || !['superadmin', 'admin', 'vodic'].includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <div className="h-14 w-14 rounded-2xl bg-red-50 flex items-center justify-center">
          <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-sm text-gray-500 font-medium">Samo admin ili vodič mogu da dodaju akcije.</p>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
      setError('Datum mora biti u formatu YYYY-MM-DD')
      setLoading(false)
      return
    }
    if (datum < todayYmd) {
      setError('Datum ne može biti u prošlosti.')
      setLoading(false)
      return
    }
    if (!tezina.trim()) {
      setError('Izaberite težinu.')
      setLoading(false)
      return
    }
    const dozvoljeneTezine = ['lako', 'srednje', 'tesko', 'alpinizam']
    if (!dozvoljeneTezine.includes(tezina.trim().toLowerCase())) {
      setError('Izaberi težinu od ponuđenih.')
      setLoading(false)
      return
    }

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
      if (slika) formData.append('slika', slika)

      const res = await api.post('/api/akcije', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setSuccess('Akcija uspešno dodata! ID: ' + res.data.akcija.id)
      navigate('/akcije')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Greška pri dodavanju akcije')
      console.error('Greška:', err)
    } finally {
      setLoading(false)
    }
  }

  const labelClass = 'block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-[0.16em]'
  const inputClass =
    'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 outline-none transition'

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 pb-12">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
          <BackButton />
          <div className="flex-1 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-600 mb-1">
              Nova planinarska akcija
            </p>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-extrabold tracking-tight text-gray-900">
              Dodaj akciju u plan
            </h1>
          </div>
          <div className="w-10 sm:w-16" aria-hidden />
        </div>

        <div className="max-w-4xl mx-auto">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 lg:p-7 space-y-6 sm:space-y-7"
          >
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs sm:text-sm text-rose-700">
                {error}
              </div>
            )}

            <div className="grid gap-4 sm:gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass}>Naziv akcije</label>
                <input
                  type="text"
                  value={naziv}
                  onChange={(e) => setNaziv(e.target.value)}
                  className={inputClass}
                  placeholder="npr. Uspon na Rtanj severnom stazom"
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Planina</label>
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
                  placeholder="npr. Midžor, Pančićev vrh"
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Datum akcije</label>
                <CalendarDropdown
                  aria-label="Izaberi datum akcije"
                  value={datum}
                  onChange={setDatum}
                  minDate={todayYmd}
                  fullWidth
                />
              </div>

              <div>
                <label className={labelClass}>Težina</label>
                <Dropdown
                  aria-label="Izaberi težinu"
                  options={[
                    { value: '', label: 'Izaberi težinu' },
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
            </div>

            <div>
              <label className={labelClass}>Opis</label>
              <textarea
                value={opis}
                onChange={(e) => setOpis(e.target.value)}
                className={`${inputClass} min-h-[80px]`}
                placeholder="Kratak opis ture, dužina, pauze, oprema, napomene…"
                rows={4}
              />
            </div>

            <div className="space-y-3 pt-1 border-t border-gray-50">
              {!drugiVodicCheck && (
                <div>
                  <label className={labelClass}>Vodič</label>
                  <Dropdown
                    aria-label="Izaberi vodiča"
                    options={[
                      { value: '', label: 'Izaberi vodiča' },
                      ...vodici.map((v) => ({
                        value: String(v.id),
                        label: `${v.fullName} (@${v.username})`,
                      })),
                    ]}
                    value={vodicId}
                    onChange={setVodicId}
                    fullWidth
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
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
                  className="w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                />
                <label htmlFor="drugi-vodic" className="text-xs sm:text-sm text-gray-700 font-medium">
                  Drugi vodič (ručni unos)
                </label>
              </div>
              {drugiVodicCheck && (
                <div>
                  <label className={labelClass}>Drugi vodič</label>
                  <input
                    type="text"
                    value={drugiVodicIme}
                    onChange={(e) => setDrugiVodicIme(e.target.value)}
                    placeholder="Ime i prezime drugog vodiča"
                    className={inputClass}
                  />
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:gap-5 sm:grid-cols-3 pt-2 border-t border-gray-50">
              <div>
                <label className={labelClass}>Uspon (m)</label>
                <input
                  type="number"
                  value={kumulativniUsponM}
                  onChange={(e) => setKumulativniUsponM(e.target.value)}
                  placeholder="npr. 1250"
                  className={inputClass}
                  min="0"
                  step="1"
                />
              </div>
              <div>
                <label className={labelClass}>Dužina (km)</label>
                <input
                  type="number"
                  value={duzinaStazeKm}
                  onChange={(e) => setDuzinaStazeKm(e.target.value)}
                  placeholder="npr. 14.5"
                  className={inputClass}
                  min="0"
                  step="0.1"
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
                  min="0"
                  step="1"
                />
              </div>
            </div>

            <div className="space-y-4 pt-2 border-t border-gray-50">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="zimski-uspon"
                  checked={zimskiUspon}
                  onChange={(e) => setZimskiUspon(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                />
                <label htmlFor="zimski-uspon" className="text-xs sm:text-sm text-gray-700 font-medium">
                  Zimski uspon
                </label>
              </div>

              <div>
                <label className={labelClass}>Slika akcije</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSlika(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-emerald-700 hover:file:bg-emerald-100"
                />
                <p className="mt-1 text-[11px] text-gray-400">Podržani formati: JPG, PNG, maksimalno 5MB.</p>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 disabled:opacity-60 disabled:cursor-wait transition-all"
              >
                {loading ? 'Dodavanje...' : 'Dodaj akciju'}
              </button>
              {success && (
                <p className="mt-3 text-center text-xs font-medium text-emerald-600">
                  {success}
                </p>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
