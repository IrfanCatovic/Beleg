import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import MarketingNavbar from '../../components/MarketingNavbar'
import api from '../../services/api'
import { useTranslation } from 'react-i18next'

type Mode = 'club' | 'hiker'

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
  { icon: IconClubs, key: 'clubs' },
  { icon: IconHelp, key: 'support' },
  { icon: IconDevice, key: 'use' },
  { icon: IconSpark, key: 'start' },
] as const

export default function Kontakt() {
  const { t } = useTranslation('contactPage')
  const { t: tc } = useTranslation('cenaPage')

  const [mode, setMode] = useState<Mode>('club')
  const formAnchorRef = useRef<HTMLDivElement | null>(null)

  const [copiedPhone, setCopiedPhone] = useState<string | null>(null)
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null)

  const [contactPerson, setContactPerson] = useState('')
  const [clubName, setClubName] = useState('')
  const [city, setCity] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [clubMemberCount, setClubMemberCount] = useState('')
  const [adminUsername, setAdminUsername] = useState('')
  const [question, setQuestion] = useState('')

  const [hikerName, setHikerName] = useState('')
  const [hikerEmail, setHikerEmail] = useState('')
  const [hikerPhone, setHikerPhone] = useState('')
  const [hikerCity, setHikerCity] = useState('')
  const [hikerInterest, setHikerInterest] = useState('')

  const [fieldError, setFieldError] = useState('')
  const [sending, setSending] = useState(false)
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'error'>('idle')

  useEffect(() => {
    if (mode !== 'club') {
      setUsernameStatus('idle')
      return
    }
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
  }, [adminUsername, mode])

  function chooseMode(next: Mode) {
    setMode(next)
    setFieldError('')
    setSubmitMessage(null)
  }

  function scrollToForm() {
    formAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleCtaPickClub() {
    setMode('club')
    setFieldError('')
    setSubmitMessage(null)
    requestAnimationFrame(() => scrollToForm())
  }

  async function handlePhoneClick(telefon: string) {
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

  async function handleEmailClick(email: string) {
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

  async function handleClubSubmit() {
    const person = contactPerson.trim()
    const club = clubName.trim()
    const place = city.trim()
    const email = contactEmail.trim()
    const phone = contactPhone.trim()
    const q = question.trim()
    const admin = adminUsername.trim()
    const membersRaw = clubMemberCount.replace(/\s/g, '')
    const membersParsed = membersRaw === '' ? NaN : parseInt(membersRaw, 10)

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
    if (clubMemberCount.trim() !== '' && (!Number.isFinite(membersParsed) || membersParsed < 1 || membersParsed > 500000)) {
      setFieldError(tc('validation.memberCountInvalid'))
      return
    }
    if (admin.length > 0 && admin.length < 2) {
      setFieldError(tc('validation.usernameShort'))
      return
    }
    if (admin.length >= 2 && usernameStatus !== 'available') {
      setFieldError(tc('validation.usernameWaitOrTaken'))
      return
    }

    setSending(true)
    try {
      await api.post(
        '/api/cena-zahtev',
        {
          paket: t('mail.packageNameClub'),
          extraUsers: 0,
          extraAdmins: 0,
          note: q,
          imeKluba: club,
          contactEmail: email,
          contactPhone: phone,
          contactPerson: person,
          city: place,
          clubMemberCount: Number.isFinite(membersParsed) ? membersParsed : 1,
          adminUsername: admin || `klub_${Date.now().toString(36)}`,
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
      setContactPhone('')
      setClubMemberCount('')
      setAdminUsername('')
      setQuestion('')
    } catch (err: unknown) {
      handleSubmitError(err)
    } finally {
      setSending(false)
    }
  }

  async function handleHikerSubmit() {
    const name = hikerName.trim()
    const email = hikerEmail.trim()
    const phone = hikerPhone.trim()
    const place = hikerCity.trim()
    const interest = hikerInterest.trim()

    setFieldError('')
    setSubmitMessage(null)

    if (!name || !interest) {
      setFieldError(t('form.requiredAll'))
      return
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError(tc('validation.emailInvalid'))
      return
    }

    setSending(true)
    try {
      await api.post(
        '/api/cena-zahtev',
        {
          paket: t('mail.packageNameHiker'),
          extraUsers: 0,
          extraAdmins: 0,
          note: interest,
          imeKluba: t('mail.hikerPlaceholder'),
          contactEmail: email,
          contactPhone: phone,
          contactPerson: name,
          city: place,
          clubMemberCount: 1,
          adminUsername: `planinar_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          basePriceRsd: 0,
          extraUsersCostRsd: 0,
          extraAdminsCostRsd: 0,
          totalMonthlyRsd: 0,
        },
        { timeout: 45_000, withCredentials: false },
      )
      setSubmitMessage({ type: 'success', text: t('messages.success') })
      setHikerName('')
      setHikerEmail('')
      setHikerPhone('')
      setHikerCity('')
      setHikerInterest('')
    } catch (err: unknown) {
      handleSubmitError(err)
    } finally {
      setSending(false)
    }
  }

  function handleSubmitError(err: unknown) {
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
  }

  const baseInput =
    'w-full rounded-xl border px-3 py-2.5 text-sm text-gray-800 shadow-sm focus:ring-2 focus:ring-emerald-500/30 outline-none transition-colors'
  const okBorder = 'border-gray-300 focus:border-emerald-500'
  const errBorder = 'border-red-400'

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/80 via-white to-emerald-50/80">
      <header className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-10 pt-6">
        <MarketingNavbar />
      </header>

      <main className="max-w-4xl mx-auto px-4 pb-20">
        <div className="text-center mt-10 sm:mt-14 mb-12">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 mb-5">
            <IconChat className="h-7 w-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4 tracking-tight">
            {t('hero.title')}
          </h1>
          <p className="text-gray-600 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            {t('hero.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-14">
          {TRUST_ITEMS.map((item) => (
            <div
              key={item.key}
              className="relative rounded-2xl bg-white border border-emerald-100/80 shadow-sm hover:shadow-md hover:border-emerald-200/80 transition-all p-4 sm:p-5 text-center overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50/50 rounded-bl-full" aria-hidden="true" />
              <div className="relative flex flex-col items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <item.icon className="h-5 w-5" />
                </span>
                <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  {t(`trustCards.${item.key}.label`)}
                </span>
                <span className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">
                  {t(`trustCards.${item.key}.value`)}
                </span>
                <span className="text-xs sm:text-sm text-gray-600 leading-snug">
                  {t(`trustCards.${item.key}.desc`)}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <IconTeam className="h-5 w-5" />
            </span>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">{t('contacts.title')}</h2>
          </div>
          <p className="text-sm text-gray-600 max-w-2xl">
            {t('contacts.subtitle')}
          </p>
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
                  onClick={() => void handlePhoneClick(osoba.telefon)}
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
                  onClick={() => void handleEmailClick(osoba.email)}
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

        <div ref={formAnchorRef} className="scroll-mt-24 mt-14 sm:mt-16">
          <div className="mb-6 sm:mb-8 text-center">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 tracking-tight">
              {t('modeSelector.title')}
            </h2>
            <p className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto leading-relaxed">
              {t('modeSelector.subtitle')}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 sm:gap-5" role="tablist" aria-label={t('modeSelector.title')}>
            <ModeCard
              active={mode === 'club'}
              onClick={() => chooseMode('club')}
              icon={<IconClubs className="h-5 w-5" />}
              title={t('modeSelector.club.title')}
              desc={t('modeSelector.club.desc')}
              ariaControls="kontakt-form-panel"
            />
            <ModeCard
              active={mode === 'hiker'}
              onClick={() => chooseMode('hiker')}
              icon={<IconBackpack className="h-5 w-5" />}
              title={t('modeSelector.hiker.title')}
              desc={t('modeSelector.hiker.desc')}
              ariaControls="kontakt-form-panel"
            />
          </div>

          <div
            id="kontakt-form-panel"
            role="tabpanel"
            className="mt-6 sm:mt-8 rounded-2xl bg-white border border-emerald-100 shadow-sm p-6 sm:p-8 space-y-5"
          >
            {mode === 'club' ? (
              <>
                <div>
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1">{t('clubForm.title')}</h3>
                  <p className="text-xs sm:text-sm text-gray-600 max-w-2xl leading-relaxed">
                    {t('clubForm.subtitle')}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldText
                    id="club-contact-person"
                    label={t('form.contactPerson')}
                    required
                    value={contactPerson}
                    onChange={(v) => {
                      setContactPerson(v)
                      setFieldError('')
                    }}
                    placeholder={t('form.contactPersonPlaceholder')}
                    error={Boolean(fieldError)}
                    baseInput={baseInput}
                    okBorder={okBorder}
                    errBorder={errBorder}
                  />
                  <FieldText
                    id="club-name"
                    label={t('form.clubName')}
                    required
                    value={clubName}
                    onChange={(v) => {
                      setClubName(v)
                      setFieldError('')
                    }}
                    placeholder={t('form.clubNamePlaceholder')}
                    error={Boolean(fieldError)}
                    baseInput={baseInput}
                    okBorder={okBorder}
                    errBorder={errBorder}
                  />
                </div>

                <FieldText
                  id="club-city"
                  label={t('form.city')}
                  required
                  value={city}
                  onChange={(v) => {
                    setCity(v)
                    setFieldError('')
                  }}
                  placeholder={t('form.cityPlaceholder')}
                  error={Boolean(fieldError)}
                  baseInput={baseInput}
                  okBorder={okBorder}
                  errBorder={errBorder}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldText
                    id="club-email"
                    type="email"
                    autoComplete="email"
                    label={tc('form.email')}
                    required
                    value={contactEmail}
                    onChange={(v) => {
                      setContactEmail(v)
                      setFieldError('')
                    }}
                    placeholder={tc('form.placeholders.email')}
                    error={Boolean(fieldError)}
                    baseInput={baseInput}
                    okBorder={okBorder}
                    errBorder={errBorder}
                  />
                  <FieldText
                    id="club-phone"
                    type="tel"
                    autoComplete="tel"
                    label={t('clubForm.phone')}
                    value={contactPhone}
                    onChange={(v) => {
                      setContactPhone(v)
                      setFieldError('')
                    }}
                    placeholder={t('clubForm.phonePlaceholder')}
                    error={Boolean(fieldError)}
                    baseInput={baseInput}
                    okBorder={okBorder}
                    errBorder={errBorder}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="club-members" className="text-xs font-medium text-gray-600">
                      {t('clubForm.memberCount')}
                    </label>
                    <input
                      id="club-members"
                      type="number"
                      min={1}
                      max={500000}
                      inputMode="numeric"
                      value={clubMemberCount}
                      onChange={(e) => {
                        setClubMemberCount(e.target.value)
                        setFieldError('')
                      }}
                      className={`${baseInput} ${fieldError ? errBorder : okBorder}`}
                      placeholder={t('clubForm.memberCountPlaceholder')}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="club-admin-username" className="text-xs font-medium text-gray-600">
                      {t('clubForm.adminUsername')}
                    </label>
                    <input
                      id="club-admin-username"
                      type="text"
                      autoComplete="username"
                      value={adminUsername}
                      onChange={(e) => {
                        setAdminUsername(e.target.value)
                        setFieldError('')
                      }}
                      className={`${baseInput} ${fieldError ? errBorder : okBorder}`}
                      placeholder={t('clubForm.adminUsernamePlaceholder')}
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
                </div>

                <div className="space-y-2">
                  <label htmlFor="club-question" className="text-xs font-medium text-gray-600">
                    {t('form.question')} <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="club-question"
                    value={question}
                    onChange={(e) => {
                      setQuestion(e.target.value)
                      setFieldError('')
                    }}
                    rows={4}
                    className={`${baseInput} resize-y ${fieldError ? errBorder : okBorder}`}
                    placeholder={t('clubForm.questionPlaceholder')}
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
                  <p className="text-xs text-gray-500 max-w-lg">{t('clubForm.hint')}</p>
                  <button
                    type="button"
                    onClick={() => void handleClubSubmit()}
                    disabled={
                      sending ||
                      (adminUsername.trim().length >= 2 && usernameStatus !== 'available')
                    }
                    className="inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-70 disabled:cursor-not-allowed transition-colors shadow-md shadow-emerald-500/25"
                  >
                    {sending ? t('form.sending') : t('clubForm.submit')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1">{t('hikerForm.title')}</h3>
                  <p className="text-xs sm:text-sm text-gray-600 max-w-2xl leading-relaxed">
                    {t('hikerForm.subtitle')}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldText
                    id="hiker-name"
                    label={t('hikerForm.name')}
                    required
                    value={hikerName}
                    onChange={(v) => {
                      setHikerName(v)
                      setFieldError('')
                    }}
                    placeholder={t('hikerForm.namePlaceholder')}
                    error={Boolean(fieldError)}
                    baseInput={baseInput}
                    okBorder={okBorder}
                    errBorder={errBorder}
                  />
                  <FieldText
                    id="hiker-email"
                    type="email"
                    autoComplete="email"
                    label={tc('form.email')}
                    required
                    value={hikerEmail}
                    onChange={(v) => {
                      setHikerEmail(v)
                      setFieldError('')
                    }}
                    placeholder={tc('form.placeholders.email')}
                    error={Boolean(fieldError)}
                    baseInput={baseInput}
                    okBorder={okBorder}
                    errBorder={errBorder}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldText
                    id="hiker-phone"
                    type="tel"
                    autoComplete="tel"
                    label={t('hikerForm.phone')}
                    value={hikerPhone}
                    onChange={(v) => {
                      setHikerPhone(v)
                      setFieldError('')
                    }}
                    placeholder={t('hikerForm.phonePlaceholder')}
                    error={Boolean(fieldError)}
                    baseInput={baseInput}
                    okBorder={okBorder}
                    errBorder={errBorder}
                  />
                  <FieldText
                    id="hiker-city"
                    label={t('hikerForm.city')}
                    value={hikerCity}
                    onChange={(v) => {
                      setHikerCity(v)
                      setFieldError('')
                    }}
                    placeholder={t('hikerForm.cityPlaceholder')}
                    error={Boolean(fieldError)}
                    baseInput={baseInput}
                    okBorder={okBorder}
                    errBorder={errBorder}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="hiker-interest" className="text-xs font-medium text-gray-600">
                    {t('hikerForm.interest')} <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="hiker-interest"
                    value={hikerInterest}
                    onChange={(e) => {
                      setHikerInterest(e.target.value)
                      setFieldError('')
                    }}
                    rows={4}
                    className={`${baseInput} resize-y ${fieldError ? errBorder : okBorder}`}
                    placeholder={t('hikerForm.interestPlaceholder')}
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
                  <p className="text-xs text-gray-500 max-w-lg">{t('hikerForm.hint')}</p>
                  <button
                    type="button"
                    onClick={() => void handleHikerSubmit()}
                    disabled={sending}
                    className="inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-70 disabled:cursor-not-allowed transition-colors shadow-md shadow-emerald-500/25"
                  >
                    {sending ? t('form.sending') : t('hikerForm.submit')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-14 relative rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-600 to-emerald-800 p-8 sm:p-10 text-center shadow-xl shadow-emerald-500/20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.12)_0%,transparent_50%)]" aria-hidden="true" />
          <div className="absolute bottom-0 right-0 w-48 h-48 bg-white/5 rounded-tl-full" aria-hidden="true" />
          <div className="relative">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-3 tracking-tight">
              {t('ctaNew.title')}
            </h2>
            <p className="text-emerald-50/95 text-sm sm:text-base mb-6 max-w-xl mx-auto leading-relaxed">
              {t('ctaNew.text')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch sm:items-center mb-4">
              <button
                type="button"
                onClick={handleCtaPickClub}
                className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-emerald-800 bg-white hover:bg-emerald-50 transition-colors shadow-lg"
              >
                {t('ctaNew.primary')}
                <IconArrow className="h-4 w-4" />
              </button>
              <Link
                to="/registracija-clan"
                className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white bg-white/0 border border-white/40 hover:bg-white/10 transition-colors"
              >
                {t('ctaNew.secondary')}
              </Link>
            </div>
            <p className="text-emerald-50/80 text-xs sm:text-sm max-w-lg mx-auto leading-relaxed">
              {t('ctaNew.smallText')}
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

type FieldTextProps = {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
  type?: 'text' | 'email' | 'tel'
  autoComplete?: string
  error?: boolean
  baseInput: string
  okBorder: string
  errBorder: string
}

function FieldText({
  id,
  label,
  value,
  onChange,
  placeholder,
  required,
  type,
  autoComplete,
  error,
  baseInput,
  okBorder,
  errBorder,
}: FieldTextProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-xs font-medium text-gray-600">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        id={id}
        type={type ?? 'text'}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${baseInput} ${error ? errBorder : okBorder}`}
        placeholder={placeholder}
      />
    </div>
  )
}

type ModeCardProps = {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  desc: string
  ariaControls: string
}

function ModeCard({ active, onClick, icon, title, desc, ariaControls }: ModeCardProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={ariaControls}
      onClick={onClick}
      className={[
        'group text-left rounded-2xl border p-5 sm:p-6 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/40',
        active
          ? 'border-emerald-400 bg-emerald-50/80 shadow-md shadow-emerald-500/15'
          : 'border-gray-200 bg-white hover:border-emerald-200 hover:shadow-md',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <span
          className={[
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            active ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100',
          ].join(' ')}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3 mb-1.5">
            <h3 className={`text-base sm:text-lg font-semibold ${active ? 'text-emerald-800' : 'text-gray-900'}`}>
              {title}
            </h3>
            {active && (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shrink-0">
                <IconCheck className="h-3 w-3" />
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">{desc}</p>
        </div>
      </div>
    </button>
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

function IconHelp({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 9a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 17h.01" />
    </svg>
  )
}

function IconDevice({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="2" y="4" width="14" height="11" rx="2" />
      <rect x="15" y="9" width="7" height="11" rx="1.5" />
      <path strokeLinecap="round" d="M2 18h7" />
    </svg>
  )
}

function IconSpark({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </svg>
  )
}

function IconBackpack({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6V4a3 3 0 016 0v2" />
      <rect x="5" y="6" width="14" height="15" rx="3" />
      <path strokeLinecap="round" d="M9 13h6M9 16h6" />
    </svg>
  )
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7L10 17L4 11" />
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
