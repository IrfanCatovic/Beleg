import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../../context/AuthContext'
import api from '../../../services/api'
import Dropdown from '../../../components/Dropdown'
import CalendarDropdown from '../../../components/CalendarDropdown'
import DatePartsSelect from '../../../components/DatePartsSelect'
import Loader from '../../../components/Loader'
import { dateToYMD } from '../../../utils/dateUtils'
import {
  UserCircleIcon,
  IdentificationIcon,
  PhoneIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  KeyIcon,
  ArrowLeftIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline'

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

export default function ProfileSettings() {
  const { t } = useTranslation('profileSettings')
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, isLoggedIn, login, refreshUser } = useAuth()
  const [form, setForm] = useState(initialForm)
  const [role, setRole] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string>('')
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [avatarActionsOpen, setAvatarActionsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [targetUsername, setTargetUsername] = useState('')
  const [emailVerified, setEmailVerified] = useState(false)
  const [sendingVerification, setSendingVerification] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const isAdminEdit = !!id && (user?.role === 'superadmin' || user?.role === 'admin')
  const canEditAdminFields = user?.role === 'superadmin' || user?.role === 'admin'
  const mustCompleteProfile = !isAdminEdit && !!user?.profileIncomplete

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/home', { replace: true })
      return
    }
    // Samo admin/superadmin mogu pristupiti /profil/podesavanja/:id
    if (id && user?.role !== 'superadmin' && user?.role !== 'admin') {
      navigate('/profil/podesavanja', { replace: true })
      return
    }

    // Admin/superadmin uređuju drugog korisnika
    if (isAdminEdit) {
      const fetchUser = async () => {
        try {
          const res = await api.get(`/api/korisnici/${id}`)
          const k = res.data
          setForm({
            ...initialForm,
            username: k.username || '',
            izreceneDisciplinskeKazne: k.izrecene_disciplinske_kazne || '',
            izborUOrganeSportskogUdruzenja: k.izbor_u_organe_sportskog_udruzenja || '',
            napomene: k.napomene || '',
          })
          setRole(k.role || '')
          setTargetUsername(k.username || '')
        } catch (err: any) {
          setError(err.response?.data?.error || t('loadProfileError'))
        } finally {
          setLoading(false)
        }
      }
      fetchUser()
      return
    }

    // Uobičajeno: korisnik menja svoj profil
    const fetchMe = async () => {
      try {
        const res = await api.get('/api/me')
        const k = res.data
        setForm({
          username: k.username || '',
          fullName: k.fullName || '',
          imeRoditelja: k.ime_roditelja || '',
          pol: k.pol || '',
          datumRodjenja: dateOnly(k.datum_rodjenja),
          drzavljanstvo: k.drzavljanstvo || '',
          adresa: k.adresa || '',
          telefon: k.telefon || '',
          email: k.email || '',
          brojLicnogDokumenta: k.broj_licnog_dokumenta || '',
          brojPlaninarskeLegitimacije: k.broj_planinarske_legitimacije || '',
          brojPlaninarskeMarkice: k.broj_planinarske_markice || '',
          datumUclanjenja: dateOnly(k.datum_uclanjenja),
          izreceneDisciplinskeKazne: k.izrecene_disciplinske_kazne || '',
          izborUOrganeSportskogUdruzenja: k.izbor_u_organe_sportskog_udruzenja || '',
          napomene: k.napomene || '',
        })
        setRole(k.role || '')
        setEmailVerified(!!k.email_verified_at)
        if (k.avatar_url) setAvatarPreview(k.avatar_url)
      } catch (err: any) {
        setError(err.response?.data?.error || t('loadProfileError'))
      } finally {
        setLoading(false)
      }
    }

    fetchMe()
  }, [isLoggedIn, navigate, id, isAdminEdit])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setSaving(true)

    try {
      if (isAdminEdit) {
        if (newPassword !== confirmPassword) {
          setError(t('passwordMismatch'))
          setSaving(false)
          return
        }
        if (newPassword && newPassword.length < 8) {
          setError(t('passwordTooShort'))
          setSaving(false)
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
        const res = await api.get(`/api/korisnici/${id}`)
        const k = res.data as { username: string }
        await api.patch(`/api/korisnici/${id}`, body)
        setSuccess(true)
        setTimeout(() => navigate(`/korisnik/${k.username}`, { replace: true }), 1500)
        return
      }

      if (newPassword !== confirmPassword) {
        setError(t('passwordMismatch'))
        setSaving(false)
        return
      }
      if (!form.email.trim()) {
        setError('Email je obavezan da biste nastavili korišćenje aplikacije.')
        setSaving(false)
        return
      }
      if (!form.pol.trim()) {
        setError('Pol je obavezan da biste nastavili korišćenje aplikacije.')
        setSaving(false)
        return
      }
      if (!form.datumRodjenja) {
        setError('Datum rođenja je obavezan da biste nastavili korišćenje aplikacije.')
        setSaving(false)
        return
      }
      if (newPassword && newPassword.length < 8) {
        setError(t('passwordTooShort'))
        setSaving(false)
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
      if (newPassword) formData.append('newPassword', newPassword)
      if (avatarFile) formData.append('avatar', avatarFile)
      if (removeAvatar) formData.append('removeAvatar', '1')
      if (canEditAdminFields) {
        formData.append('izreceneDisciplinskeKazne', form.izreceneDisciplinskeKazne.trim())
        formData.append('izborUOrganeSportskogUdruzenja', form.izborUOrganeSportskogUdruzenja.trim())
        formData.append('napomene', form.napomene.trim())
      }

      const res = await api.patch('/api/me', formData)

      if (res.data?.role && res.data?.user) {
        login({
          role: res.data.role,
          user: res.data.user,
          token: typeof res.data.token === 'string' ? res.data.token : undefined,
        })
      }
      await refreshUser()
      const meRes = await api.get('/api/me')
      const verifiedNow = !!meRes.data?.email_verified_at
      setEmailVerified(verifiedNow)

      setSuccess(true)
      if (mustCompleteProfile && !verifiedNow) {
        const email = form.email.trim().toLowerCase()
        if (email) {
          try {
            await api.post('/api/email/resend', { email })
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
      setTimeout(() => navigate(`/korisnik/${form.username}`, { replace: true }), 1500)
    } catch (err: any) {
      setError(err.response?.data?.error || t('saveProfileError'))
    } finally {
      setSaving(false)
    }
  }

  const handleResendVerification = async () => {
    const email = form.email.trim().toLowerCase()
    if (!email) {
      setError('Unesite email i sačuvajte profil pre slanja verifikacije.')
      return
    }
    setSendingVerification(true)
    setError('')
    try {
      await api.post('/api/email/resend', { email })
      navigate('/registracija-email-provera', { replace: false, state: { email } })
    } catch (err: any) {
      setError(err.response?.data?.error || 'Slanje verifikacionog emaila nije uspelo.')
    } finally {
      setSendingVerification(false)
    }
  }

  const disabledInputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-100 text-gray-600 cursor-not-allowed'
  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500'
  const labelClass = 'block text-xs font-medium text-gray-500 mb-1'

  if (!isLoggedIn) return null
  if (loading) return <Loader />

  const backTo = isAdminEdit
    ? (targetUsername ? `/korisnik/${targetUsername}` : id ? `/users/${id}` : '/users')
    : (form.username ? `/korisnik/${form.username}` : user?.username ? `/korisnik/${user.username}` : '/home')

  return (
    <div className="min-h-[60vh] bg-gradient-to-b from-gray-50 to-white">
      {/* Hero */}
      <div className="border-b border-gray-200/80 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                to={backTo}
                className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                <ArrowLeftIcon className="h-5 w-5" />
                {t('back')}
              </Link>
              <div className="h-14 w-px bg-gray-200 hidden sm:block" />
              <div className="flex items-center gap-4">
                {/* Profilna slika – hover: potamni + ikonica olovke, klik otvara izbor fajla (samo za sopstveni profil) */}
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
                      <div className="h-full w-full rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-bold text-2xl overflow-hidden">
                        {avatarPreview ? (
                          <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span>{(form.fullName || form.username || '?').charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setAvatarActionsOpen(true)}
                        className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center text-gray-700 hover:text-emerald-600 hover:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                        aria-label="Izmeni profilnu sliku"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-bold text-2xl shrink-0 overflow-hidden">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span>{(form.fullName || form.username || '?').charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    {isAdminEdit ? t('userSettings') : t('profileSettings')}
                  </h1>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {isAdminEdit ? t('adminSubtitle') : t('selfSubtitle')}
                  </p>
                </div>
              </div>
            </div>
            {!isAdminEdit && (
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  form="profile-settings-form"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"
                >
                  {saving ? t('saving') : t('saveChanges')}
                </button>
                <Link
                  to={backTo}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {t('cancel')}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {success && (
        <div className="mx-auto max-w-5xl px-4 pt-4 sm:px-6 lg:px-8">
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-medium text-emerald-800">
            {t('savedRedirecting')}
          </div>
        </div>
      )}
      {error && (
        <div className="mx-auto max-w-5xl px-4 pt-4 sm:px-6 lg:px-8">
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</div>
        </div>
      )}
      {mustCompleteProfile && (
        <div className="mx-auto max-w-5xl px-4 pt-4 sm:px-6 lg:px-8">
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Pre nastavka korišćenja aplikacije obavezno popunite i sačuvajte: email, pol i datum rođenja.
              {!emailVerified && ' Nakon toga morate i da potvrdite email adresu.'}
            </p>
            {!emailVerified && (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={sendingVerification}
                className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60"
              >
                {sendingVerification ? 'Šaljem...' : 'Pošalji verifikacioni email'}
              </button>
            )}
          </div>
        </div>
      )}

      <form id="profile-settings-form" onSubmit={handleSubmit} className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Admin edit: uloga + disciplinske + opcioni reset lozinke (samo superadmin efektivno prolazi backend proveru) */}
          {isAdminEdit ? (
            <div className="space-y-6">
                  <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80">
                      <div className="flex items-center gap-2">
                        <UserCircleIcon className="h-5 w-5 text-emerald-600" />
                        <h2 className="text-base font-semibold text-gray-900">{t('role')}</h2>
                      </div>
                    </div>
                    <div className="p-5">
                      <Dropdown aria-label={t('role')} options={[{ value: 'clan', label: t('roles.clan') }, { value: 'admin', label: t('roles.admin') }, { value: 'vodic', label: t('roles.vodic') }, { value: 'blagajnik', label: t('roles.blagajnik') }, { value: 'sekretar', label: t('roles.sekretar') }, { value: 'menadzer-opreme', label: t('roles.menadzerOpreme') }]} value={role} onChange={setRole} fullWidth />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-visible">
                    <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80">
                      <div className="flex items-center gap-2">
                        <ClipboardDocumentListIcon className="h-5 w-5 text-emerald-600" />
                        <h2 className="text-base font-semibold text-gray-900">{t('disciplineNotesTitle')}</h2>
                      </div>
                    </div>
                    <div className="p-5 space-y-4">
                      <div>
                        <label className={labelClass}>{t('disciplinary')}</label>
                        <textarea name="izreceneDisciplinskeKazne" value={form.izreceneDisciplinskeKazne} onChange={handleChange} rows={3} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>{t('selectionBodies')}</label>
                        <textarea name="izborUOrganeSportskogUdruzenja" value={form.izborUOrganeSportskogUdruzenja} onChange={handleChange} rows={3} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>{t('notes')}</label>
                        <textarea name="napomene" value={form.napomene} onChange={handleChange} rows={3} className={inputClass} />
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-visible">
                    <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80">
                      <div className="flex items-center gap-2">
                        <KeyIcon className="h-5 w-5 text-emerald-600" />
                        <h2 className="text-base font-semibold text-gray-900">{t('setNewPassword')}</h2>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{t('leaveEmptyIfNoChange')}</p>
                    </div>
                    <div className="p-5 space-y-4">
                      <div>
                        <label className={labelClass}>{t('newPassword')}</label>
                        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} placeholder={t('min8')} minLength={8} autoComplete="new-password" />
                      </div>
                      <div>
                        <label className={labelClass}>{t('repeatPassword')}</label>
                        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} placeholder={t('repeatPassword')} autoComplete="new-password" />
                      </div>
                    </div>
                  </div>
              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50">
                  {saving ? t('saving') : t('saveChanges')}
                </button>
                <Link to={backTo} className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  {t('cancel')}
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Nalog */}
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-visible">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80">
                  <div className="flex items-center gap-2">
                    <UserCircleIcon className="h-5 w-5 text-emerald-600" />
                    <h2 className="text-base font-semibold text-gray-900">{t('account')}</h2>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className={labelClass}>{t('username')}</label>
                    <input name="username" value={form.username} onChange={handleChange} required className={inputClass} placeholder={t('usernameUnique')} />
                  </div>
                  <div>
                    <label className={labelClass}>{t('role')}</label>
                    <input value={role} readOnly disabled className={disabledInputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>{t('newPasswordLeaveEmpty')}</label>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} placeholder={t('min8')} minLength={8} autoComplete="new-password" />
                  </div>
                  <div>
                    <label className={labelClass}>{t('repeatPassword')}</label>
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} placeholder={t('repeatPassword')} autoComplete="new-password" />
                  </div>
                </div>
              </div>

              {/* Lični podaci */}
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-visible">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80">
                  <div className="flex items-center gap-2">
                    <IdentificationIcon className="h-5 w-5 text-emerald-600" />
                    <h2 className="text-base font-semibold text-gray-900">{t('personalData')}</h2>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>{t('fullName')}</label>
                      <input name="fullName" value={form.fullName} onChange={handleChange} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>{t('parentName')}</label>
                      <input name="imeRoditelja" value={form.imeRoditelja} onChange={handleChange} className={inputClass} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>{t('gender')}</label>
                      <Dropdown aria-label={t('gender')} options={[{ value: '', label: t('selectOption') }, { value: 'M', label: t('genderMale') }, { value: 'Ž', label: t('genderFemale') }]} value={form.pol} onChange={(v) => setForm((prev) => ({ ...prev, pol: v }))} fullWidth />
                    </div>
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
                  </div>
                  <div>
                    <label className={labelClass}>{t('citizenship')}</label>
                    <input name="drzavljanstvo" value={form.drzavljanstvo} onChange={handleChange} className={inputClass} />
                  </div>
                </div>
              </div>

              {/* Kontakt */}
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-visible">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80">
                  <div className="flex items-center gap-2">
                    <PhoneIcon className="h-5 w-5 text-emerald-600" />
                    <h2 className="text-base font-semibold text-gray-900">{t('contact')}</h2>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>{t('email')}</label>
                      <input name="email" type="email" value={form.email} onChange={handleChange} className={inputClass} required />
                    </div>
                    <div>
                      <label className={labelClass}>{t('phone')}</label>
                      <input name="telefon" value={form.telefon} onChange={handleChange} className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>{t('address')}</label>
                    <input name="adresa" value={form.adresa} onChange={handleChange} className={inputClass} />
                  </div>
                </div>
              </div>

              {/* Dokumenti i planinarski */}
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-visible">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80">
                  <div className="flex items-center gap-2">
                    <DocumentTextIcon className="h-5 w-5 text-emerald-600" />
                    <h2 className="text-base font-semibold text-gray-900">{t('documentsAndHiking')}</h2>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>{t('idDocumentNumber')}</label>
                      <input name="brojLicnogDokumenta" value={form.brojLicnogDokumenta} onChange={handleChange} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>{t('hikingCardNumber')}</label>
                      <input name="brojPlaninarskeLegitimacije" value={form.brojPlaninarskeLegitimacije} onChange={handleChange} className={inputClass} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>{t('hikingBadgeNumber')}</label>
                      <input name="brojPlaninarskeMarkice" value={form.brojPlaninarskeMarkice} onChange={handleChange} className={inputClass} />
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
                </div>
              </div>

              {/* Disciplinske, napomene */}
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-visible lg:col-span-2">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80">
                  <div className="flex items-center gap-2">
                    <ClipboardDocumentListIcon className="h-5 w-5 text-emerald-600" />
                    <h2 className="text-base font-semibold text-gray-900">{t('disciplineNotesTitle')}</h2>
                  </div>
                  {!canEditAdminFields && <p className="mt-1 text-xs text-gray-500">{t('adminOnlyFields')}</p>}
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className={labelClass}>{t('disciplinary')}</label>
                    <textarea name="izreceneDisciplinskeKazne" value={form.izreceneDisciplinskeKazne} onChange={handleChange} rows={3} readOnly={!canEditAdminFields} disabled={!canEditAdminFields} className={canEditAdminFields ? inputClass : disabledInputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>{t('selectionBodies')}</label>
                    <textarea name="izborUOrganeSportskogUdruzenja" value={form.izborUOrganeSportskogUdruzenja} onChange={handleChange} rows={3} readOnly={!canEditAdminFields} disabled={!canEditAdminFields} className={canEditAdminFields ? inputClass : disabledInputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>{t('notes')}</label>
                    <textarea name="napomene" value={form.napomene} onChange={handleChange} rows={3} readOnly={!canEditAdminFields} disabled={!canEditAdminFields} className={canEditAdminFields ? inputClass : disabledInputClass} />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 lg:col-span-2 sm:hidden">
                <button type="submit" disabled={saving} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50">
                  {saving ? t('saving') : t('saveChanges')}
                </button>
                <Link to={backTo} className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  {t('cancel')}
                </Link>
              </div>
            </div>
          )}
        </form>
      {!isAdminEdit && avatarActionsOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Promena profilne slike</h3>
              <p className="mt-1 text-sm text-gray-500">Izaberite šta želite da uradite.</p>
            </div>
            <div className="p-4 space-y-2">
              <button
                type="button"
                onClick={handleChooseAvatarFromGallery}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-left text-sm font-medium text-gray-800 hover:bg-gray-50"
              >
                Dodaj iz galerije
              </button>
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-left text-sm font-medium text-rose-700 hover:bg-rose-100"
              >
                Ukloni profilnu
              </button>
            </div>
            <div className="px-4 pb-4">
              <button
                type="button"
                onClick={() => setAvatarActionsOpen(false)}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
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
