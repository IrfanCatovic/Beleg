import { useNavigate } from 'react-router-dom'

export default function Login() {
  const navigate = useNavigate()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    localStorage.setItem('isLoggedIn', 'true')
    console.log('Login pokušaj prebacujem na /home')
    navigate('/home')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">

      <div className="w-full max-w-md sm:max-w-lg lg:max-w-xl xl:max-w-2xl rounded-xl bg-white p-6 sm:p-8 lg:p-10 shadow-xl border border-gray-200">
        

        <div className="mb-8 text-center">
          <h2 
            className="text-3xl sm:text-4xl font-bold"
            style={{ color: '#41ac53' }}
          >
            Beleg PD
          </h2>
          <p className="mt-2 text-base sm:text-lg text-gray-600">
            Prijava člana
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-7">

          <div>
            <label 
              htmlFor="username" 
              className="mb-2 block text-sm sm:text-base font-medium text-gray-700"
            >
              Korisničko ime
            </label>
            <input
              id="username"
              type="text"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 sm:py-3.5 text-base sm:text-lg focus:border-[#41ac53] focus:ring-2 focus:ring-[#41ac53]/30 focus:outline-none transition"
              placeholder="Unesite korisničko ime"
              required
            />
          </div>

          <div>
            <label 
              htmlFor="password" 
              className="mb-2 block text-sm sm:text-base font-medium text-gray-700"
            >
              Lozinka
            </label>
            <input
              id="password"
              type="password"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 sm:py-3.5 text-base sm:text-lg focus:border-[#41ac53] focus:ring-2 focus:ring-[#41ac53]/30 focus:outline-none transition"
              placeholder="Unesite lozinku"
              required
            />
          </div>


          <button
            type="submit"
            className="w-full rounded-lg py-3.5 sm:py-4 font-semibold text-white text-base sm:text-lg transition-colors duration-200"
            style={{ backgroundColor: '#41ac53' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fed74c'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#41ac53'}
          >
            Uloguj se
          </button>
        </form>

        <p className="mt-6 text-center text-sm sm:text-base text-gray-500">
          Nemaš nalog? Obrati se administratoru društva.
        </p>
      </div>
    </div>
  )
}