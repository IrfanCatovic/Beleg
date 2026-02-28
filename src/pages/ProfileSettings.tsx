import { useEffect, useState } from 'react'
import { useNavigate, Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

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
  const { user, isLoggedIn, login } = useAuth()
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

  const isAdminEdit = !!id && (user?.role === 'admin' || user?.role === 'sekretar')
  const isSekretarEdit = !!id && user?.role === 'sekretar'
  const canEditAdminFields = user?.role === 'admin'

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/home', { replace: true })
      return
    }
    // Admin ili sekretar mogu pristupiti /profil/podesavanja/:id
    if (id && user?.role !== 'admin' && user?.role !== 'sekretar') {
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
            izreceneDisciplinskeKazne: k.izrecene_disciplinske_kazne || '',
            izborUOrganeSportskogUdruzenja: k.izbor_u_organe_sportskog_udruzenja || '',
            napomene: k.napomene || '',
          })
          setRole(k.role || '')
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
        await api.patch(`/api/korisnici/${id}`, body)
        setSuccess(true)
        setTimeout(() => navigate(`/users/${id}`, { replace: true }), 1500)
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
      formData.append('username', form.username.trim())
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

      const res = await api.patch('/api/me', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      if (res.data?.token && res.data?.role && res.data?.user) {
        login({
          token: res.data.token,
          role: res.data.role,
          user: res.data.user,
        })
      }

      setSuccess(true)
      setTimeout(() => navigate('/profil', { replace: true }), 1500)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Greška pri čuvanju profila')
    } finally {
      setSaving(false)
    }
  }

  const disabledInputClass =
    'w-full p-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed'
  const inputClass =
    'w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#41ac53] focus:border-[#41ac53]'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'
  const sectionClass = 'space-y-4'

  if (!isLoggedIn) return null
  if (loading) return <div className="text-center py-20">Učitavanje...</div>

  const backLink = isAdminEdit ? (
    <Link to={`/users/${id}`} className="text-gray-600 hover:text-gray-900 text-sm font-medium">
      ← Nazad na profil korisnika
    </Link>
  ) : (
    <Link to="/profil" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
      ← Nazad na profil
    </Link>
  )

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold" style={{ color: '#41ac53' }}>
            {isSekretarEdit ? 'Postavi lozinku korisniku' : isAdminEdit ? 'Admin: Podešavanja korisnika' : 'Podešavanja profila'}
          </h2>
          {backLink}
        </div>

        <p className="text-sm text-gray-500 mb-6">
          {isSekretarEdit
            ? 'Samo možete postaviti novu lozinku korisniku — isključivo u slučaju kada je korisnik zaboravio lozinku.'
            : isAdminEdit
            ? 'Admin može menjati ulogu, disciplinske kazne, izbor u organe, napomene. Može i postaviti novu lozinku korisniku — samo ako je korisnik zaboravio lozinku.'
            : 'Možete menjati sva polja osim uloge i admin polja (disciplinske kazne, izbor u organe, napomene). Ulogu i ta polja može promeniti samo administrator. Možete promeniti i lozinku.'}
        </p>

        {success && (
          <div className="mb-6 p-4 bg-green-100 text-green-800 rounded-lg text-center font-medium">
            Profil sačuvan. Preusmeravam...
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-800 rounded-lg">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Admin edit: role + disciplinske, izbor, napomene + opciono lozinka. Sekretar: samo lozinka */}
          {isAdminEdit ? (
            <>
              {/* Sekretar vidi samo sekciju za lozinku */}
              {isSekretarEdit ? (
                <div className={sectionClass}>
                  <h3 className="text-lg font-semibold text-gray-800 border-b border-emerald-200 pb-2 mb-2">
                    Postavi novu lozinku (samo ako je korisnik zaboravio)
                  </h3>
                  <div className="space-y-2">
                    <label className={labelClass}>Nova lozinka *</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={inputClass}
                      placeholder="Min. 8 karaktera"
                      minLength={8}
                      required
                      autoComplete="new-password"
                    />
                    <label className={labelClass}>Ponovite lozinku *</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={inputClass}
                      placeholder="Ponovite lozinku"
                      required
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              ) : (
                <>
              <div className={sectionClass}>
                <h3 className="text-lg font-semibold text-gray-800 border-b border-emerald-200 pb-2 mb-2">
                  Uloga
                </h3>
                <div>
                  <label className={labelClass}>Uloga (samo admin menja)</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className={inputClass}
                  >
                    <option value="clan">clan</option>
                    <option value="admin">admin</option>
                    <option value="vodic">vodic</option>
                    <option value="blagajnik">blagajnik</option>
                    <option value="sekretar">sekretar</option>
                    <option value="menadzer-opreme">menadzer-opreme</option>
                  </select>
                </div>
              </div>
              <div className={sectionClass}>
                <h3 className="text-lg font-semibold text-gray-800 border-b border-emerald-200 pb-2 mb-2">
                  Disciplinske kazne, izbor u organe, napomene
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>Izrečene disciplinske kazne</label>
                    <textarea
                      name="izreceneDisciplinskeKazne"
                      value={form.izreceneDisciplinskeKazne}
                      onChange={handleChange}
                      rows={3}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Izbor u organe sportskog udruženja</label>
                    <textarea
                      name="izborUOrganeSportskogUdruzenja"
                      value={form.izborUOrganeSportskogUdruzenja}
                      onChange={handleChange}
                      rows={3}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Napomene</label>
                    <textarea
                      name="napomene"
                      value={form.napomene}
                      onChange={handleChange}
                      rows={3}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
              <div className={sectionClass}>
                <h3 className="text-lg font-semibold text-gray-800 border-b border-emerald-200 pb-2 mb-2">
                  Postavi novu lozinku (samo ako je korisnik zaboravio)
                </h3>
                <div className="space-y-2">
                  <label className={labelClass}>Nova lozinka (ostavite prazno ako ne menjate)</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={inputClass}
                    placeholder="Min. 8 karaktera"
                    minLength={8}
                    autoComplete="new-password"
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputClass}
                    placeholder="Ponovite lozinku"
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 px-4 bg-[#41ac53] hover:bg-[#3a9a4a] disabled:opacity-60 text-white font-medium rounded-lg transition-colors"
                >
                  {saving ? 'Čuvanje...' : 'Sačuvaj promene'}
                </button>
                <Link
                  to={`/users/${id}`}
                  className="py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-center"
                >
                  Odustani
                </Link>
              </div>
            </>
              )}
              {isSekretarEdit && (
                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-3 px-4 bg-[#41ac53] hover:bg-[#3a9a4a] disabled:opacity-60 text-white font-medium rounded-lg transition-colors"
                  >
                    {saving ? 'Čuvanje...' : 'Postavi lozinku'}
                  </button>
                  <Link
                    to={`/users/${id}`}
                    className="py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-center"
                  >
                    Odustani
                  </Link>
                </div>
              )}
            </>
          ) : (
            <>
          {/* Korisničko ime i uloga */}
          <div className={sectionClass}>
            <h3 className="text-lg font-semibold text-gray-800 border-b border-emerald-200 pb-2 mb-2">
              Nalog
            </h3>
            <div>
              <label className={labelClass}>Korisničko ime</label>
              <input
                name="username"
                value={form.username}
                onChange={handleChange}
                required
                className={inputClass}
                placeholder="Jedinstveno u sistemu"
              />
            </div>
            <div>
              <label className={labelClass}>Uloga (samo admin može da promeni)</label>
              <input
                value={role}
                readOnly
                disabled
                className={disabledInputClass}
              />
            </div>
            {/* Promena lozinke – samo kod sopstvenog profila, admin ne vidi ni lozinku */}
            <div className="space-y-2 mt-4">
              <label className={labelClass}>Nova lozinka (ostavite prazno ako ne menjate)</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
                placeholder="Min. 8 karaktera"
                minLength={8}
                autoComplete="new-password"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                placeholder="Ponovite lozinku"
                autoComplete="new-password"
              />
            </div>
          </div>

          {/* Lični podaci */}
          <div className={sectionClass}>
            <h3 className="text-lg font-semibold text-gray-800 border-b border-emerald-200 pb-2 mb-2">
              Lični podaci
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Puno ime</label>
                <input name="fullName" value={form.fullName} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Ime roditelja</label>
                <input name="imeRoditelja" value={form.imeRoditelja} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Pol</label>
                <select name="pol" value={form.pol} onChange={handleChange} className={inputClass}>
                  <option value="">— izaberi —</option>
                  <option value="M">M</option>
                  <option value="Ž">Ž</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Datum rođenja</label>
                <input
                  name="datumRodjenja"
                  type="date"
                  value={form.datumRodjenja}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Državljanstvo</label>
                <input name="drzavljanstvo" value={form.drzavljanstvo} onChange={handleChange} className={inputClass} />
              </div>
            </div>
          </div>

          {/* Kontakt */}
          <div className={sectionClass}>
            <h3 className="text-lg font-semibold text-gray-800 border-b border-emerald-200 pb-2 mb-2">
              Kontakt
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Email</label>
                <input name="email" type="email" value={form.email} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Telefon</label>
                <input name="telefon" value={form.telefon} onChange={handleChange} className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Adresa</label>
                <input name="adresa" value={form.adresa} onChange={handleChange} className={inputClass} />
              </div>
            </div>
          </div>

          {/* Dokumenti i planinarski podaci */}
          <div className={sectionClass}>
            <h3 className="text-lg font-semibold text-gray-800 border-b border-emerald-200 pb-2 mb-2">
              Dokumenti i planinarski podaci
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Broj ličnog dokumenta</label>
                <input
                  name="brojLicnogDokumenta"
                  value={form.brojLicnogDokumenta}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Broj planinarske legitimacije</label>
                <input
                  name="brojPlaninarskeLegitimacije"
                  value={form.brojPlaninarskeLegitimacije}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Broj planinarske markice</label>
                <input
                  name="brojPlaninarskeMarkice"
                  value={form.brojPlaninarskeMarkice}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Datum učlanjenja</label>
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

          {/* Disciplinske kazne, izbor u organe, napomene – samo admin može da menja */}
          <div className={sectionClass}>
            <h3 className="text-lg font-semibold text-gray-800 border-b border-emerald-200 pb-2 mb-2">
              Disciplinske kazne, izbor u organe, napomene
            </h3>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>
                  Izrečene disciplinske kazne {!canEditAdminFields && '(samo admin)'}
                </label>
                <textarea
                  name="izreceneDisciplinskeKazne"
                  value={form.izreceneDisciplinskeKazne}
                  onChange={handleChange}
                  rows={3}
                  readOnly={!canEditAdminFields}
                  disabled={!canEditAdminFields}
                  className={canEditAdminFields ? inputClass : disabledInputClass}
                />
              </div>
              <div>
                <label className={labelClass}>
                  Izbor u organe sportskog udruženja {!canEditAdminFields && '(samo admin)'}
                </label>
                <textarea
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
                <label className={labelClass}>
                  Napomene {!canEditAdminFields && '(samo admin)'}
                </label>
                <textarea
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
          </div>

          {/* Avatar */}
          <div className={sectionClass}>
            <h3 className="text-lg font-semibold text-gray-800 border-b border-emerald-200 pb-2 mb-2">
              Profilna slika
            </h3>
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="w-full p-2 border border-gray-300 rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#41ac53]/10 file:text-[#41ac53] hover:file:bg-[#41ac53]/20 cursor-pointer"
            />
            {avatarPreview && (
              <div className="mt-3">
                <img
                  src={avatarPreview}
                  alt="Pregled"
                  className="w-24 h-24 rounded-full object-cover border border-gray-200"
                />
              </div>
            )}
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 px-4 bg-[#41ac53] hover:bg-[#3a9a4a] disabled:opacity-60 text-white font-medium rounded-lg transition-colors"
            >
              {saving ? 'Čuvanje...' : 'Sačuvaj promene'}
            </button>
            <Link
              to="/profil"
              className="py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-center"
            >
              Odustani
            </Link>
          </div>
          </>
          )}
        </form>
      </div>
    </div>
  )
}
