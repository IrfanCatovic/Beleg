// src/pages/ErrorPage.tsx
import { Link } from 'react-router-dom'

export default function ErrorPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-gray-900 via-emerald-900 to-gray-900 flex items-center justify-center px-4">
      {/* Pozadina sa suptilnim planinskim efektom */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_70%,#41ac53_0%,transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,#fed74c_0%,transparent_50%)]" />
      </div>

      {/* Glavni sadržaj */}
      <div className="relative z-10 text-center max-w-2xl">
        {/* Veliki 404 */}
        <h1 className="text-8xl sm:text-9xl md:text-[12rem] font-black text-white tracking-tighter leading-none animate-pulse">
          404
        </h1>

        {/* Naslov */}
        <h2 className="mt-6 text-3xl sm:text-4xl md:text-5xl font-bold text-[#fed74c] mb-6">
          Staza ne postoji...
        </h2>

        {/* Tekst */}
        <p className="text-lg sm:text-xl md:text-2xl text-gray-300 mb-10 leading-relaxed">
          Izgleda da si skrenuo sa označene staze.  
          Ili je možda ova ruta još uvek u izviđanju.
        </p>

        {/* Animirano dugme */}
        <Link
          to="/home"
          className="inline-block px-10 py-5 text-xl sm:text-2xl font-bold text-white rounded-full shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-3xl hover:bg-[#fed74c] hover:text-[#41ac53] focus:outline-none focus:ring-4 focus:ring-[#fed74c]/50"
          style={{ backgroundColor: '#41ac53' }}
        >
          Vrati se na početnu stazu
        </Link>

        {/* Mali footer */}
        <p className="mt-16 text-sm sm:text-base text-gray-500">
          na vrhu • Nema vrha koji se ne može osvojiti... osim ove stranice 😅
        </p>
      </div>
    </div>
  )
}