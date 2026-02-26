// src/pages/RegisterAdmin.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

export default function RegisterAdmin() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    username: '',
    password: '',
    fullName: '',
    email: '',
    adresa: '',
    telefon: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
  const checkSetup = async () => {
    try {
      const res = await api.get('/api/setup/status')

      const setupCompleted = res.data.hasUsers || res.data.setupCompleted || false;
      if (setupCompleted) {
        navigate('/', { replace: true })
      }
    } catch (err) {
      console.error('Greška pri proveri statusa', err)
        }
        finally {
          setLoading(false)
        }
      }

      checkSetup()
    }, [navigate])
    
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      await api.post('/api/setup/admin', form)
      setSuccess(true)
      // Posle uspeha → odmah na /
      setTimeout(() => navigate('/', { replace: true }), 1500)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Greška pri kreiranju administratora')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">Proveravam stanje aplikacije...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-emerald-50 px-4 py-12">
      <div className="w-full max-w-lg bg-white p-8 rounded-2xl shadow-xl border border-emerald-100">
        <h2 className="text-3xl font-bold text-center mb-8" style={{ color: '#41ac53' }}>
          Kreiranje prvog administratora
        </h2>

        {success && (
          <div className="mb-6 p-4 bg-green-100 text-green-800 rounded-lg text-center font-medium">
            Administrator uspešno kreiran! Preusmeravam na login...
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-800 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Korisničko ime
            </label>
            <input
              name="username"
              value={form.username}
              onChange={handleChange}
              required
              className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#41ac53] focus:border-[#41ac53]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lozinka
            </label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              required
              className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#41ac53] focus:border-[#41ac53]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Puno ime
            </label>
            <input
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              required
              className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#41ac53] focus:border-[#41ac53]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Adresa
            </label>
            <input
              name="adresa"
              value={form.adresa}
              onChange={handleChange}
              required
              className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#41ac53] focus:border-[#41ac53]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Telefon
            </label>
            <input
              name="telefon"
              value={form.telefon}
              onChange={handleChange}
              required
              className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#41ac53] focus:border-[#41ac53]"
            />
          </div>

          {/* Role – vidljivo ali disabled */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Uloga (automatski postavljeno)
            </label>
            <input
              name="role"
              value="admin"
              disabled
              className="w-full p-4 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
            />
          </div>

          <button
            type="submit"
            className="w-full py-4 text-white font-bold rounded-lg shadow-md transition-all hover:bg-[#2e8b45] focus:outline-none focus:ring-2 focus:ring-[#41ac53]/50"
            style={{ backgroundColor: '#41ac53' }}
          >
            Kreiraj prvog administratora
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-gray-500">
          Ovo je jednokratna registracija za prvog administratora aplikacije.
        </p>
      </div>
    </div>
  )
}