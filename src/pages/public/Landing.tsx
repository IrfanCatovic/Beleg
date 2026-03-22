// Lokalne slike zamenjene Cloudinary URL-ovima direktno u JSX
import { useNavigate } from 'react-router-dom'
import MarketingNavbar from '../../components/MarketingNavbar'

function IconCheck(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 text-emerald-600"
      {...props}
    >
      <path
        d="M20 7L10 17L4 11"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconSparkles(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 text-yellow-500"
      {...props}
    >
      <path
        d="M5 3L6.5 7.5L11 9L6.5 10.5L5 15L3.5 10.5L-1 9L3.5 7.5L5 3Z"
        transform="translate(8 1)"
        fill="currentColor"
      />
      <circle cx="6" cy="6" r="1" fill="currentColor" />
      <circle cx="18" cy="8" r="1.2" fill="currentColor" />
    </svg>
  )
}

export default function Landing() {

  const navigate = useNavigate()
  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900">
      {/* Hero */}
      <header className="relative isolate overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-emerald-50">
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_100%,#41ac53_0%,transparent_55%)] opacity-20 max-md:opacity-[0.12]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,#fed74c_0%,transparent_55%)] opacity-25 max-md:opacity-[0.12]" />
        </div>

        <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10 pt-8 pb-10 lg:pt-12 lg:pb-14">
          <MarketingNavbar />

          <div className="space-y-10">
            {/* Naslov + opis + CTA (levo) i slika (desno) */}
            <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6 lg:gap-10">
              {/* Leva kolona: tekst */}
              <div className="flex-[1.1] flex flex-col items-start gap-4">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-snug max-w-2xl">
                  Planiner{' '}
                  <span style={{ color: '#41ac53' }}>
                    digitalno srce tvog planinarskog društva
                  </span>
                </h1>

                <p className="text-base sm:text-lg text-gray-700 max-w-2xl">
                  Upravljanje članovima, akcijama, finansijama i obaveštenjima na jednom mestu.
                  Uštedi i preko <span className="font-semibold text-emerald-700">200 sati godišnje</span> na
                  formularima, ručnom prepisivanju i haosu u tabelama.
                </p>

                <p className="text-sm text-gray-600 max-w-xl">
                  Za predsednike, sekretare, vodiče, blagajnike i članove koji žele manje administracije, a više vremena na stazi.
                </p>

                <div className="flex flex-wrap gap-4 items-center">
                  <a
                    href="#cta"
                    className="inline-flex items-center justify-center px-8 py-3 rounded-full text-sm sm:text-base font-semibold text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl transition-all"
                    style={{ background: 'linear-gradient(135deg,#41ac53 0%,#2f855a 100%)' }}
                  >
                    Zakaži prezentaciju
                  </a>
                  <a
                    href="#how-it-works"
                    className="inline-flex items-center justify-center px-6 py-3 rounded-full text-sm sm:text-base font-semibold border border-gray-300 text-gray-800 hover:border-emerald-500 hover:text-emerald-700 transition-all bg-white/70 backdrop-blur"
                  >
                    Pogledaj kako radi
                  </a>
                </div>

                <p className="text-xs sm:text-sm text-gray-500">
                  Bez obaveze i bez pritiska za 30 minuta pokazujemo kako Planiner rešava vaše svakodnevne glavobolje.
                </p>
              </div>

              {/* Desna kolona: slika */}
              <div className="flex-[0.9] flex justify-center lg:justify-end">
                <div className="max-w-md sm:max-w-lg lg:max-w-xl xl:max-w-2xl">
                  <img
                    src="https://res.cloudinary.com/dfvxp5rza/image/upload/v1773786067/na_vrhu_prikaz_aplikacije_na_laptopu_i_telefonu_kp9o1u.png"
                    alt="na vrhu  prikaz aplikacije na laptopu i telefonu"
                    className="rounded-3xl w-full h-auto object-contain"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mountain band segment sa porukom */}
      <section className="relative w-full bg-slate-900 text-white">
        <div className="relative w-full h-56 sm:h-72 md:h-80 lg:h-96 overflow-hidden">
          <img
            src="https://res.cloudinary.com/dfvxp5rza/image/upload/v1773786066/planinski_pejza%C5%BE_vpdfmb.jpg"
            alt="Planinski pejzaž"
            className="w-full h-full object-cover"
            style={{ objectPosition: 'center center' }}
          />

          {/* Tamni overlay za čitljiv tekst */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/70 via-slate-900/30 to-slate-900/80" />

          {/* Tekst preko slike */}
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <div className="max-w-3xl text-center">
              <p className="text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase text-emerald-200 mb-3">
                Samo za ozbiljne planinare
              </p>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-3 sm:mb-4 leading-snug">
                Prati svoj napredak na svakoj stazi
              </h2>
              <p className="text-sm sm:text-base text-slate-100 max-w-2xl mx-auto">
                Planiner ti pokazuje koliko si kilometara prešao, koliko uspona savladao i na kojim si se
                vrhovima već dokazao. Sezona po sezona, godina po godina.
              </p>
            </div>
          </div>
        </div>

        {/* Donji cik-cak border prema sledećem delu (belom) */}
        <div className="absolute -bottom-6 left-0 right-0 h-6 overflow-hidden text-white">
          <svg
            viewBox="0 0 100 10"
            preserveAspectRatio="none"
            className="w-full h-full"
          >
            <polygon
              fill="white"
              points="0,0 0,10 5,5 10,10 15,5 20,10 25,5 30,10 35,5 40,10 45,5 50,10 55,5 60,10 65,5 70,10 75,5 80,10 85,5 90,10 95,5 100,10 100,0"
            />
          </svg>
        </div>
      </section>

      <main className="flex-1">
        {/* Problemi -> Rešenja */}
        <section className="py-16 sm:py-20 bg-white relative isolate overflow-hidden">
          <div className="pointer-events-none absolute inset-0 z-0 opacity-40 max-md:opacity-[0.14]">
            <div className="absolute -left-32 max-md:-left-48 top-10 h-64 max-md:h-44 w-64 max-md:w-44 rounded-full bg-emerald-50" />
            <div className="absolute -right-32 max-md:-right-48 bottom-0 h-80 max-md:h-48 w-80 max-md:w-48 rounded-full bg-yellow-50" />
          </div>
          <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold mb-4">Šta tačno rešavamo</h2>
              <p className="text-gray-600 text-sm sm:text-base max-w-2xl mx-auto">
                Od haosa u papirima i tabelama do jasnog, digitalnog sistema koji radi umesto vas.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full bg-red-100">
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-red-500">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                      <line x1="12" y1="8" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <circle cx="12" cy="16.5" r="1.2" fill="currentColor" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-500">Problem</p>
                </div>
                <p className="text-sm font-semibold mb-3">
                  Haos u tabelama, papiri, duplo kucanje, izgubljeni formulari.
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  Podaci o članovima razbacani u Excelu, papirnim obrascima i porukama, niko nema kompletnu sliku.
                </p>
                <div className="border-t border-dashed border-gray-200 mt-3 pt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100">
                      <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 text-emerald-600">
                        <path d="M20 7L10 17L4 11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold text-emerald-700">Rešenje u Planiner</p>
                  </div>
                  <p className="text-xs text-gray-600">
                    Centralizovana baza članova sa svim podacima, dokumentima i planinarskim informacijama
                    (legitimacije, markice, disciplinske mere, izbor u organe).
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full bg-red-100">
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-red-500">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                      <line x1="12" y1="8" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <circle cx="12" cy="16.5" r="1.2" fill="currentColor" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-500">Problem</p>
                </div>
                <p className="text-sm font-semibold mb-3">
                  Ne zna se ko je šta uplatio, na koju akciju je prijavljen i sve ide preko poruka.
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  Sekretar, vodiči i blagajnik troše sate na dopisivanje, prepisivanje i prebrojavanje.
                </p>
                <div className="border-t border-dashed border-gray-200 mt-3 pt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100">
                      <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 text-emerald-600">
                        <path d="M20 7L10 17L4 11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold text-emerald-700">Rešenje u Planiner</p>
                  </div>
                  <p className="text-xs text-gray-600">
                    Jedinstveno mesto za akcije, zadatke, finansije i obaveštenja, svaki ulogovani vidi ono što
                    mu treba. Vodiči, admini i blagajnici imaju posebna ovlašćenja.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full bg-red-100">
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-red-500">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                      <line x1="12" y1="8" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <circle cx="12" cy="16.5" r="1.2" fill="currentColor" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-500">Problem</p>
                </div>
                <p className="text-sm font-semibold mb-3">
                  Administracija troši sate i dane godišnje.
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  Upis članova, evidencija akcija, ručna obaveštenja, finansijski izveštaji, sve se radi od nule.
                </p>
                <div className="border-t border-dashed border-gray-200 mt-3 pt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100">
                      <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 text-emerald-600">
                        <path d="M20 7L10 17L4 11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold text-emerald-700">Rešenje u Planiner</p>
                  </div>
                  <p className="text-xs text-gray-600">
                    Automatizacija procesa (registracija članova, evidencija akcija, obaveštenja, finansije) i
                    ušteda preko <span className="font-semibold">200 sati godišnje</span>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Za člana: kako radi, zašto je zanimljivo, zajednica, napredak, takmičenje */}
        <section id="za-clana" className="py-16 sm:py-20 bg-gradient-to-b from-slate-50 to-white">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10">
            <div className="text-center mb-12">
              <p className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700 mb-3">
                Za člana društva
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">
                Tvoj put na stazi jednostavno i zanimljivo
              </h2>
              <p className="text-gray-600 text-sm sm:text-base max-w-2xl mx-auto">
                Planiner nije samo za rukovodstvo. Kao član imaš svoj prostor: pregled akcija, prijave jednim klikom,
                zajednica sa drugim planinarima i motivacija kroz napredak i takmičenje.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {/* Kako koristiš aplikaciju */}
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-100">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-emerald-600">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">Kako radi za tebe</h3>
                </div>
                <ul className="space-y-3 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Uloguješ se i vidiš sve predstojeće akcije društva na jednom mestu.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Prijaviš se na akciju jednim klikom bez papira, formulara i dopisivanja.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Posle svake akcije automatski ti se beleže kilometri, uspon i učestvovanje.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Pratiš svoj napredak i rang u društvu sve na tvom profilu.</span>
                  </li>
                </ul>
              </div>

              {/* Interakcija sa ostalim planinarima */}
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-xl bg-blue-100">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-blue-600">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">Zajednica i interakcija</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Ostani u toku sa društvom i drugim planinarima:
                </p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 text-blue-500 shrink-0" />
                    <span>Ko je na kojoj akciji vidiš ko se prijavio i ko je vodič.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 text-blue-500 shrink-0" />
                    <span>Obaveštenja o novim akcijama, promenama i važnim obaveštenjima.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 text-blue-500 shrink-0" />
                    <span>Javni profili članova pogledaj napredak drugih i podeli svoj.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 text-blue-500 shrink-0" />
                    <span>Jedno mesto umesto deset grupa i poruka sve na stazi, sve u Planineru.</span>
                  </li>
                </ul>
              </div>

              {/* Beleženje napretka i takmičenje */}
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-xl bg-amber-100">
                    <IconSparkles className="h-5 w-5 text-amber-600" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">Napredak i takmičenje</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Svaka akcija ti donosi više od uspomene beleži se i motivira:
                </p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 text-amber-500 shrink-0" />
                    <span>Kilometri, ukupan uspon, broj akcija istorija na tvom profilu.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 text-amber-500 shrink-0" />
                    <span>Rank tipa „Legenda stijena“ vidiš gde stojiš u društvu.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 text-amber-500 shrink-0" />
                    <span>Mini takmičenja po sezoni ko je najaktivniji, ko ima najviše uspona.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 text-amber-500 shrink-0" />
                    <span>Podeli svoj planinarski CV na društvenim mrežama i motiviraj druge.</span>
                  </li>
                </ul>
              </div>
            </div>

            <p className="text-center text-sm text-gray-500 mt-8">
              Želiš da tvoje društvo koristi Planiner?{' '}
              <a href="#cta" className="font-semibold text-emerald-600 hover:text-emerald-700 underline">
                Predloži rukovodstvu da zakaže prezentaciju
              </a>
              .
            </p>
          </div>
        </section>

        {/* Ranking i mini takmičenja */}
        <section className="py-16 sm:py-20 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-slate-50">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10">
            <div className="flex flex-col lg:flex-row items-center lg:items-start gap-8 lg:gap-12">
              {/* Tekst levo */}
              <div className="flex-[1.1] max-w-3xl">
                <p className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300 mb-3">
                  <IconSparkles className="h-3.5 w-3.5 text-emerald-300" />
                  Ranking i mini takmičenja
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold mb-3">
                  Pretvorite svaku akciju u mali izazov
                </h2>
                <p className="text-sm sm:text-base text-slate-200 mb-4 max-w-xl">
                  Planiner vodi detaljnu statistiku za svakog člana nakon uspešne akcije, broj pređenih kilometara,
                  ukupni uspon i osvojen rank. Društvo dobija motivacioni sistem koji nagrađuje aktivnost, a članovi
                  jasnu sliku o svom napretku.
                </p>
                <ul className="space-y-2 text-xs sm:text-sm text-slate-200">
                  <li className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
                    <span>
                      Personalizovani ranking za svakog člana na osnovu učestvovanja na akcijama i pređene kilometraže.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
                    <span>
                      Beleženje ključnih metrika posle svake akcije: broj kilometara, ukupan uspon, broj dana na terenu.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
                    <span>
                      Unutrašnja mini takmičenja po sezoni ili godini, ko je najaktivniji, ko je skupio najviše uspona.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
                    <span>
                      Deljenje profila na društvenim mrežama, članovi mogu da pokažu svoj planinarski CV
                      prijateljima i zajednici.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Kartica profila desno (hero slaganje) */}
              <div className="flex-[0.9] flex justify-center lg:justify-end">
                <div className="w-full max-w-sm md:max-w-md rounded-3xl border border-emerald-500/20 bg-slate-900/60 p-4 sm:p-5 shadow-2xl shadow-black/40">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Profil člana</p>
                      <p className="text-sm font-semibold text-slate-50">Pera Perić</p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300">
                      Rank: Legenda stijena
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center mb-4">
                    <div className="rounded-2xl bg-slate-800/70 px-3 py-2">
                      <p className="text-[10px] text-slate-400 mb-1">Ukupno km</p>
                      <p className="text-sm font-semibold text-slate-50">182</p>
                    </div>
                    <div className="rounded-2xl bg-slate-800/70 px-3 py-2">
                      <p className="text-[10px] text-slate-400 mb-1">Ukupan uspon</p>
                      <p className="text-sm font-semibold text-slate-50">6 450 m</p>
                    </div>
                    <div className="rounded-2xl bg-slate-800/70 px-3 py-2">
                      <p className="text-[10px] text-slate-400 mb-1">Akcije</p>
                      <p className="text-sm font-semibold text-slate-50">24</p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-800/80 px-3 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] text-slate-400">Mini takmičenje, prolećna sezona</p>
                      <p className="text-xs text-slate-100">Trenutni plasman: 3. mesto u društvu</p>
                    </div>
                    <button
                      type="button"
                      className="ml-3 inline-flex items-center rounded-full bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-slate-900 hover:bg-emerald-400 transition-colors"
                    >
                      Podeli profil
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Ključne funkcionalnosti */}
        <section id="features" className="py-16 sm:py-20 bg-emerald-50/60 relative isolate overflow-hidden">
          <div className="pointer-events-none absolute inset-0 z-0 opacity-50 max-md:opacity-[0.18]">
            <div className="absolute -right-24 max-md:-right-40 -top-10 max-md:-top-6 h-56 max-md:h-36 w-56 max-md:w-36 rounded-full bg-white/60" />
            <div className="absolute -left-24 max-md:-left-40 bottom-0 h-48 max-md:h-32 w-48 max-md:w-32 rounded-full bg-emerald-100/70" />
          </div>
          <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">Ključne funkcionalnosti aplikacije</h2>
              <p className="text-gray-600 text-sm sm:text-base max-w-3xl mx-auto">
                Sve što planinarskom društvu treba  od prvog učlanjenja do poslednjeg izvještaja blagajne.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="group rounded-2xl bg-white shadow-sm border border-emerald-100 p-5 hover:shadow-lg hover:border-emerald-200 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold mb-2 text-emerald-900">Upravljanje članovima</h3>
                    <p className="text-xs text-gray-600 mb-3">
                      Detaljni profili članova sa ličnim podacima, kontaktima, planinarskim dokumentima,
                      disciplinskim merama i izborima u organe.
                    </p>
                    <p className="text-xs text-gray-500">
                      Više uloga (admin, sekretar, vodič, blagajnik, član) svako vidi ono što mu je potrebno.
                    </p>
                  </div>
                  <div className="shrink-0 inline-flex items-center justify-center h-11 w-11 rounded-xl bg-emerald-100 group-hover:bg-emerald-200 transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-emerald-600">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="group rounded-2xl bg-white shadow-sm border border-blue-100 p-5 hover:shadow-lg hover:border-blue-200 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold mb-2 text-blue-900">Akcije i zadaci</h3>
                    <p className="text-xs text-gray-600 mb-3">
                      Kreiranje, uređivanje i praćenje planinarskih akcija, prijave članova i zadaci za vodiče
                      i organizatore.
                    </p>
                    <p className="text-xs text-gray-500">
                      Jasan pregled aktivnih i prošlih akcija, istorije prisustva i angažmana članova.
                    </p>
                  </div>
                  <div className="shrink-0 inline-flex items-center justify-center h-11 w-11 rounded-xl bg-blue-100 group-hover:bg-blue-200 transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-blue-600">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="group rounded-2xl bg-white shadow-sm border border-amber-100 p-5 hover:shadow-lg hover:border-amber-200 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold mb-2 text-amber-900">Finansije (admin i blagajnik)</h3>
                    <p className="text-xs text-gray-600 mb-3">
                      Evidencija uplata i isplata, povezivanje sa članovima ili akcijama i pregled istorije plaćanja.
                    </p>
                    <p className="text-xs text-gray-500">
                      Transparentan rad blagajnika i lakše pravdanje finansija prema upravnom odboru.
                    </p>
                  </div>
                  <div className="shrink-0 inline-flex items-center justify-center h-11 w-11 rounded-xl bg-amber-100 group-hover:bg-amber-200 transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-amber-600">
                      <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
                      <path d="M4 6v12a2 2 0 0 0 2 2h14v-4" />
                      <circle cx="18" cy="14" r="1" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="group rounded-2xl bg-white shadow-sm border border-violet-100 p-5 hover:shadow-lg hover:border-violet-200 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold mb-2 text-violet-900">Obaveštenja u realnom vremenu</h3>
                    <p className="text-xs text-gray-600 mb-3">
                      Interni sistem notifikacija za akcije, uplate, zadatke i važna saopštenja.
                    </p>
                    <p className="text-xs text-gray-500">
                      Admin jednim klikom šalje obaveštenje svim članovima ili ciljanim grupama.
                    </p>
                  </div>
                  <div className="shrink-0 inline-flex items-center justify-center h-11 w-11 rounded-xl bg-violet-100 group-hover:bg-violet-200 transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-violet-600">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="group rounded-2xl bg-white shadow-sm border border-rose-100 p-5 hover:shadow-lg hover:border-rose-200 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold mb-2 text-rose-900">Automatski PDF izveštaji</h3>
                    <p className="text-xs text-gray-600 mb-3">
                      Planiner za vas automatski priprema ključne PDF dokumente spremne za slanje i arhivu.
                    </p>
                    <p className="text-xs text-gray-500">
                      Godišnji izveštaj o akcijama, pojedinačni izveštaji sa akcija, profil svakog člana i detaljni
                      finansijski izveštaji nastaju iz sistema jednim klikom, bez dodatnog kucanja i prepisivanja.
                    </p>
                  </div>
                  <div className="shrink-0 inline-flex items-center justify-center h-11 w-11 rounded-xl bg-rose-100 group-hover:bg-rose-200 transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-rose-600">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="group rounded-2xl bg-white shadow-sm border border-sky-100 p-5 hover:shadow-lg hover:border-sky-200 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold mb-2 text-sky-900">Javni profil i dostignuća</h3>
                    <p className="text-xs text-gray-600">
                      Svaki korisnik ima svoj profil koji je javno dostupan. Na njemu može da pokaže svoja dostignuća: pređene staze, savladane uspone i učešće u akcijama.
                    </p>
                  </div>
                  <div className="shrink-0 inline-flex items-center justify-center h-11 w-11 rounded-xl bg-sky-100 group-hover:bg-sky-200 transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-sky-600">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                      <path d="M16 3l2 2-2 2" fill="none" />
                      <polygon points="22 2 22 6 18 4" fill="currentColor" stroke="none" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Kako funkcioniše */}
        <section id="how-it-works" className="py-16 sm:py-20 bg-white">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">Kako funkcioniše Planiner</h2>
              <p className="text-gray-600 text-sm sm:text-base max-w-2xl mx-auto">
                Jasni koraci od prvog kontakta do svakodnevnog rada celog društva u sistemu.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-4">
              {[
                {
                  title: 'Kreiramo administratora i strukturu',
                  text: 'Na kratkom online sastanku upoznajemo se sa vašim društvom, postavljamo prvog admina i dogovaramo strukturu: sekcije, vodiče, blagajnika, upravni odbor i ostale uloge.',
                  step: '01',
                },
                {
                  title: 'Unos postojećih članova i podataka',
                  text: 'Pomažemo da postojeće članove sa papira i iz tabela postepeno unesete u planiner uz naše šablone i podršku tima.',
                  step: '02',
                },
                {
                  title: 'Akcije, zadaci i uloge u sistemu',
                  text: 'Vodiči i admini u aplikaciji planiraju akcije, definišu zadatke za tim, dodeljuju odgovorne osobe i prate prijave članova i to sve na jednom mestu.',
                  step: '03',
                }, 
                {
                  title: 'Svakodnevni rad celog društva',
                  text: 'Članovi se prijavljuju na akcije i prate svoj napredak, vodiči šalju obaveštenja, blagajnik vidi sve uplate, a rukovodstvo ima jasan uvid u članove, akcije i finansije. planiner postaje digitalno „mesto susreta“ celog društva.',
                  step: '04',
                },
              ].map(({ title, text, step }, i) => {
                const colors = [
                  'bg-emerald-100 text-emerald-800 border-emerald-200',
                  'bg-blue-100 text-blue-800 border-blue-200',
                  'bg-amber-100 text-amber-800 border-amber-200',
                  'bg-violet-100 text-violet-800 border-violet-200',
                ]
                const borders = [
                  'border-emerald-100 hover:border-emerald-200',
                  'border-blue-100 hover:border-blue-200',
                  'border-amber-100 hover:border-amber-200',
                  'border-violet-100 hover:border-violet-200',
                ]
                return (
                  <div
                    key={step}
                    className={`relative rounded-2xl border p-5 shadow-sm bg-white hover:shadow-md transition-all ${borders[i]}`}
                  >
                    <div className={`absolute -top-3 left-4 inline-flex items-center justify-center h-7 px-3 rounded-full border text-[10px] font-semibold ${colors[i]}`}>
                      Korak {step}
                    </div>
                    <h3 className="mt-3 mb-2 text-sm font-semibold">{title}</h3>
                    <p className="text-xs text-gray-600">{text}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Komunitet i podrška */}
        <section className="py-16 sm:py-20 bg-slate-50">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10">
            <div className="flex flex-col lg:flex-row items-center lg:items-start gap-8 lg:gap-12">
              {/* Tekst levo */}
              <div className="flex-[1.1]">
                <h2 className="text-2xl sm:text-3xl font-bold mb-4">Više od softvera - partner za društvo</h2>
                <p className="text-sm sm:text-base text-gray-600 mb-6">
                  Planiner razvija posvećen tim developera koji aktivno sarađuje sa planinarskim društvima. Naš cilj
                  je da vam damo više vremena na stazi, a manje za stolom.
                </p>

                <div className="space-y-5 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5 inline-flex items-center justify-center h-9 w-9 rounded-xl bg-emerald-100">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5 text-emerald-600">
                        <polyline points="16 18 22 12 16 6" />
                        <polyline points="8 6 2 12 8 18" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 mb-1">Ozbiljan tim developera</p>
                      <p className="text-xs text-gray-600">
                        Redovni update-i, sigurnosne zakrpe i nove funkcionalnosti zasnovane na iskustvu sa terena, uz
                        brz odaziv na prijavljene bagove i probleme u radu.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5 inline-flex items-center justify-center h-9 w-9 rounded-xl bg-blue-100">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5 text-blue-600">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 mb-1">Podrška na lokalnom jeziku</p>
                      <p className="text-xs text-gray-600">
                        E-mail, telefon i online sastanci  od implementacije i obuke tima do svakodnevnih pitanja, sa
                        fokusom na brz response time i jasne, konkretne odgovore.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5 inline-flex items-center justify-center h-9 w-9 rounded-xl bg-amber-100">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5 text-amber-600">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 mb-1">Community za planinare</p>
                      <p className="text-xs text-gray-600">
                        Kreiramo mrežu društava koja koriste isti sistem, razmenjuju prakse i predloge za nove funkcije,
                        a naše izdanje prati realne potrebe i predloge iz te zajednice.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Slika tima desno */}
              <div className="flex-[0.9] flex justify-center lg:justify-end">
                <div className="w-full max-w-sm">
                  <div className="rounded-3xl bg-white border border-slate-100 shadow-md overflow-hidden">
                    <img
                      src="https://res.cloudinary.com/dfvxp5rza/image/upload/v1773786065/teamwork_nfwwcv.jpg"
                      alt="Tim na Planiner u online sastanku sa planinarskim društvom"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-center text-[11px] text-gray-400 mt-2">Tim Planiner-a  podrška od prvog dana</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Planinar band segment sa porukom */}
        <section className="relative w-full bg-slate-900 text-white">
          <div className="relative w-full h-56 sm:h-72 md:h-80 lg:h-96 overflow-hidden">
            <img
              src="https://res.cloudinary.com/dfvxp5rza/image/upload/v1773786066/planinar_na_stazi_zaz7p3.jpg"
              alt="Planinar na stazi"
              className="w-full h-full object-cover filter blur-[1px] scale-105"
              style={{ objectPosition: 'center 65%' }}
            />

            {/* Tamni overlay za čitljiv tekst */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/40 to-slate-900/90" />

            {/* Tekst preko slike */}
            <div className="absolute inset-0 flex items-center justify-center px-4">
              <div className="max-w-3xl text-center">
                <p className="text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase text-emerald-200 mb-3">
                  Članovi u centru sistema
                </p>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-3 sm:mb-4 leading-snug">
                  Svaki član vidi svoj put na planini
                </h2>
                <p className="text-sm sm:text-base text-slate-100 max-w-2xl mx-auto">
                  Planiner čuva planinarsku priču svakog člana, od prve akcije i markice do ozbiljnih uspona i
                  vođenja tura. Društvo dobija urednu evidenciju, a članovi lični motiv da budu još aktivniji.
                </p>
              </div>
            </div>
          </div>

          {/* Donji cik-cak border prema sledećem belom segmentu */}
          <div className="absolute -bottom-6 left-0 right-0 h-6 overflow-hidden text-white">
            <svg
              viewBox="0 0 100 10"
              preserveAspectRatio="none"
              className="w-full h-full"
            >
              <polygon
                fill="white"
                points="0,0 0,10 5,5 10,10 15,5 20,10 25,5 30,10 35,5 40,10 45,5 50,10 55,5 60,10 65,5 70,10 75,5 80,10 85,5 90,10 95,5 100,10 100,0"
              />
            </svg>
          </div>
        </section>

        {/* Brojevi i benefiti */}
        <section className="py-16 sm:py-20 bg-white relative isolate overflow-hidden">
          <div className="pointer-events-none absolute inset-0 z-0 opacity-40 max-md:opacity-[0.14]">
            <div className="absolute -left-28 max-md:-left-44 top-16 max-md:top-8 h-52 max-md:h-36 w-52 max-md:w-36 rounded-full bg-emerald-50" />
            <div className="absolute -right-24 max-md:-right-40 bottom-10 max-md:bottom-4 h-60 max-md:h-40 w-60 max-md:w-40 rounded-full bg-slate-50" />
          </div>
          <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">Brojevi i benefiti</h2>
              <p className="text-gray-600 text-sm sm:text-base max-w-2xl mx-auto">
                Jasne, merljive koristi koje vaše društvo dobija prelaskom na Planiner.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 text-center hover:shadow-md transition-shadow">
                <div className="mx-auto mb-3 inline-flex items-center justify-center h-10 w-10 rounded-full bg-emerald-200/60">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-emerald-700">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-emerald-800 mb-1">Ušteda vremena</p>
                <p className="text-2xl font-extrabold text-emerald-700 mb-1">200+</p>
                <p className="text-[11px] text-emerald-900/80">sati godišnje manje na administraciji</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-center hover:shadow-md transition-shadow">
                <div className="mx-auto mb-3 inline-flex items-center justify-center h-10 w-10 rounded-full bg-slate-200/60">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-slate-700">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-slate-800 mb-1">Manje grešaka</p>
                <p className="text-2xl font-extrabold text-slate-800 mb-1">0</p>
                <p className="text-[11px] text-slate-900/80">
                  izgubljenih formulara i duplih unosa
                </p>
              </div>
              <div className="rounded-2xl border border-yellow-100 bg-yellow-50 p-5 text-center hover:shadow-md transition-shadow">
                <div className="mx-auto mb-3 inline-flex items-center justify-center h-10 w-10 rounded-full bg-yellow-200/60">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-yellow-800">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-yellow-900 mb-1">Brža komunikacija</p>
                <p className="text-2xl font-extrabold text-yellow-900 mb-1">x3</p>
                <p className="text-[11px] text-yellow-900/90">
                  sve informacije i obaveštenja na jednom mestu
                </p>
              </div>
              <div className="rounded-2xl border border-violet-100 bg-violet-50/40 p-5 text-center hover:shadow-md transition-shadow">
                <div className="mx-auto mb-3 inline-flex items-center justify-center h-10 w-10 rounded-full bg-violet-200/60">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-violet-700">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-violet-800 mb-1">Transparentnost</p>
                <p className="text-2xl font-extrabold text-violet-700 mb-1">100%</p>
                <p className="text-[11px] text-violet-900/80">
                  bolji pregled rada rukovodstva i blagajne
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Social proof  citati korisnika */}
        <section className="py-14 sm:py-18 bg-slate-50 border-y border-slate-100">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 mb-8">Šta kažu korisnici</p>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
                <div className="flex gap-0.5 mb-3">
                  {[...Array(5)].map((_, i) => <svg key={i} viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-yellow-400"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" /></svg>)}
                </div>
                <p className="text-sm text-gray-700 italic mb-4">
                  „Konačno nemam 50 poruka u viber grupi pre svake akcije. Sve je na jednom mestu, prijave, detalji, ko je platio."
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700">M</div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">Marko P. <span className="font-normal text-gray-400"> Vodič</span></p>
                    <p className="text-[11px] text-gray-400">PD „Zeleni vrh"</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
                <div className="flex gap-0.5 mb-3">
                  {[...Array(5)].map((_, i) => <svg key={i} viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-yellow-400"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" /></svg>)}
                </div>
                <p className="text-sm text-gray-700 italic mb-4">
                  „Kao blagajnik trošio sam dane na prepisivanje uplata iz beležnice. Sada vidim sve u realnom vremenu i mogu da izvezem izveštaj u PDF za 10 sekundi."
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-700">J</div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">Jelena S. <span className="font-normal text-gray-400"> Blagajnik</span></p>
                    <p className="text-[11px] text-gray-400">PD „Staza"</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
                <div className="flex gap-0.5 mb-3">
                  {[...Array(5)].map((_, i) => <svg key={i} viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-yellow-400"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" /></svg>)}
                </div>
                <p className="text-sm text-gray-700 italic mb-4">
                  „Moj profil sa statistikom i rangom me motiviše da idem na svaku akciju. Javni profil sam podelio na Instagramu, svi su bili oduševljeni."
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-sky-100 flex items-center justify-center text-xs font-bold text-sky-700">N</div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">Nemanja D. <span className="font-normal text-gray-400"> Član</span></p>
                    <p className="text-[11px] text-gray-400">PD „Vršak"</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Za koga je */}
        <section id="for-whom" className="py-16 sm:py-20 bg-emerald-50/60">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">Za koga je Planiner</h2>
              <p className="text-gray-600 text-sm sm:text-base max-w-3xl mx-auto">
                Jedna aplikacija, različiti pogledi  svaka uloga u društvu dobija jasne benefite.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="group rounded-2xl bg-white border border-emerald-100 p-5 hover:shadow-lg hover:border-emerald-200 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-emerald-700 mb-1">Predsednik društva</p>
                    <p className="text-sm font-semibold mb-2">
                      Sve na jednom mestu, bez iznenađenja.
                    </p>
                    <p className="text-xs text-gray-600">
                      Jasan pregled članova, akcija, finansija i obaveštenja. Manji rizik, manje haosa.
                    </p>
                  </div>
                  <div className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-xl bg-emerald-100 group-hover:bg-emerald-200 transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5 text-emerald-600">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="group rounded-2xl bg-white border border-blue-100 p-5 hover:shadow-lg hover:border-blue-200 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-blue-700 mb-1">Sekretar</p>
                    <p className="text-sm font-semibold mb-2">
                      Manje papira, više reda.
                    </p>
                    <p className="text-xs text-gray-600">
                      Brzi upis i ažuriranje članova, dokumentacija na dohvat ruke, manje manuelnog rada.
                    </p>
                  </div>
                  <div className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-xl bg-blue-100 group-hover:bg-blue-200 transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5 text-blue-600">
                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="group rounded-2xl bg-white border border-amber-100 p-5 hover:shadow-lg hover:border-amber-200 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-amber-700 mb-1">Vodič</p>
                    <p className="text-sm font-semibold mb-2">
                      Jasne prijave i komunikacija.
                    </p>
                    <p className="text-xs text-gray-600">
                      Jedno mesto za kreiranje akcija, pregled prijava i informacije za učesnike.
                    </p>
                  </div>
                  <div className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-xl bg-amber-100 group-hover:bg-amber-200 transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5 text-amber-600">
                      <circle cx="12" cy="12" r="10" />
                      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="group rounded-2xl bg-white border border-violet-100 p-5 hover:shadow-lg hover:border-violet-200 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-violet-700 mb-1">Blagajnik</p>
                    <p className="text-sm font-semibold mb-2">
                      Čista evidencija finansija.
                    </p>
                    <p className="text-xs text-gray-600">
                      Jasna evidencija uplata i isplata, lakše pravdanje finansija pred članovima i upravom.
                    </p>
                  </div>
                  <div className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-xl bg-violet-100 group-hover:bg-violet-200 transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5 text-violet-600">
                      <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
                      <path d="M4 6v12a2 2 0 0 0 2 2h14v-4" />
                      <circle cx="18" cy="14" r="1" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* UI preview  premium showcase */}
        <section className="relative isolate py-20 sm:py-28 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 overflow-hidden">
          {/* Ambient glow effects — iza teksta; na mobilu manji i slabiji da ne prekrivaju naslove */}
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 md:left-1/4 md:translate-x-0 w-[min(100vw,280px)] h-[min(100vw,280px)] md:w-[600px] md:h-[600px] bg-emerald-500/10 rounded-full blur-[80px] md:blur-[120px] max-md:opacity-40" />
            <div className="absolute bottom-0 right-1/2 translate-x-1/2 md:right-1/4 md:translate-x-0 w-[min(100vw,240px)] h-[min(100vw,240px)] md:w-[500px] md:h-[500px] bg-sky-500/8 rounded-full blur-[70px] md:blur-[100px] max-md:opacity-35" />
          </div>

          <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10">
            {/* Header */}
            <div className="text-center mb-16 sm:mb-20">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400 mb-3">Sneak peek</p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4 tracking-tight">
                Pogledaj aplikaciju iznutra
              </h2>
              <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
                Priključi se globalnoj mreži planinara. Isto iskustvo na računaru i telefonu vidi i budi viđen.
              </p>
            </div>

            <div className="space-y-24 sm:space-y-32">

              {/* ── 1. Akcije ── */}
              <div className="grid gap-10 lg:gap-16 lg:grid-cols-[1fr,1.4fr] items-center">
                {/* Tekst levo */}
                <div>
                  <span className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-bold mb-4">1</span>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">Akcije</h3>
                  <p className="text-sm text-slate-400 leading-relaxed mb-5">
                    Lista akcija, prijave članova i detalji isto iskustvo na računaru i na mobilnom. Prijavi se na planinarsku akciju u par klikova.
                  </p>
                  <div className="flex gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Desktop
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-sky-400 bg-sky-500/10 px-3 py-1 rounded-full">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />Mobile
                    </span>
                  </div>
                </div>
                {/* Slike desno PC veći, dva mobilna preklapaju */}
                <div className="relative">
                  {/* PC screenshot browser frame */}
                  <div className="rounded-xl overflow-hidden shadow-2xl shadow-black/40 ring-1 ring-white/10">
                    <div className="bg-slate-700 px-4 py-2 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                      <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/80" />
                      <span className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
                      <span className="ml-3 text-[10px] text-slate-400 truncate">planiner.app/akcije/uspon-na-zlu-kolatu</span>
                    </div>
                    <img src="/ActionDetails.png" alt="Akcije PC prikaz" className="w-full h-auto" />
                  </div>
                  {/* Mobilni ekrani lebde preko donjeg desnog ugla */}
                  <div className="absolute -bottom-8 -right-2 sm:-right-4 flex gap-2 sm:gap-3">
                    <div className="w-[90px] sm:w-[110px] rounded-xl overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-white/10 bg-slate-800">
                      <img src="/ActionDetails_mobile.png" alt="Akcije telefon detalj" className="w-full h-auto" />
                    </div>
                    <div className="w-[90px] sm:w-[110px] rounded-xl overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-white/10 bg-slate-800 -mt-4 sm:-mt-6">
                      <img src="/Akcije1_mob.png" alt="Akcije telefon lista" className="w-full h-auto" />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── 2. Profili obrnut layout: slike levo, tekst desno ── */}
              <div className="grid gap-10 lg:gap-16 lg:grid-cols-[1.4fr,1fr] items-center">
                {/* Slike levo */}
                <div className="relative order-2 lg:order-1">
                  <div className="rounded-xl overflow-hidden shadow-2xl shadow-black/40 ring-1 ring-white/10">
                    <div className="bg-slate-700 px-4 py-2 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                      <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/80" />
                      <span className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
                      <span className="ml-3 text-[10px] text-slate-400 truncate">planiner.app/korisnik/catko</span>
                    </div>
                    <div className="bg-slate-800/60 flex items-center justify-center py-20 text-xs text-slate-500">
                      Screenshot profila (PC) dodaj sliku ovde
                    </div>
                  </div>
                  <div className="absolute -bottom-8 -left-2 sm:-left-4 flex gap-2 sm:gap-3">
                    <div className="w-[90px] sm:w-[110px] rounded-xl overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-white/10 bg-slate-800 flex items-center justify-center py-16 text-[10px] text-slate-500 text-center px-2">
                      Profil (telefon)
                    </div>
                  </div>
                </div>
                {/* Tekst desno */}
                <div className="order-1 lg:order-2">
                  <span className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-sky-500/20 text-sky-400 text-sm font-bold mb-4">2</span>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">Profili korisnika</h3>
                  <p className="text-sm text-slate-400 leading-relaxed mb-5">
                    Javni profili članova statistika, pređene staze, usponi i učešće u akcijama. Pregledaj druge planinare i pokaži svoja dostignuća.
                  </p>
                  <div className="flex gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Desktop
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-sky-400 bg-sky-500/10 px-3 py-1 rounded-full">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />Mobile
                    </span>
                  </div>
                </div>
              </div>

              {/* ── 3. Finansije ── */}
              <div className="grid gap-10 lg:gap-16 lg:grid-cols-[1fr,1.4fr] items-center">
                <div>
                  <span className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-amber-500/20 text-amber-400 text-sm font-bold mb-4">3</span>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">Finansije</h3>
                  <p className="text-sm text-slate-400 leading-relaxed mb-5">
                    Blagajna, uplate, isplate i pregled po akcijama. Za blagajnike i rukovodstvo sve na jednom mestu, dostupno i sa mobilnog.
                  </p>
                  <div className="flex gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Desktop
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-sky-400 bg-sky-500/10 px-3 py-1 rounded-full">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />Mobile
                    </span>
                  </div>
                </div>
                <div className="relative">
                  <div className="rounded-xl overflow-hidden shadow-2xl shadow-black/40 ring-1 ring-white/10">
                    <div className="bg-slate-700 px-4 py-2 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                      <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/80" />
                      <span className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
                      <span className="ml-3 text-[10px] text-slate-400 truncate">planiner.app/finansije</span>
                    </div>
                    <div className="bg-slate-800/60 flex items-center justify-center py-20 text-xs text-slate-500">
                      Screenshot finansija (PC) dodaj sliku ovde
                    </div>
                  </div>
                  <div className="absolute -bottom-8 -right-2 sm:-right-4">
                    <div className="w-[90px] sm:w-[110px] rounded-xl overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-white/10 bg-slate-800 flex items-center justify-center py-16 text-[10px] text-slate-500 text-center px-2">
                      Finansije (telefon)
                    </div>
                  </div>
                </div>
              </div>

              {/* ── 4. Zadaci obrnut layout ── */}
              <div className="grid gap-10 lg:gap-16 lg:grid-cols-[1.4fr,1fr] items-center">
                <div className="relative order-2 lg:order-1">
                  <div className="rounded-xl overflow-hidden shadow-2xl shadow-black/40 ring-1 ring-white/10">
                    <div className="bg-slate-700 px-4 py-2 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                      <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/80" />
                      <span className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
                      <span className="ml-3 text-[10px] text-slate-400 truncate">planiner.app/zadaci</span>
                    </div>
                    <div className="bg-slate-800/60 flex items-center justify-center py-20 text-xs text-slate-500">
                      Screenshot zadataka (PC) dodaj sliku ovde
                    </div>
                  </div>
                  <div className="absolute -bottom-8 -left-2 sm:-left-4">
                    <div className="w-[90px] sm:w-[110px] rounded-xl overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-white/10 bg-slate-800 flex items-center justify-center py-16 text-[10px] text-slate-500 text-center px-2">
                      Zadaci (telefon)
                    </div>
                  </div>
                </div>
                <div className="order-1 lg:order-2">
                  <span className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-violet-500/20 text-violet-400 text-sm font-bold mb-4">4</span>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">Zadaci</h3>
                  <p className="text-sm text-slate-400 leading-relaxed mb-5">
                    Zadaci za rukovodstvo, vodiče i članove praćenje obaveza, rokova i statusa. Organizovan rad bez zaboravljenih stvari.
                  </p>
                  <div className="flex gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Desktop
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-sky-400 bg-sky-500/10 px-3 py-1 rounded-full">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />Mobile
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* CTA pri dnu */}
        <section id="cta" className="py-16 sm:py-20 bg-gradient-to-br from-emerald-700 via-emerald-800 to-slate-900 text-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-8 lg:px-10 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              Spremni da svom društvu vratite vrijeme, a sebi mir?
            </h2>
            <p className="text-sm sm:text-base text-emerald-50 mb-8">
              Pokažemo vam Planiner u 30 minuta. Bez obaveze, bez pritiska samo iskren pregled onoga što vašem društvu
              može da olakša rad.
            </p>
            <div className="flex flex-wrap gap-4 justify-center mb-3">
              <a
                onClick={() => navigate('/kontakt')}
                className="cursor-pointer inline-flex items-center justify-center px-8 py-3 rounded-full text-sm sm:text-base font-semibold text-emerald-900 bg-white hover:bg-emerald-50 transition-all shadow-lg shadow-black/20"
              >
                Zakaži prezentaciju
              </a>
              <a
                onClick={() => navigate('/kontakt')}
                className="cursor-pointer inline-flex items-center justify-center px-7 py-3 rounded-full text-sm sm:text-base font-semibold border border-emerald-200 text-emerald-50 hover:bg-emerald-700/40 transition-all"
              >
                Pošalji upit
              </a>
            </div>
            <p className="text-xs text-emerald-200/60 mb-6">
              Možemo organizovati online sastanak sa rukovodstvom društva, pokazati interfejs i dogovoriti naredne korake.
            </p>
            <div className="border-t border-emerald-500/20 pt-5">
              <p className="text-xs text-emerald-100/70 mb-2">Želiš prvo da vidiš kako izgleda?</p>
              <a
                href="/login"
                className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-300 hover:text-white transition-colors"
              >
                Pogledaj demo nalog
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
              </a>
              <p className="mt-2 text-[11px] text-emerald-200/80">Demo: username planiner / pw admin123</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 bg-slate-900 text-slate-200">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src="/LogoP.jpg" alt="Planiner" className="h-8 w-8 rounded-lg" />
              <div>
                <p className="text-sm font-semibold text-white">Planiner</p>
                <p className="text-[11px] text-slate-400">by Orin</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-5 text-xs text-slate-400 justify-center sm:justify-end">
              <a href="#hero" className="hover:text-white transition-colors">
                O nama
              </a>
              <a href="#features" className="hover:text-white transition-colors">
                Funkcionalnosti
              </a>
              <a href="/kontakt" className="hover:text-white transition-colors">
                Kontakt
              </a>
              <button
                type="button"
                className="hover:text-white transition-colors"
              >
                Politika privatnosti
              </button>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-800 text-center sm:text-left">
            <p className="text-[11px] text-slate-500 mb-2">
              © {new Date().getFullYear()} Orin d.o.o.  za planinarska društva koja žele više vremena na stazi, a manje za stolom.
            </p>
            <p className="text-[11px] text-slate-500">
              Demo nalog: username <strong>planiner</strong> / pw <strong>admin123</strong>
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

