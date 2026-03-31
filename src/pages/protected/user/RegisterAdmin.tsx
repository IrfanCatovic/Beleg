// src/pages/RegisterAdmin.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../services/api'
import Dropdown from '../../../components/Dropdown'
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
}

export default function RegisterAdmin() {
  const { t } = useTranslation('setup')
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string>('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkSetup = async () => {
      try {
        const res = await api.get('/api/setup/status')
        if (res.data.hasUsers) {
          navigate('/', { replace: true })
        }
      } catch (err) {
        console.error(t('registerAdmin.setupStatusErrorLog'), err)
      } finally {
        setLoading(false)
      }
    }
    checkSetup()
  }, [navigate])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError(t('registerAdmin.imageOnlyError'))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(t('registerAdmin.imageTooLargeError'))
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

    try {
      const formData = new FormData()
      formData.append('username', form.username.trim().toLowerCase())
      formData.append('password', form.password)

      // Opciona polja – dodaj samo ako nisu prazna
      const optional: (keyof typeof form)[] = [
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

      await api.post('/api/setup/admin', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setSuccess(true)
      setTimeout(() => navigate('/', { replace: true }), 2000)
    } catch (err: any) {
      setError(err.response?.data?.error || t('registerAdmin.createError'))
    }
  }

  const inputClass =
    'w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#41ac53] focus:border-[#41ac53]'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'
  const sectionClass = 'space-y-4'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">{t('registerAdmin.checkingState')}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-emerald-50 px-4 py-12">
      <div className="w-full max-w-2xl bg-white p-8 rounded-2xl shadow-xl border border-emerald-100">
        <h2 className="text-3xl font-bold text-center mb-8" style={{ color: '#41ac53' }}>
          {t('registerAdmin.title')}
        </h2>

        {success && (
          <div className="mb-6 p-4 bg-green-100 text-green-800 rounded-lg text-center font-medium">
            {t('registerAdmin.createdRedirecting')}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-800 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Obavezna polja */}
          <div className={sectionClass}>
            <h3 className="text-lg font-semibold text-gray-800 border-b border-emerald-200 pb-2 mb-2">
              {t('registerAdmin.requiredFields')}
            </h3>
            <div>
              <label className={labelClass}>{t('registerAdmin.usernameRequired')}</label>
              <input
                name="username"
                value={form.username}
                onChange={handleChange}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t('registerAdmin.passwordRequired')}</label>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                required
                minLength={8}
                className={inputClass}
              />
            </div>
          </div>

          {/* Lični podaci */}
          <div className={sectionClass}>
            <h3 className="text-lg font-semibold text-gray-800 border-b border-emerald-200 pb-2 mb-2">
              {t('registerAdmin.personalOptional')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                  <label className={labelClass}>{t('registerAdmin.fullName')}</label>
                <input
                  name="fullName"
                  value={form.fullName}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                  <label className={labelClass}>{t('registerAdmin.parentName')}</label>
                <input
                  name="imeRoditelja"
                  value={form.imeRoditelja}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                  <label className={labelClass}>{t('registerAdmin.gender')}</label>
                <Dropdown
                  aria-label="Pol"
                  options={[
                    { value: '', label: t('registerAdmin.pick') },
                    { value: 'M', label: t('registerAdmin.genderMale') },
                    { value: 'Ž', label: t('registerAdmin.genderFemale') },
                  ]}
                  value={form.pol}
                  onChange={(v) => setForm((prev) => ({ ...prev, pol: v }))}
                  fullWidth
                />
              </div>
              <div>
                  <label className={labelClass}>{t('registerAdmin.birthDate')}</label>
                <input
                  name="datumRodjenja"
                  type="date"
                  value={form.datumRodjenja}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                  <label className={labelClass}>{t('registerAdmin.citizenship')}</label>
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
            <h3 className="text-lg font-semibold text-gray-800 border-b border-emerald-200 pb-2 mb-2">
              {t('registerAdmin.contactOptional')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{t('registerAdmin.email')}</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>{t('registerAdmin.phone')}</label>
                <input
                  name="telefon"
                  value={form.telefon}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('registerAdmin.address')}</label>
                <input
                  name="adresa"
                  value={form.adresa}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Planinarski / dokumenti */}
          <div className={sectionClass}>
            <h3 className="text-lg font-semibold text-gray-800 border-b border-emerald-200 pb-2 mb-2">
              {t('registerAdmin.docsOptional')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{t('registerAdmin.idDocNumber')}</label>
                <input
                  name="brojLicnogDokumenta"
                  value={form.brojLicnogDokumenta}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>{t('registerAdmin.hikingCardNumber')}</label>
                <input
                  name="brojPlaninarskeLegitimacije"
                  value={form.brojPlaninarskeLegitimacije}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>{t('registerAdmin.hikingBadgeNumber')}</label>
                <input
                  name="brojPlaninarskeMarkice"
                  value={form.brojPlaninarskeMarkice}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>{t('registerAdmin.membershipDate')}</label>
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
            <h3 className="text-lg font-semibold text-gray-800 border-b border-emerald-200 pb-2 mb-2">
              {t('registerAdmin.notesOptional')}
            </h3>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>{t('registerAdmin.disciplinary')}</label>
                <textarea
                  name="izreceneDisciplinskeKazne"
                  value={form.izreceneDisciplinskeKazne}
                  onChange={handleChange}
                  rows={3}
                  className={inputClass}
                  placeholder={t('registerAdmin.disciplinaryPlaceholder')}
                />
              </div>
              <div>
                <label className={labelClass}>{t('registerAdmin.selectionBodies')}</label>
                <textarea
                  name="izborUOrganeSportskogUdruzenja"
                  value={form.izborUOrganeSportskogUdruzenja}
                  onChange={handleChange}
                  rows={3}
                  className={inputClass}
                  placeholder={t('registerAdmin.selectionBodiesPlaceholder')}
                />
              </div>
              <div>
                <label className={labelClass}>{t('registerAdmin.notes')}</label>
                <textarea
                  name="napomene"
                  value={form.napomene}
                  onChange={handleChange}
                  rows={3}
                  className={inputClass}
                  placeholder={t('registerAdmin.notesPlaceholder')}
                />
              </div>
            </div>
          </div>

          {/* Avatar */}
          <div className={sectionClass}>
            <h3 className="text-lg font-semibold text-gray-800 border-b border-emerald-200 pb-2 mb-2">
              {t('registerAdmin.avatarOptional')}
            </h3>
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="w-full p-2 border border-gray-300 rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#41ac53]/10 file:text-[#41ac53] hover:file:bg-[#41ac53]/20 cursor-pointer"
            />
            {avatarPreview && (
              <div className="mt-4 flex justify-center">
                <img
                  src={avatarPreview}
                  alt={t('registerAdmin.avatarPreviewAlt')}
                  className="w-32 h-32 object-cover rounded-full border-4 border-[#41ac53]/30 shadow-md"
                />
              </div>
            )}
          </div>

          <div>
            <label className={labelClass}>{t('registerAdmin.roleAuto')}</label>
            <input
              name="role"
              value="admin"
              disabled
              className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
            />
          </div>

          <button
            type="submit"
            className="w-full py-4 text-white font-bold rounded-lg shadow-md transition-all hover:bg-[#2e8b45] focus:outline-none focus:ring-2 focus:ring-[#41ac53]/50"
            style={{ backgroundColor: '#41ac53' }}
          >
            {t('registerAdmin.submit')}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-gray-500">
          {t('registerAdmin.footerHint')}
        </p>
      </div>
    </div>
  )
}
