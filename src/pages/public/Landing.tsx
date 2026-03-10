import heroImage from '../../../public/hero.png'
import teamImage from '../../../public/team.jpg'
import segmentImage from '../../../public/segment1.jpeg'
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
  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900">
      {/* Hero */}
      <header className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-emerald-50">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_100%,#41ac53_0%,transparent_55%)] opacity-20" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,#fed74c_0%,transparent_55%)] opacity-25" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-8 lg:px-10 pt-8 pb-20 lg:pt-12 lg:pb-28">
          <MarketingNavbar />

          <div className="space-y-10">
            {/* Naslov + opis + CTA (levo) i slika (desno) */}
            <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6 lg:gap-10">
              {/* Leva kolona: tekst */}
              <div className="flex-[1.1] flex flex-col items-start gap-4">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-snug max-w-2xl">
                  NaVrhu{' '}
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
                  Za predsednike, sekretare, vodiče i blagajnike koji žele manje administracije, a više vremena na stazi.
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
                  Bez obaveze i bez pritiska za 30 minuta pokazujemo kako NaVrhu rešava vaše svakodnevne glavobolje.
                </p>
              </div>

              {/* Desna kolona: slika */}
              <div className="flex-[0.9] flex justify-center lg:justify-end">
                <div className="max-w-sm sm:max-w-md">
                  <img
                    src={heroImage}
                    alt="na vrhu – prikaz aplikacije na laptopu i telefonu"
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
            src={segmentImage}
            alt="Planinski pejzaž"
            className="w-full h-full object-cover"
            style={{ objectPosition: 'center top' }}
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
                NaVrhu ti pokazuje koliko si kilometara prešao, koliko uspona savladao i na kojim si se
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
        <section className="py-16 sm:py-20 bg-white relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-40">
            <div className="absolute -left-32 top-10 h-64 w-64 rounded-full bg-emerald-50" />
            <div className="absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-yellow-50" />
          </div>
          <div className="max-w-6xl mx-auto px-4 sm:px-8 lg:px-10">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold mb-4">Šta tačno rešavamo</h2>
              <p className="text-gray-600 text-sm sm:text-base max-w-2xl mx-auto">
                Od haosa u papirima i tabelama do jasnog, digitalnog sistema koji radi umesto vas.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-gray-100 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-500 mb-2">Problem</p>
                <p className="text-sm font-semibold mb-3">
                  Haos u tabelama, papiri, duplo kucanje, izgubljeni formulari.
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  Podaci o članovima razbacani u Excelu, papirnim obrascima i porukama, niko nema kompletnu sliku.
                </p>
                <div className="border-t border-dashed border-gray-200 mt-3 pt-3">
                  <p className="text-xs font-semibold text-emerald-700 mb-1">Rešenje u NaVrhu</p>
                  <p className="text-xs text-gray-600">
                    Centralizovana baza članova sa svim podacima, dokumentima i planinarskim informacijama
                    (legitimacije, markice, disciplinske mere, izbor u organe).
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-500 mb-2">Problem</p>
                <p className="text-sm font-semibold mb-3">
                  Ne zna se ko je šta uplatio, na koju akciju je prijavljen i sve ide preko poruka.
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  Sekretar, vodiči i blagajnik troše sate na dopisivanje, prepisivanje i prebrojavanje.
                </p>
                <div className="border-t border-dashed border-gray-200 mt-3 pt-3">
                  <p className="text-xs font-semibold text-emerald-700 mb-1">Rešenje u NaVrhu</p>
                  <p className="text-xs text-gray-600">
                    Jedinstveno mesto za akcije, zadatke, finansije i obaveštenja, svaki ulogovani vidi ono što
                    mu treba. Vodiči, admini i blagajnici imaju posebna ovlašćenja.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-500 mb-2">Problem</p>
                <p className="text-sm font-semibold mb-3">
                  Administracija troši sate i dane godišnje.
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  Upis članova, evidencija akcija, ručna obaveštenja, finansijski izveštaji, sve se radi od nule.
                </p>
                <div className="border-t border-dashed border-gray-200 mt-3 pt-3">
                  <p className="text-xs font-semibold text-emerald-700 mb-1">Rešenje u NaVrhu</p>
                  <p className="text-xs text-gray-600">
                    Automatizacija procesa (registracija članova, evidencija akcija, obaveštenja, finansije) i
                    ušteda preko <span className="font-semibold">200 sati godišnje</span>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Ranking i mini takmičenja */}
        <section className="py-16 sm:py-20 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-10">
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
                  NaVrhu vodi detaljnu statistiku za svakog člana nakon uspešne akcije, broj pređenih kilometara,
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
        <section id="features" className="py-16 sm:py-20 bg-emerald-50/60 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-50">
            <div className="absolute -right-24 -top-10 h-56 w-56 rounded-full bg-white/60" />
            <div className="absolute -left-24 bottom-0 h-48 w-48 rounded-full bg-emerald-100/70" />
          </div>
          <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-10">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">Ključne funkcionalnosti aplikacije</h2>
              <p className="text-gray-600 text-sm sm:text-base max-w-3xl mx-auto">
                Sve što planinarskom društvu treba – od prvog učlanjenja do poslednjeg izvještaja blagajne.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl bg-white shadow-sm border border-emerald-100 p-5">
                <h3 className="text-sm font-semibold mb-2">Upravljanje članovima</h3>
                <p className="text-xs text-gray-600 mb-3">
                  Detaljni profili članova sa ličnim podacima, kontaktima, planinarskim dokumentima,
                  disciplinskim merama i izborima u organe.
                </p>
                <p className="text-xs text-gray-500">
                  Više uloga (admin, sekretar, vodič, blagajnik, član) svako vidi ono što mu je potrebno.
                </p>
              </div>

              <div className="rounded-2xl bg-white shadow-sm border border-emerald-100 p-5">
                <h3 className="text-sm font-semibold mb-2">Akcije i zadaci</h3>
                <p className="text-xs text-gray-600 mb-3">
                  Kreiranje, uređivanje i praćenje planinarskih akcija, prijave članova i zadaci za vodiče
                  i organizatore.
                </p>
                <p className="text-xs text-gray-500">
                  Jasan pregled aktivnih iprošlih akcija, istorije prisustva i angažmana članova.
                </p>
              </div>

              <div className="rounded-2xl bg-white shadow-sm border border-emerald-100 p-5">
                <h3 className="text-sm font-semibold mb-2">Finansije (admin i blagajnik)</h3>
                <p className="text-xs text-gray-600 mb-3">
                  Evidencija uplata i isplata, povezivanje sa članovima ili akcijama i pregled istorije plaćanja.
                </p>
                <p className="text-xs text-gray-500">
                  Transparentan rad blagajnika i lakše pravdanje finansija prema upravnom odboru.
                </p>
              </div>

              <div className="rounded-2xl bg-white shadow-sm border border-emerald-100 p-5">
                <h3 className="text-sm font-semibold mb-2">Obaveštenja u realnom vremenu</h3>
                <p className="text-xs text-gray-600 mb-3">
                  Interni sistem notifikacija za akcije, uplate, zadatke i važna saopštenja.
                </p>
                <p className="text-xs text-gray-500">
                  Admin jednim klikom šalje obaveštenje svim članovima ili ciljanim grupama.
                </p>
              </div>

              <div className="rounded-2xl bg-white shadow-sm border border-emerald-100 p-5">
                <h3 className="text-sm font-semibold mb-2">Automatski PDF izveštaji</h3>
                <p className="text-xs text-gray-600 mb-3">
                  NaVrhu za vas automatski priprema ključne PDF dokumente spremne za slanje i arhivu.
                </p>
                <p className="text-xs text-gray-500">
                  Godišnji izveštaj o akcijama, pojedinačni izveštaji sa akcija, profil svakog člana i detaljni
                  finansijski izveštaji nastaju iz sistema jednim klikom, bez dodatnog kucanja i prepisivanja.
                </p>
              </div>

              <div className="rounded-2xl bg-white shadow-sm border border-emerald-100 p-5">
                <h3 className="text-sm font-semibold mb-2">Centralni login i web pristup</h3>
                <p className="text-xs text-gray-600 mb-3">
                  Pristup preko browsera, bez instalacije. Sve je dostupno 24/7 sa računara, tableta ili telefona uz podršku tima developera.
