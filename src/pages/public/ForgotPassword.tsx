import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const res = await api.post('/api/password/forgot', { email: email.trim() })
      setSuccess(res.data?.message || 'Ako email postoji u sistemu, link je poslat.')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Došlo je do greške. Pokušajte ponovo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-sky-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900 mb-2">Zaboravljena lozinka</h1>
        <p className="text-sm text-slate-600 mb-5">Unesite email adresu i poslaćemo vam link za postavljanje nove lozinke.</p>
        {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
        {success && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-xl border border-emerald-100 bg-white px-3.5 py-2.5 text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-70"
          >
            {loading ? 'Slanje...' : 'Pošalji link'}
          </button>
        </form>
        <p className="mt-4 text-center text-xs">
          <Link to="/login" className="text-emerald-700 hover:underline">Nazad na prijavu</Link>
        </p>
      </div>
    </div>
  )
}
