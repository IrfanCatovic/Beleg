import { useState} from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function RegisterUser() {
    const { user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    username: '',
    password: '',
    fullName: '',
    email: '',
    adresa: '',
    telefon: '',
    role: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(true)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

  const roleOptions = user?.role === 'admin' ? [
  'admin', 'clan', 'vodic', 'blagajnik', 'sekretar', 'menadzer-opreme'
] : [
  'clan', 'vodic', 'blagajnik', 'sekretar', 'menadzer-opreme' // bez admina
]



  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-emerald-50 px-4 py-12">
      <div className="w-full max-w-lg bg-white p-8 rounded-2xl shadow-xl border border-emerald-100">
        <h2 className="text-3xl font-bold text-center mb-8" style={{ color: '#41ac53' }}>
          Registracija novog člana
        </h2>

        {success && (
          <div className="mb-6 p-4 bg-green-100 text-green-800 rounded-lg text-center font-medium">
            Član uspešno registrovan! Preusmeravam na login...
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

            <div>
                <label 
                    className="block text-sm font-medium text-gray-700 mb-1"
                >
                    Uloga
                </label>
                <select
                    name="role"
                    value={form.role}
                    onChange={handleChange}
                    required
                    className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#41ac53] focus:border-[#41ac53] bg-white text-gray-900 text-base transition-colors duration-200 hover:border-[#41ac53]/70 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <option value="" disabled>
                    Izaberite ulogu
                    </option>
                    {roleOptions.map((role) => (
                    <option 
                        key={role} 
                        value={role}
                    >
                        {role.charAt(0).toUpperCase() + role.slice(1).replace('-', ' ')}
                    </option>
                    ))}
                </select>
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
          Ovo je registracija za novog člana aplikacije.
        </p>
      </div>
    </div>
  )
}