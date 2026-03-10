import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import Loader from '../../components/Loader'

export default function RegisterSuperAdmin() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await api.get('/api/setup/status')
        if (!res.data.needsSuperadmin) {
          navigate('/login', { replace: true })
          return
        }
      } catch (err) {
        console.error(err)
        setError('Greška pri proveri statusa.')
      } finally {
        setChecking(false)
      }
    }
    checkStatus()
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const formData = new FormData()
      formData.append('username', username)
      formData.append('password', password)
      formData.append('role', 'superadmin')
      if (fullName) formData.append('fullName', fullName)
      if (avatarFile) formData.append('avatar', avatarFile)

      await api.post('/api/register', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      navigate('/login', { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.error || 'Greška pri registraciji superadmina.')
    } finally {
      setSubmitting(false)
    }
  }

  if (checking) {
    return <Loader />
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-gray-200">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: '#41ac53' }}>
          Kreiranje superadmin naloga
        </h1>
        <p className="text-sm text-gray-600 mb-4">
          Ovo je jednokratni korak za kreiranje glavnog naloga (superadmin). Posle toga se svi drugi nalozi
          kreiraju iz aplikacije.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#41ac53] focus:ring-2 focus:ring-[#41ac53]/30 outline-none"
              required
              disabled={submitting}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Lozinka
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#41ac53] focus:ring-2 focus:ring-[#41ac53]/30 outline-none"
              required
              minLength={8}
              disabled={submitting}
            />
          </div>

          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
              Ime i prezime (opciono)
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#41ac53] focus:ring-2 focus:ring-[#41ac53]/30 outline-none"
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rola
            </label>
            <input
              type="text"
              value="superadmin"
              readOnly
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
            />
          </div>

          <div>
            <label htmlFor="avatar" className="block text-sm font-medium text-gray-700 mb-1">
              Profilna slika (opciono)
            </label>
            <input
              id="avatar"
              type="file"
              accept="image/*"
              className="w-full text-sm"
              onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`w-full rounded-lg py-2.5 font-semibold text-white text-sm transition-colors ${
              submitting ? 'opacity-60 cursor-not-allowed' : ''
            }`}
            style={{ backgroundColor: '#41ac53' }}
          >
            {submitting ? 'Kreiram...' : 'Kreiraj superadmin nalog'}
          </button>
        </form>
      </div>
    </div>
  )
}