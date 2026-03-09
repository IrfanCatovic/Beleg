import { useMemo, useState } from 'react'

const EMAIL = 'catovicc84@gmail.com'
const EUR_TO_RSD = 117
const ADMIN_PRICE_EUR = 5
const ADMIN_PRICE_RSD = ADMIN_PRICE_EUR * EUR_TO_RSD

type PaketKey = 'Starter' | 'Growth' | 'Pro'

const PAKETI: Record<
  PaketKey,
  {
    name: string
    description: string
    basePriceEur: number
    includedUsers: number
    extraPricePerUserEur: number
    spaceGb: number
    admins: number
    highlighted?: boolean
  }
> = {
  Starter: {
    name: 'Starter',
    description: 'Za manja društva koja tek uvode digitalnu administraciju.',
    basePriceEur: 25,
    includedUsers: 100,
    extraPricePerUserEur: 0.4, // 0.25 * 1.6
    spaceGb: 5,
    admins: 3,
  },
  Growth: {
    name: 'Growth',
    description: 'Za aktivna društva sa većim brojem članova i akcija.',
    basePriceEur: 49,
    includedUsers: 500,
    extraPricePerUserEur: 0.16, // ≈ (49 / 500) * 1.6
    spaceGb: 20,
    admins: 3,
    highlighted: true,
  },
  Pro: {
    name: 'Pro',
    description: 'Za velika društva i saveze kojima je potrebna puna podrška.',
    basePriceEur: 79,
    includedUsers: 2000,
    extraPricePerUserEur: 0.06, // ≈ (79 / 2000) * 1.6
    spaceGb: 50,
    admins: 5,
  },
}

