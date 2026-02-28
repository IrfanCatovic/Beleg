import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

const dateOnly = (s: string | undefined): string => {
  if (!s) return ''
  return s.slice(0, 10)
}

const initialForm = {
  username: '',
  fullName: '',
  imeRoditelja: '',
  pol: '',
  datumRodjenja: '',
  drzavljanstvo: '',
  adresa: '',
  telefon: '',
  email: '',
  brojLicnogDokumenta: '',
  brojPlaninarskeLegitimacije: '',
  brojPlaninarskeMarkice: '',
  datumUclanjenja: '',
  izreceneDisciplinskeKazne: '',
  izborUOrganeSportskogUdruzenja: '',
  napomene: '',
}

export default function ProfileSettings() {
  const navigate = useNavigate()
  const { user, isLoggedIn, login } = useAuth()
  const [form, setForm] = useState(initialForm)
  const [role, setRole] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/home', { replace: true })
      return
    }

    const fetchMe = async () => {
      try {
        const res = await api.get('/api/me')
        const k = res.data
        setForm({
          username: k.username || '',
          fullName: k.fullName || '',
          imeRoditelja: k.ime_roditelja || '',
          pol: k.pol || '',
          datumRodjenja: dateOnly(k.datum_rodjenja),
          drzavljanstvo: k.drzavljanstvo || '',
          adresa: k.adresa || '',
          telefon: k.telefon || '',
          email: k.email || '',
          brojLicnogDokumenta: k.broj_licnog_dokumenta || '',
          brojPlaninarskeLegitimacije: k.broj_planinarske_legitimacije || '',
          brojPlaninarskeMarkice: k.broj_planinarske_markice || '',
          datumUclanjenja: dateOnly(k.datum_uclanjenja),
          izreceneDisciplinskeKazne: k.izrecene_disciplinske_kazne || '',
          izborUOrganeSportskogUdruzenja: k.izbor_u_organe_sportskog_udruzenja || '',
          napomene: k.napomene || '',
        })
        setRole(k.role || '')
        if (k.avatar_url) setAvatarPreview(k.avatar_url)
      } catch (err: any) {
        setError(err.response?.data?.error || 'Greška pri učitavanju profila')
      } finally {
        setLoading(false)
      }
    }

    fetchMe()
  }, [isLoggedIn, navigate])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Dozvoljene su samo slike (jpg, png, gif...)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Slika je prevelika (maksimum 5 MB)')
      return
    }
    setError('')
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setSaving(true)

    try {
      const formData = new FormData()
      formData.append('username', form.username.trim())
      formData.append('fullName', form.fullName.trim())
      formData.append('imeRoditelja', form.imeRoditelja.trim())
      formData.append('pol', form.pol)
      formData.append('drzavljanstvo', form.drzavljanstvo.trim())
      formData.append('adresa', form.adresa.trim())
      formData.append('telefon', form.telefon.trim())
      formData.append('email', form.email.trim())
      formData.append('brojLicnogDokumenta', form.brojLicnogDokumenta.trim())
      formData.append('brojPlaninarskeLegitimacije', form.brojPlaninarskeLegitimacije.trim())
      formData.append('brojPlaninarskeMarkice', form.brojPlaninarskeMarkice.trim())
      formData.append('izreceneDisciplinskeKazne', form.izreceneDisciplinskeKazne.trim())
      formData.append('izborUOrganeSportskogUdruzenja', form.izborUOrganeSportskogUdruzenja.trim())
      formData.append('napomene', form.napomene.trim())
      if (form.datumRodjenja) formData.append('datumRodjenja', form.datumRodjenja)
      if (form.datumUclanjenja) formData.append('datumUclanjenja', form.datumUclanjenja)
      if (avatarFile) formData.append('avatar', avatarFile)

      const res = await api.patch('/api/me', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      // Ako je promenjeno korisničko ime, backend vraća novi JWT – osvežimo token i korisnika
      if (res.data?.token && res.data?.role && res.data?.user) {
        login({
          token: res.data.token,
          role: res.data.role,
          user: res.data.user,
        })
      }

      setSuccess(true)
      setTimeout(() => navigate('/profil', { replace: true }), 1500)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Greška pri čuvanju profila')
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#41ac53] focus:border-[#41ac53]'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'
  const sectionClass = 'space-y-4'

  if (!isLoggedIn) return null
  if (loading) return <div className="text-center py-20">Učitavanje...</div>

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold" style={{ color: '#41ac53' }}>
            Podešavanja profila
          </h2>
          <Link to="/profil" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
            ← Nazad na profil
          </Link>
        </div>

        <p className="text-sm text-gray-500 mb-6">
          Možete menjati sva polja osim uloge (role). Ulogu može promeniti samo administrator. Ako promenite
          korisničko ime, mora biti jedinstveno.
        </p>

        {success && (
          <div className="mb-6 p-4 bg-green-100 text-green-800 rounded-lg text-center font-medium">
            Profil sačuvan. Preusmeravam...
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-800 rounded-lg">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Korisničko ime i uloga */}
          <div className={sectionClass}>
            <h3 className="text-lg font-semibold text-gray-800 border-b border-emerald-200 pb-2 mb-2">
              Nalog
            </h3>
            <div>
              <label className={labelClass}>Korisničko ime</label>
              <input
                name="username"
                value={form.username}
                onChange={handleChange}
                required
                className={inputClass}
                placeholder="Jedinstveno u sistemu"
              />
            </div>
            <div>
              <label className={labelClass}>Uloga (samo admin može da promeni)</label>
              <input
                value={role}
                readOnly
                disabled
                className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Lični podaci */}
          <div className={sectionClass}>
            <h3 className="text-lg font-semibold text-gray-800 border-b border-emerald-200 pb-2 mb-2">
              Lični podaci
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Puno ime</label>
                <input name="fullName" value={form.fullName} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Ime roditelja</label>
                <input name="imeRoditelja" value={form.imeRoditelja} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Pol</label>
                <select name="pol" value={form.pol} onChange={handleChange} className={inputClass}>
                  <option value="">— izaberi —</option>
                  <option value="M">M</option>
                  <option value="Ž">Ž</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Datum rođenja</label>
                <input
                  name="datumRodjenja"
                  type="date"
                  value={form.datumRodjenja}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Državljanstvo</label>
                <input name="drzavljanstvo" value={form.drzavljanstvo} onChange={handleChange} className={inputClass} />
              </div>
            </div>
          </div>

          {/* Kontakt */}
          <div className={sectionClass}>
            <h3 className="text-lg font-semibold text-gray-800 border-b border-emerald-200 pb-2 mb-2">
              Kontakt
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Email</label>
                <input name="email" type="email" value={form.email} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Telefon</label>
                <input name="telefon" value={form.telefon} onChange={handleChange} className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Adresa</label>
                <input name="adresa" value={form.adresa} onChange={handleChange} className={inputClass} />
              </div>
            </div>
          </div>

          {/* Dokumenti i planinarski podaci */}
          <div className={sectionClass}>
            <h3 className="text-lg font-semibold text-gray-800 border-b border-emerald-200 pb-2 mb-2">
              Dokumenti i planinarski podaci
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Broj ličnog dokumenta</label>
                <input
                  name="brojLicnogDokumenta"
                  value={form.brojLicnogDokumenta}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Broj planinarske legitimacije</label>
                <input
                  name="brojPlaninarskeLegitimacije"
                  value={form.brojPlaninarskeLegitimacije}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Broj planinarske markice</label>
                <input
                  name="brojPlaninarskeMarkice"
                  value={form.brojPlaninarskeMarkice}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Datum učlanjenja</label>
                <input
                  name="datumUclanjenja"
                  type="date"
                  value={form.datumUclanjenja}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Disciplinske kazne, izbor u organe, napomene */}
          <div className={sectionClass}>
            <h3 className="text-lg font-semibold text-gray-800 border-b border-emerald-200 pb-2 mb-2">
              Disciplinske kazne, izbor u organe, napomene
            </h3>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Izrečene disciplinske kazne</label>
                <textarea
                  name="izreceneDisciplinskeKazne"
                  value={form.izreceneDisciplinskeKazne}
                  onChange={handleChange}
                  rows={3}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Izbor u organe sportskog udruženja</label>
                <textarea
                  name="izborUOrganeSportskogUdruzenja"
                  value={form.izborUOrganeSportskogUdruzenja}
                  onChange={handleChange}
                  rows={3}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Napomene</label>
                <textarea
                  name="napomene"
                  value={form.napomene}
                  onChange={handleChange}
                  rows={3}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Avatar */}
          <div className={sectionClass}>
            <h3 className="text-lg font-semibold text-gray-800 border-b border-emerald-200 pb-2 mb-2">
              Profilna slika
            </h3>
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="w-full p-2 border border-gray-300 rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#41ac53]/10 file:text-[#41ac53] hover:file:bg-[#41ac53]/20 cursor-pointer"
            />
            {avatarPreview && (
              <div className="mt-3">
                <img
                  src={avatarPreview}
                  alt="Pregled"
                  className="w-24 h-24 rounded-full object-cover border border-gray-200"
                />
              </div>
            )}
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 px-4 bg-[#41ac53] hover:bg-[#3a9a4a] disabled:opacity-60 text-white font-medium rounded-lg transition-colors"
            >
              {saving ? 'Čuvanje...' : 'Sačuvaj promene'}
            </button>
            <Link
              to="/profil"
              className="py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-center"
            >
              Odustani
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
