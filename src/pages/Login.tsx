import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useEffect, useState } from 'react'
import api from '../services/api'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)


  useEffect(() => {
  const checkSetup = async () => {

    setLoading(true)
    try {
      const res = await api.get('/api/setup/status')


      const setupCompleted = res.data.hasUsers || res.data.setupCompleted || false;

      if (!setupCompleted) {
        navigate('/welcome', { replace: true })
      }
    } catch (err) {
      console.error('Greška pri proveri statusa', err)

        }
        finally {
          setLoading(false)}
      }

      checkSetup()
    }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('') // Clear previous error
    setLoading(true)

    try {
      const response = await api.post('/login', { username, password })
      login(response.data)
      navigate('/home')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Pogrešno korisničko ime ili lozinka.')
    }
    finally {
      setLoading(false)
    }
  }

  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">Proveravam stanje...</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">

      <div className="w-full max-w-md sm:max-w-lg lg:max-w-xl xl:max-w-2xl rounded-xl bg-white p-6 sm:p-8 lg:p-10 shadow-xl border border-gray-200">
        

        <div className="mb-8 text-center">
          <h2 
            className="text-3xl sm:text-4xl font-bold"
            style={{ color: '#41ac53' }}
          >
            Adri Sentinel
          </h2>
          <p className="mt-2 text-base sm:text-lg text-gray-600">
            User login
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-7">

          <div>
            <label 
              htmlFor="username" 
              className="mb-2 block text-sm sm:text-base font-medium text-gray-700"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 sm:py-3.5 text-base sm:text-lg focus:border-[#41ac53] focus:ring-2 focus:ring-[#41ac53]/30 focus:outline-none transition"
              placeholder="Enter your username"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label 
              htmlFor="password" 
              className="mb-2 block text-sm sm:text-base font-medium text-gray-700"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 sm:py-3.5 text-base sm:text-lg focus:border-[#41ac53] focus:ring-2 focus:ring-[#41ac53]/30 focus:outline-none transition"
              placeholder="Enter your password"
              required
              disabled={loading}
            />
          </div>


          <button
            type="submit"
            className={`w-full rounded-lg py-3.5 sm:py-4 font-semibold text-white text-base sm:text-lg transition-colors duration-200 ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            style={{ backgroundColor: '#41ac53' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fed74c'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#41ac53'}
          >
            Login
          </button>
        </form>

        <p className="mt-6 text-center text-sm sm:text-base text-gray-500">
          Don't have an account? Contact administrator to create one.
        </p>
      </div>
    </div>
  )
}