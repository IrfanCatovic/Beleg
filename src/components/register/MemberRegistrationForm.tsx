import { useState } from 'react'
import api from '../../services/api'
import { registerMemberByInvite } from '../../services/invite'
import Dropdown from '../Dropdown'
import { useTranslation } from 'react-i18next'

const baseInitial = {
  username: '',
  password: '',
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

type BaseForm = typeof baseInitial

type StaffForm = BaseForm & { role: string }

function staffInitial(): StaffForm {
  return { ...baseInitial, role: '' }
}

function baseFormOnly(): BaseForm {
  return { ...baseInitial }
}

const usernameCharsetRegex = /^[a-zA-Z0-9._]+$/

function validateUsername(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return 'Korisničko ime je obavezno.'
  if (/\s/.test(trimmed)) return 'Korisničko ime ne sme sadržati razmake.'
  if (!usernameCharsetRegex.test(trimmed)) {
    return 'Dozvoljena su samo slova, brojevi, tačka i donja crta (bez razmaka, crtica i drugih znakova).'
  }
  const lower = trimmed.toLowerCase()
  if (lower.length < 2 || lower.length > 30) return 'Korisničko ime mora imati između 2 i 30 karaktera.'
  if (lower.startsWith('.') || lower.endsWith('.') || lower.startsWith('_') || lower.endsWith('_')) {
    return 'Korisničko ime ne sme počinjati niti završavati tačkom ili donjom crtom.'
  }
  if (lower.includes('..') || lower.includes('__') || lower.includes('._') || lower.includes('_.')) {
    return 'Korisničko ime ne sme imati uzastopne specijalne znakove.'
  }
  return null
}

type MemberRegistrationFormProps =
  | {
      variant: 'staff'
      roleOptions: string[]
      onSuccess: () => void
    }
  | {
      variant: 'invite'
      inviteCode: string
      klubId: number
      klubNaziv?: string
      onSuccess: () => void
    }

export default function MemberRegistrationForm(props: MemberRegistrationFormProps) {
  const { t } = useTranslation('setup')
  const { t: tInvite } = useTranslation('invite')
  const [form, setForm] = useState<StaffForm | BaseForm>(() =>
    props.variant === 'staff' ? staffInitial() : baseFormOnly(),
  )
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const isStaff = props.variant === 'staff'
  const roleOptions = isStaff ? props.roleOptions : []

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError(t('registerUser.imageOnlyError'))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(t('registerUser.imageTooLargeError'))
      return
    }
    setError('')
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    const usernameError = validateUsername(form.username)
    if (usernameError) {
      setError(usernameError)
      return
    }

    const role = isStaff ? (form as StaffForm).role.trim() : 'clan'
    if (isStaff && !role) {
      setError(t('registerUser.pickRole'))
      return
    }

    const em = form.email.trim()
    if (!em) {
      setError(tInvite('registerForm.emailRequired'))
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      setError(tInvite('registerForm.emailInvalid'))
      return
    }

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('username', form.username.trim().toLowerCase())
      formData.append('password', form.password)
      formData.append('role', role)

      const optional: (keyof BaseForm)[] = [
        'fullName', 'imeRoditelja', 'pol', 'datumRodjenja', 'drzavljanstvo',
        'adresa', 'telefon', 'email', 'brojLicnogDokumenta',
        'brojPlaninarskeLegitimacije', 'brojPlaninarskeMarkice', 'datumUclanjenja',
        'izreceneDisciplinskeKazne', 'izborUOrganeSportskogUdruzenja', 'napomene',
      ]
      optional.forEach((key) => {
        const val = form[key]?.trim()
        if (val) formData.append(key, val)
      })

      if (avatarFile) formData.append('avatar', avatarFile)

      if (!isStaff) {
        formData.append('inviteCode', props.inviteCode)
        formData.append('klubId', String(props.klubId))
        await registerMemberByInvite(formData)
      } else {
        await api.post('/api/register', formData)
      }

      setSuccess(true)
      setTimeout(() => props.onSuccess(), 2000)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || t('registerUser.createError'))
    } finally {
      setSubmitting(false)
    }
  }

  const labelClass = 'block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-[0.16em]'
  const inputClass =
    'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 outline-none transition'
  const sectionClass = 'space-y-4'

  const successMsg = isStaff ? t('registerUser.createdRedirecting') : tInvite('registerForm.successRedirect')
  const footerHint = isStaff ? t('registerUser.footerHint') : tInvite('registerForm.footerHint')

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 lg:p-7 space-y-6 sm:space-y-7"
    >
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs sm:text-sm text-emerald-700 text-center font-medium">
          {successMsg}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs sm:text-sm text-rose-700">
          {error}
        </div>
      )}

      {!isStaff && (
        <>
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-600 mb-1">
              {tInvite('registerForm.badge')}
            </p>
            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-gray-900">{tInvite('registerForm.title')}</h2>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-900">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 mb-0.5">
              {tInvite('registerForm.clubLabel')}
            </p>
            <p className="font-semibold">{props.klubNaziv ?? `ID ${props.klubId}`}</p>
            <p className="mt-2 text-xs text-emerald-800/90">{tInvite('registerForm.hintLine')}</p>
          </div>
        </>
      )}

      <div className={sectionClass}>
        <h3 className="text-xs sm:text-sm font-semibold text-gray-900 uppercase tracking-[0.18em] mb-2">
          {t('registerUser.requiredFields')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          <div className="sm:col-span-2">
            <label className={labelClass}>{t('registerUser.usernameRequired')}</label>
            <input
              name="username"
              value={form.username}
              onChange={handleChange}
              required
              minLength={2}
              maxLength={30}
              pattern="^[a-zA-Z0-9._]+$"
              title="Dozvoljena su slova (mala i velika), brojevi, tačka i donja crta; bez razmaka."
              className={inputClass}
              placeholder={t('registerUser.usernamePlaceholder')}
              disabled={submitting || success}
            />
          </div>
          <div>
            <label className={labelClass}>{t('registerUser.passwordRequired')}</label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              required
              minLength={8}
              className={inputClass}
              placeholder={t('registerUser.passwordPlaceholder')}
              disabled={submitting || success}
            />
          </div>
          {isStaff && (
            <div>
              <label className={labelClass}>{t('registerUser.roleRequired')}</label>
              <Dropdown
                aria-label={t('registerUser.roleRequired')}
                options={[
                  { value: '', label: t('registerUser.pick') },
                  ...roleOptions.map((role) => ({
                    value: role,
                    label: role.charAt(0).toUpperCase() + role.slice(1).replace('-', ' '),
                  })),
                ]}
                value={(form as StaffForm).role}
                onChange={(v) => setForm((prev) => ({ ...prev, role: v }))}
                fullWidth
              />
            </div>
          )}
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className="text-xs sm:text-sm font-semibold text-gray-900 uppercase tracking-[0.18em] mb-2">
          {t('registerUser.personalOptional')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          <div>
            <label className={labelClass}>{t('registerUser.fullName')}</label>
            <input
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              className={inputClass}
              placeholder={t('registerUser.fullNamePlaceholder')}
              disabled={submitting || success}
            />
          </div>
          <div>
            <label className={labelClass}>{t('registerUser.parentName')}</label>
            <input
              name="imeRoditelja"
              value={form.imeRoditelja}
              onChange={handleChange}
              className={inputClass}
              disabled={submitting || success}
            />
          </div>
          <div>
            <label className={labelClass}>{t('registerUser.gender')}</label>
            <Dropdown
              aria-label={t('registerUser.gender')}
              options={[
                { value: '', label: t('registerUser.pick') },
                { value: 'M', label: t('registerUser.genderMale') },
                { value: 'Ž', label: t('registerUser.genderFemale') },
              ]}
              value={form.pol}
              onChange={(v) => setForm((prev) => ({ ...prev, pol: v }))}
              fullWidth
            />
          </div>
          <div>
            <label className={labelClass}>{t('registerUser.birthDate')}</label>
            <input
              name="datumRodjenja"
              type="date"
              value={form.datumRodjenja}
              onChange={handleChange}
              className={inputClass}
              disabled={submitting || success}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>{t('registerUser.citizenship')}</label>
            <input
              name="drzavljanstvo"
              value={form.drzavljanstvo}
              onChange={handleChange}
              className={inputClass}
              disabled={submitting || success}
            />
          </div>
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className="text-xs sm:text-sm font-semibold text-gray-900 uppercase tracking-[0.18em] mb-2">
          {t('registerUser.contactOptional')}
        </h3>
        <p className="text-xs text-emerald-700 -mt-1 mb-2">{tInvite('registerForm.emailRequired')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          <div>
            <label className={labelClass}>{t('registerUser.email')} *</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              className={inputClass}
              placeholder={t('registerUser.emailPlaceholder')}
              required
              disabled={submitting || success}
            />
          </div>
          <div>
            <label className={labelClass}>{t('registerUser.phone')}</label>
            <input
              name="telefon"
              value={form.telefon}
              onChange={handleChange}
              className={inputClass}
              placeholder={t('registerUser.phonePlaceholder')}
              disabled={submitting || success}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>{t('registerUser.address')}</label>
            <input
              name="adresa"
              value={form.adresa}
              onChange={handleChange}
              className={inputClass}
              placeholder={t('registerUser.addressPlaceholder')}
              disabled={submitting || success}
            />
          </div>
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className="text-xs sm:text-sm font-semibold text-gray-900 uppercase tracking-[0.18em] mb-2">
          {t('registerUser.docsOptional')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          <div>
            <label className={labelClass}>{t('registerUser.idDocNumber')}</label>
            <input
              name="brojLicnogDokumenta"
              value={form.brojLicnogDokumenta}
              onChange={handleChange}
              className={inputClass}
              disabled={submitting || success}
            />
          </div>
          <div>
            <label className={labelClass}>{t('registerUser.hikingCardNumber')}</label>
            <input
              name="brojPlaninarskeLegitimacije"
              value={form.brojPlaninarskeLegitimacije}
              onChange={handleChange}
              className={inputClass}
              disabled={submitting || success}
            />
          </div>
          <div>
            <label className={labelClass}>{t('registerUser.hikingBadgeNumber')}</label>
            <input
              name="brojPlaninarskeMarkice"
              value={form.brojPlaninarskeMarkice}
              onChange={handleChange}
              className={inputClass}
              disabled={submitting || success}
            />
          </div>
          <div>
            <label className={labelClass}>{t('registerUser.membershipDate')}</label>
            <input
              name="datumUclanjenja"
              type="date"
              value={form.datumUclanjenja}
              onChange={handleChange}
              className={inputClass}
              disabled={submitting || success}
            />
          </div>
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className="text-xs sm:text-sm font-semibold text-gray-900 uppercase tracking-[0.18em] mb-2">
          {t('registerUser.notesOptional')}
        </h3>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>{t('registerUser.disciplinary')}</label>
            <textarea
              name="izreceneDisciplinskeKazne"
              value={form.izreceneDisciplinskeKazne}
              onChange={handleChange}
              rows={3}
              className={`${inputClass} min-h-[72px]`}
              placeholder={t('registerUser.disciplinaryPlaceholder')}
              disabled={submitting || success}
            />
          </div>
          <div>
            <label className={labelClass}>{t('registerUser.selectionBodies')}</label>
            <textarea
              name="izborUOrganeSportskogUdruzenja"
              value={form.izborUOrganeSportskogUdruzenja}
              onChange={handleChange}
              rows={3}
              className={`${inputClass} min-h-[72px]`}
              placeholder={t('registerUser.selectionBodiesPlaceholder')}
              disabled={submitting || success}
            />
          </div>
          <div>
            <label className={labelClass}>{t('registerUser.notes')}</label>
            <textarea
              name="napomene"
              value={form.napomene}
              onChange={handleChange}
              rows={3}
              className={`${inputClass} min-h-[72px]`}
              placeholder={t('registerUser.notesPlaceholder')}
              disabled={submitting || success}
            />
          </div>
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className="text-xs sm:text-sm font-semibold text-gray-900 uppercase tracking-[0.18em] mb-2">
          {t('registerUser.avatarOptional')}
        </h3>
        <input
          type="file"
          accept="image/*"
          onChange={handleAvatarChange}
          disabled={submitting || success}
          className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
        />
        {avatarPreview && (
          <div className="mt-4 flex justify-center">
            <img
              src={avatarPreview}
              alt={t('registerUser.avatarPreviewAlt')}
              className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-full border-4 border-emerald-100 shadow-md"
            />
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-gray-50">
        <button
          type="submit"
          disabled={submitting || success}
          className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 disabled:opacity-60 disabled:cursor-wait transition-all"
        >
          {t('registerUser.submit')}
        </button>
        <p className="mt-3 text-center text-[11px] text-gray-400">{footerHint}</p>
      </div>
    </form>
  )
}
