import { useMemo, useState } from 'react'
import axios from 'axios'
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
  const convertFromRsd = (amountRsd: number) => {
    if (currency === 'RSD') return amountRsd
    return Math.round(amountRsd / RSD_PER_CURRENCY[currency])
  }
  const formatMoney = (amountRsd: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(convertFromRsd(amountRsd))
  const basePriceRsd = selected.basePriceRsd
  const extraPricePerUserRsd = selected.extraPricePerUserRsd
  const isFreePaket = selectedPaket === 'Free'

  const { extraUsersCostRsd, extraAdminsCostRsd, totalMonthlyRsd } = useMemo(() => {
    if (isFreePaket) {
      return { extraUsersCostRsd: 0, extraAdminsCostRsd: 0, totalMonthlyRsd: 0 }
    }
    const extraUsersCost = extraUsers * extraPricePerUserRsd
    const extraAdminsCost = extraAdmins * ADMIN_PRICE_RSD
    return {
      extraUsersCostRsd: extraUsersCost,
      extraAdminsCostRsd: extraAdminsCost,
      totalMonthlyRsd: basePriceRsd + extraUsersCost + extraAdminsCost,
    }
  }, [extraUsers, extraAdmins, basePriceRsd, extraPricePerUserRsd, isFreePaket])

  const handleSendEmail = async () => {
    const club = imeKluba.trim()
    const phone = contactPhone.trim()
    const email = contactEmail.trim()
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

    setSending(true)
    try {
      // Javna forma: bez cookies — manje CORS problema kad je frontend na drugom domenu od API-ja.
      await api.post(
        '/api/cena-zahtev',
        {
          paket: t(`packages.${selectedPaket}.name`),
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
        const msg = (err.response?.data as { error?: string } | undefined)?.error
        if (msg) {
          setSubmitMessage({ type: 'error', text: msg })
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
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-emerald-50">
      <header className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-10 pt-6">
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
                    : t('card.extraUserPrice', { price: formatMoney(p.extraPricePerUserRsd) })}
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
                {extraUsers} × {formatMoney(extraPricePerUserRsd)} ={' '}
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
                    : `${extraUsers} × ${formatMoney(extraPricePerUserRsd)} = ${formatMoney(Math.round(extraUsersCostRsd))}`}
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
                placeholder={t('form.phonePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="contact-email" className="text-xs font-medium text-gray-600">
                {t('form.email')} <span className="text-red-500">*</span>
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
                placeholder={t('form.emailPlaceholder')}
              />
            </div>
          </div>
          {fieldError && <p className="text-xs text-red-600">{fieldError}</p>}

          <div className="space-y-2">
            <label htmlFor="note" className="text-xs font-medium text-gray-600">
              {t('form.notes')} <span className="text-gray-400">({t('form.optional')})</span>
            </label>
            <textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none resize-y"
              placeholder={t('form.notesPlaceholder')}
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
              {t('form.submitHint')}
            </p>
            <button
              type="button"
              onClick={handleSendEmail}
              disabled={sending}
              className="inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
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

