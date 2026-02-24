import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'

export default function Welcome() {
  const [loading, setLoading] = useState(true)
  const [setupCompleted, setSetupCompleted] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const checkSetup = async () => {
      try {
        const res = await api.get('/api/setup/status')
        const { setupCompleted } = res.data

        if (setupCompleted) {
          // Baza nije prazna idi na login
          navigate('/login', { replace: true })
        } else {
          // Baza prazna ostanite na welcome i pokaži formu za admina
          setSetupCompleted(false)
        }
      } catch (err) {
        console.error('Greška pri proveri setup statusa', err)
      } finally {
        setLoading(false)
      }
    }

    checkSetup()
  }, [navigate])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-600">Proveravam stanje aplikacije...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4">
      <div className="max-w-2xl text-center">
        <h1 className="text-5xl md:text-7xl font-bold mb-6" style={{ color: '#41ac53' }}>
          Adri Sentinel
        </h1>

        <p className="text-xl md:text-2xl text-gray-700 mb-4">
          Dobro došli u vašu planinarsku avanturu!
        </p>

        <p className="text-lg text-gray-600 mb-12">
          Ovo je prvi put da se aplikacija pokreće.  
          Molimo vas da kreirate prvog administratora kako bismo mogli nastaviti sa normalnim radom.
        </p>

        <Link
          to="/setup/admin"
          className="inline-block px-10 py-5 text-xl font-bold text-white rounded-full shadow-lg transition-all hover:scale-105 hover:shadow-xl"
          style={{ background: 'linear-gradient(135deg, #41ac53 0%, #2e8b45 100%)' }}
        >
          Kreiraj prvog administratora
        </Link>

        <p className="mt-16 text-sm text-gray-500">
          Planinarsko društvo Adri Sentinel © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}