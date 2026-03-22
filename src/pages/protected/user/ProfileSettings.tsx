import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link, useParams } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import api from '../../../services/api'
import Dropdown from '../../../components/Dropdown'
import CalendarDropdown from '../../../components/CalendarDropdown'
import Loader from '../../../components/Loader'
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
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, isLoggedIn, login, refreshUser } = useAuth()
  const [form, setForm] = useState(initialForm)
  const [role, setRole] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [targetUsername, setTargetUsername] = useState('')
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const isAdminEdit = !!id && (user?.role === 'superadmin' || user?.role === 'admin' || user?.role === 'sekretar')
  const isSekretarEdit = !!id && user?.role === 'sekretar'
  const canEditAdminFields = user?.role === 'superadmin' || user?.role === 'admin'

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/home', { replace: true })
      return
    }
    // Admin ili sekretar mogu pristupiti /profil/podesavanja/:id
    if (id && user?.role !== 'superadmin' && user?.role !== 'admin' && user?.role !== 'sekretar') {
      navigate('/profil/podesavanja', { replace: true })
      return
    }

    // Admin ili sekretar editing another user: admin vidi sva polja + lozinku, sekretar samo lozinku
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
          setError(err.response?.data?.error || 'Greška pri učitavanju profila')
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
        if (k.avatar_url) setAvatarPreview(k.avatar_url)
      } catch (err: any) {
        setError(err.response?.data?.error || 'Greška pri učitavanju profila')
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
      setError('Dozvoljene su samo slike (jpg, png, gif...)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Slika je prevelika (maksimum 5 MB)')
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
    setSaving(true)

    try {
      if (isAdminEdit) {
        if (newPassword !== confirmPassword) {
          setError('Lozinke se ne podudaraju.')
          setSaving(false)
          return
        }
        if (newPassword && newPassword.length < 8) {
          setError('Lozinka mora imati najmanje 8 karaktera.')
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
        if (isSekretarEdit && !newPassword) {
          setError('Unesite novu lozinku korisnika.')
          setSaving(false)
          return
        }
        const res = await api.get(`/api/korisnici/${id}`)
        const k = res.data as { username: string }
        await api.patch(`/api/korisnici/${id}`, body)
        setSuccess(true)
        setTimeout(() => navigate(`/korisnik/${k.username}`, { replace: true }), 1500)
        return
      }

      if (newPassword !== confirmPassword) {
        setError('Lozinke se ne podudaraju.')
        setSaving(false)
        return
      }
      if (newPassword && newPassword.length < 8) {
        setError('Lozinka mora imati najmanje 8 karaktera.')
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
        await refreshUser()
      }

      setSuccess(true)
      setTimeout(() => navigate(`/korisnik/${form.username}`, { replace: true }), 1500)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Greška pri čuvanju profila')
    } finally {
      setSaving(false)
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
                Nazad
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
                      aria-label="Izaberi profilnu sliku"
                    />
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-bold text-2xl shrink-0 overflow-hidden group focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                    >
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span>{(form.fullName || form.username || '?').charAt(0).toUpperCase()}</span>
                      )}
                      <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
                        <PencilSquareIcon className="h-8 w-8 text-white" />
                      </span>
                    </button>
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
                    {isSekretarEdit ? 'Postavi lozinku' : isAdminEdit ? 'Podešavanja korisnika' : 'Podešavanja profila'}
                  </h1>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {isSekretarEdit
                      ? 'Nova lozinka za korisnika (samo ako je zaboravio)'
                      : isAdminEdit
                      ? 'Uloga, disciplinske kazne, napomene, lozinka'
                      : 'Lični i planinarski podaci, lozinka'}
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
                  {saving ? 'Čuvanje...' : 'Sačuvaj promene'}
                </button>
                <Link
                  to={backTo}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Odustani
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {success && (
        <div className="mx-auto max-w-5xl px-4 pt-4 sm:px-6 lg:px-8">
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-medium text-emerald-800">
            Profil sačuvan. Preusmeravam...
          </div>
        </div>
      )}
      {error && (
        <div className="mx-auto max-w-5xl px-4 pt-4 sm:px-6 lg:px-8">
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</div>
        </div>
      )}

      <form id="profile-settings-form" onSubmit={handleSubmit} className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Admin edit: sekretar samo lozinka; admin uloga + disciplinske + lozinka */}
          {isAdminEdit ? (
            <div className="space-y-6">
              {isSekretarEdit ? (
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-visible">
                  <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80">
                    <div className="flex items-center gap-2">
                      <KeyIcon className="h-5 w-5 text-emerald-600" />
                      <h2 className="text-base font-semibold text-gray-900">Postavi novu lozinku</h2>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">Samo ako je korisnik zaboravio lozinku.</p>
                  </div>
                  <div className="p-5 space-y-4">
                    <div>
                      <label className={labelClass}>Nova lozinka *</label>
                      <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} placeholder="Min. 8 karaktera" minLength={8} required autoComplete="new-password" />
                    </div>
                    <div>
                      <label className={labelClass}>Ponovite lozinku *</label>
                      <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} placeholder="Ponovite lozinku" required autoComplete="new-password" />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80">
                      <div className="flex items-center gap-2">
                        <UserCircleIcon className="h-5 w-5 text-emerald-600" />
                        <h2 className="text-base font-semibold text-gray-900">Uloga</h2>
                      </div>
                    </div>
                    <div className="p-5">
                      <Dropdown aria-label="Uloga" options={[{ value: 'clan', label: 'Clan' }, { value: 'admin', label: 'Admin' }, { value: 'vodic', label: 'Vodic' }, { value: 'blagajnik', label: 'Blagajnik' }, { value: 'sekretar', label: 'Sekretar' }, { value: 'menadzer-opreme', label: 'Menadzer opreme' }]} value={role} onChange={setRole} fullWidth />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-visible">
                    <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80">
                      <div className="flex items-center gap-2">
                        <ClipboardDocumentListIcon className="h-5 w-5 text-emerald-600" />
                        <h2 className="text-base font-semibold text-gray-900">Disciplinske kazne, izbor u organe, napomene</h2>
                      </div>
                    </div>
                    <div className="p-5 space-y-4">
                      <div>
                        <label className={labelClass}>Izrečene disciplinske kazne</label>
                        <textarea name="izreceneDisciplinskeKazne" value={form.izreceneDisciplinskeKazne} onChange={handleChange} rows={3} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Izbor u organe sportskog udruženja</label>
                        <textarea name="izborUOrganeSportskogUdruzenja" value={form.izborUOrganeSportskogUdruzenja} onChange={handleChange} rows={3} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Napomene</label>
                        <textarea name="napomene" value={form.napomene} onChange={handleChange} rows={3} className={inputClass} />
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-visible">
                    <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80">
                      <div className="flex items-center gap-2">
                        <KeyIcon className="h-5 w-5 text-emerald-600" />
                        <h2 className="text-base font-semibold text-gray-900">Postavi novu lozinku</h2>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">Ostavite prazno ako ne menjate.</p>
                    </div>
                    <div className="p-5 space-y-4">
                      <div>
                        <label className={labelClass}>Nova lozinka</label>
                        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} placeholder="Min. 8 karaktera" minLength={8} autoComplete="new-password" />
                      </div>
                      <div>
                        <label className={labelClass}>Ponovite lozinku</label>
                        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} placeholder="Ponovite lozinku" autoComplete="new-password" />
                      </div>
                    </div>
                  </div>
                </>
              )}
              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50">
                  {saving ? 'Čuvanje...' : isSekretarEdit ? 'Postavi lozinku' : 'Sačuvaj promene'}
                </button>
                <Link to={backTo} className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Odustani
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
                    <h2 className="text-base font-semibold text-gray-900">Nalog</h2>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className={labelClass}>Korisničko ime</label>
                    <input name="username" value={form.username} onChange={handleChange} required className={inputClass} placeholder="Jedinstveno u sistemu" />
                  </div>
                  <div>
                    <label className={labelClass}>Uloga</label>
                    <input value={role} readOnly disabled className={disabledInputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Nova lozinka (ostavite prazno ako ne menjate)</label>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} placeholder="Min. 8 karaktera" minLength={8} autoComplete="new-password" />
                  </div>
                  <div>
                    <label className={labelClass}>Ponovite lozinku</label>
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} placeholder="Ponovite lozinku" autoComplete="new-password" />
                  </div>
                </div>
              </div>

              {/* Lični podaci */}
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-visible">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80">
                  <div className="flex items-center gap-2">
                    <IdentificationIcon className="h-5 w-5 text-emerald-600" />
                    <h2 className="text-base font-semibold text-gray-900">Lični podaci</h2>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Puno ime</label>
                      <input name="fullName" value={form.fullName} onChange={handleChange} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Ime roditelja</label>
                      <input name="imeRoditelja" value={form.imeRoditelja} onChange={handleChange} className={inputClass} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Pol</label>
                      <Dropdown aria-label="Pol" options={[{ value: '', label: '— izaberi —' }, { value: 'M', label: 'Muški' }, { value: 'Ž', label: 'Ženski' }]} value={form.pol} onChange={(v) => setForm((prev) => ({ ...prev, pol: v }))} fullWidth />
                    </div>
                    <div>
                      <label className={labelClass}>Datum rođenja</label>
                      <CalendarDropdown value={form.datumRodjenja} onChange={(v) => setForm((prev) => ({ ...prev, datumRodjenja: v }))} placeholder="Izaberite datum" fullWidth aria-label="Datum rođenja" />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Državljanstvo</label>
                    <input name="drzavljanstvo" value={form.drzavljanstvo} onChange={handleChange} className={inputClass} />
                  </div>
                </div>
              </div>

              {/* Kontakt */}
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-visible">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80">
                  <div className="flex items-center gap-2">
                    <PhoneIcon className="h-5 w-5 text-emerald-600" />
                    <h2 className="text-base font-semibold text-gray-900">Kontakt</h2>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Email</label>
                      <input name="email" type="email" value={form.email} onChange={handleChange} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Telefon</label>
                      <input name="telefon" value={form.telefon} onChange={handleChange} className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Adresa</label>
                    <input name="adresa" value={form.adresa} onChange={handleChange} className={inputClass} />
                  </div>
                </div>
              </div>

              {/* Dokumenti i planinarski */}
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-visible">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80">
                  <div className="flex items-center gap-2">
                    <DocumentTextIcon className="h-5 w-5 text-emerald-600" />
                    <h2 className="text-base font-semibold text-gray-900">Dokumenti i planinarski podaci</h2>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Broj ličnog dokumenta</label>
                      <input name="brojLicnogDokumenta" value={form.brojLicnogDokumenta} onChange={handleChange} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Broj planinarske legitimacije</label>
                      <input name="brojPlaninarskeLegitimacije" value={form.brojPlaninarskeLegitimacije} onChange={handleChange} className={inputClass} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Broj planinarske markice</label>
                      <input name="brojPlaninarskeMarkice" value={form.brojPlaninarskeMarkice} onChange={handleChange} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Datum učlanjenja</label>
                      <CalendarDropdown value={form.datumUclanjenja} onChange={(v) => setForm((prev) => ({ ...prev, datumUclanjenja: v }))} placeholder="Izaberite datum" fullWidth aria-label="Datum učlanjenja" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Disciplinske, napomene */}
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-visible lg:col-span-2">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80">
                  <div className="flex items-center gap-2">
                    <ClipboardDocumentListIcon className="h-5 w-5 text-emerald-600" />
                    <h2 className="text-base font-semibold text-gray-900">Disciplinske kazne, izbor u organe, napomene</h2>
                  </div>
                  {!canEditAdminFields && <p className="mt-1 text-xs text-gray-500">Ova polja menja samo admin.</p>}
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className={labelClass}>Izrečene disciplinske kazne</label>
                    <textarea name="izreceneDisciplinskeKazne" value={form.izreceneDisciplinskeKazne} onChange={handleChange} rows={3} readOnly={!canEditAdminFields} disabled={!canEditAdminFields} className={canEditAdminFields ? inputClass : disabledInputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Izbor u organe sportskog udruženja</label>
                    <textarea name="izborUOrganeSportskogUdruzenja" value={form.izborUOrganeSportskogUdruzenja} onChange={handleChange} rows={3} readOnly={!canEditAdminFields} disabled={!canEditAdminFields} className={canEditAdminFields ? inputClass : disabledInputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Napomene</label>
                    <textarea name="napomene" value={form.napomene} onChange={handleChange} rows={3} readOnly={!canEditAdminFields} disabled={!canEditAdminFields} className={canEditAdminFields ? inputClass : disabledInputClass} />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 lg:col-span-2 sm:hidden">
                <button type="submit" disabled={saving} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50">
                  {saving ? 'Čuvanje...' : 'Sačuvaj promene'}
                </button>
                <Link to={backTo} className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Odustani
                </Link>
              </div>
            </div>
          )}
        </form>
    </div>
  )
}
