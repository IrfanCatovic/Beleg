import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

export default function ProfileSettings() {
  const navigate = useNavigate()
  const { user, isLoggedIn } = useAuth()
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    adresa: '',
    telefon: '',
  })
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
          fullName: k.fullName || '',
          email: k.email || '',
          adresa: k.adresa || '',
          telefon: k.telefon || '',
        })
        if (k.avatar_url) setAvatarPreview(k.avatar_url)
      } catch (err: any) {
        setError(err.response?.data?.error || 'Greška pri učitavanju profila')
      } finally {
        setLoading(false)
      }
    }

    fetchMe()
  }, [isLoggedIn, navigate])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      formData.append('fullName', form.fullName)
      formData.append('email', form.email)
      formData.append('adresa', form.adresa)
      formData.append('telefon', form.telefon)
      if (avatarFile) formData.append('avatar', avatarFile)

      await api.patch('/api/me', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setSuccess(true)
      setTimeout(() => navigate('/profil', { replace: true }), 1500)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Greška pri čuvanju profila')
    } finally {
      setSaving(false)
    }
  }

  if (!isLoggedIn) return null
  if (loading) return <div className="text-center py-20">Učitavanje...</div>

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold" style={{ color: '#41ac53' }}>
            Podešavanja profila
          </h2>
          <Link
            to="/profil"
            className="text-gray-600 hover:text-gray-900 text-sm font-medium"
          >
            ← Nazad na profil
          </Link>
        </div>

        <p className="text-sm text-gray-500 mb-6">
          Korisničko ime i uloga se ne mogu menjati. Pređeni km i visina ostaju sačuvani pri ažuriranju.
        </p>

        {success && (
          <div className="mb-6 p-4 bg-green-100 text-green-800 rounded-lg text-center font-medium">
            Profil sačuvan. Preusmeravam...
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-800 rounded-lg">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Puno ime</label>
            <input
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              required
              className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#41ac53] focus:border-[#41ac53]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#41ac53] focus:border-[#41ac53]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adresa</label>
            <input
              name="adresa"
              value={form.adresa}
              onChange={handleChange}
              required
              className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#41ac53] focus:border-[#41ac53]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
            <input
              name="telefon"
              value={form.telefon}
              onChange={handleChange}
              required
              className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#41ac53] focus:border-[#41ac53]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Slika profila (opciono)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#41ac53] file:text-white file:font-medium hover:file:bg-[#3a9a4a]"
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
