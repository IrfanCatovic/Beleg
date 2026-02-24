import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

export default function SetupAdmin() {
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

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    try {
      await api.post('/api/setup/admin', form)
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Greška pri kreiranju admina')
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl text-green-600">
          Admin uspešno kreiran! Preusmeravam na login...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg bg-white p-8 rounded-xl shadow-lg">
        <h2 className="text-3xl font-bold mb-8 text-center" style={{ color: '#41ac53' }}>
          Kreirajte prvog administratora
        </h2>

        {error && <div className="mb-6 p-4 bg-red-100 text-red-700 rounded">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          <input name="username" placeholder="Korisničko ime" onChange={handleChange} required className="w-full p-4 border rounded" />
          <input name="password" type="password" placeholder="Lozinka" onChange={handleChange} required className="w-full p-4 border rounded" />
          <input name="fullName" placeholder="Puno ime" onChange={handleChange} required className="w-full p-4 border rounded" />
          <input name="email" type="email" placeholder="Email" onChange={handleChange} required className="w-full p-4 border rounded" />
          <input name="adresa" placeholder="Adresa" onChange={handleChange} required className="w-full p-4 border rounded" />
          <input name="telefon" placeholder="Telefon" onChange={handleChange} required className="w-full p-4 border rounded" />

          <button
            type="submit"
            className="w-full py-4 text-white font-bold rounded-lg"
            style={{ backgroundColor: '#41ac53' }}
          >
            Kreiraj admina
          </button>
        </form>
      </div>
    </div>
  )
}