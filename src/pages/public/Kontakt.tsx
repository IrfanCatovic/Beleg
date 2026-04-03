import { useEffect, useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import MarketingNavbar from '../../components/MarketingNavbar'
import api from '../../services/api'
import { useTranslation } from 'react-i18next'

const KONTAKTI = [
  {
    ime: 'Irfan',
    telefon: '+381 69 555 4991',
    email: 'catovicc84@gmail.com',
  },
  {
    ime: 'Enes',
    telefon: '+381 63 830 6056',
    email: 'enesh23@gmail.com',
  },
  
] as const

const TRUST_ITEMS = [
  {
    icon: IconClubs,
    value: '30+',
    labelKey: 'trust.activeClubs',
  },
  {
    icon: IconClock,
    value: '< 1h',
    labelKey: 'trust.responseTime',
  },
  {
    icon: IconHeart,
    value: '100%',
    labelKey: 'trust.satisfiedClients',
  },
  {
    icon: IconStar,
    value: '5.0',
    labelKey: 'trust.reviews',
  },
] as const

export default function Kontakt() {
  const { t } = useTranslation('contactPage')
  const { t: tc } = useTranslation('cenaPage')
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null)
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null)
  const [contactPerson, setContactPerson] = useState('')
  const [clubName, setClubName] = useState('')
  const [city, setCity] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [clubMemberCount, setClubMemberCount] = useState('')
  const [adminUsername, setAdminUsername] = useState('')
  const [question, setQuestion] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [sending, setSending] = useState(false)
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'error'>('idle')

  useEffect(() => {
    const u = adminUsername.trim()
    if (u.length < 2) {
      setUsernameStatus('idle')
      return
    }
    setUsernameStatus('checking')
    const timer = window.setTimeout(() => {
      void api
        .get<{ available: boolean }>('/api/username-available', {
          params: { username: u },
          withCredentials: false,
        })
        .then((res) => {
          setUsernameStatus(res.data.available ? 'available' : 'taken')
        })
        .catch(() => {
          setUsernameStatus('error')
        })
    }, 450)
    return () => window.clearTimeout(timer)
  }, [adminUsername])

  const handlePhoneClick = async (telefon: string) => {
    try {
      await navigator.clipboard.writeText(telefon)
      setCopiedPhone(telefon)
      setTimeout(() => {
        setCopiedPhone((prev) => (prev === telefon ? null : prev))
      }, 1500)
    } catch {
      // ignore
    }
  }

  const handleEmailClick = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email)
      setCopiedEmail(email)
      setTimeout(() => {
        setCopiedEmail((prev) => (prev === email ? null : prev))
      }, 1500)
    } catch {
      // ignore
    }
  }

  const handleContactSubmit = async () => {
    const person = contactPerson.trim()
    const club = clubName.trim()
    const place = city.trim()
    const email = contactEmail.trim()
    const q = question.trim()
    const admin = adminUsername.trim()
    const membersParsed = parseInt(clubMemberCount.replace(/\s/g, ''), 10)

    setFieldError('')
    setSubmitMessage(null)

    if (!person || !club || !place || !q) {
      setFieldError(t('form.requiredAll'))
      return
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError(tc('validation.emailInvalid'))
      return
    }
    if (!Number.isFinite(membersParsed) || membersParsed < 1 || membersParsed > 500000) {
      setFieldError(tc('validation.memberCountInvalid'))
      return
    }
    if (admin.length < 2) {
      setFieldError(tc('validation.usernameShort'))
      return
    }
    if (usernameStatus !== 'available') {
      setFieldError(tc('validation.usernameWaitOrTaken'))
      return
    }

    setSending(true)
    try {
      await api.post(
        '/api/cena-zahtev',
        {
          paket: t('mail.packageName'),
          extraUsers: 0,
          extraAdmins: 0,
          note: q,
          imeKluba: club,
          contactEmail: email,
          contactPhone: '',
          contactPerson: person,
          city: place,
          clubMemberCount: membersParsed,
          adminUsername: admin,
          basePriceRsd: 0,
          extraUsersCostRsd: 0,
          extraAdminsCostRsd: 0,
          totalMonthlyRsd: 0,
        },
        { timeout: 45_000, withCredentials: false },
      )
      setSubmitMessage({ type: 'success', text: t('messages.success') })
      setContactPerson('')
      setClubName('')
      setCity('')
      setContactEmail('')
      setClubMemberCount('')
      setAdminUsername('')
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
      const res =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response
          : null
      const msg = res?.data?.error ?? t('messages.sendError')
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

      <main className="max-w-4xl mx-auto px-4 pb-20">
        {/* Hero */}
        <div className="text-center mt-10 sm:mt-14 mb-12">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 mb-5">
            <IconChat className="h-7 w-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4 tracking-tight">
            {t('hero.title')}
          </h1>
          <p className="text-gray-600 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            {t('hero.subtitle')}
          </p>
        </div>

        {/* Trust strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-14">
          {TRUST_ITEMS.map((item) => (
            <div
              key={item.labelKey}
              className="relative rounded-2xl bg-white border border-emerald-100/80 shadow-sm hover:shadow-md hover:border-emerald-200/80 transition-all p-4 sm:p-5 text-center overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50/50 rounded-bl-full" />
              <div className="relative flex flex-col items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <item.icon className="h-5 w-5" />
                </span>
                <span className="text-xl sm:text-2xl font-bold text-emerald-700">{item.value}</span>
                <span className="text-xs sm:text-sm text-gray-600 leading-snug">{t(item.labelKey)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Contact section title */}
        <div className="flex items-center gap-3 mb-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <IconTeam className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-semibold text-gray-900">{t('contacts.title')}</h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-5 sm:gap-6">
          {KONTAKTI.map((osoba) => (
            <section
              key={osoba.ime}
              className="group rounded-2xl bg-white border border-emerald-100 shadow-sm hover:shadow-md hover:border-emerald-200/80 transition-all p-6 sm:p-7"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white font-semibold text-lg shadow-md shadow-emerald-500/25">
                  {osoba.ime.charAt(0)}
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{osoba.ime}</h3>
              </div>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => handlePhoneClick(osoba.telefon)}
                  className="flex items-center gap-3 py-2 px-3 -mx-3 rounded-xl text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors w-full text-left"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 shrink-0">
                    <PhoneIcon className="h-4 w-4" />
                  </span>
                  <span className="font-medium">{osoba.telefon}</span>
                </button>
                {copiedPhone === osoba.telefon && (
                  <span className="block text-[10px] text-emerald-500 mt-0.5 ml-1">{t('contacts.phoneCopied')}</span>
                )}
                <button
                  type="button"
                  onClick={() => handleEmailClick(osoba.email)}
                  className="flex items-center gap-3 py-2 px-3 -mx-3 rounded-xl text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors break-all w-full text-left"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 shrink-0">
                    <EmailIcon className="h-4 w-4" />
                  </span>
                  <span className="font-medium text-sm sm:text-base">{osoba.email}</span>
                </button>
                {copiedEmail === osoba.email && (
                  <span className="block text-[10px] text-emerald-500 mt-0.5 ml-1">{t('contacts.emailCopied')}</span>
                )}
              </div>
            </section>
          ))}
        </div>

        {/* Kontakt forma */}
        <div className="mt-12 rounded-2xl bg-white border border-emerald-100 shadow-sm p-6 sm:p-8 space-y-5">
          <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">{t('form.title')}</h2>
              <p className="text-xs sm:text-sm text-gray-600 max-w-xl">
                {t('form.subtitle')}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="contact-person" className="text-xs font-medium text-gray-600">
                {t('form.contactPerson')} <span className="text-red-500">*</span>
              </label>
              <input
                id="contact-person"
                type="text"
                value={contactPerson}
                onChange={(e) => {
                  setContactPerson(e.target.value)
                  setFieldError('')
                }}
                className={`w-full rounded-xl border px-3 py-2 text-sm text-gray-800 shadow-sm focus:ring-2 focus:ring-emerald-500/30 outline-none ${
                  fieldError ? 'border-red-400' : 'border-gray-300 focus:border-emerald-500'
                }`}
                placeholder={t('form.contactPersonPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="club-name" className="text-xs font-medium text-gray-600">
                {t('form.clubName')} <span className="text-red-500">*</span>
              </label>
              <input
                id="club-name"
                type="text"
                value={clubName}
                onChange={(e) => {
                  setClubName(e.target.value)
                  setFieldError('')
                }}
                className={`w-full rounded-xl border px-3 py-2 text-sm text-gray-800 shadow-sm focus:ring-2 focus:ring-emerald-500/30 outline-none ${
                  fieldError ? 'border-red-400' : 'border-gray-300 focus:border-emerald-500'
                }`}
                placeholder={t('form.clubNamePlaceholder')}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)]">
            <div className="space-y-2">
              <label htmlFor="city" className="text-xs font-medium text-gray-600">
                {t('form.city')} <span className="text-red-500">*</span>
              </label>
              <input
                id="city"
                type="text"
                value={city}
                onChange={(e) => {
                  setCity(e.target.value)
                  setFieldError('')
                }}
                className={`w-full rounded-xl border px-3 py-2 text-sm text-gray-800 shadow-sm focus:ring-2 focus:ring-emerald-500/30 outline-none ${
                  fieldError ? 'border-red-400' : 'border-gray-300 focus:border-emerald-500'
                }`}
                placeholder={t('form.cityPlaceholder')}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="kontakt-email" className="text-xs font-medium text-gray-600">
                {tc('form.email')} <span className="text-red-500">*</span>
              </label>
              <input
                id="kontakt-email"
                type="email"
                autoComplete="email"
                value={contactEmail}
                onChange={(e) => {
                  setContactEmail(e.target.value)
                  setFieldError('')
                }}
                className={`w-full rounded-xl border px-3 py-2 text-sm text-gray-800 shadow-sm focus:ring-2 focus:ring-emerald-500/30 outline-none ${
                  fieldError ? 'border-red-400' : 'border-gray-300 focus:border-emerald-500'
                }`}
                placeholder={tc('form.placeholders.email')}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="kontakt-members" className="text-xs font-medium text-gray-600">
                {tc('form.memberCount')} <span className="text-red-500">*</span>
              </label>
              <input
                id="kontakt-members"
                type="number"
                min={1}
                max={500000}
                inputMode="numeric"
                value={clubMemberCount}
                onChange={(e) => {
                  setClubMemberCount(e.target.value)
                  setFieldError('')
                }}
                className={`w-full rounded-xl border px-3 py-2 text-sm text-gray-800 shadow-sm focus:ring-2 focus:ring-emerald-500/30 outline-none ${
                  fieldError ? 'border-red-400' : 'border-gray-300 focus:border-emerald-500'
                }`}
                placeholder={tc('form.placeholders.memberCount')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="kontakt-admin-username" className="text-xs font-medium text-gray-600">
              {tc('form.adminUsername')} <span className="text-red-500">*</span>
            </label>
            <input
              id="kontakt-admin-username"
              type="text"
              autoComplete="username"
              value={adminUsername}
              onChange={(e) => {
                setAdminUsername(e.target.value)
                setFieldError('')
              }}
              className={`w-full rounded-xl border px-3 py-2 text-sm text-gray-800 shadow-sm focus:ring-2 focus:ring-emerald-500/30 outline-none ${
                fieldError ? 'border-red-400' : 'border-gray-300 focus:border-emerald-500'
              }`}
              placeholder={tc('form.placeholders.adminUsername')}
            />
            {adminUsername.trim().length >= 2 && usernameStatus === 'checking' && (
              <p className="text-xs text-gray-500">{tc('form.usernameChecking')}</p>
            )}
            {adminUsername.trim().length >= 2 && usernameStatus === 'available' && (
              <p className="text-xs text-emerald-600 font-medium">{tc('form.usernameAvailable')}</p>
            )}
            {adminUsername.trim().length >= 2 && usernameStatus === 'taken' && (
              <p className="text-xs text-red-600 font-medium">{tc('form.usernameTaken')}</p>
            )}
            {adminUsername.trim().length >= 2 && usernameStatus === 'error' && (
              <p className="text-xs text-amber-600">{tc('form.usernameCheckError')}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="question" className="text-xs font-medium text-gray-600">
              {t('form.question')} <span className="text-red-500">*</span>
            </label>
            <textarea
              id="question"
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value)
                setFieldError('')
              }}
              rows={4}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none resize-y"
              placeholder={t('form.questionPlaceholder')}
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
              {t('form.hint')}
            </p>
            <button
              type="button"
              onClick={() => void handleContactSubmit()}
              disabled={
                sending ||
                (adminUsername.trim().length >= 2 && usernameStatus !== 'available')
              }
              className="inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? t('form.sending') : t('form.submit')}
            </button>
          </div>
        </div>

        {/* CTA Cena */}
        <div className="mt-14 relative rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-600 to-emerald-800 p-8 sm:p-10 text-center shadow-xl shadow-emerald-500/20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.12)_0%,transparent_50%)]" />
          <div className="absolute bottom-0 right-0 w-48 h-48 bg-white/5 rounded-tl-full" />
          <div className="relative">
            <p className="text-emerald-50/95 text-sm sm:text-base mb-5 max-w-lg mx-auto leading-relaxed">
              {t('cta.text')}
            </p>
            <Link
              to="/cena"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-emerald-800 bg-white hover:bg-emerald-50 transition-colors shadow-lg"
            >
              {t('cta.button')}
              <IconArrow className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

function IconChat({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  )
}

function IconClubs({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
      />
    </svg>
  )
}

function IconClock({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )
}

function IconHeart({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
      />
    </svg>
  )
}

function IconStar({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
      />
    </svg>
  )
}

function IconTeam({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  )
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
      />
    </svg>
  )
}

function EmailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  )
}

function IconArrow({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
    </svg>
  )
}
