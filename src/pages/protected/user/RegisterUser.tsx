// src/pages/RegisterUser.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import Dropdown from '../../../components/Dropdown'
import BackButton from '../../../components/buttons/BackButton'
import { useTranslation } from 'react-i18next'

const initialForm = {
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
  role: '',
}

export default function RegisterUser() {
  const { t } = useTranslation('setup')
  const { user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string>('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

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
    if (!form.role.trim()) {
      setError(t('registerUser.pickRole'))
      return
    }
    try {
      const formData = new FormData()
      formData.append('username', form.username.trim().toLowerCase())
      formData.append('password', form.password)
      formData.append('role', form.role)

      // Opciona polja – dodaj samo ako nisu prazna
      const optional: (keyof typeof form)[] = [
        'fullName', 'imeRoditelja', 'pol', 'datumRodjenja', 'drzavljanstvo',
        'adresa', 'telefon', 'email', 'brojLicnogDokumenta',
        'brojPlaninarskeLegitimacije', 'brojPlaninarskeMarkice', 'datumUclanjenja',
        'izreceneDisciplinskeKazne', 'izborUOrganeSportskogUdruzenja', 'napomene',
      ]
      optional.forEach((key) => {
        if (key === 'role') return
        const val = form[key]?.trim()
        if (val) formData.append(key, val)
      })

      if (avatarFile) formData.append('avatar', avatarFile)

      await api.post('/api/register', formData)

      setSuccess(true)
      setTimeout(() => navigate('/users', { replace: true }), 2000)
    } catch (err: any) {
      setError(err.response?.data?.error || t('registerUser.createError'))
    }
  }

  const labelClass = 'block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-[0.16em]'
  const inputClass =
    'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 outline-none transition'
  const sectionClass = 'space-y-4'

  const roleOptions = (user?.role === 'superadmin' || user?.role === 'admin')
    ? ['admin', 'clan', 'vodic', 'blagajnik', 'sekretar', 'menadzer-opreme']
    : ['clan', 'vodic', 'blagajnik', 'sekretar', 'menadzer-opreme']

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 pb-12">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
          <BackButton />
          <div className="flex-1 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-600 mb-1">
              {t('registerUser.badge')}
            </p>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-extrabold tracking-tight text-gray-900">
              {t('registerUser.title')}
            </h1>
          </div>
          <div className="w-10 sm:w-16" aria-hidden />
        </div>

        <div className="max-w-4xl mx-auto">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 lg:p-7 space-y-6 sm:space-y-7"
          >
            {success && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs sm:text-sm text-emerald-700 text-center font-medium">
                {t('registerUser.createdRedirecting')}
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs sm:text-sm text-rose-700">
                {error}
              </div>
            )}

            {/* Obavezna polja */}
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
                    className={inputClass}
                    placeholder={t('registerUser.usernamePlaceholder')}
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
                  />
                </div>
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
                    value={form.role}
                    onChange={(v) => setForm((prev) => ({ ...prev, role: v }))}
                    fullWidth
                  />
                </div>
              </div>
            </div>

            {/* Lični podaci */}
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
                  />
                </div>
                <div>
                  <label className={labelClass}>{t('registerUser.parentName')}</label>
                  <input
                    name="imeRoditelja"
                    value={form.imeRoditelja}
                    onChange={handleChange}
                    className={inputClass}
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
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>{t('registerUser.citizenship')}</label>
                  <input
                    name="drzavljanstvo"
                    value={form.drzavljanstvo}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* Kontakt */}
            <div className={sectionClass}>
              <h3 className="text-xs sm:text-sm font-semibold text-gray-900 uppercase tracking-[0.18em] mb-2">
              {t('registerUser.contactOptional')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <div>
                  <label className={labelClass}>{t('registerUser.email')}</label>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder={t('registerUser.emailPlaceholder')}
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
                  />
                </div>
              </div>
            </div>

            {/* Planinarski / dokumenti */}
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
                  />
                </div>
                <div>
                  <label className={labelClass}>{t('registerUser.hikingCardNumber')}</label>
                  <input
                    name="brojPlaninarskeLegitimacije"
                    value={form.brojPlaninarskeLegitimacije}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>{t('registerUser.hikingBadgeNumber')}</label>
                  <input
                    name="brojPlaninarskeMarkice"
                    value={form.brojPlaninarskeMarkice}
                    onChange={handleChange}
                    className={inputClass}
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
                  />
                </div>
              </div>
            </div>

            {/* Disciplinske kazne, izbor u organe, napomene */}
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
                  />
                </div>
              </div>
            </div>

            {/* Avatar */}
            <div className={sectionClass}>
              <h3 className="text-xs sm:text-sm font-semibold text-gray-900 uppercase tracking-[0.18em] mb-2">
                {t('registerUser.avatarOptional')}
              </h3>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
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
                className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 disabled:opacity-60 disabled:cursor-wait transition-all"
              >
                {t('registerUser.submit')}
              </button>
              <p className="mt-3 text-center text-[11px] text-gray-400">
                {t('registerUser.footerHint')}
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
