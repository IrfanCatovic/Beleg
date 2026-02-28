// src/pages/RegisterUser.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

const initialForm = {
  username: '',
  password: '',
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
  role: '',
}

export default function RegisterUser() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string>('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
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

    try {
      const formData = new FormData()
      formData.append('username', form.username.trim())
      formData.append('password', form.password)
      formData.append('role', form.role)

      // Opciona polja – dodaj samo ako nisu prazna
      const optional: (keyof typeof form)[] = [
        'fullName', 'imeRoditelja', 'pol', 'datumRodjenja', 'drzavljanstvo',
        'adresa', 'telefon', 'email', 'brojLicnogDokumenta',
        'brojPlaninarskeLegitimacije', 'brojPlaninarskeMarkice', 'datumUclanjenja',
        'izreceneDisciplinskeKazne', 'izborUOrganeSportskogUdruzenja', 'napomene',
      ]
      optional.forEach((key) => {
        if (key === 'role') return
        const val = form[key]?.trim()
        if (val) formData.append(key, val)
      })

      if (avatarFile) formData.append('avatar', avatarFile)

      await api.post('/api/register', formData)

      setSuccess(true)
      setTimeout(() => navigate('/users', { replace: true }), 2000)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Greška pri kreiranju korisnika')
    }
  }

  const inputClass =
    'w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#41ac53] focus:border-[#41ac53]'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'
  const sectionClass = 'space-y-4'

  const roleOptions = user?.role === 'admin'
    ? ['admin', 'clan', 'vodic', 'blagajnik', 'sekretar', 'menadzer-opreme']
    : ['clan', 'vodic', 'blagajnik', 'sekretar', 'menadzer-opreme']

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-emerald-50 px-4 py-12">
      <div className="w-full max-w-2xl bg-white p-8 rounded-2xl shadow-xl border border-emerald-100">
        <h2 className="text-3xl font-bold text-center mb-8" style={{ color: '#41ac53' }}>
          Registracija novog člana
        </h2>

        {success && (
          <div className="mb-6 p-4 bg-green-100 text-green-800 rounded-lg text-center font-medium">
            Član uspešno registrovan! Preusmeravam...
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-800 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Obavezna polja */}
          <div className={sectionClass}>
            <h3 className="text-lg font-semibold text-gray-800 border-b border-emerald-200 pb-2 mb-2">
              Obavezna polja
            </h3>
            <div>
              <label className={labelClass}>Korisničko ime *</label>
              <input
                name="username"
                value={form.username}
                onChange={handleChange}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Lozinka * (min. 8 karaktera)</label>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                required
                minLength={8}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Uloga *</label>
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                required
                className={inputClass}
              >
                <option value="">— izaberi —</option>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role.charAt(0).toUpperCase() + role.slice(1).replace('-', ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Lični podaci */}
          <div className={sectionClass}>
            <h3 className="text-lg font-semibold text-gray-800 border-b border-emerald-200 pb-2 mb-2">
              Lični podaci (opciono)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Puno ime</label>
                <input
                  name="fullName"
                  value={form.fullName}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Ime roditelja</label>
                <input
                  name="imeRoditelja"
                  value={form.imeRoditelja}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Pol</label>
                <select
                  name="pol"
                  value={form.pol}
                  onChange={handleChange}
                  className={inputClass}
                >
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
                <input
                  name="drzavljanstvo"
                  value={form.drzavljanstvo}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Kontakt */}
          <div className={sectionClass}>
            <h3 className="text-lg font-semibold text-gray-800 border-b border-emerald-200 pb-2 mb-2">
              Kontakt (opciono)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Email</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Telefon</label>
                <input
                  name="telefon"
                  value={form.telefon}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Adresa</label>
                <input
                  name="adresa"
                  value={form.adresa}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Planinarski / dokumenti */}
          <div className={sectionClass}>
            <h3 className="text-lg font-semibold text-gray-800 border-b border-emerald-200 pb-2 mb-2">
              Dokumenti i planinarski podaci (opciono)
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
              Disciplinske kazne, izbor u organe, napomene (opciono)
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
                  placeholder="Tekst o izrečenim disciplinskim kaznama..."
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
                  placeholder="Tekst o izboru u organe..."
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
                  placeholder="Dodatne napomene..."
                />
              </div>
            </div>
          </div>

          {/* Avatar */}
          <div className={sectionClass}>
            <h3 className="text-lg font-semibold text-gray-800 border-b border-emerald-200 pb-2 mb-2">
              Profilna slika (opciono)
            </h3>
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="w-full p-2 border border-gray-300 rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#41ac53]/10 file:text-[#41ac53] hover:file:bg-[#41ac53]/20 cursor-pointer"
            />
            {avatarPreview && (
              <div className="mt-4 flex justify-center">
                <img
                  src={avatarPreview}
                  alt="Preview profilne slike"
                  className="w-32 h-32 object-cover rounded-full border-4 border-[#41ac53]/30 shadow-md"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-4 text-white font-bold rounded-lg shadow-md transition-all hover:bg-[#2e8b45] focus:outline-none focus:ring-2 focus:ring-[#41ac53]/50"
            style={{ backgroundColor: '#41ac53' }}
          >
            Kreiraj novog člana
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-gray-500">
          Obavezna su samo korisničko ime, lozinka i uloga. Ostala polja možete popuniti kasnije.
        </p>
      </div>
    </div>
  )
}
