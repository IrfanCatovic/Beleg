import MarketingNavbar from '../../components/MarketingNavbar'

export default function Kontakt() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-emerald-50">
      <header className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-10 pt-6">
        <MarketingNavbar />
      </header>
      <main className="flex items-center justify-center px-4 pb-10">
        <div className="w-full max-w-xl mt-6 rounded-2xl bg-white/90 p-8 shadow-xl border border-emerald-100">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Kontakt</h1>
          <p className="text-gray-600 text-sm sm:text-base">
            Ovo je mesto za kontakt formu / informacije o aplikaciji.
            Za sada je stranica prazna i spremna za dalje uređivanje.
          </p>
        </div>
      </main>
    </div>
  )
}

