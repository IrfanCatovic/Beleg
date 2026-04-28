import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import api from '../../../services/api'
import BackButton from '../../../components/buttons/BackButton'
import Dropdown from '../../../components/Dropdown'
import { useTranslation } from 'react-i18next'

interface Korisnik {
  id: number
  username: string
  fullName?: string
  role: string
}

interface Akcija {
  id: number
  naziv: string
  planina: string
  vrh: string
  datum: string
}

interface CandidateUser {
  id: number
  username: string
  fullName?: string
  avatarUrl?: string
  klubNaziv?: string
}

const PAGE_SIZE = 5

export default function AddPastAction() {
  const { t } = useTranslation('actionForms')
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tipAkcije = searchParams.get('tip') === 'via_ferrata' ? 'via_ferrata' : 'planina'
  const [korisnici, setKorisnici] = useState<Korisnik[]>([])
  const [vodici, setVodici] = useState<Korisnik[]>([])
  const [zavrseneAkcije, setZavrseneAkcije] = useState<Akcija[]>([])
  const [actionQuery, setActionQuery] = useState('')
  const [showLegacyCreate, setShowLegacyCreate] = useState(false)
  const [selectedExistingAction, setSelectedExistingAction] = useState<Akcija | null>(null)
  const [showManageModal, setShowManageModal] = useState(false)
  const [manageTab, setManageTab] = useState<'club' | 'external'>('club')
  const [manageError, setManageError] = useState('')
  const [manageSuccess, setManageSuccess] = useState('')

  const [clubUsers, setClubUsers] = useState<CandidateUser[]>([])
  const [clubQuery, setClubQuery] = useState('')
  const [clubOffset, setClubOffset] = useState(0)
  const [clubHasMore, setClubHasMore] = useState(true)
  const [clubLoading, setClubLoading] = useState(false)
  const [selectedClubUserIds, setSelectedClubUserIds] = useState<number[]>([])

  const [externalUsers, setExternalUsers] = useState<CandidateUser[]>([])
  const [externalQuery, setExternalQuery] = useState('')
  const [externalOffset, setExternalOffset] = useState(0)
  const [externalHasMore, setExternalHasMore] = useState(true)
  const [externalLoading, setExternalLoading] = useState(false)
  const [selectedExternalUserIds, setSelectedExternalUserIds] = useState<number[]>([])
  const [sendingAction, setSendingAction] = useState(false)

  const clubListRef = useRef<HTMLDivElement | null>(null)
  const externalListRef = useRef<HTMLDivElement | null>(null)

  const [selectedKorisnikIds, setSelectedKorisnikIds] = useState<string[]>([])
  const [naziv, setNaziv] = useState('')
  const [planina, setPlanina] = useState('')
  const [vrh, setVrh] = useState('')
  const [datum, setDatum] = useState('')
  const [opis, setOpis] = useState('')
  const [tezina, setTezina] = useState('')
  const [kumulativniUsponM, setKumulativniUsponM] = useState('')
  const [duzinaStazeKm, setDuzinaStazeKm] = useState('')
  const [visinaVrhM, setVisinaVrhM] = useState('')
  const [zimskiUspon, setZimskiUspon] = useState(false)
  const [vodicId, setVodicId] = useState('')
  const [drugiVodicCheck, setDrugiVodicCheck] = useState(false)
  const [drugiVodicIme, setDrugiVodicIme] = useState('')
  const [dodajUIstorijuKluba, setDodajUIstorijuKluba] = useState(true)
  const [javna, setJavna] = useState(false)
  const [slika, setSlika] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      setLoading(true)
      try {
        const [korisniciRes, akcijeRes] = await Promise.all([
          api.get<{ korisnici: Korisnik[] }>('/api/korisnici'),
          api.get<{ zavrsene: Akcija[] }>('/api/akcije'),
        ])
        const list = korisniciRes.data.korisnici || []
        setKorisnici(list)
        setVodici(list.filter((k) => k.role === 'vodic'))
        setZavrseneAkcije(akcijeRes.data.zavrsene || [])
      } catch (err: any) {
        setError(err.response?.data?.error || t('errors.loadUsers'))
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user])

  const filteredActions = useMemo(() => {
    const q = actionQuery.trim().toLowerCase()
    if (!q) return zavrseneAkcije
    return zavrseneAkcije.filter((a) =>
      [a.naziv, a.planina, a.vrh, a.datum].some((part) => (part || '').toLowerCase().includes(q)),
    )
  }, [actionQuery, zavrseneAkcije])

  const fetchClubUsers = async (replace: boolean, queryOverride?: string) => {
    if (!selectedExistingAction || clubLoading) return
    const q = queryOverride ?? clubQuery
    const nextOffset = replace ? 0 : clubOffset
    setClubLoading(true)
    try {
      const res = await api.get<{ users: CandidateUser[] }>(`/api/akcije/${selectedExistingAction.id}/eligible-club-members`, {
        params: { q, limit: PAGE_SIZE, offset: nextOffset },
      })
      const users = res.data.users || []
      setClubUsers((prev) => (replace ? users : [...prev, ...users]))
      setClubOffset(nextOffset + users.length)
      setClubHasMore(users.length === PAGE_SIZE)
    } catch (err: any) {
      setManageError(err.response?.data?.error || 'Greška pri učitavanju članova kluba.')
    } finally {
      setClubLoading(false)
    }
  }

  const fetchExternalUsers = async (replace: boolean, queryOverride?: string) => {
    if (!selectedExistingAction || externalLoading) return
    const q = queryOverride ?? externalQuery
    const nextOffset = replace ? 0 : externalOffset
    setExternalLoading(true)
    try {
      const res = await api.get<{ users: CandidateUser[] }>(`/api/akcije/${selectedExistingAction.id}/eligible-external-users`, {
        params: { q, limit: PAGE_SIZE, offset: nextOffset },
      })
      const users = res.data.users || []
      setExternalUsers((prev) => (replace ? users : [...prev, ...users]))
      setExternalOffset(nextOffset + users.length)
      setExternalHasMore(users.length === PAGE_SIZE)
    } catch (err: any) {
      setManageError(err.response?.data?.error || 'Greška pri učitavanju korisnika van kluba.')
    } finally {
      setExternalLoading(false)
    }
  }

  const openManageModal = (akcija: Akcija) => {
    setSelectedExistingAction(akcija)
    setShowManageModal(true)
    setManageTab('club')
    setManageError('')
    setManageSuccess('')
    setClubUsers([])
    setClubOffset(0)
    setClubHasMore(true)
    setSelectedClubUserIds([])
    setExternalUsers([])
    setExternalOffset(0)
    setExternalHasMore(true)
    setSelectedExternalUserIds([])
    void fetchClubUsers(true, '')
    void fetchExternalUsers(true, '')
  }

  const closeManageModal = () => {
    setShowManageModal(false)
    setSelectedExistingAction(null)
    setManageError('')
    setManageSuccess('')
    setSelectedClubUserIds([])
    setSelectedExternalUserIds([])
  }

  const toggleClubUser = (id: number) => {
    setSelectedClubUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const toggleExternalUser = (id: number) => {
    setSelectedExternalUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleAddClubMembers = async () => {
    if (!selectedExistingAction || selectedClubUserIds.length === 0) {
      setManageError('Izaberi bar jednog člana kluba.')
      return
    }
    setManageError('')
    setManageSuccess('')
    setSendingAction(true)
    try {
      const res = await api.post(`/api/akcije/${selectedExistingAction.id}/add-club-members-completed`, {
        korisnikIds: selectedClubUserIds,
      })
      setManageSuccess(
        `Obrađeno: dodato ${res.data?.added ?? 0}, ažurirano ${res.data?.updated ?? 0}, preskočeno ${res.data?.skipped ?? 0}.`,
      )
      setSelectedClubUserIds([])
      await fetchClubUsers(true)
    } catch (err: any) {
      setManageError(err.response?.data?.error || 'Greška pri dodavanju članova.')
    } finally {
      setSendingAction(false)
    }
  }

  const handleSendExternalRequests = async () => {
    if (!selectedExistingAction || selectedExternalUserIds.length === 0) {
      setManageError('Izaberi bar jednog korisnika van kluba.')
      return
    }
    setManageError('')
    setManageSuccess('')
    setSendingAction(true)
    try {
      const responses = await Promise.allSettled(
        selectedExternalUserIds.map((targetUserId) =>
          api.post(`/api/akcije/${selectedExistingAction.id}/participation-requests`, { targetUserId }),
        ),
      )
      const successCount = responses.filter((item) => item.status === 'fulfilled').length
      const failedCount = responses.length - successCount
      if (failedCount > 0) {
        setManageError(`Poslato: ${successCount}, neuspešno: ${failedCount}.`)
      } else {
        setManageSuccess(`Uspešno poslato zahteva: ${successCount}.`)
      }
      setSelectedExternalUserIds([])
      await fetchExternalUsers(true)
    } catch (err: any) {
      setManageError(err.response?.data?.error || 'Greška pri slanju zahteva.')
    } finally {
      setSendingAction(false)
    }
  }

  const onClubListScroll = () => {
    if (!clubListRef.current || clubLoading || !clubHasMore) return
    const { scrollTop, scrollHeight, clientHeight } = clubListRef.current
    if (scrollHeight - scrollTop - clientHeight < 24) {
      void fetchClubUsers(false)
    }
  }

  const onExternalListScroll = () => {
    if (!externalListRef.current || externalLoading || !externalHasMore) return
    const { scrollTop, scrollHeight, clientHeight } = externalListRef.current
    if (scrollHeight - scrollTop - clientHeight < 24) {
      void fetchExternalUsers(false)
    }
  }

  const handleClubSearch = () => {
    setClubOffset(0)
    setClubHasMore(true)
    setSelectedClubUserIds([])
    void fetchClubUsers(true)
  }

  const handleExternalSearch = () => {
    setExternalOffset(0)
    setExternalHasMore(true)
    setSelectedExternalUserIds([])
    void fetchExternalUsers(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedKorisnikIds.length === 0) {
      setError(t('errors.selectUser'))
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
      setError(t('errors.invalidDateFormat'))
      return
    }
    if (!tezina.trim()) {
      setError(t('errors.selectDifficulty'))
      return
    }
    const dozvoljeneTezine = ['lako', 'srednje', 'tesko', 'alpinizam']
    if (!dozvoljeneTezine.includes(tezina.trim().toLowerCase())) {
      setError(t('errors.selectDifficultyFromList'))
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const targetKorisnikId = selectedKorisnikIds[0]
      const formData = new FormData()
      formData.append('naziv', naziv)
      formData.append('tipAkcije', tipAkcije)
      formData.append('planina', planina.trim())
      formData.append('vrh', vrh)
      formData.append('datum', datum)
      formData.append('opis', opis)
      formData.append('tezina', tezina)
      formData.append('kumulativniUsponM', kumulativniUsponM)
      formData.append('duzinaStazeKm', duzinaStazeKm)
      formData.append('visinaVrhM', visinaVrhM)
      formData.append('zimskiUspon', String(zimskiUspon))
      if (vodicId) formData.append('vodic_id', vodicId)
      if (drugiVodicCheck && drugiVodicIme.trim()) formData.append('drugi_vodic_ime', drugiVodicIme.trim())
      formData.append('dodaj_u_istoriju_kluba', dodajUIstorijuKluba ? 'true' : 'false')
      formData.append('javna', String(javna))
      formData.append('korisnik_ids', selectedKorisnikIds.join(','))
      if (slika) formData.append('slika', slika)

      await api.post(`/api/korisnici/${targetKorisnikId}/dodaj-proslu-akciju`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      if (selectedKorisnikIds.length === 1) {
        const selected = korisnici.find((k) => String(k.id) === targetKorisnikId)
        if (selected?.username) {
          navigate(`/korisnik/${selected.username}`, { replace: true })
          return
        }
      }
      navigate('/users', { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.error || t('errors.addPastAction'))
      setSubmitting(false)
    }
  }

  const toggleKorisnik = (id: string) => {
    setSelectedKorisnikIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    )
  }

  const toggleAllKorisnici = () => {
    if (selectedKorisnikIds.length === korisnici.length) {
      setSelectedKorisnikIds([])
      return
    }
    setSelectedKorisnikIds(korisnici.map((k) => String(k.id)))
  }

  if (!user || !['superadmin', 'admin', 'vodic'].includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <div className="h-14 w-14 rounded-2xl bg-red-50 flex items-center justify-center">
          <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-sm text-gray-500 font-medium">{t('past.onlyAdminGuide')}</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  const labelClass = 'block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-[0.16em]'
  const inputClass =
    'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 outline-none transition'

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 pb-12">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
          <BackButton to="/profil" />
          <div className="flex-1 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-600 mb-1">
              {t('past.badge')}
            </p>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-extrabold tracking-tight text-gray-900">
              {t('past.title')}
            </h1>
          </div>
          <div className="w-10 sm:w-16" aria-hidden />
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="mb-6 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 sm:p-5">
            <h2 className="text-base sm:text-lg font-bold text-gray-900">Dodaj članove na postojeću završenu akciju</h2>
            <p className="text-sm text-gray-600 mt-1">
              Prvo pretraži završene akcije kluba i otvori modal za unos učesnika.
            </p>
            <div className="mt-3">
              <input
                type="text"
                value={actionQuery}
                onChange={(e) => setActionQuery(e.target.value)}
                placeholder="Pretraga po nazivu, planini, vrhu ili datumu"
                className={inputClass}
              />
            </div>
            <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-emerald-100 bg-white divide-y divide-gray-100">
              {filteredActions.length === 0 ? (
                <p className="px-3.5 py-3 text-sm text-gray-500">Nema pronađenih završenih akcija.</p>
              ) : (
                filteredActions.map((akcija) => (
                  <div key={akcija.id} className="flex items-center justify-between gap-3 px-3.5 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{akcija.naziv}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {akcija.planina} · {akcija.vrh} · {akcija.datum}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openManageModal(akcija)}
                      className="shrink-0 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
                    >
                      Dodaj učesnike
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowLegacyCreate((prev) => !prev)}
                className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
              >
                {showLegacyCreate ? 'Sakrij kreiranje nove prošle akcije' : 'Akcija ne postoji? Kreiraj novu prošlu akciju'}
              </button>
            </div>
          </div>

          {showManageModal && selectedExistingAction && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 px-4">
              <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl border border-gray-200">
                <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-100">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">{selectedExistingAction.naziv}</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {selectedExistingAction.planina} · {selectedExistingAction.vrh} · {selectedExistingAction.datum}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeManageModal}
                    className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Zatvori
                  </button>
                </div>

                <div className="p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setManageTab('club')}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                        manageTab === 'club' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      Članovi kluba
                    </button>
                    <button
                      type="button"
                      onClick={() => setManageTab('external')}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                        manageTab === 'external' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      Van kluba
                    </button>
                  </div>

                  {manageError && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{manageError}</div>}
                  {manageSuccess && <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{manageSuccess}</div>}

                  {manageTab === 'club' ? (
                    <div>
                      <div className="flex gap-2 mb-3">
                        <input
                          type="text"
                          value={clubQuery}
                          onChange={(e) => setClubQuery(e.target.value)}
                          placeholder="Pretraga članova kluba"
                          className={inputClass}
                        />
                        <button
                          type="button"
                          onClick={handleClubSearch}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          Pretraži
                        </button>
                      </div>
                      <div
                        ref={clubListRef}
                        onScroll={onClubListScroll}
                        className="max-h-72 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100"
                      >
                        {clubUsers.length === 0 && !clubLoading ? (
                          <p className="px-3 py-3 text-sm text-gray-500">Nema kandidata.</p>
                        ) : (
                          clubUsers.map((item) => (
                            <label key={item.id} className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-emerald-50/50">
                              <input
                                type="checkbox"
                                checked={selectedClubUserIds.includes(item.id)}
                                onChange={() => toggleClubUser(item.id)}
                                className="w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                              />
                              <span className="text-sm text-gray-800 truncate">{item.fullName || item.username} (@{item.username})</span>
                            </label>
                          ))
                        )}
                        {clubLoading && <p className="px-3 py-2 text-xs text-gray-500">Učitavanje...</p>}
                      </div>
                      <div className="mt-3 flex justify-between items-center gap-2">
                        <p className="text-xs text-gray-500">Izabrano: {selectedClubUserIds.length}</p>
                        <button
                          type="button"
                          onClick={() => void handleAddClubMembers()}
                          disabled={sendingAction}
                          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                        >
                          {sendingAction ? '...' : 'Dodaj na akciju'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex gap-2 mb-3">
                        <input
                          type="text"
                          value={externalQuery}
                          onChange={(e) => setExternalQuery(e.target.value)}
                          placeholder="Pretraga korisnika van kluba"
                          className={inputClass}
                        />
                        <button
                          type="button"
                          onClick={handleExternalSearch}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          Pretraži
                        </button>
                      </div>
                      <div
                        ref={externalListRef}
                        onScroll={onExternalListScroll}
                        className="max-h-72 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100"
                      >
                        {externalUsers.length === 0 && !externalLoading ? (
                          <p className="px-3 py-3 text-sm text-gray-500">Nema kandidata.</p>
                        ) : (
                          externalUsers.map((item) => (
                            <label key={item.id} className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-emerald-50/50">
                              <input
                                type="checkbox"
                                checked={selectedExternalUserIds.includes(item.id)}
                                onChange={() => toggleExternalUser(item.id)}
                                className="w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                              />
                              <span className="text-sm text-gray-800 truncate">
                                {item.fullName || item.username} (@{item.username})
                                {item.klubNaziv ? ` · ${item.klubNaziv}` : ''}
                              </span>
                            </label>
                          ))
                        )}
                        {externalLoading && <p className="px-3 py-2 text-xs text-gray-500">Učitavanje...</p>}
                      </div>
                      <div className="mt-3 flex justify-between items-center gap-2">
                        <p className="text-xs text-gray-500">Izabrano: {selectedExternalUserIds.length}</p>
                        <button
                          type="button"
                          onClick={() => void handleSendExternalRequests()}
                          disabled={sendingAction}
                          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                        >
                          {sendingAction ? '...' : 'Pošalji zahteve'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {showLegacyCreate && (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 lg:p-7 space-y-6 sm:space-y-7"
          >
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs sm:text-sm text-rose-700">
                {error}
              </div>
            )}

            {/* Korisnici */}
            <div>
              <label className={labelClass}>{t('fields.user')}</label>
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs text-gray-600">
                    Izabrano clanova: <span className="font-semibold text-gray-900">{selectedKorisnikIds.length}</span>
                  </p>
                  <button
                    type="button"
                    onClick={toggleAllKorisnici}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    {selectedKorisnikIds.length === korisnici.length ? 'Ponisti sve' : 'Izaberi sve'}
                  </button>
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 bg-white">
                  {korisnici.map((k) => {
                    const id = String(k.id)
                    const checked = selectedKorisnikIds.includes(id)
                    return (
                      <label
                        key={k.id}
                        className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-800 hover:bg-emerald-50/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleKorisnik(id)}
                          className="w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className="truncate">{k.fullName || k.username} (@{k.username})</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Osnovni podaci o akciji */}
            <div className="grid gap-4 sm:gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('fields.actionName')}</label>
                <input
                  type="text"
                  value={naziv}
                  onChange={(e) => setNaziv(e.target.value)}
                  className={inputClass}
                  placeholder={t('placeholders.actionName')}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>{t('fields.mountain')}</label>
                <input
                  type="text"
                  value={planina}
                  onChange={(e) => setPlanina(e.target.value)}
                  className={inputClass}
                  placeholder={t('placeholders.mountain')}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>{t('fields.peak')}</label>
                <input
                  type="text"
                  value={vrh}
                  onChange={(e) => setVrh(e.target.value)}
                  className={inputClass}
                  placeholder={t('placeholders.peak')}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>{t('fields.actionDate')}</label>
                <input
                  type="date"
                  value={datum}
                  onChange={(e) => setDatum(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>{t('fields.difficulty')}</label>
                <Dropdown
                  aria-label={t('fields.pickDifficulty')}
                  options={[
                    { value: '', label: t('difficulty.pickShort') },
                    { value: 'lako', label: t('difficulty.easy') },
                    { value: 'srednje', label: t('difficulty.medium') },
                    { value: 'tesko', label: t('difficulty.hard') },
                    { value: 'alpinizam', label: t('difficulty.alpinism') },
                  ]}
                  value={tezina}
                  onChange={setTezina}
                  fullWidth
                />
              </div>
            </div>

            {/* Opis */}
            <div>
              <label className={labelClass}>{t('fields.description')}</label>
              <textarea
                value={opis}
                onChange={(e) => setOpis(e.target.value)}
                className={`${inputClass} min-h-[80px]`}
                placeholder={t('placeholders.description')}
                rows={3}
              />
            </div>

            {/* Vodiči */}
            <div className="space-y-3 pt-1 border-t border-gray-50">
              {!drugiVodicCheck && (
                <div>
                  <label className={labelClass}>{t('fields.guide')}</label>
                  <Dropdown
                    aria-label={t('fields.pickGuide')}
                    options={[
                      { value: '', label: t('guide.optional') },
                      ...vodici.map((v) => ({
                        value: String(v.id),
                        label: `${v.fullName || v.username} (@${v.username})`,
                      })),
                    ]}
                    value={vodicId}
                    onChange={setVodicId}
                    fullWidth
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="drugi-vodic"
                  checked={drugiVodicCheck}
                  onChange={(e) => {
                    const checked = e.target.checked
                    setDrugiVodicCheck(checked)
                    if (checked) setVodicId('')
                    else setDrugiVodicIme('')
                  }}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                />
                <label htmlFor="drugi-vodic" className="text-xs sm:text-sm text-gray-700 font-medium">
                  {t('fields.secondGuideManual')}
                </label>
              </div>
              {drugiVodicCheck && (
                <div>
                  <label className={labelClass}>{t('fields.secondGuideName')}</label>
                  <input
                    type="text"
                    value={drugiVodicIme}
                    onChange={(e) => setDrugiVodicIme(e.target.value)}
                    placeholder={t('placeholders.fullName')}
                    className={inputClass}
                  />
                </div>
              )}
            </div>

            {/* Brojke o stazi */}
            <div className="grid gap-4 sm:gap-5 sm:grid-cols-3 pt-2 border-t border-gray-50">
              <div>
                <label className={labelClass}>{t('fields.ascentM')}</label>
                <input
                  type="number"
                  value={kumulativniUsponM}
                  onChange={(e) => setKumulativniUsponM(e.target.value)}
                  placeholder={t('placeholders.ascentM')}
                  className={inputClass}
                  min={0}
                  step={1}
                  required
                />
              </div>
              <div>
                <label className={labelClass}>{t('fields.lengthKm')}</label>
                <input
                  type="number"
                  value={duzinaStazeKm}
                  onChange={(e) => setDuzinaStazeKm(e.target.value)}
                  placeholder={t('placeholders.lengthKm')}
                  className={inputClass}
                  min={0}
                  step={0.1}
                  required
                />
              </div>
              <div>
                <label className={labelClass}>{t('fields.peakHeightM')}</label>
                <input
                  type="number"
                  value={visinaVrhM}
                  onChange={(e) => setVisinaVrhM(e.target.value)}
                  placeholder={t('placeholders.peakHeightM')}
                  className={inputClass}
                  min={0}
                  step={1}
                />
              </div>
            </div>

            {/* Zimski uspon + slika */}
            <div className="space-y-4 pt-2 border-t border-gray-50">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="zimski-uspon"
                  checked={zimskiUspon}
                  onChange={(e) => setZimskiUspon(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                />
                <label htmlFor="zimski-uspon" className="text-xs sm:text-sm text-gray-700 font-medium">
                  {t('fields.winterAscent')}
                </label>
              </div>

              <div>
                <label className={labelClass}>{t('fields.actionImageOptional')}</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSlika(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-emerald-700 hover:file:bg-emerald-100"
                />
              </div>
            </div>

            {/* Javna + Istorija kluba */}
            <div className="space-y-3 pt-2 border-t border-gray-50">
              <div className="flex items-center gap-3 p-3.5 rounded-lg bg-sky-50/60 border border-sky-100">
                <input
                  type="checkbox"
                  id="javna-past"
                  checked={javna}
                  onChange={(e) => setJavna(e.target.checked)}
                  className="w-4 h-4 rounded border-sky-300 text-sky-500 focus:ring-sky-500"
                />
                <label htmlFor="javna-past" className="text-xs sm:text-sm text-gray-800 font-medium">
                  {t('past.publicActionPastHelp')}
                </label>
              </div>
              <div className="flex items-center gap-3 p-3.5 rounded-lg bg-emerald-50/60 border border-emerald-100">
                <input
                  type="checkbox"
                  id="dodaj-u-istoriju"
                  checked={dodajUIstorijuKluba}
                  onChange={(e) => setDodajUIstorijuKluba(e.target.checked)}
                  className="w-4 h-4 rounded border-emerald-300 text-emerald-500 focus:ring-emerald-500"
                />
                <label htmlFor="dodaj-u-istoriju" className="text-xs sm:text-sm text-gray-800 font-medium">
                  {t('past.addToClubHistory')}
                </label>
              </div>
              <p className="text-[11px] text-gray-500">
                {t('past.historyHelp')}
              </p>
            </div>

            {/* Dugmad */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 disabled:opacity-60 disabled:cursor-wait transition-all"
              >
                {submitting ? t('past.adding') : t('past.submit')}
              </button>
              <button
                type="button"
                onClick={() => navigate('/profil')}
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/50 transition-all"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
          )}
        </div>
      </div>
    </div>
  )
}
