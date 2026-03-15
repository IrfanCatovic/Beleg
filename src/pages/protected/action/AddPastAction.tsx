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
  const [javna, setJavna] = useState(false)
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
      formData.append('javna', String(javna))
      if (slika) formData.append('slika', slika)

      await api.post(`/api/korisnici/${korisnikId}/dodaj-proslu-akciju`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const selected = korisnici.find((k) => String(k.id) === korisnikId)
      if (selected?.username) {
        navigate(`/korisnik/${selected.username}`, { replace: true })
      } else {
        navigate('/users', { replace: true })
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Greška pri dodavanju prošle akcije.')
      setSubmitting(false)
    }
  }

  if (!user || !['superadmin', 'admin', 'vodic'].includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <div className="h-14 w-14 rounded-2xl bg-red-50 flex items-center justify-center">
          <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-sm text-gray-500 font-medium">Samo admin ili vodič mogu da dodaju prošlu akciju.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  const labelClass = 'block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-[0.16em]'
  const inputClass =
    'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 outline-none transition'

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 pb-12">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
          <BackButton to="/profil" />
          <div className="flex-1 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-600 mb-1">
              Prošla planinarska akcija
            </p>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-extrabold tracking-tight text-gray-900">
              Dodaj akciju na profil člana
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

            {/* Korisnik */}
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

            {/* Osnovni podaci o akciji */}
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
                <input
                  type="date"
                  value={datum}
                  onChange={(e) => setDatum(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>

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
            </div>

            {/* Opis */}
            <div>
              <label className={labelClass}>Opis</label>
              <textarea
                value={opis}
                onChange={(e) => setOpis(e.target.value)}
                className={`${inputClass} min-h-[80px]`}
                placeholder="Kratak opis ture, dužina, pauze, oprema, napomene…"
                rows={3}
              />
            </div>

            {/* Vodiči */}
            <div className="space-y-3 pt-1 border-t border-gray-50">
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
            </div>

            {/* Brojke o stazi */}
            <div className="grid gap-4 sm:gap-5 sm:grid-cols-3 pt-2 border-t border-gray-50">
              <div>
                <label className={labelClass}>Uspon (m)</label>
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
                <label className={labelClass}>Dužina (km)</label>
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
            </div>

            {/* Zimski uspon + slika */}
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
                <label className={labelClass}>Slika akcije (opciono)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSlika(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-emerald-700 hover:file:bg-emerald-100"
                />
              </div>
            </div>

            {/* Javna + Istorija kluba */}
            <div className="space-y-3 pt-2 border-t border-gray-50">
              <div className="flex items-center gap-3 p-3.5 rounded-lg bg-sky-50/60 border border-sky-100">
                <input
                  type="checkbox"
                  id="javna-past"
                  checked={javna}
                  onChange={(e) => setJavna(e.target.checked)}
                  className="w-4 h-4 rounded border-sky-300 text-sky-500 focus:ring-sky-500"
                />
                <label htmlFor="javna-past" className="text-xs sm:text-sm text-gray-800 font-medium">
                  Javna (svi su videli dok je bila aktivna; završenu vidi samo klub)
                </label>
              </div>
              <div className="flex items-center gap-3 p-3.5 rounded-lg bg-emerald-50/60 border border-emerald-100">
                <input
                  type="checkbox"
                  id="dodaj-u-istoriju"
                  checked={dodajUIstorijuKluba}
                  onChange={(e) => setDodajUIstorijuKluba(e.target.checked)}
                  className="w-4 h-4 rounded border-emerald-300 text-emerald-500 focus:ring-emerald-500"
                />
                <label htmlFor="dodaj-u-istoriju" className="text-xs sm:text-sm text-gray-800 font-medium">
                  Dodaj u istoriju akcija kluba
                </label>
              </div>
              <p className="text-[11px] text-gray-500">
                Ako nije čekirano, akcija će se upisati samo na profil člana (napredak) i neće se pojaviti u listi završenih
                akcija kluba.
              </p>
            </div>

            {/* Dugmad */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 disabled:opacity-60 disabled:cursor-wait transition-all"
              >
                {submitting ? 'Dodavanje...' : 'Dodaj i idi na profil'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/profil')}
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/50 transition-all"
              >
                Odustani
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
