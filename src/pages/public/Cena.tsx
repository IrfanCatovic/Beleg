import { useMemo, useState } from 'react'
import axios from 'axios'
import MarketingNavbar from '../../components/MarketingNavbar'
import api from '../../services/api'

const ADMIN_PRICE_RSD = 600

type PaketKey = 'Starter' | 'Growth' | 'Pro'

const PAKETI: Record<
  PaketKey,
  {
    name: string
    description: string
    basePriceRsd: number
    includedUsers: number
    extraPricePerUserRsd: number
    spaceGb: number
    admins: number
    highlighted?: boolean
  }
> = {
  Starter: {
    name: 'Starter paket',
    description: 'Za manja društva koja tek uvode digitalnu administraciju.',
    basePriceRsd: 2925,
    includedUsers: 100,
    extraPricePerUserRsd: 47,
    spaceGb: 2,
    admins: 3,
  },
  Growth: {
    name: 'Growth paket',
    description: 'Za aktivna društva sa većim brojem članova i akcija.',
    basePriceRsd: 5750,
    includedUsers: 500,
    extraPricePerUserRsd: 21,
    spaceGb: 5,
    admins: 3,
    highlighted: true,
  },
  Pro: {
    name: 'Pro paket',
    description: 'Za velika društva i saveze kojima je potrebna puna podrška.',
    basePriceRsd: 9750,
    includedUsers: 1000,
    extraPricePerUserRsd: 9,
    spaceGb: 10,
    admins: 5,
  },
}

