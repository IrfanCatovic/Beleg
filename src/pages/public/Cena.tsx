import { useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import MarketingNavbar from '../../components/MarketingNavbar'
import api from '../../services/api'
import { useTranslation } from 'react-i18next'

const ADMIN_PRICE_RSD = 600
const CURRENCY_BY_LANG = { sr: 'RSD', bs: 'BAM', hr: 'EUR', de: 'EUR', en: 'USD' } as const
const LOCALE_BY_LANG = { sr: 'sr-RS', bs: 'bs-BA', hr: 'hr-HR', de: 'de-DE', en: 'en-US' } as const
const RSD_PER_CURRENCY = { RSD: 1, BAM: 57.6, EUR: 117.4, USD: 102.8 } as const

type PaketKey = 'Free' | 'Starter' | 'Growth' | 'Pro'

const PAKETI: Record<
  PaketKey,
  {
    basePriceRsd: number
    includedUsers: number
    extraPricePerUserRsd: number
    /** Prikaz prostora u GB (ako nije zadato spaceMb). */
    spaceGb?: number
    /** Ako je zadato, prikazuje se umesto spaceGb (npr. besplatni paket). */
    spaceMb?: number
    admins: number
    highlighted?: boolean
  }
> = {
  Free: {
    basePriceRsd: 0,
    includedUsers: 50,
    extraPricePerUserRsd: 0,
    spaceMb: 500,
    admins: 1,
  },
  Starter: {
    basePriceRsd: 2950,
    includedUsers: 100,
    extraPricePerUserRsd: 47,
    spaceGb: 2,
    admins: 3,
  },
  Growth: {
    basePriceRsd: 5750,
    includedUsers: 500,
    extraPricePerUserRsd: 21,
    spaceGb: 5,
    admins: 3,
    highlighted: true,
  },
  Pro: {
    basePriceRsd: 9750,
    includedUsers: 1000,
    extraPricePerUserRsd: 9,
    spaceGb: 10,
    admins: 5,
  },
}

const PILLARS = [
  {
    icon: IconShieldCare,
    title: 'Brinemo o klubovima',
    text:
      'Svako društvo je deo iste porodice. Gradimo Planiner tako da administracija, članstvo i organizacija budu što jednostavniji – bez pritiska da „nadogradiš“ paket.',
  },
  {
    icon: IconAllIncluded,
    title: 'Nema paketa – sve je uključeno',
    text:
      'Nema Startera, Pro-a ni složenih cena po članu. Jedna verzija aplikacije za sve klubove: iste mogućnosti, ista briga, bez iznenađenja na računu – jer računa nema.',
  },
  {
    icon: IconMountainFamily,
    title: 'Jedna velika porodica planinara',
    text:
      'Cilj nam je da povežemo planinarsku zajednicu – da klubovi dele iskustvo i osećaj pripadnosti. Zato je pristup besplatno otvoren svima koji žele da rade zajedno sa nama.',
  },
] as const

const FREE_INCLUDES = [
  'Članstvo i evidencija članova',
  'Akcije, izleti i događaji',
  'Dokumentacija i komunikacija u klubu',
  'Ista aplikacija za mala i velika društva',
] as const

export default function Cena() {
  const { t, i18n } = useTranslation('pricing')
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
  const lang = (i18n.resolvedLanguage || i18n.language || 'sr').split('-')[0] as keyof typeof CURRENCY_BY_LANG
  const currency = CURRENCY_BY_LANG[lang] ?? 'RSD'
  const locale = LOCALE_BY_LANG[lang] ?? 'sr-RS'
  const convertFromRsd = (amountRsd: number, roundToInteger = true) => {
    if (currency === 'RSD') return amountRsd
    const converted = amountRsd / RSD_PER_CURRENCY[currency]
    return roundToInteger ? Math.round(converted) : converted
  }
  const formatMoney = (amountRsd: number, keepSmallDecimals = false) => {
    const converted = convertFromRsd(amountRsd, !keepSmallDecimals)
    const showTwoDecimals = keepSmallDecimals
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: showTwoDecimals ? 2 : 0,
      maximumFractionDigits: showTwoDecimals ? 2 : 0,
    }).format(converted)
  }
  const basePriceRsd = selected.basePriceRsd
  const extraPricePerUserRsd = selected.extraPricePerUserRsd
  const isFreePaket = selectedPaket === 'Free'

    setFieldError('')
    setSubmitMessage(null)
    if (!club) {
      setFieldError(t('form.requiredClub'))
      return
    }
    if (!phone) {
      setFieldError(t('form.requiredPhone'))
      return
    }
    if (!email) {
      setFieldError(t('form.requiredEmail'))
      return
    }

    const noteBody = `Upit poslato sa stranice Cena:\n\nKontakt osoba: ${person}\nIme kluba: ${club}\nMesto: ${place}\n\nPitanje:\n${q}\n`

    setSending(true)
    try {
      await api.post(
        '/api/cena-zahtev',
        {
          paket: t(`packages.${selectedPaket}.name`),
          extraUsers,
          extraAdmins,
          note: note.trim(),
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
      setSubmitMessage({ type: 'success', text: t('messages.success') })
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
            text: t('messages.timeout'),
          })
          return
        }
        if (!err.response && (code === 'ERR_NETWORK' || err.message === 'Network Error')) {
          setSubmitMessage({
            type: 'error',
            text: t('messages.network'),
          })
          return
        }
        const apiMsg = (err.response?.data as { error?: string } | undefined)?.error
        if (apiMsg) {
          setSubmitMessage({ type: 'error', text: apiMsg })
          return
        }
      }
      const res = err && typeof err === 'object' && 'response' in err ? (err as { response?: { data?: { error?: string } } }).response : null
      const msg = res?.data?.error ?? t('messages.sendError')
      setSubmitMessage({ type: 'error', text: msg })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-emerald-50/60">
      <header className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-10 pt-6 relative z-10">
        <MarketingNavbar />
      </header>
      <div className="mx-auto max-w-5xl px-4 pb-10 space-y-10">
        <div className="text-center mt-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">{t('title')}</h1>
          <p className="text-gray-600 text-sm sm:text-base max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        {/* Paketi */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
                onClick={() => {
                  setSelectedPaket(key)
                  if (key === 'Free') {
                    setExtraUsers(0)
                    setExtraAdmins(0)
                  }
                }}
                className={`rounded-2xl shadow-sm p-6 flex flex-col text-left border transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                  cardClasses
                } ${isActive ? 'ring-2 ring-offset-2 ring-offset-emerald-50 ring-emerald-400' : ''}`}
              >
                <p
                  className={`text-xs font-semibold uppercase tracking-[0.18em] mb-2 ${
                    p.highlighted ? 'text-emerald-200' : 'text-emerald-600'
                  }`}
                >
                  {t(`packages.${key}.name`)}
                </p>
                <h2 className="text-lg font-bold mb-1">{t(`packages.${key}.short`)}</h2>
                <p
                  className={`text-3xl font-extrabold mb-4 ${
                    p.highlighted ? 'text-white' : 'text-emerald-700'
                  }`}
                >
                  {p.basePriceRsd === 0 ? (
                    <span className="block">{t('common.free')}</span>
                  ) : (
                    <>
                      {formatMoney(p.basePriceRsd)}
                      <span className="text-sm font-medium opacity-80"> {t('common.perMonth')}</span>
                    </>
                  )}
                </p>
                <ul className={`text-sm space-y-1 mb-4 ${p.highlighted ? 'text-emerald-50' : 'text-gray-600'}`}>
                  <li>{t('card.upToMembers', { count: p.includedUsers.toLocaleString(locale) })}</li>
                  <li>
                    {t('card.upToImages', {
                      size: p.spaceMb != null ? `${p.spaceMb.toLocaleString(locale)} MB` : `${p.spaceGb} GB`,
                    })}
                  </li>
                  <li>{t('card.adminAccounts', { count: p.admins })}</li>
                </ul>
                <p className={`text-xs mt-auto ${p.highlighted ? 'text-emerald-100' : 'text-gray-500'}`}>
                  {p.basePriceRsd === 0
                    ? t('card.freeFootnote')
                    : t('card.extraUserPrice', { price: formatMoney(p.extraPricePerUserRsd, true) })}
                </p>
                {isActive && (
                  <p className={`mt-2 text-xs font-semibold ${p.highlighted ? 'text-white' : 'text-emerald-700'}`}>
                    {t('card.selected')}
                  </p>
                )}
              </button>
            )
          })}
        </div>

        {/* Dodatni korisnici */}
        <div
          className={`rounded-2xl bg-white/95 border border-emerald-100 shadow-sm p-6 space-y-4 ${
            isFreePaket ? 'opacity-60' : ''
          }`}
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-1">{t('extraUsers.title')}</h2>
          <p className="text-sm text-gray-600">
            {isFreePaket ? (
              <>
                {t('extraUsers.freeText')}
              </>
            ) : (
              <>
                {t('extraUsers.paidText')}
              </>
            )}
          </p>

          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{t('extraUsers.zero')}</span>
              <span>250</span>
              <span>{t('extraUsers.fiveHundred')}</span>
            </div>
            <input
              type="range"
              min={0}
              max={500}
              step={10}
              value={extraUsers}
              onChange={(e) => setExtraUsers(Number(e.target.value))}
              disabled={isFreePaket}
              className="w-full accent-emerald-600 disabled:cursor-not-allowed"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="font-medium text-gray-800">
                {t('extraUsers.selected')}:{' '}
                <span className="text-emerald-700 font-semibold">{extraUsers}</span>
              </span>
              <span className="text-gray-700">
                {extraUsers} × {formatMoney(extraPricePerUserRsd, true)} ={' '}
                <span className="font-semibold text-emerald-700">
                  {formatMoney(Math.round(extraUsersCostRsd))} {t('common.perMonth')}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Dodatni admini */}
        <div
          className={`rounded-2xl bg-white/95 border border-emerald-100 shadow-sm p-6 space-y-4 ${
            isFreePaket ? 'opacity-60' : ''
          }`}
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-1">{t('extraAdmins.title')}</h2>
          <p className="text-sm text-gray-600">
            {t('extraAdmins.text')}
          </p>

          <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-end">
            <div className="space-y-2">
              <label htmlFor="extra-admins" className="text-xs font-medium text-gray-600">
                {t('extraAdmins.countLabel')}
              </label>
              <input
                id="extra-admins"
                type="number"
                min={0}
                max={20}
                value={extraAdmins}
                onChange={(e) => setExtraAdmins(Math.max(0, Math.min(20, Number(e.target.value) || 0)))}
                disabled={isFreePaket}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none disabled:cursor-not-allowed"
              />
            </div>
            <div className="text-sm text-gray-700 space-y-1">
              <p>
                {t('extraAdmins.pricePer')}:{' '}
                <span className="font-semibold">
                  {formatMoney(ADMIN_PRICE_RSD)} {t('common.perMonth')}
                </span>
              </p>
              <p>
                {t('extraAdmins.total')}:{' '}
                <span className="font-semibold text-emerald-700">
                  {formatMoney(Math.round(extraAdminsCostRsd))} {t('common.perMonth')}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Rezime i napomena */}
        <div className="rounded-2xl bg-white/95 border border-emerald-100 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">{t('summary.title')}</h2>

          <div className="grid gap-3 text-sm text-gray-700 sm:grid-cols-2">
            <div className="space-y-1">
              <p>
                {t('summary.package')}:{' '}
                <span className="font-semibold text-emerald-700">
                  {t(`packages.${selectedPaket}.name`)}
                </span>
              </p>
              <p>
                {t('summary.basePrice')}:{' '}
                <span className="font-semibold">
                  {isFreePaket
                    ? t('common.free')
                    : `${formatMoney(Math.round(basePriceRsd))} ${t('common.perMonth')}`}
                </span>
              </p>
              <p>
                {t('summary.includedUsers')}:{' '}
                <span className="font-semibold">{selected.includedUsers.toLocaleString(locale)}</span>
              </p>
            </div>
            <div className="space-y-1">
              <p>
                {t('summary.extraUsers')}:{' '}
                <span className="font-semibold">
                  {isFreePaket
                    ? t('summary.onlyPaid')
                    : `${extraUsers} × ${formatMoney(extraPricePerUserRsd, true)} = ${formatMoney(Math.round(extraUsersCostRsd))}`}
                </span>
              </p>
              <p>
                {t('summary.extraAdmins')}:{' '}
                <span className="font-semibold">
                  {isFreePaket
                    ? t('summary.onlyPaid')
                    : `${extraAdmins} × ${formatMoney(ADMIN_PRICE_RSD)} = ${formatMoney(Math.round(extraAdminsCostRsd))}`}
                </span>
              </p>
              <p className="text-base font-semibold text-emerald-700">
                {t('summary.totalMonthly')}:{' '}
                {isFreePaket ? t('common.free') : formatMoney(Math.round(totalMonthlyRsd))}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="ime-kluba" className="text-xs font-medium text-gray-600">
              {t('form.clubName')} <span className="text-red-500">*</span>
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
              placeholder={t('form.clubPlaceholder')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="contact-phone" className="text-xs font-medium text-gray-600">
                {t('form.phone')} <span className="text-red-500">*</span>
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
                placeholder={t('form.phonePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="contact-email" className="text-xs font-medium text-gray-600">
                {t('form.email')} <span className="text-red-500">*</span>
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
                placeholder={t('form.emailPlaceholder')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="note" className="text-xs font-medium text-gray-600">
              {t('form.notes')} <span className="text-gray-400">({t('form.optional')})</span>
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
              placeholder={t('form.notesPlaceholder')}
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
              {t('form.submitHint')}
            </p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={sending}
              className="inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-70 disabled:cursor-not-allowed transition-colors shadow-md shadow-emerald-600/20"
            >
              {sending ? t('form.sending') : t('form.submit')}
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-500 text-center max-w-2xl mx-auto">
          {t('footerNote')}
        </p>
      </div>
    </div>
  )
}

function IconSpark({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  )
}

function IconShieldCare({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  )
}

function IconAllIncluded({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  )
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function IconMountainFamily({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}

function IconHeartMountain({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3M3 12h3m12 0h3" opacity={0.35} />
    </svg>
  )
}

function IconGift({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v13m0-13V6a2 2 0 112-2h-2.5a2.5 2.5 0 000 5H12zm0-5h2.5a2.5 2.5 0 010 5H12m-7 8h14a2 2 0 002-2v-5a2 2 0 00-2-2H5a2 2 0 00-2 2v5a2 2 0 002 2z" />
    </svg>
  )
}

function IconPen({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  )
}