export default function Cena() {
  const [selectedPaket, setSelectedPaket] = useState<PaketKey>('Growth')
  const [extraUsers, setExtraUsers] = useState(0)
  const [extraAdmins, setExtraAdmins] = useState(0)
  const [note, setNote] = useState('')

  const selected = PAKETI[selectedPaket]

  const basePriceRsd = selected.basePriceEur * EUR_TO_RSD
  const extraPricePerUserRsd = selected.extraPricePerUserEur * EUR_TO_RSD

  const { extraUsersCostRsd, extraAdminsCostRsd, totalMonthlyRsd } = useMemo(() => {
    const extraUsersCost = extraUsers * extraPricePerUserRsd
    const extraAdminsCost = extraAdmins * ADMIN_PRICE_RSD
    return {
      extraUsersCostRsd: extraUsersCost,
      extraAdminsCostRsd: extraAdminsCost,
      totalMonthlyRsd: basePriceRsd + extraUsersCost + extraAdminsCost,
    }
  }, [extraUsers, extraAdmins, basePriceRsd, extraPricePerUserRsd])

  const handleSendEmail = () => {
    const subject = encodeURIComponent(`NaVrhu – interesovanje za paket ${selected.name}`)
    const bodyLines = [
      'Dobar dan,',
      '',
      `interesuje me paket ${selected.name}.`,
      '',
      `Osnovna cena paketa: ${basePriceRsd.toLocaleString('sr-RS')} din / mesec`,
      `U paketu uključeno korisnika: ${selected.includedUsers}`,
      `Broj dodatnih korisnika: ${extraUsers}`,
      `Cena dodatnog korisnika: ${Math.round(extraPricePerUserRsd).toLocaleString('sr-RS')} din`,
      `Ukupno za dodatne korisnike: ${Math.round(extraUsersCostRsd).toLocaleString('sr-RS')} din / mesec`,
      '',
      `Broj dodatnih admin naloga: ${extraAdmins}`,
      `Cena dodatnog admin naloga: ${ADMIN_PRICE_RSD.toLocaleString('sr-RS')} din`,
      `Ukupno za dodatne admine: ${Math.round(extraAdminsCostRsd).toLocaleString('sr-RS')} din / mesec`,
      '',
      `UKUPNO (paket + dodatni korisnici + dodatni admini): ${Math.round(totalMonthlyRsd).toLocaleString(
        'sr-RS'
      )} din / mesec`,
      '',
      note ? `Dodatne napomene:\n${note}\n` : '',
      'Hvala!',
    ]
    const body = encodeURIComponent(bodyLines.join('\n'))
    window.location.href = `mailto:${EMAIL}?subject=${subject}&body=${body}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-emerald-50 px-4 py-10">
      <div className="mx-auto max-w-5xl space-y-10">
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Paketi i cene</h1>
          <p className="text-gray-600 text-sm sm:text-base max-w-2xl mx-auto">
            Izaberite paket, dodajte po potrebi više korisnika i pošaljite nam poruku – odgovaramo sa detaljnom ponudom
            prilagođenom vašem društvu.
          </p>
        </div>

        {/* Paketi */}
        <div className="grid gap-6 md:grid-cols-3">
          {(Object.keys(PAKETI) as PaketKey[]).map((key) => {
            const p = PAKETI[key]
            const isActive = key === selectedPaket
            const cardClasses = p.highlighted
              ? 'bg-emerald-700 text-white border-emerald-700'
              : 'bg-white/95 text-gray-900 border-emerald-100'

            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedPaket(key)}
                className={`rounded-2xl shadow-sm p-6 flex flex-col text-left border transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                  cardClasses
                } ${isActive ? 'ring-2 ring-offset-2 ring-offset-emerald-50 ring-emerald-400' : ''}`}
              >
                <p
                  className={`text-xs font-semibold uppercase tracking-[0.18em] mb-2 ${
                    p.highlighted ? 'text-emerald-200' : 'text-emerald-600'
                  }`}
                >
                  {p.name}
                </p>
                <h2 className="text-lg font-bold mb-1">{p.description.split('.')[0]}.</h2>
                <p
                  className={`text-3xl font-extrabold mb-4 ${
                    p.highlighted ? 'text-white' : 'text-emerald-700'
                  }`}
                >
                  {Math.round(p.basePriceEur * EUR_TO_RSD).toLocaleString('sr-RS')} din
                  <span className="text-sm font-medium opacity-80"> / mesec</span>
                </p>
                <ul className={`text-sm space-y-1 mb-4 ${p.highlighted ? 'text-emerald-50' : 'text-gray-600'}`}>
                  <li>do {p.includedUsers.toLocaleString('sr-RS')} članova</li>
                  <li>do {p.spaceGb} GB slika</li>
                  <li>admin naloga: {p.admins}</li>
                </ul>
                <p className={`text-xs mt-auto ${p.highlighted ? 'text-emerald-100' : 'text-gray-500'}`}>
                  Cena dodatnog korisnika: {Math.round(p.extraPricePerUserEur * EUR_TO_RSD).toLocaleString('sr-RS')} din / mesec
                </p>
                {isActive && (
                  <p className={`mt-2 text-xs font-semibold ${p.highlighted ? 'text-white' : 'text-emerald-700'}`}>
                    Izabrani paket
                  </p>
                )}
              </button>
            )
          })}
        </div>

        {/* Dodatni korisnici */}
        <div className="rounded-2xl bg-white/95 border border-emerald-100 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Dodatni korisnici (članovi)</h2>
          <p className="text-sm text-gray-600">
            Osim korisnika uključenih u paket, možete dodati još korisnika po fiksnoj ceni po korisniku. Povucite klizač
            da procenite koliko bi vas to koštalo mesečno.
          </p>

          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>0 dodatnih</span>
              <span>250</span>
              <span>500 dodatnih</span>
            </div>
            <input
              type="range"
              min={0}
              max={500}
              step={10}
              value={extraUsers}
              onChange={(e) => setExtraUsers(Number(e.target.value))}
              className="w-full accent-emerald-600"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="font-medium text-gray-800">
                Izabrano dodatnih korisnika:{' '}
                <span className="text-emerald-700 font-semibold">{extraUsers}</span>
              </span>
              <span className="text-gray-700">
                {extraUsers} × {Math.round(extraPricePerUserRsd).toLocaleString('sr-RS')} din ={' '}
                <span className="font-semibold text-emerald-700">
                  {Math.round(extraUsersCostRsd).toLocaleString('sr-RS')} din / mesec
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Dodatni admini */}
        <div className="rounded-2xl bg-white/95 border border-emerald-100 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Dodatni admin nalozi</h2>
          <p className="text-sm text-gray-600">
            Svaki paket uključuje svoje admin naloge (Starter 3, Growth 3, Pro 5). Ako vam je potrebno više ljudi sa
            administratorskim pristupom, možete dodati dodatne admin naloge.
          </p>

          <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-end">
            <div className="space-y-2">
              <label htmlFor="extra-admins" className="text-xs font-medium text-gray-600">
                Broj dodatnih admin naloga
              </label>
              <input
                id="extra-admins"
                type="number"
                min={0}
                max={20}
                value={extraAdmins}
                onChange={(e) => setExtraAdmins(Math.max(0, Math.min(20, Number(e.target.value) || 0)))}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none"
              />
            </div>
            <div className="text-sm text-gray-700 space-y-1">
              <p>
                Cena po dodatnom adminu:{' '}
                <span className="font-semibold">
                  {ADMIN_PRICE_RSD.toLocaleString('sr-RS')} din / mesec
                </span>
              </p>
              <p>
                Ukupno za dodatne admine:{' '}
                <span className="font-semibold text-emerald-700">
                  {Math.round(extraAdminsCostRsd).toLocaleString('sr-RS')} din / mesec
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Rezime i napomena */}
        <div className="rounded-2xl bg-white/95 border border-emerald-100 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Pregled vaše kombinacije</h2>

          <div className="grid gap-3 text-sm text-gray-700 sm:grid-cols-2">
            <div className="space-y-1">
              <p>
                Paket:{' '}
                <span className="font-semibold text-emerald-700">
                  {selected.name}
                </span>
              </p>
              <p>
                Osnovna cena paketa:{' '}
                <span className="font-semibold">{Math.round(basePriceRsd).toLocaleString('sr-RS')} din / mesec</span>
              </p>
              <p>
                Uključeno korisnika:{' '}
                <span className="font-semibold">{selected.includedUsers.toLocaleString('sr-RS')}</span>
              </p>
            </div>
            <div className="space-y-1">
              <p>
                Dodatni korisnici:{' '}
                <span className="font-semibold">
                  {extraUsers} × {Math.round(extraPricePerUserRsd).toLocaleString('sr-RS')} din ={' '}
                  {Math.round(extraUsersCostRsd).toLocaleString('sr-RS')} din
                </span>
              </p>
              <p>
                Dodatni admini:{' '}
                <span className="font-semibold">
                  {extraAdmins} × {ADMIN_PRICE_RSD.toLocaleString('sr-RS')} din ={' '}
                  {Math.round(extraAdminsCostRsd).toLocaleString('sr-RS')} din
                </span>
              </p>
              <p className="text-base font-semibold text-emerald-700">
                Ukupno mesečno: {Math.round(totalMonthlyRsd).toLocaleString('sr-RS')} din
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="note" className="text-xs font-medium text-gray-600">
              Dodatne napomene (npr. specifične potrebe, broj vodiča, prelazak sa postojećeg sistema…)
            </label>
            <textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none resize-y"
              placeholder="Ovdje možete ukratko opisati vaše društvo i dodatne želje…"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
            <p className="text-xs text-gray-500">
              Klikom na „Pošalji poruku“ otvoriće se vaš e-mail klijent sa popunjenom porukom. Možete je dodatno
              izmeniti pre slanja.
            </p>
            <button
              type="button"
              onClick={handleSendEmail}
              className="inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors"
            >
              Pošalji poruku
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-500 text-center max-w-2xl mx-auto">
          Sve cene su informativne i mogu se prilagoditi u dogovoru sa društvom (broj članova, specifične potrebe,
          dodatne funkcionalnosti).
        </p>
      </div>
    </div>
  )
}