export default function Cena() {
  const [selectedPaket, setSelectedPaket] = useState<PaketKey>('Growth')
  const [extraUsers, setExtraUsers] = useState(0)
  const [extraAdmins, setExtraAdmins] = useState(0)
  const [note, setNote] = useState('')
  const [imeKluba, setImeKluba] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [sending, setSending] = useState(false)
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const selected = PAKETI[selectedPaket]
  const basePriceRsd = selected.basePriceRsd
  const extraPricePerUserRsd = selected.extraPricePerUserRsd

  const { extraUsersCostRsd, extraAdminsCostRsd, totalMonthlyRsd } = useMemo(() => {
    const extraUsersCost = extraUsers * extraPricePerUserRsd
    const extraAdminsCost = extraAdmins * ADMIN_PRICE_RSD
    return {
      extraUsersCostRsd: extraUsersCost,
      extraAdminsCostRsd: extraAdminsCost,
      totalMonthlyRsd: basePriceRsd + extraUsersCost + extraAdminsCost,
    }
  }, [extraUsers, extraAdmins, basePriceRsd, extraPricePerUserRsd])

  const handleSendEmail = async () => {
    const club = imeKluba.trim()
    const phone = contactPhone.trim()
    const email = contactEmail.trim()
    setFieldError('')
    setSubmitMessage(null)
    if (!club) {
      setFieldError('Obavezno unesite ime kluba.')
      return
    }
    if (!phone) {
      setFieldError('Obavezno unesite broj telefona.')
      return
    }
    if (!email) {
      setFieldError('Obavezno unesite email.')
      return
    }

    setSending(true)
    try {
      // Javna forma: bez cookies — manje CORS problema kad je frontend na drugom domenu od API-ja.
      await api.post(
        '/api/cena-zahtev',
        {
          paket: selected.name,
          extraUsers,
          extraAdmins,
          note: note.trim(),
          imeKluba: club,
          contactEmail: email,
          contactPhone: phone,
          basePriceRsd: Math.round(basePriceRsd),
          extraUsersCostRsd: Math.round(extraUsersCostRsd),
          extraAdminsCostRsd: Math.round(extraAdminsCostRsd),
          totalMonthlyRsd: Math.round(totalMonthlyRsd),
        },
        { timeout: 45_000, withCredentials: false },
      )
      setSubmitMessage({ type: 'success', text: 'Poruka je uspešno poslata. Javit ćemo vam se uskoro.' })
      setNote('')
      setImeKluba('')
      setContactPhone('')
      setContactEmail('')
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const code = err.code
        const timedOut =
          code === 'ECONNABORTED' ||
          code === 'ETIMEDOUT' ||
          (typeof err.message === 'string' && err.message.toLowerCase().includes('timeout'))
        if (timedOut) {
          setSubmitMessage({
            type: 'error',
            text: 'Zahtev je predugo trajao. Proverite da li API radi i da je u hostingu podešen SMTP (mnogi blokiraju port 587).',
          })
          return
        }
        if (!err.response && (code === 'ERR_NETWORK' || err.message === 'Network Error')) {
          setSubmitMessage({
            type: 'error',
            text: 'Nema odgovora od servera. Proverite VITE_API_URL na frontendu i CORS_ORIGINS na API-ju (mora tačan URL sajta, npr. https://app.vercel.app).',
          })
          return
        }
        const msg = (err.response?.data as { error?: string } | undefined)?.error
        if (msg) {
          setSubmitMessage({ type: 'error', text: msg })
          return
        }
      }
      const res = err && typeof err === 'object' && 'response' in err ? (err as { response?: { data?: { error?: string } } }).response : null
      const msg = res?.data?.error ?? 'Greška pri slanju. Pokušajte ponovo.'
      setSubmitMessage({ type: 'error', text: msg })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-emerald-50">
      <header className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-10 pt-6">
        <MarketingNavbar />
      </header>
      <div className="mx-auto max-w-5xl px-4 pb-10 space-y-10">
        <div className="text-center mt-6">
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
                  {p.basePriceRsd.toLocaleString('sr-RS')} din
                  <span className="text-sm font-medium opacity-80"> / mesec</span>
                </p>
                <ul className={`text-sm space-y-1 mb-4 ${p.highlighted ? 'text-emerald-50' : 'text-gray-600'}`}>
                  <li>do {p.includedUsers.toLocaleString('sr-RS')} članova</li>
                  <li>do {p.spaceGb} GB slika</li>
                  <li>admin naloga: {p.admins}</li>
                </ul>
                <p className={`text-xs mt-auto ${p.highlighted ? 'text-emerald-100' : 'text-gray-500'}`}>
                  Cena dodatnog korisnika: {p.extraPricePerUserRsd.toLocaleString('sr-RS')} din / mesec
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
                {extraUsers} × {extraPricePerUserRsd.toLocaleString('sr-RS')} din ={' '}
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
                  {extraUsers} × {extraPricePerUserRsd.toLocaleString('sr-RS')} din ={' '}
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
            <label htmlFor="ime-kluba" className="text-xs font-medium text-gray-600">
              Ime kluba <span className="text-red-500">*</span>
            </label>
            <input
              id="ime-kluba"
              type="text"
              value={imeKluba}
              onChange={(e) => {
                setImeKluba(e.target.value)
                setFieldError('')
              }}
              className={`w-full rounded-xl border px-3 py-2 text-sm text-gray-800 shadow-sm focus:ring-2 focus:ring-emerald-500/30 outline-none ${
                fieldError ? 'border-red-400' : 'border-gray-300 focus:border-emerald-500'
              }`}
              placeholder="npr. Planinarsko društvo Javor"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="contact-phone" className="text-xs font-medium text-gray-600">
                Kontakt telefon <span className="text-red-500">*</span>
              </label>
              <input
                id="contact-phone"
                type="tel"
                value={contactPhone}
                onChange={(e) => {
                  setContactPhone(e.target.value)
                  setFieldError('')
                }}
                className={`w-full rounded-xl border px-3 py-2 text-sm text-gray-800 shadow-sm focus:ring-2 focus:ring-emerald-500/30 outline-none ${
                  fieldError ? 'border-red-400' : 'border-gray-300 focus:border-emerald-500'
                }`}
                placeholder="+381 6x xxx xxxx"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="contact-email" className="text-xs font-medium text-gray-600">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                id="contact-email"
                type="email"
                value={contactEmail}
                onChange={(e) => {
                  setContactEmail(e.target.value)
                  setFieldError('')
                }}
                className={`w-full rounded-xl border px-3 py-2 text-sm text-gray-800 shadow-sm focus:ring-2 focus:ring-emerald-500/30 outline-none ${
                  fieldError ? 'border-red-400' : 'border-gray-300 focus:border-emerald-500'
                }`}
                placeholder="vas@email.rs"
              />
            </div>
          </div>
          {fieldError && <p className="text-xs text-red-600">{fieldError}</p>}

          <div className="space-y-2">
            <label htmlFor="note" className="text-xs font-medium text-gray-600">
              Dodatne napomene <span className="text-gray-400">(opciono)</span>
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

          {submitMessage && (
            <p
              className={`text-sm font-medium ${
                submitMessage.type === 'success' ? 'text-emerald-700' : 'text-red-600'
              }`}
            >
              {submitMessage.text}
            </p>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
            <p className="text-xs text-gray-500">
              Klikom na „Pošalji zahtev“ poruka će biti poslata direktno na našu adresu. Javićemo vam se uskoro.
            </p>
            <button
              type="button"
              onClick={handleSendEmail}
              disabled={sending}
              className="inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? 'Slanje…' : 'Pošalji zahtev'}
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

