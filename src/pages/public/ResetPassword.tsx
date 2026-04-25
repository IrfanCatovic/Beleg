import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../../services/api'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams])
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!token) {
      setError('Nedostaje token za reset lozinke.')
      return
    }
    if (newPassword.length < 8) {
      setError('Lozinka mora imati najmanje 8 karaktera.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Lozinke se ne poklapaju.')
      return
    }
    setLoading(true)
    try {
      const res = await api.post('/api/password/reset', { token, newPassword })
      setSuccess(res.data?.message || 'Lozinka je uspešno promenjena.')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Došlo je do greške. Pokušajte ponovo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-sky-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900 mb-2">Postavi novu lozinku</h1>
        <p className="text-sm text-slate-600 mb-5">Unesite novu lozinku i potvrdite izmenu.</p>
        {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
        {success && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nova lozinka"
            className="w-full rounded-xl border border-emerald-100 bg-white px-3.5 py-2.5 text-sm"
          />
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Ponovi novu lozinku"
            className="w-full rounded-xl border border-emerald-100 bg-white px-3.5 py-2.5 text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-70"
          >
            {loading ? 'Čuvanje...' : 'Sačuvaj lozinku'}
          </button>
        </form>
        <p className="mt-4 text-center text-xs">
          <Link to="/login" className="text-emerald-700 hover:underline">Nazad na prijavu</Link>
        </p>
      </div>
    </div>
  )
}
