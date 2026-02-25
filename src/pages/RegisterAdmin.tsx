import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'

export default function Register() {
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      const res = await api.post('/api/register', form)
      setSuccess(true)
      alert(res.data.message)
      setTimeout(() => navigate('/login'), 1500)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Greška pri registraciji')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-lg bg-white p-8 rounded-2xl shadow-xl">
        <h2 className="text-3xl font-bold text-center mb-8 text-[#41ac53]">
          Registracija novog člana
        </h2>

        {success && (
          <div className="mb-6 p-4 bg-green-100 text-green-800 rounded-lg text-center">
            Registracija uspešna! Preusmeravam na login...
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-800 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            name="username"
            placeholder="Korisničko ime"
            onChange={handleChange}
            required
            className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#41ac53]"
          />
          <input
            name="password"
            type="password"
            placeholder="Lozinka (min 8 karaktera)"
            onChange={handleChange}
            required
            className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#41ac53]"
          />
          <input
            name="fullName"
            placeholder="Puno ime"
            onChange={handleChange}
            required
            className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#41ac53]"
          />
          <input
            name="email"
            type="email"
            placeholder="Email"
            onChange={handleChange}
            required
            className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#41ac53]"
          />
          <input
            name="adresa"
            placeholder="Adresa"
            onChange={handleChange}
            required
            className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#41ac53]"
          />
          <input
            name="telefon"
            placeholder="Telefon"
            onChange={handleChange}
            required
            className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#41ac53]"
          />

          <button
            type="submit"
            className="w-full py-4 text-white font-bold rounded-lg shadow-md transition-all hover:bg-[#2e8b45]"
            style={{ backgroundColor: '#41ac53' }}
          >
            Registruj se
          </button>
        </form>

        <p className="mt-6 text-center text-gray-600">
          Već imate nalog?{' '}
          <Link to="/login" className="text-[#41ac53] font-medium hover:underline">
            Ulogujte se
          </Link>
        </p>
      </div>
    </div>
  )
}