import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../../context/AuthContext'
import { fetchKorisnikById, patchKorisnik } from '../../../services/users'
import { fetchMeProfile, updateMe, resendEmailVerification } from '../../../services/auth'
import { getMyGuideProfile } from '../../../services/guideProfiles'
import { computeProfileIncomplete } from '@beleg/shared'
import Dropdown from '../../../components/Dropdown'
import CalendarDropdown from '../../../components/CalendarDropdown'
import DatePartsSelect from '../../../components/DatePartsSelect'
import Loader from '../../../components/Loader'
import { ProfileCompletionCard } from '../../../components/profile/ProfileCompletionCard'
import { ProfilePrivacySection } from '../../../components/profile/ProfilePrivacySection'
import { ProfileGuideSettingsBlock } from '../../../components/profile/ProfileGuideSettingsBlock'
import { dateToYMD } from '../../../utils/dateUtils'
import {
  computeProfileCompletion,
  hasMembershipDocsFilled,
} from '../../../utils/profileCompletion'
import {
  PRIVACY_COPY,
  buildGuideSettingsBlock,
  mapGuideProfileToCompletionStatus,
  publicProfilePath,
  type GuideSettingsStatus,
} from '../../../utils/profileSettingsModel'
import { applyWebSettingsAuthRefresh } from '../../../utils/profileSettingsIntegration'
import {
  UserCircleIcon,
  PhoneIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  KeyIcon,
  ArrowLeftIcon,
  PencilSquareIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline'

function getErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { data?: { error?: string } } }).response
    if (response?.data?.error) return response.data.error
  }
  return fallback
}

const dateOnly = (s: string | undefined): string => {
  if (!s) return ''
  return s.slice(0, 10)
}

const initialForm = {
  username: '',
  fullName: '',
  imeRoditelja: '',
  pol: '',
  datumRodjenja: '',
  drzavljanstvo: '',
  adresa: '',
  telefon: '',
  email: '',
  brojLicnogDokumenta: '',
  brojPlaninarskeLegitimacije: '',
  brojPlaninarskeMarkice: '',
  datumUclanjenja: '',
  izreceneDisciplinskeKazne: '',
  izborUOrganeSportskogUdruzenja: '',
  napomene: '',
}

function PasswordInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  describedBy,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
  describedBy?: string
}) {
  const [visible, setVisible] = useState(false)
  const labelClass = 'block text-xs font-medium text-slate-500 mb-1.5'
  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500'
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-describedby={describedBy}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-700"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Sakrij lozinku' : 'Prikaži lozinku'}
        >
          {visible ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

export default function ProfileSettings() {
  const { t } = useTranslation('profileSettings')
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, isLoggedIn, login, refreshUser } = useAuth()
  const [form, setForm] = useState(initialForm)
  const [role, setRole] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string>('')
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [avatarActionsOpen, setAvatarActionsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [targetUsername, setTargetUsername] = useState('')
  const [emailVerified, setEmailVerified] = useState(false)
  const [klubNaziv, setKlubNaziv] = useState('')
  const [hasCover, setHasCover] = useState(false)
  const [hasAvatarRemote, setHasAvatarRemote] = useState(false)
  const [guideStatus, setGuideStatus] = useState<GuideSettingsStatus>('none')
  const [resendingEmail, setResendingEmail] = useState(false)
  const [baseline, setBaseline] = useState('')
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const submitLockRef = useRef(false)

  const isAdminEdit = !!id && (user?.role === 'superadmin' || user?.role === 'admin')
  const canEditAdminFields = user?.role === 'superadmin' || user?.role === 'admin'
  const mustCompleteProfile = !isAdminEdit && !!user?.profileIncomplete

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/home', { replace: true })
      return
    }
    if (id && user?.role !== 'superadmin' && user?.role !== 'admin') {
      navigate('/profil/podesavanja', { replace: true })
      return
    }

    if (isAdminEdit) {
      const fetchUser = async () => {
        try {
          const k = (await fetchKorisnikById(Number(id))) as {
            username?: string
            role?: string
            izrecene_disciplinske_kazne?: string
            izbor_u_organe_sportskog_udruzenja?: string
            napomene?: string
          }
          setForm({
            ...initialForm,
            username: k.username || '',
            izreceneDisciplinskeKazne: k.izrecene_disciplinske_kazne || '',
            izborUOrganeSportskogUdruzenja: k.izbor_u_organe_sportskog_udruzenja || '',
            napomene: k.napomene || '',
          })
          setRole(k.role || '')
          setTargetUsername(k.username || '')
        } catch (err: unknown) {
          setError(getErrorMessage(err, t('loadProfileError')))
        } finally {
          setLoading(false)
        }
      }
      fetchUser()
      return
    }

    const fetchMe = async () => {
      try {
        const k = (await fetchMeProfile()) as (Awaited<ReturnType<typeof fetchMeProfile>> & {
          ime_roditelja?: string
          drzavljanstvo?: string
          adresa?: string
          telefon?: string
          broj_licnog_dokumenta?: string
          broj_planinarske_legitimacije?: string
          broj_planinarske_markice?: string
          datum_uclanjenja?: string | null
          izrecene_disciplinske_kazne?: string
          izbor_u_organe_sportskog_udruzenja?: string
          napomene?: string
          klubNaziv?: string
          klubId?: number | null
          cover_image_url?: string
          avatar_url?: string
        }) | null
        if (!k) {
          setError(t('loadProfileError'))
          return
        }
        const nextForm = {
          username: k.username || '',
          fullName: k.fullName || '',
          imeRoditelja: k.ime_roditelja || '',
          pol: k.pol || '',
          datumRodjenja: dateOnly(k.datum_rodjenja ?? undefined),
          drzavljanstvo: k.drzavljanstvo || '',
          adresa: k.adresa || '',
          telefon: k.telefon || '',
          email: k.email || '',
          brojLicnogDokumenta: k.broj_licnog_dokumenta || '',
          brojPlaninarskeLegitimacije: k.broj_planinarske_legitimacije || '',
          brojPlaninarskeMarkice: k.broj_planinarske_markice || '',
          datumUclanjenja: dateOnly(k.datum_uclanjenja ?? undefined),
          izreceneDisciplinskeKazne: k.izrecene_disciplinske_kazne || '',
          izborUOrganeSportskogUdruzenja: k.izbor_u_organe_sportskog_udruzenja || '',
          napomene: k.napomene || '',
        }
        setForm(nextForm)
        setRole(k.role || '')
        setEmailVerified(!!k.email_verified_at)
        setKlubNaziv(k.klubNaziv || '')
        setHasCover(!!k.cover_image_url)
        setHasAvatarRemote(!!k.avatar_url)
        if (k.avatar_url) setAvatarPreview(k.avatar_url)
        setBaseline(JSON.stringify(nextForm))
        try {
          const gp = await getMyGuideProfile()
          setGuideStatus(mapGuideProfileToCompletionStatus(gp))
        } catch {
          setGuideStatus('none')
        }
      } catch (err: unknown) {
        setError(getErrorMessage(err, t('loadProfileError')))
      } finally {
        setLoading(false)
      }
    }

    fetchMe()
  }, [isLoggedIn, navigate, id, isAdminEdit, t, user?.role])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError(t('imageOnlyError'))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(t('imageTooLargeError'))
      return
    }
    setError('')
    setRemoveAvatar(false)
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    setAvatarActionsOpen(false)
    e.target.value = ''
  }

  const handleChooseAvatarFromGallery = () => {
    setAvatarActionsOpen(false)
    avatarInputRef.current?.click()
  }

  const handleRemoveAvatar = () => {
    setAvatarFile(null)
    setAvatarPreview('')
    setRemoveAvatar(true)
    setAvatarActionsOpen(false)
  }

  const hasAvatar = (!!avatarPreview || hasAvatarRemote) && !removeAvatar

  const completionInput = useMemo(
    () => ({
      fullName: form.fullName,
      username: form.username,
      email: form.email,
      emailVerified,
      hasAvatar,
      hasCover,
      hasClub: !!klubNaziv.trim(),
      hasMembershipDocs: hasMembershipDocsFilled({
        legitimacija: form.brojPlaninarskeLegitimacije,
        markica: form.brojPlaninarskeMarkice,
        licniDokument: form.brojLicnogDokumenta,
      }),
      guideStatus,
    }),
    [form, emailVerified, hasAvatar, hasCover, klubNaziv, guideStatus],
  )

  const completion = useMemo(() => computeProfileCompletion(completionInput), [completionInput])
  const guideBlock = useMemo(() => buildGuideSettingsBlock(guideStatus), [guideStatus])
  const publicPath = publicProfilePath(form.username)

  const isDirty = useMemo(() => {
    if (isAdminEdit) return true
    if (!baseline) return false
    if (JSON.stringify(form) !== baseline) return true
    if (newPassword || confirmPassword || currentPassword) return true
    if (avatarFile || removeAvatar) return true
    return false
  }, [isAdminEdit, baseline, form, newPassword, confirmPassword, currentPassword, avatarFile, removeAvatar])

  const handleResendEmail = async () => {
    const email = form.email.trim().toLowerCase()
    if (!email || resendingEmail) return
    setResendingEmail(true)
    setError('')
    setStatusMessage('')
    try {
      await resendEmailVerification(email)
      setStatusMessage('Potvrda je poslata na vaš email.')
      setTimeout(() => setStatusMessage(''), 3000)
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('saveProfileError')))
    } finally {
      setResendingEmail(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving || submitLockRef.current) return
    submitLockRef.current = true
    setError('')
    setSuccess(false)
    setStatusMessage('')
    setSaving(true)

    try {
      if (isAdminEdit) {
        if (newPassword !== confirmPassword) {
          setError(t('passwordMismatch'))
          return
        }
        if (newPassword && newPassword.length < 8) {
          setError(t('passwordTooShort'))
          return
        }
        const body: Record<string, string> = {}
        if (canEditAdminFields) {
          body.role = role
          body.izreceneDisciplinskeKazne = form.izreceneDisciplinskeKazne.trim()
          body.izborUOrganeSportskogUdruzenja = form.izborUOrganeSportskogUdruzenja.trim()
          body.napomene = form.napomene.trim()
        }
        if (newPassword) body.newPassword = newPassword
        const k = await fetchKorisnikById(Number(id))
        await patchKorisnik(Number(id), body)
        setSuccess(true)
        setTimeout(() => navigate(`/korisnik/${k.username}`, { replace: true }), 1500)
        return
      }

      if (newPassword !== confirmPassword) {
        setError(t('passwordMismatch'))
        return
      }
      if (!form.email.trim()) {
        setError('Email je obavezan da biste nastavili korišćenje aplikacije.')
        return
      }
      if (!form.pol.trim()) {
        setError('Pol je obavezan da biste nastavili korišćenje aplikacije.')
        return
      }
      if (!form.datumRodjenja) {
        setError('Datum rođenja je obavezan da biste nastavili korišćenje aplikacije.')
        return
      }
      if (newPassword && newPassword.length < 8) {
        setError(t('passwordTooShort'))
        return
      }
      if (newPassword && !currentPassword.trim()) {
        setError(t('currentPasswordRequired'))
        return
      }

      const formData = new FormData()
      formData.append('username', form.username.trim().toLowerCase())
      formData.append('fullName', form.fullName.trim())
      formData.append('imeRoditelja', form.imeRoditelja.trim())
      formData.append('pol', form.pol)
      formData.append('drzavljanstvo', form.drzavljanstvo.trim())
      formData.append('adresa', form.adresa.trim())
      formData.append('telefon', form.telefon.trim())
      formData.append('email', form.email.trim())
      formData.append('brojLicnogDokumenta', form.brojLicnogDokumenta.trim())
      formData.append('brojPlaninarskeLegitimacije', form.brojPlaninarskeLegitimacije.trim())
      formData.append('brojPlaninarskeMarkice', form.brojPlaninarskeMarkice.trim())
      if (form.datumRodjenja) formData.append('datumRodjenja', form.datumRodjenja)
      if (form.datumUclanjenja) formData.append('datumUclanjenja', form.datumUclanjenja)
      if (newPassword) {
        formData.append('newPassword', newPassword)
        formData.append('currentPassword', currentPassword)
      }
      if (avatarFile) formData.append('avatar', avatarFile)
      if (removeAvatar) formData.append('removeAvatar', '1')
      if (canEditAdminFields) {
        formData.append('izreceneDisciplinskeKazne', form.izreceneDisciplinskeKazne.trim())
        formData.append('izborUOrganeSportskogUdruzenja', form.izborUOrganeSportskogUdruzenja.trim())
        formData.append('napomene', form.napomene.trim())
      }

      const res = (await updateMe(formData)) as {
        role?: string
        user?: { username: string; fullName: string; avatar_url?: string; klubId?: number }
        token?: string
      }

      if (res?.role && res?.user) {
        login({
          role: res.role,
          user: res.user,
          token: typeof res.token === 'string' ? res.token : undefined,
        })
      }
      await applyWebSettingsAuthRefresh({ refreshUser })
      const me = await fetchMeProfile()
      const verifiedNow = !!me?.email_verified_at
      setEmailVerified(verifiedNow)
      if (me?.avatar_url) {
        setAvatarPreview(me.avatar_url)
        setHasAvatarRemote(true)
      } else if (removeAvatar) {
        setHasAvatarRemote(false)
        setAvatarPreview('')
      }
      setAvatarFile(null)
      setRemoveAvatar(false)
      setBaseline(JSON.stringify(form))
      setNewPassword('')
      setConfirmPassword('')
      setCurrentPassword('')
      setSuccess(true)

      const needsEmailVerification =
        !isAdminEdit && !!me && computeProfileIncomplete(me) && !verifiedNow
      if (needsEmailVerification) {
        const email = form.email.trim().toLowerCase()
        if (email) {
          try {
            await resendEmailVerification(email)
          } catch {
            // Korisnik i dalje ide na stranicu za potvrdu gde može ručno ponoviti slanje.
          }
        }
        setTimeout(
          () =>
            navigate('/registracija-email-provera', {
              replace: true,
              state: { email },
            }),
          1200,
        )
        return
      }
      const nextUsername = form.username.trim()
      setTimeout(
        () =>
          navigate(`/korisnik/${encodeURIComponent(nextUsername)}`, {
            replace: true,
            state: { refreshProfile: true },
          }),
        1500,
      )
    } catch (err: unknown) {
      setSuccess(false)
      setError(getErrorMessage(err, t('saveProfileError')))
    } finally {
      setSaving(false)
      submitLockRef.current = false
    }
  }

  const disabledInputClass =
    'w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm bg-slate-50 text-slate-500 cursor-not-allowed'
  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500'
  const labelClass = 'block text-xs font-medium text-slate-500 mb-1.5'
  const primaryBtnClass =
    'inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 hover:shadow transition-all disabled:opacity-50 disabled:hover:shadow-sm'
  const secondaryBtnClass =
    'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors'
  const adminCardClass = 'rounded-2xl bg-white shadow-sm ring-1 ring-black/5 overflow-visible'
  const adminCardHeaderClass = 'px-5 py-4 border-b border-slate-100/90'

  if (!isLoggedIn) return null
  if (loading) return <Loader />

  const backTo = isAdminEdit
    ? targetUsername
      ? `/korisnik/${targetUsername}`
      : id
        ? `/users/${id}`
        : '/users'
    : form.username
      ? `/korisnik/${form.username}`
      : user?.username
        ? `/korisnik/${user.username}`
        : '/home'

  const saveDisabled = saving || (!isAdminEdit && !isDirty)

  return (
    <div className="min-h-[60vh] bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      <div className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                to={backTo}
                className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5" />
                {t('back')}
              </Link>
              <div className="h-10 w-px bg-slate-200 hidden sm:block" />
              <div className="flex items-center gap-3.5">
                {!isAdminEdit ? (
                  <>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                      aria-label={t('chooseProfileImage')}
                    />
                    <div className="relative h-16 w-16 sm:h-20 sm:w-20 shrink-0">
                      <div className="h-full w-full rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-bold text-2xl overflow-hidden ring-2 ring-white shadow-md">
                        {avatarPreview ? (
                          <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span>{(form.fullName || form.username || '?').charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setAvatarActionsOpen(true)}
                        className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-700 hover:text-emerald-600 hover:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                        aria-label="Izmeni profilnu sliku"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-bold text-2xl shrink-0 overflow-hidden ring-2 ring-white shadow-md">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span>{(form.fullName || form.username || '?').charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                    {isAdminEdit ? t('userSettings') : t('profileSettings')}
                  </h1>
                  <p className="text-sm text-slate-500 mt-0.5 leading-snug">
                    {isAdminEdit ? t('adminSubtitle') : t('selfSubtitle')}
                  </p>
                </div>
              </div>
            </div>
            {!isAdminEdit && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  form="profile-settings-form"
                  disabled={saveDisabled}
                  aria-busy={saving}
                  aria-label={saving ? t('saving') : t('saveChanges')}
                  className={primaryBtnClass}
                >
                  {saving ? t('saving') : t('saveChanges')}
                </button>
                <Link to={backTo} className={secondaryBtnClass}>
                  {t('cancel')}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 pt-4 sm:px-6 lg:px-8" aria-live="polite" aria-atomic="true">
        {success && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200/80 px-4 py-3 text-sm font-medium text-emerald-800" role="status">
            {t('savedRedirecting')}
          </div>
        )}
        {statusMessage && !success ? (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200/80 px-4 py-3 text-sm font-medium text-emerald-800" role="status">
            {statusMessage}
          </div>
        ) : null}
        {error && (
          <div className="mt-2 rounded-xl bg-rose-50 border border-rose-200/80 px-4 py-3 text-sm text-rose-700" role="alert">
            {error}
          </div>
        )}
      </div>
      {mustCompleteProfile && (
        <div className="mx-auto max-w-3xl px-4 pt-4 sm:px-6 lg:px-8">
          <div className="rounded-xl bg-amber-50 border border-amber-200/80 px-4 py-3 text-sm text-amber-900">
            <p>
              Pre nastavka korišćenja aplikacije obavezno popunite i sačuvajte: email, pol i datum rođenja.
              {!emailVerified &&
                ' Nakon čuvanja, verifikacioni email će biti automatski poslat i bićete preusmereni na potvrdu emaila.'}
            </p>
          </div>
        </div>
      )}

      <form
        id="profile-settings-form"
        onSubmit={handleSubmit}
        className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8 pb-40 sm:pb-8"
      >
        {isAdminEdit ? (
          <div className="space-y-6">
            <div className={adminCardClass}>
              <div className={adminCardHeaderClass}>
                <div className="flex items-center gap-2">
                  <UserCircleIcon className="h-5 w-5 text-emerald-600" />
                  <h2 className="text-base font-semibold text-slate-900 tracking-tight">{t('role')}</h2>
                </div>
              </div>
              <div className="p-5">
                <Dropdown
                  aria-label={t('role')}
                  options={[
                    { value: 'clan', label: t('roles.clan') },
                    { value: 'admin', label: t('roles.admin') },
                    { value: 'vodic', label: t('roles.vodic') },
                    { value: 'blagajnik', label: t('roles.blagajnik') },
                    { value: 'sekretar', label: t('roles.sekretar') },
                    { value: 'menadzer-opreme', label: t('roles.menadzerOpreme') },
                  ]}
                  value={role}
                  onChange={setRole}
                  fullWidth
                />
              </div>
            </div>
            <div className={adminCardClass}>
              <div className={adminCardHeaderClass}>
                <div className="flex items-center gap-2">
                  <ClipboardDocumentListIcon className="h-5 w-5 text-emerald-600" />
                  <h2 className="text-base font-semibold text-slate-900 tracking-tight">{t('disciplineNotesTitle')}</h2>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className={labelClass}>{t('disciplinary')}</label>
                  <textarea
                    name="izreceneDisciplinskeKazne"
                    value={form.izreceneDisciplinskeKazne}
                    onChange={handleChange}
                    rows={3}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>{t('selectionBodies')}</label>
                  <textarea
                    name="izborUOrganeSportskogUdruzenja"
                    value={form.izborUOrganeSportskogUdruzenja}
                    onChange={handleChange}
                    rows={3}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>{t('notes')}</label>
                  <textarea name="napomene" value={form.napomene} onChange={handleChange} rows={3} className={inputClass} />
                </div>
              </div>
            </div>
            <div className={adminCardClass}>
              <div className={adminCardHeaderClass}>
                <div className="flex items-center gap-2">
                  <KeyIcon className="h-5 w-5 text-emerald-600" />
                  <h2 className="text-base font-semibold text-slate-900 tracking-tight">{t('setNewPassword')}</h2>
                </div>
                <p className="mt-1 text-xs text-slate-500">{t('leaveEmptyIfNoChange')}</p>
              </div>
              <div className="p-5 space-y-4">
                <PasswordInput
                  id="admin-new-password"
                  label={t('newPassword')}
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder={t('min8')}
                  autoComplete="new-password"
                />
                <PasswordInput
                  id="admin-confirm-password"
                  label={t('repeatPassword')}
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder={t('repeatPassword')}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className={primaryBtnClass}
              >
                {saving ? t('saving') : t('saveChanges')}
              </button>
              <Link to={backTo} className={secondaryBtnClass}>
                {t('cancel')}
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <ProfileCompletionCard input={completionInput} result={completion} />

            <ProfilePrivacySection
              id="public-profile"
              title="Javni profil"
              badge={PRIVACY_COPY.publicBadge}
              description={PRIVACY_COPY.publicHint}
              icon={<UserCircleIcon className="h-5 w-5 text-emerald-600" />}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="fullName" className={labelClass}>
                    {t('fullName')}
                  </label>
                  <input
                    id="fullName"
                    name="fullName"
                    value={form.fullName}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="username" className={labelClass}>
                    {t('username')}
                  </label>
                  <input
                    id="username"
                    name="username"
                    value={form.username}
                    onChange={handleChange}
                    required
                    className={inputClass}
                    placeholder={t('usernameUnique')}
                    autoComplete="username"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Profilna fotografija se menja preko dugmeta na slici iznad. Cover fotografija se uređuje na javnom
                profilu.
              </p>
              {publicPath ? (
                <Link
                  to={publicPath}
                  className="inline-flex text-sm font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
                >
                  {PRIVACY_COPY.publicProfileLink}
                </Link>
              ) : null}
            </ProfilePrivacySection>

            <ProfilePrivacySection
              id="private-contact"
              title="Kontakt i lični podaci"
              badge={PRIVACY_COPY.privateBadge}
              description={PRIVACY_COPY.privateHint}
              icon={<PhoneIcon className="h-5 w-5 text-emerald-600" />}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="email" className={labelClass}>
                    {t('email')}
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    className={inputClass}
                    required
                    autoComplete="email"
                    inputMode="email"
                  />
                </div>
                <div>
                  <label htmlFor="telefon" className={labelClass}>
                    {t('phone')}
                  </label>
                  <input
                    id="telefon"
                    name="telefon"
                    value={form.telefon}
                    onChange={handleChange}
                    className={inputClass}
                    autoComplete="tel"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="adresa" className={labelClass}>
                  {t('address')}
                </label>
                <input id="adresa" name="adresa" value={form.adresa} onChange={handleChange} className={inputClass} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="imeRoditelja" className={labelClass}>
                    {t('parentName')}
                  </label>
                  <input
                    id="imeRoditelja"
                    name="imeRoditelja"
                    value={form.imeRoditelja}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass} id="gender-label">
                    {t('gender')}
                  </label>
                  <Dropdown
                    aria-label={t('gender')}
                    options={[
                      { value: '', label: t('selectOption') },
                      { value: 'M', label: t('genderMale') },
                      { value: 'Ž', label: t('genderFemale') },
                    ]}
                    value={form.pol}
                    onChange={(v) => setForm((prev) => ({ ...prev, pol: v }))}
                    fullWidth
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>{t('birthDate')}</label>
                  <DatePartsSelect
                    ariaLabel={t('birthDate')}
                    value={form.datumRodjenja}
                    onChange={(v) => setForm((prev) => ({ ...prev, datumRodjenja: v }))}
                    placeholderDay={t('day')}
                    placeholderMonth={t('month')}
                    placeholderYear={t('year')}
                    minYear={1900}
                    maxYear={new Date().getFullYear()}
                  />
                </div>
                <div>
                  <label htmlFor="drzavljanstvo" className={labelClass}>
                    {t('citizenship')}
                  </label>
                  <input
                    id="drzavljanstvo"
                    name="drzavljanstvo"
                    value={form.drzavljanstvo}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              </div>
            </ProfilePrivacySection>

            <ProfilePrivacySection
              id="membership-docs"
              title="Planinarsko članstvo i dokumentacija"
              badge={PRIVACY_COPY.clubBadge}
              description={PRIVACY_COPY.clubHint}
              icon={<DocumentTextIcon className="h-5 w-5 text-emerald-600" />}
            >
              <div>
                <label htmlFor="klub" className={labelClass}>
                  Planinarski klub
                </label>
                <input
                  id="klub"
                  value={klubNaziv || 'Niste povezani sa klubom'}
                  readOnly
                  disabled
                  className={disabledInputClass}
                  aria-describedby="klub-hint"
                />
                <p id="klub-hint" className="mt-1 text-xs text-slate-500">
                  {PRIVACY_COPY.clubManagedHint}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="brojPlaninarskeLegitimacije" className={labelClass}>
                    {t('hikingCardNumber')}
                  </label>
                  <input
                    id="brojPlaninarskeLegitimacije"
                    name="brojPlaninarskeLegitimacije"
                    value={form.brojPlaninarskeLegitimacije}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="brojPlaninarskeMarkice" className={labelClass}>
                    {t('hikingBadgeNumber')}
                  </label>
                  <input
                    id="brojPlaninarskeMarkice"
                    name="brojPlaninarskeMarkice"
                    value={form.brojPlaninarskeMarkice}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="brojLicnogDokumenta" className={labelClass}>
                    {t('idDocumentNumber')}
                  </label>
                  <input
                    id="brojLicnogDokumenta"
                    name="brojLicnogDokumenta"
                    value={form.brojLicnogDokumenta}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>{t('membershipDate')}</label>
                  <CalendarDropdown
                    value={form.datumUclanjenja}
                    onChange={(v) => setForm((prev) => ({ ...prev, datumUclanjenja: v }))}
                    placeholder={t('chooseDate')}
                    fullWidth
                    aria-label={t('membershipDate')}
                    minDate="1900-01-01"
                    maxDate={dateToYMD(new Date())}
                  />
                </div>
              </div>
              <div className="space-y-4 border-t border-slate-100 pt-4">
                <div className="flex items-center gap-2">
                  <ClipboardDocumentListIcon className="h-5 w-5 text-emerald-600" />
                  <h3 className="text-sm font-semibold text-slate-900">{t('disciplineNotesTitle')}</h3>
                </div>
                {!canEditAdminFields && (
                  <p className="text-xs text-slate-500" id="discipline-admin-hint">
                    {t('adminOnlyFields')} {PRIVACY_COPY.clubManagedHint}
                  </p>
                )}
                <div>
                  <label htmlFor="izreceneDisciplinskeKazne" className={labelClass}>
                    {t('disciplinary')}
                  </label>
                  <textarea
                    id="izreceneDisciplinskeKazne"
                    name="izreceneDisciplinskeKazne"
                    value={form.izreceneDisciplinskeKazne}
                    onChange={handleChange}
                    rows={3}
                    readOnly={!canEditAdminFields}
                    disabled={!canEditAdminFields}
                    aria-describedby={!canEditAdminFields ? 'discipline-admin-hint' : undefined}
                    className={canEditAdminFields ? inputClass : disabledInputClass}
                  />
                </div>
                <div>
                  <label htmlFor="izborUOrganeSportskogUdruzenja" className={labelClass}>
                    {t('selectionBodies')}
                  </label>
                  <textarea
                    id="izborUOrganeSportskogUdruzenja"
                    name="izborUOrganeSportskogUdruzenja"
                    value={form.izborUOrganeSportskogUdruzenja}
                    onChange={handleChange}
                    rows={3}
                    readOnly={!canEditAdminFields}
                    disabled={!canEditAdminFields}
                    className={canEditAdminFields ? inputClass : disabledInputClass}
                  />
                </div>
                <div>
                  <label htmlFor="napomene" className={labelClass}>
                    {t('notes')}
                  </label>
                  <textarea
                    id="napomene"
                    name="napomene"
                    value={form.napomene}
                    onChange={handleChange}
                    rows={3}
                    readOnly={!canEditAdminFields}
                    disabled={!canEditAdminFields}
                    className={canEditAdminFields ? inputClass : disabledInputClass}
                  />
                </div>
              </div>
            </ProfilePrivacySection>

            {guideBlock ? <ProfileGuideSettingsBlock model={guideBlock} /> : null}

            <ProfilePrivacySection
              id="account-security"
              title="Nalog i sigurnost"
              icon={<KeyIcon className="h-5 w-5 text-emerald-600" />}
            >
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1.5">Status potvrde emaila</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      emailVerified
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                        : 'bg-amber-50 text-amber-900 border border-amber-200/80'
                    }`}
                  >
                    {emailVerified ? 'Email je potvrđen' : 'Email nije potvrđen'}
                  </span>
                  {!emailVerified && form.email.trim() ? (
                    <button
                      type="button"
                      onClick={() => void handleResendEmail()}
                      disabled={resendingEmail || saving}
                      className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-50 transition-colors"
                    >
                      {resendingEmail ? 'Šaljem…' : 'Pošalji ponovo potvrdu'}
                    </button>
                  ) : null}
                </div>
              </div>
              <div>
                <label htmlFor="role-ro" className={labelClass}>
                  {t('role')}
                </label>
                <input id="role-ro" value={role} readOnly disabled className={disabledInputClass} />
              </div>
              <PasswordInput
                id="current-password"
                label={t('currentPassword')}
                value={currentPassword}
                onChange={setCurrentPassword}
                placeholder={t('currentPasswordHint')}
                autoComplete="current-password"
              />
              <PasswordInput
                id="new-password"
                label={t('newPasswordLeaveEmpty')}
                value={newPassword}
                onChange={setNewPassword}
                placeholder={t('min8')}
                autoComplete="new-password"
              />
              <PasswordInput
                id="confirm-password"
                label={t('repeatPassword')}
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder={t('repeatPassword')}
                autoComplete="new-password"
              />
            </ProfilePrivacySection>

            {/* Iznad AppLayoutMobileBottomBar (md:hidden, ~4rem) da „Sačuvaj“ ne bude ispod nava */}
            <div className="fixed inset-x-0 bottom-16 z-30 border-t border-slate-200/80 bg-white/90 p-3 backdrop-blur-md sm:static sm:inset-auto sm:bottom-auto sm:z-auto sm:mt-2 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
              <div className="mx-auto flex max-w-3xl flex-wrap gap-3 sm:mx-0">
                <button
                  type="submit"
                  disabled={saveDisabled}
                  aria-busy={saving}
                  aria-label={saving ? t('saving') : t('saveChanges')}
                  className={`${primaryBtnClass} flex-1 sm:flex-none`}
                >
                  {saving ? t('saving') : t('saveChanges')}
                </button>
                <Link to={backTo} className={`${secondaryBtnClass} flex-1 sm:flex-none`}>
                  {t('cancel')}
                </Link>
              </div>
            </div>
          </div>
        )}
      </form>

      {!isAdminEdit && avatarActionsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl ring-1 ring-black/5">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">Promena profilne slike</h3>
              <p className="mt-1 text-sm text-slate-500">Izaberite šta želite da uradite.</p>
            </div>
            <div className="p-4 space-y-2">
              <button
                type="button"
                onClick={handleChooseAvatarFromGallery}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors"
              >
                Dodaj iz galerije
              </button>
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-left text-sm font-medium text-rose-700 hover:bg-rose-100 transition-colors"
              >
                Ukloni profilnu
              </button>
            </div>
            <div className="px-4 pb-4">
              <button
                type="button"
                onClick={() => setAvatarActionsOpen(false)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Otkaži
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