,                </p>
                <p className="text-xs text-gray-500">
                  Jedan sistem, svi članovi i saradnici na istom mestu.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Kako funkcioniše */}
        <section id="how-it-works" className="py-16 sm:py-20 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-8 lg:px-10">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">Kako funkcioniše NaVrhu</h2>
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
                  text: 'Pomažemo da postojeće članove sa papira i iz tabela postepeno unesete u NaVrhu uz naše šablone i podršku tima',
                  step: '02',
                },
                {
                  title: 'Akcije, zadaci i uloge u sistemu',
                  text: 'Vodiči i admini u aplikaciji planiraju akcije, definišu zadatke za tim, dodeljuju odgovorne osobe i prate prijave članova i to sve na jednom mestu.',
                  step: '03',
                }, e
                {
                  title: 'Svakodnevni rad celog društva',
                  text: 'Članovi se prijavljuju na akcije i prate svoj napredak, vodiči šalju obaveštenja, blagajnik vidi sve uplate, a rukovodstvo ima jasan uvid u članove, akcije i finansije. NaVrhu postaje digitalno „mesto susreta“ celog društva.',
                  step: '04',
                },
              ].map(({ title, text, step }) => (
                <div
                  key={step}
                  className="relative rounded-2xl border border-gray-100 p-5 shadow-sm bg-white"
                >
                  <div className="absolute -top-3 left-4 inline-flex items-center justify-center h-7 px-3 rounded-full bg-emerald-100 text-[10px] font-semibold text-emerald-800">
                    Korak {step}
                  </div>
                  <h3 className="mt-3 mb-2 text-sm font-semibold">{title}</h3>
                  <p className="text-xs text-gray-600">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Komunitet i podrška */}
        <section className="py-16 sm:py-20 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-10">
            <div className="flex flex-col lg:flex-row items-center lg:items-start gap-8 lg:gap-12">
              {/* Tekst levo */}
              <div className="flex-[1.1]">
                <h2 className="text-2xl sm:text-3xl font-bold mb-4">Više od softvera - partner za društvo</h2>
                <p className="text-sm sm:text-base text-gray-600 mb-6">
                  NaVrhu razvija posvećen tim developera koji aktivno sarađuje sa planinarskim društvima. Naš cilj
                  je da vam damo više vremena na stazi, a manje za stolom.
                </p>

                <div className="space-y-4 text-sm">
                  <div>
                    <p className="font-semibold text-gray-800 mb-1">Ozbiljan tim developera</p>
                    <p className="text-xs text-gray-600">
                      Redovni update-i, sigurnosne zakrpe i nove funkcionalnosti zasnovane na iskustvu sa terena, uz
                      brz odaziv na prijavljene bagove i probleme u radu.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 mb-1">Podrška na lokalnom jeziku</p>
                    <p className="text-xs text-gray-600">
                      E-mail, telefon i online sastanci – od implementacije i obuke tima do svakodnevnih pitanja, sa
                      fokusom na brz response time i jasne, konkretne odgovore.
                    </p>
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

              {/* Slika tima desno */}
              <div className="flex-[0.9] flex justify-center lg:justify-end">
                <div className="w-full max-w-sm rounded-3xl bg-white border border-slate-100 shadow-md overflow-hidden">
                  <img
                    src={teamImage}
                    alt="Tim na vrhu u online sastanku sa planinarskim društvom"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Brojevi i benefiti */}
        <section className="py-16 sm:py-20 bg-white relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-40">
            <div className="absolute -left-28 top-16 h-52 w-52 rounded-full bg-emerald-50" />
            <div className="absolute -right-24 bottom-10 h-60 w-60 rounded-full bg-slate-50" />
          </div>
          <div className="max-w-6xl mx-auto px-4 sm:px-8 lg:px-10">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">Brojevi i benefiti</h2>
              <p className="text-gray-600 text-sm sm:text-base max-w-2xl mx-auto">
                Jasne, merljive koristi koje vaše društvo dobija prelaskom na NaVrhu.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-center">
                <p className="text-xs font-semibold text-emerald-800 mb-1">Ušteda vremena</p>
                <p className="text-2xl font-extrabold text-emerald-700 mb-1">200+</p>
                <p className="text-[11px] text-emerald-900/80">sati godišnje manje na administraciji</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center">
                <p className="text-xs font-semibold text-slate-800 mb-1">Manje grešaka</p>
                <p className="text-2xl font-extrabold text-slate-800 mb-1">↓</p>
                <p className="text-[11px] text-slate-900/80">
                  preciznija evidencija članova, uplata i prisustva
                </p>
              </div>
              <div className="rounded-2xl border border-yellow-100 bg-yellow-50 p-4 text-center">
                <p className="text-xs font-semibold text-yellow-900 mb-1">Brža komunikacija</p>
                <p className="text-2xl font-extrabold text-yellow-900 mb-1">x3</p>
                <p className="text-[11px] text-yellow-900/90">
                  sve informacije i obaveštenja na jednom mestu
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-white p-4 text-center">
                <p className="text-xs font-semibold text-emerald-800 mb-1">Transparentnost</p>
                <p className="text-2xl font-extrabold text-emerald-700 mb-1">100%</p>
                <p className="text-[11px] text-emerald-900/80">
                  bolji pregled rada rukovodstva i blagajne
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Za koga je */}
        <section id="for-whom" className="py-16 sm:py-20 bg-emerald-50/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-10">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">Za koga je NaVrhu</h2>
              <p className="text-gray-600 text-sm sm:text-base max-w-3xl mx-auto">
                Jedna aplikacija, različiti pogledi – svaka uloga u društvu dobija jasne benefite.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-white border border-emerald-100 p-5">
                <p className="text-xs font-semibold text-emerald-700 mb-1">Predsednik društva</p>
                <p className="text-sm font-semibold mb-2">
                  Sve na jednom mestu, bez iznenađenja.
                </p>
                <p className="text-xs text-gray-600">
                  Jasan pregled članova, akcija, finansija i obaveštenja. Manji rizik, manje haosa.
                </p>
              </div>
              <div className="rounded-2xl bg-white border border-emerald-100 p-5">
                <p className="text-xs font-semibold text-emerald-700 mb-1">Sekretar</p>
                <p className="text-sm font-semibold mb-2">
                  Manje papira, više reda.
                </p>
                <p className="text-xs text-gray-600">
                  Brzi upis i ažuriranje članova, dokumentacija na dohvat ruke, manje manuelnog rada.
                </p>
              </div>
              <div className="rounded-2xl bg-white border border-emerald-100 p-5">
                <p className="text-xs font-semibold text-emerald-700 mb-1">Vodič</p>
                <p className="text-sm font-semibold mb-2">
                  Jasne prijave i komunikacija.
                </p>
                <p className="text-xs text-gray-600">
                  Jedno mesto za kreiranje akcija, pregled prijava i informacije za učesnike.
                </p>
              </div>
              <div className="rounded-2xl bg-white border border-emerald-100 p-5">
                <p className="text-xs font-semibold text-emerald-700 mb-1">Blagajnik</p>
                <p className="text-sm font-semibold mb-2">
                  Čista evidencija finansija.
                </p>
                <p className="text-xs text-gray-600">
                  Jasna evidencija uplata i isplata, lakše pravdanje finansija pred članovima i upravom.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* UI preview */}
        <section className="py-16 sm:py-20 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">Pogled u interfejs</h2>
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl border border-gray-100 bg-slate-50 p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 mb-2">
                  UI mockup (placeholder)
                </p>
                <p className="text-xs text-gray-600 mb-4">
                  Ovdje ubaciti mockup interfejsa – dashboard sa listom akcija, obaveštenjima sa strane, menijem za
                  finansije i korisnike.
                </p>
                <div className="h-40 rounded-2xl border border-dashed border-gray-300 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-[11px] text-gray-500">
                  Veliki screenshot dashboard-a (placeholder)
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="h-24 rounded-2xl border border-dashed border-gray-300 bg-slate-100 flex items-center justify-center text-[10px] text-gray-500">
                    Mobilni prikaz
                  </div>
                  <div className="h-24 rounded-2xl border border-dashed border-gray-300 bg-slate-100 flex items-center justify-center text-[10px] text-gray-500">
                    Tablet prikaz
                  </div>
                  <div className="h-24 rounded-2xl border border-dashed border-gray-300 bg-slate-100 flex items-center justify-center text-[10px] text-gray-500">
                    Detalji akcije
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA pri dnu */}
        <section id="cta" className="py-16 sm:py-20 bg-gradient-to-br from-emerald-700 via-emerald-800 to-slate-900 text-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              Spremni da svom društvu vratite vrijeme, a sebi mir?
            </h2>
            <p className="text-sm sm:text-base text-emerald-50 mb-8">
              Pokažemo vam NaVrhu u 30 minuta. Bez obaveze, bez pritiska samo iskren pregled onoga što vašem društvu
              može da olakša rad.
            </p>
            <div className="flex flex-wrap gap-4 justify-center mb-4">
              <a
                href="mailto:catovicc84@gmail.com?subject=Prezentacija%20za%20na%20vrhu&body=Pozdrav%2C%0A%0Aželeli%20bismo%20da%20zakažemo%20prezentaciju%20za%20na%20vrhu%20za%20naše%20planinarsko%20društvo.%0A%0AIme%20društva%3A%0AKontakt%20osoba%3A%0ATermin%20koji%20vam%20odgovara%3A%0A%0AHvala!"
                className="inline-flex items-center justify-center px-8 py-3 rounded-full text-sm sm:text-base font-semibold text-emerald-900 bg-white hover:bg-emerald-50 transition-all shadow-lg shadow-black/20"
              >
                Zakaži prezentaciju
              </a>
              <a
                href="mailto:catovicc84@gmail.com?subject=Upit%20za%20na%20vrhu"
                className="inline-flex items-center justify-center px-7 py-3 rounded-full text-sm sm:text-base font-semibold border border-emerald-200 text-emerald-50 hover:bg-emerald-700/40 transition-all"
              >
                Pošalji upit
              </a>
            </div>
            <p className="text-[11px] text-emerald-100/80">
              Možemo organizovati online sastanak sa rukovodstvom društva, pokazati interfejs i dogovoriti naredne korake.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-900 text-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-300 text-center sm:text-left">
            Adri Sentinel – za planinarska društva koja žele više vremena na stazi, a manje za stolom.
          </div>
          <div className="flex flex-wrap gap-4 text-[11px] text-slate-400 justify-center sm:justify-end">
            <a href="#hero" className="hover:text-white transition-colors">
              O nama
            </a>
            <a href="#features" className="hover:text-white transition-colors">
              Funkcionalnosti
            </a>
            <a href="#cta" className="hover:text-white transition-colors">
              Kontakt
            </a>
            <span className="text-slate-500">•</span>
            <button
              type="button"
              className="hover:text-white transition-colors"
            >
              Politika privatnosti
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}

