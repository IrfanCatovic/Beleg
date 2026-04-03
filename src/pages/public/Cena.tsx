import { useState } from 'react'
import axios from 'axios'
import MarketingNavbar from '../../components/MarketingNavbar'
import api from '../../services/api'

export default function Cena() {
  const [contactPerson, setContactPerson] = useState('')
  const [clubName, setClubName] = useState('')
  const [city, setCity] = useState('')
  const [question, setQuestion] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [sending, setSending] = useState(false)
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = async () => {
    const person = contactPerson.trim()
    const club = clubName.trim()
    const place = city.trim()
    const q = question.trim()

    setFieldError('')
    setSubmitMessage(null)

    if (!person || !club || !place || !q) {
      setFieldError('Molimo popunite sva obavezna polja.')
      return
    }

    const noteBody = `Upit poslato sa stranice Cena:\n\nKontakt osoba: ${person}\nIme kluba: ${club}\nMesto: ${place}\n\nPitanje:\n${q}\n`

    setSending(true)
    try {
      await api.post(
        '/api/cena-zahtev',
        {
          paket: 'Cena stranica',
          extraUsers: 0,
          extraAdmins: 0,
          note: noteBody,
          imeKluba: club,
          contactEmail: '',
          contactPhone: '',
          basePriceRsd: 0,
          extraUsersCostRsd: 0,
          extraAdminsCostRsd: 0,
          totalMonthlyRsd: 0,
        },
        { timeout: 45_000, withCredentials: false },
      )
      setSubmitMessage({ type: 'success', text: 'Poruka je uspešno poslata. Javićemo vam se uskoro.' })
      setContactPerson('')
      setClubName('')
      setCity('')
      setQuestion('')
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
            text: 'Zahtev je predugo trajao. Na produkciji proverite SMTP/Resend na serveru i VITE_API_URL + CORS.',
          })
          return
        }
        if (!err.response && (code === 'ERR_NETWORK' || err.message === 'Network Error')) {
          setSubmitMessage({
            type: 'error',
            text: 'Nema odgovora od servera. Proverite VITE_API_URL i CORS_ORIGINS (tačan URL vašeg sajta).',
          })
          return
        }
        const apiMsg = (err.response?.data as { error?: string } | undefined)?.error
        if (apiMsg) {
          setSubmitMessage({ type: 'error', text: apiMsg })
          return
        }
      }
      const res =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response
          : null
      const msg = res?.data?.error ?? 'Greška pri slanju. Pokušajte ponovo.'
      setSubmitMessage({ type: 'error', text: msg })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/80 via-white to-emerald-50/80">
      <header className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-10 pt-6">
        <MarketingNavbar />
      </header>

      <main className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <section className="mt-8 sm:mt-12 mb-12 sm:mb-16 text-center sm:text-left">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-6 tracking-tight leading-tight">
            Planiner je za planinarske klubove
          </h1>
          <div className="space-y-4 text-gray-700 text-sm sm:text-base leading-relaxed max-w-none">
            <p>
              Aplikacija je namenjena planinarskim društvima i klubovima: članstvo, akcije, dokumentacija i komunikacija
              na jednom mestu.
            </p>
            <p className="text-base sm:text-lg font-medium text-emerald-800">
              Registracija vašeg kluba je potpuno besplatna.
            </p>
            <p>
              Pošaljite nam upit ispod sa osnovnim podacima – kontakt osoba, ime kluba, mesto i kratko pitanje. Odgovorićemo
              vam i dogovorićemo sledeće korake za aktivaciju.
            </p>
          </div>
        </section>

        <div className="rounded-2xl bg-white border border-emerald-100 shadow-sm p-6 sm:p-8 space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Upit za registraciju kluba</h2>
            <p className="text-xs sm:text-sm text-gray-600 max-w-xl">
              Ista polja kao na stranici Kontakt; u predmetu emaila i u telu poruke jasno je označeno da je upit sa stranice
              Cena.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="cena-contact-person" className="text-xs font-medium text-gray-600">
                Kontakt osoba <span className="text-red-500">*</span>
              </label>
              <input
                id="cena-contact-person"
                type="text"
                value={contactPerson}
                onChange={(e) => {
                  setContactPerson(e.target.value)
                  setFieldError('')
                }}
                className={`w-full rounded-xl border px-3 py-2 text-sm text-gray-800 shadow-sm focus:ring-2 focus:ring-emerald-500/30 outline-none ${
                  fieldError ? 'border-red-400' : 'border-gray-300 focus:border-emerald-500'
                }`}
                placeholder="Ime i prezime kontakt osobe"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="cena-club-name" className="text-xs font-medium text-gray-600">
                Ime kluba <span className="text-red-500">*</span>
              </label>
              <input
                id="cena-club-name"
                type="text"
                value={clubName}
                onChange={(e) => {
                  setClubName(e.target.value)
                  setFieldError('')
                }}
                className={`w-full rounded-xl border px-3 py-2 text-sm text-gray-800 shadow-sm focus:ring-2 focus:ring-emerald-500/30 outline-none ${
                  fieldError ? 'border-red-400' : 'border-gray-300 focus:border-emerald-500'
                }`}
                placeholder="npr. Planinarsko društvo Javor"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="cena-city" className="text-xs font-medium text-gray-600">
              Mesto <span className="text-red-500">*</span>
            </label>
            <input
              id="cena-city"
              type="text"
              value={city}
              onChange={(e) => {
                setCity(e.target.value)
                setFieldError('')
              }}
              className={`w-full rounded-xl border px-3 py-2 text-sm text-gray-800 shadow-sm focus:ring-2 focus:ring-emerald-500/30 outline-none ${
                fieldError ? 'border-red-400' : 'border-gray-300 focus:border-emerald-500'
              }`}
              placeholder="Grad ili mesto u kojem je klub"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="cena-question" className="text-xs font-medium text-gray-600">
              Pitanje za nas <span className="text-red-500">*</span>
            </label>
            <textarea
              id="cena-question"
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value)
                setFieldError('')
              }}
              rows={4}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none resize-y"
              placeholder="Ukratko napišite šta vas zanima – npr. želja za registracijom kluba, broj članova, dodatna pitanja…"
            />
          </div>

          {fieldError && <p className="text-xs text-red-600">{fieldError}</p>}
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
              Klikom na „Pošalji upit“ poruka stiže našem timu sa oznakom da je poslato sa stranice Cena.
            </p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={sending}
              className="inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? 'Slanje…' : 'Pošalji upit'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
