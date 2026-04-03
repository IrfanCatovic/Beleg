import { useState, useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import api from '../../../services/api'
import { useNavigate, useParams } from 'react-router-dom'
import BackButton from '../../../components/buttons/BackButton'
import Dropdown from '../../../components/Dropdown'
import { canManageHostAkcija } from '../../../utils/canManageAkcija'
import { useTranslation } from 'react-i18next'

interface Korisnik {
  id: number
  username: string
  fullName: string
  role: string
}

interface AkcijaData {
  id: number
  naziv: string
  planina?: string
  vrh: string
  datum: string
  opis: string
  tezina: string
  slikaUrl?: string
  kumulativniUsponM?: number
  duzinaStazeKm?: number
  vodicId?: number
  drugiVodicIme?: string
  isCompleted?: boolean
  javna?: boolean
  klubId?: number
}

export default function EditAction() {
  const { t } = useTranslation('actionForms')
  const { user } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const [vodici, setVodici] = useState<Korisnik[]>([])
  const [naziv, setNaziv] = useState('')
  const [planina, setPlanina] = useState('')
  const [vrh, setVrh] = useState('')
  const [datum, setDatum] = useState('')
  const [opis, setOpis] = useState('')
  const [tezina, setTezina] = useState('')
  const [slika, setSlika] = useState<File | null>(null)
  const [kumulativniUsponM, setKumulativniUsponM] = useState('')
  const [duzinaStazeKm, setDuzinaStazeKm] = useState('')
  const [vodicId, setVodicId] = useState('')
  const [drugiVodicCheck, setDrugiVodicCheck] = useState(false)
  const [drugiVodicIme, setDrugiVodicIme] = useState('')
  const [javna, setJavna] = useState(false)

  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const fetchVodici = async () => {
      try {
        const res = await api.get('/api/korisnici')
        const korisnici = res.data.korisnici || []
        setVodici(korisnici.filter((k: Korisnik) => k.role === 'vodic'))
      } catch {
        setVodici([])
      }
    }
    fetchVodici()
  }, [])

  useEffect(() => {
    if (!id || !user) return

    const fetchAkcija = async () => {
      setLoadingData(true)
      try {
        const res = await api.get(`/api/akcije/${id}`)
        const a: AkcijaData = res.data

        const canKnowHost =
          user.role === 'superadmin' || user.klubId != null
        if (
          a.klubId != null &&
          canKnowHost &&
          !canManageHostAkcija(user, a.klubId)
        ) {
          navigate(`/akcije/${id}`, { replace: true })
          return
        }

        const datumStr = typeof a.datum === 'string'
          ? a.datum.slice(0, 10)
          : new Date(a.datum).toISOString().slice(0, 10)

        setNaziv(a.naziv || '')
        setPlanina(a.planina || '')
        setVrh(a.vrh || '')
        setDatum(datumStr)
        setOpis(a.opis || '')
        setTezina((a.tezina === 'teško' ? 'tesko' : a.tezina) || '')
        setKumulativniUsponM(a.kumulativniUsponM != null ? String(a.kumulativniUsponM) : '')
        setDuzinaStazeKm(a.duzinaStazeKm != null ? String(a.duzinaStazeKm) : '')
        setVodicId(a.vodicId ? String(a.vodicId) : '')
        setDrugiVodicIme(a.drugiVodicIme || '')
        setDrugiVodicCheck(!!a.drugiVodicIme)
        setJavna(a.javna ?? false)
      } catch (err: any) {
        setError(err.response?.data?.error || t('errors.loadAction'))
      } finally {
        setLoadingData(false)
      }
    }

    fetchAkcija()
  }, [id, user, navigate])

  if (!user || !['superadmin', 'admin', 'vodic'].includes(user.role)) {
    return <div className="text-center py-10 text-red-600">{t('edit.onlyAdminGuide')}</div>
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    setLoading(true)
    setError('')
    setSuccess('')

    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
      setError(t('errors.invalidDateFormat'))
      setLoading(false)
      return
    }
    if (!tezina.trim()) {
      setError(t('errors.selectDifficulty'))
      setLoading(false)
      return
    }
    const dozvoljeneTezine = ['lako', 'srednje', 'tesko', 'alpinizam']
    if (!dozvoljeneTezine.includes(tezina.trim().toLowerCase())) {
      setError(t('errors.selectDifficultyFromList'))
      setLoading(false)
      return
    }

    try {
      const formData = new FormData()
      formData.append('naziv', naziv)
      formData.append('planina', planina.trim())
      formData.append('vrh', vrh)
      formData.append('datum', datum)
      formData.append('opis', opis)
      formData.append('tezina', tezina)
      formData.append('kumulativniUsponM', kumulativniUsponM)
      formData.append('duzinaStazeKm', duzinaStazeKm)
      if (vodicId) formData.append('vodic_id', vodicId)
      if (drugiVodicCheck && drugiVodicIme.trim()) formData.append('drugi_vodic_ime', drugiVodicIme.trim())
      formData.append('javna', String(javna))
      if (slika) formData.append('slika', slika)

      await api.patch(`/api/akcije/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      setSuccess(t('edit.success'))
      navigate(`/akcije/${id}`)
    } catch (err: any) {
      setError(err.response?.data?.error || t('errors.editAction'))
      console.error('Greška:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loadingData) {
    return (
      <div className="py-8 px-4 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#41ac53] mx-auto mb-4"></div>
        <p className="text-gray-600">{t('edit.loading')}</p>
      </div>
    )
  }

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
      <div className="flex flex-row items-center justify-between gap-4 mb-8">
        <BackButton />
        <h2 className="text-3xl font-bold flex-1 text-center" style={{ color: '#41ac53' }}>
          {t('edit.title')}
        </h2>
        <div className="w-14" aria-hidden />
      </div>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md p-6 space-y-6">
        <div>
          <label className="block text-gray-700 font-medium mb-2">{t('fields.actionName')}</label>
          <input
            type="text"
            value={naziv}
            onChange={(e) => setNaziv(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-[#41ac53]"
            required
          />
        </div>

        <div>
          <label className="block text-gray-700 font-medium mb-2">{t('fields.mountainName')}</label>
          <input
            type="text"
            value={planina}
            onChange={(e) => setPlanina(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-[#41ac53]"
            placeholder={t('placeholders.mountain')}
            required
          />
        </div>

        <div>
          <label className="block text-gray-700 font-medium mb-2">{t('fields.peak')}</label>
          <input
            type="text"
            value={vrh}
            onChange={(e) => setVrh(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-[#41ac53]"
            required
          />
        </div>

        <div>
          <label className="block text-gray-700 font-medium mb-2">{t('fields.actionDate')}</label>
          <input
            type="date"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-[#41ac53]"
            required
          />
        </div>

        <div>
          <label className="block text-gray-700 font-medium mb-2">{t('fields.description')}</label>
          <textarea
            value={opis}
            onChange={(e) => setOpis(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-[#41ac53]"
            rows={4}
          />
        </div>

        {!drugiVodicCheck && (
          <div>
            <label className="block text-gray-700 font-medium mb-2">{t('fields.guide')}</label>
            <Dropdown
              aria-label={t('fields.pickGuide')}
              options={[
                { value: '', label: t('guide.pick') },
                ...vodici.map((v) => ({
                  value: String(v.id),
                  label: `${v.fullName} (@${v.username})`,
                })),
              ]}
              value={vodicId}
              onChange={setVodicId}
              fullWidth
            />
          </div>
        )}

        <div className="flex items-center gap-3">
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
            className="w-4 h-4 rounded border-gray-300 text-[#41ac53] focus:ring-[#41ac53]"
          />
          <label htmlFor="drugi-vodic" className="text-gray-700 font-medium">
            {t('fields.secondGuide')}
          </label>
        </div>
        {drugiVodicCheck && (
          <div>
            <label className="block text-gray-700 font-medium mb-2">{t('fields.enterGuideName')}</label>
            <input
              type="text"
              value={drugiVodicIme}
              onChange={(e) => setDrugiVodicIme(e.target.value)}
              placeholder={t('placeholders.secondGuideName')}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-[#41ac53]"
            />
          </div>
        )}

        <div className="flex items-center gap-3 p-3.5 rounded-lg bg-sky-50/60 border border-sky-100">
          <input
            type="checkbox"
            id="javna-edit"
            checked={javna}
            onChange={(e) => setJavna(e.target.checked)}
            className="w-4 h-4 rounded border-sky-300 text-sky-500 focus:ring-sky-500"
          />
          <label htmlFor="javna-edit" className="text-sm text-gray-800 font-medium">
            {t('fields.publicActionEditHelp')}
          </label>
        </div>

        <div>
          <label className="block text-gray-700 font-medium mb-2">{t('fields.difficulty')}</label>
          <Dropdown
            aria-label={t('fields.pickDifficulty')}
            options={[
              { value: '', label: t('difficulty.pick') },
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

        <div>
          <label className="block text-gray-700 font-medium mb-2">{t('fields.cumulativeAscentM')}</label>
          <input
            type="number"
            value={kumulativniUsponM}
            onChange={(e) => setKumulativniUsponM(e.target.value)}
            placeholder={t('placeholders.ascentM')}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-[#41ac53]"
            min="0"
            step="1"
          />
        </div>

        <div>
          <label className="block text-gray-700 font-medium mb-2">{t('fields.trailLengthKm')}</label>
          <input
            type="number"
            value={duzinaStazeKm}
            onChange={(e) => setDuzinaStazeKm(e.target.value)}
            placeholder={t('placeholders.lengthKm')}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-[#41ac53]"
            min="0"
            step="0.1"
          />
        </div>

        <div>
          <label className="block text-gray-700 font-medium mb-2">{t('fields.actionImage')}</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setSlika(e.target.files?.[0] || null)}
            className="w-full px-4 py-2 border rounded-lg"
          />
          <p className="text-sm text-gray-500 mt-1">{t('edit.imageKeepHint')}</p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg py-3 font-medium text-white transition-colors duration-200 disabled:opacity-50"
          style={{ backgroundColor: '#41ac53' }}
        >
          {loading ? t('edit.saving') : t('edit.saveChanges')}
        </button>

        {error && <p className="text-red-600 text-center mt-4">{error}</p>}
        {success && <p className="text-green-600 text-center mt-4">{success}</p>}
      </form>
    </div>
  )
}
