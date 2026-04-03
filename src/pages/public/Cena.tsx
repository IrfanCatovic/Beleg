import { useEffect, useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import { Trans, useTranslation } from 'react-i18next'
import MarketingNavbar from '../../components/MarketingNavbar'
import api from '../../services/api'

const PILLAR_KEYS = ['care', 'all', 'family'] as const
const INCLUDE_KEYS = ['m1', 'm2', 'm3', 'm4'] as const

const PILLAR_ICONS = {
  care: IconShieldCare,
  all: IconAllIncluded,
  family: IconMountainFamily,
} as const

export default function Cena() {
  const { t } = useTranslation('cenaPage')
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

  const handleSubmit = async () => {
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
      setFieldError(t('validation.requiredFields'))
      return
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError(t('validation.emailInvalid'))
      return
    }
    if (!Number.isFinite(membersParsed) || membersParsed < 1 || membersParsed > 500000) {
      setFieldError(t('validation.memberCountInvalid'))
      return
    }
    if (admin.length < 2) {
      setFieldError(t('validation.usernameShort'))
      return
    }
    if (usernameStatus !== 'available') {
      setFieldError(t('validation.usernameWaitOrTaken'))
      return
    }

    setSending(true)
    try {
      await api.post(
        '/api/cena-zahtev',
        {
          paket: 'Cena stranica',
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
          setSubmitMessage({ type: 'error', text: t('messages.timeout') })
          return
        }
        if (!err.response && (code === 'ERR_NETWORK' || err.message === 'Network Error')) {
          setSubmitMessage({ type: 'error', text: t('messages.network') })
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-emerald-50/60">
      <header className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-10 pt-6 relative z-10">
        <MarketingNavbar />
      </header>

      <section className="relative overflow-hidden border-b border-emerald-900/10">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-800" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(255,255,255,0.18),transparent)]" />
        <div className="absolute inset-0 opacity-[0.07] bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M30 5 L55 45 L5 45 Z\' fill=\'none\' stroke=\'%23fff\' stroke-width=\'0.8\'/%3E%3C/svg%3E')] bg-[length:72px_72px]" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-8 py-14 sm:py-20 lg:py-24 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 text-emerald-50 text-xs font-semibold uppercase tracking-wider px-3 py-1 ring-1 ring-white/20 backdrop-blur-sm">
              <IconSpark className="h-3.5 w-3.5" />
              {t('hero.badge1')}
            </span>
            <span className="inline-flex rounded-full bg-emerald-950/30 text-emerald-100 text-xs font-medium px-3 py-1 ring-1 ring-white/10">
              {t('hero.badge2')}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-[1.12] mb-6 max-w-4xl mx-auto text-balance">
            {t('hero.titleBefore')}{' '}
            <span className="text-emerald-200">{t('hero.titleHighlight')}</span> {t('hero.titleAfter')}
          </h1>
          <p className="text-emerald-50/95 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed mb-4">
            <strong className="text-white font-semibold">{t('hero.p1Strong')}</strong>
            {t('hero.p1After')}
          </p>
          <p className="text-emerald-100/90 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            {t('hero.p2Before')}{' '}
            <strong className="text-white">{t('hero.p2Family')}</strong>
            {t('hero.p2Mid')}
            <strong className="text-white"> {t('hero.p2Free')}</strong>
            {t('hero.p2After')}
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <a
              href="#upit-kluba"
              className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-emerald-900 bg-white hover:bg-emerald-50 shadow-lg shadow-emerald-950/20 transition-colors"
            >
              {t('hero.ctaInquiry')}
            </a>
            <Link
              to="/kontakt"
              className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-white ring-2 ring-white/40 hover:bg-white/10 transition-colors"
            >
              <Trans i18nKey="common:nav.contact" />
            </Link>
          </div>
        </div>
      </section>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 -mt-6 relative z-[1]">
        <div className="rounded-2xl bg-white border border-emerald-100 shadow-lg shadow-emerald-900/5 p-6 sm:p-8 mb-8 sm:mb-10">
          <p className="text-center text-sm sm:text-base text-gray-700 leading-relaxed max-w-2xl mx-auto">
            <Trans
              i18nKey="cenaPage:intro"
              components={{
                prices: <strong className="text-gray-900" />,
                family: <strong className="text-emerald-800" />,
              }}
            />
          </p>
        </div>

        <div className="rounded-2xl bg-emerald-50/80 border border-emerald-100 p-6 sm:p-8 mb-10 sm:mb-12">
          <h2 className="text-center text-sm font-bold text-emerald-900 uppercase tracking-widest mb-4">
            {t('includes.title')}
          </h2>
          <ul className="grid sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
            {INCLUDE_KEYS.map((key) => (
              <li key={key} className="flex items-start gap-2.5 text-sm text-gray-800">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white mt-0.5">
                  <IconCheck className="h-3 w-3" />
                </span>
                {t(`includes.${key}`)}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl bg-white border border-emerald-100 shadow-lg shadow-emerald-900/5 p-6 sm:p-8 mb-10 sm:mb-14">
          <div className="flex flex-col sm:flex-row sm:items-start gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30">
              <IconHeartMountain className="h-7 w-7" />
            </div>
            <div className="space-y-3 text-gray-700 text-sm sm:text-base leading-relaxed">
              <p className="text-lg sm:text-xl font-semibold text-gray-900">{t('together.title')}</p>
              <p>
                {t('together.pBefore')}{' '}
                <strong className="text-gray-900">{t('together.community')}</strong> {t('together.pMid')}{' '}
                <strong className="text-emerald-800">{t('together.connect')}</strong>
                {t('together.pAfter')}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-10 sm:mb-14">
          <h2 className="text-center text-xs font-bold uppercase tracking-[0.2em] text-emerald-700 mb-2">
            {t('pillars.eyebrow')}
          </h2>
          <p className="text-center text-xl sm:text-2xl font-bold text-gray-900 mb-8 max-w-2xl mx-auto">
            {t('pillars.title')}
          </p>
          <div className="grid gap-5 sm:gap-6 md:grid-cols-3">
            {PILLAR_KEYS.map((key) => {
              const Icon = PILLAR_ICONS[key]
              return (
                <article
                  key={key}
                  className="group relative rounded-2xl border border-emerald-100/90 bg-white p-6 shadow-sm hover:shadow-md hover:border-emerald-200/90 transition-all duration-300 overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-50 to-transparent rounded-bl-full opacity-80" />
                  <div className="relative flex flex-col h-full">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 mb-4 group-hover:bg-emerald-100 transition-colors">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="text-base font-bold text-gray-900 mb-2">{t(`pillars.${key}.title`)}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed flex-1">{t(`pillars.${key}.text`)}</p>
                  </div>
                </article>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-8 sm:p-10 mb-12 sm:mb-16 shadow-xl shadow-emerald-600/25 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-2xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-900/30 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
          <div className="relative max-w-2xl">
            <h2 className="text-xl sm:text-2xl font-bold mb-3 flex items-center gap-2 flex-wrap">
              <IconGift className="h-7 w-7 text-emerald-200 shrink-0" />
              {t('whyFree.title')}
            </h2>
            <p className="text-emerald-50 leading-relaxed text-sm sm:text-base mb-4">
              {t('whyFree.p1Before')} <strong className="text-white">{t('whyFree.p1Strong')}</strong>
              {t('whyFree.p1After')}
            </p>
            <p className="text-emerald-100/95 text-sm sm:text-base leading-relaxed">
              {t('whyFree.p2Before')} <strong className="text-white">{t('whyFree.p2Strong')}</strong>
              {t('whyFree.p2After')}
            </p>
          </div>
        </div>

        <div
          id="upit-kluba"
          className="scroll-mt-24 rounded-2xl bg-white border border-emerald-100 shadow-sm p-6 sm:p-8 space-y-5"
        >
          <div className="flex items-start gap-4 pb-1 border-b border-emerald-100/80">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <IconPen className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('form.title')}</h2>
              <p className="text-xs sm:text-sm text-gray-600 mt-1 max-w-xl">{t('form.subtitle')}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="cena-contact-person" className="text-xs font-medium text-gray-600">
                {t('form.contactPerson')} <span className="text-red-500">*</span>
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
                placeholder={t('form.placeholders.contactPerson')}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="cena-club-name" className="text-xs font-medium text-gray-600">
                {t('form.clubName')} <span className="text-red-500">*</span>
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
                placeholder={t('form.placeholders.clubName')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="cena-city" className="text-xs font-medium text-gray-600">
              {t('form.city')} <span className="text-red-500">*</span>
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
              placeholder={t('form.placeholders.city')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="cena-email" className="text-xs font-medium text-gray-600">
                {t('form.email')} <span className="text-red-500">*</span>
              </label>
              <input
                id="cena-email"
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
                placeholder={t('form.placeholders.email')}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="cena-members" className="text-xs font-medium text-gray-600">
                {t('form.memberCount')} <span className="text-red-500">*</span>
              </label>
              <input
                id="cena-members"
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
                placeholder={t('form.placeholders.memberCount')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="cena-admin-username" className="text-xs font-medium text-gray-600">
              {t('form.adminUsername')} <span className="text-red-500">*</span>
            </label>
            <input
              id="cena-admin-username"
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
              placeholder={t('form.placeholders.adminUsername')}
            />
            {adminUsername.trim().length >= 2 && usernameStatus === 'checking' && (
              <p className="text-xs text-gray-500">{t('form.usernameChecking')}</p>
            )}
            {adminUsername.trim().length >= 2 && usernameStatus === 'available' && (
              <p className="text-xs text-emerald-600 font-medium">{t('form.usernameAvailable')}</p>
            )}
            {adminUsername.trim().length >= 2 && usernameStatus === 'taken' && (
              <p className="text-xs text-red-600 font-medium">{t('form.usernameTaken')}</p>
            )}
            {adminUsername.trim().length >= 2 && usernameStatus === 'error' && (
              <p className="text-xs text-amber-600">{t('form.usernameCheckError')}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="cena-question" className="text-xs font-medium text-gray-600">
              {t('form.question')} <span className="text-red-500">*</span>
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
              placeholder={t('form.placeholders.question')}
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
            <p className="text-xs text-gray-500 max-w-md">{t('form.hint')}</p>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={
                sending ||
                (adminUsername.trim().length >= 2 && usernameStatus !== 'available')
              }
              className="inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-70 disabled:cursor-not-allowed transition-colors shadow-md shadow-emerald-600/20"
            >
              {sending ? t('form.sending') : t('form.submit')}
            </button>
          </div>
        </div>
      </main>
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
