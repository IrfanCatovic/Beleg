import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import api from '../../../services/api'
import { useNavigate, useSearchParams } from 'react-router-dom'
import BackButton from '../../../components/buttons/BackButton'
import { useTranslation } from 'react-i18next'
import { ActionWizardForm, type WizardGuide, type WizardValues } from './ActionWizardForm'
import { parseClubCurrency } from '../../../utils/clubCurrency'

interface Korisnik {
  id: number
  username: string
  fullName: string
  role: string
}

const initialWizardValues = (tip: 'planina' | 'via_ferrata'): WizardValues => ({
  naziv: '',
  actionKind: tip,
  visibility: 'klubska',
  planina: '',
  vrh: '',
  datum: '',
  opis: '',
  tezina: '',
  kumulativniUsponM: '',
  duzinaStazeKm: '',
  visinaVrhM: '',
  zimskiUspon: false,
  vodicId: '',
  drugiVodicCheck: false,
  drugiVodicIme: '',
  trajanjeSati: '',
  rokPrijava: '',
  maxLjudi: '',
  mestoPolaska: '',
  kontaktTelefon: '',
  brojDana: '1',
  cenaClan: '',
  cenaOstali: '',
  prikaziListuPrijavljenih: true,
  omoguciGrupniChat: false,
  smestaj: [],
  oprema: [],
  prevoz: [],
})

export default function AddAction() {
  const { t } = useTranslation('actionForms')
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [vodici, setVodici] = useState<Korisnik[]>([])
  const [clubCurrency, setClubCurrency] = useState(() => parseClubCurrency('RSD'))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const tipAkcije = (searchParams.get('tip') === 'via_ferrata' ? 'via_ferrata' : 'planina') as 'planina' | 'via_ferrata'
  const defaults = useMemo(() => initialWizardValues(tipAkcije), [tipAkcije])

  const todayYmd = (() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  })()

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
    const loadKlubValuta = async () => {
      try {
        const res = await api.get('/api/klub')
        const raw = res.data?.klub?.valuta ?? res.data?.valuta
        setClubCurrency(parseClubCurrency(raw))
      } catch {
        setClubCurrency(parseClubCurrency('RSD'))
      }
    }
    void loadKlubValuta()
  }, [])

  if (!user || !['superadmin', 'admin', 'vodic'].includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <p className="text-sm text-gray-500 font-medium">{t('add.onlyAdminGuide')}</p>
      </div>
    )
  }

  const handleSubmit = async (values: WizardValues, image: File | null) => {
    setLoading(true)
    setError('')
    setSuccess('')

    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.datum)) {
      setError(t('errors.invalidDateFormat'))
      setLoading(false)
      return
    }
    if (values.datum < todayYmd) {
      setError(t('errors.pastDate'))
      setLoading(false)
      return
    }
    if (!values.tezina.trim()) {
      setError(t('errors.selectDifficulty'))
      setLoading(false)
      return
    }
    const dozvoljeneTezine = ['lako', 'srednje', 'tesko', 'alpinizam']
    if (!dozvoljeneTezine.includes(values.tezina.trim().toLowerCase())) {
      setError(t('errors.selectDifficultyFromList'))
      setLoading(false)
      return
    }

    try {
      const formData = new FormData()
      formData.append('naziv', values.naziv)
      formData.append('planina', values.planina.trim())
      formData.append('vrh', values.vrh)
      formData.append('datum', values.datum)
      formData.append('opis', values.opis)
      formData.append('tezina', values.tezina)
      formData.append('kumulativniUsponM', values.kumulativniUsponM)
      formData.append('duzinaStazeKm', values.duzinaStazeKm)
      formData.append('visinaVrhM', values.visinaVrhM)
      formData.append('zimskiUspon', String(values.zimskiUspon))
      formData.append('javna', String(values.visibility === 'javna'))
      formData.append('tipAkcije', values.actionKind)
      formData.append('trajanjeSati', values.trajanjeSati)
      formData.append('rokPrijava', values.rokPrijava)
      formData.append('maxLjudi', values.maxLjudi)
      formData.append('mestoPolaska', values.mestoPolaska)
      formData.append('kontaktTelefon', values.kontaktTelefon)
      formData.append('brojDana', values.brojDana)
      formData.append('cenaClan', values.cenaClan)
      formData.append('cenaOstali', values.cenaOstali)
      formData.append('prikaziListuPrijavljenih', String(values.prikaziListuPrijavljenih))
      formData.append('omoguciGrupniChat', String(values.omoguciGrupniChat))
      if (values.vodicId) formData.append('vodic_id', values.vodicId)
      if (values.drugiVodicCheck && values.drugiVodicIme.trim()) formData.append('drugi_vodic_ime', values.drugiVodicIme.trim())
      if (image) formData.append('slika', image)

      formData.append(
        'smestajJson',
        JSON.stringify(
          values.smestaj
            .filter((s) => s.naziv.trim())
            .map((s) => ({
              naziv: s.naziv.trim(),
              cenaPoOsobiUkupno: Number(s.cenaPoOsobiUkupno || 0),
              opis: s.opis.trim(),
            })),
        ),
      )
      formData.append(
        'opremaJson',
        JSON.stringify(
          values.oprema
            .filter((o) => o.naziv.trim())
            .map((o) => ({
              naziv: o.naziv.trim(),
              dostupnaKolicina: Number(o.dostupnaKolicina || 0),
              cenaPoSetu: Number(o.cenaPoSetu || 0),
            })),
        ),
      )
      formData.append(
        'prevozJson',
        JSON.stringify(
          values.prevoz
            .filter((p) => p.tipPrevoza.trim() && p.nazivGrupe.trim())
            .map((p) => ({
              tipPrevoza: p.tipPrevoza.trim(),
              nazivGrupe: p.nazivGrupe.trim(),
              kapacitet: Number(p.kapacitet || 0),
              cenaPoOsobi: Number(p.cenaPoOsobi || 0),
            })),
        ),
      )

      const res = await api.post('/api/akcije', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setSuccess(t('add.successWithId', { id: res.data.akcija.id }))
      navigate('/akcije')
    } catch (err: any) {
      setError(err.response?.data?.error || t('errors.addAction'))
    } finally {
      setLoading(false)
    }
  }

  const guides: WizardGuide[] = vodici.map((v) => ({ id: v.id, username: v.username, fullName: v.fullName }))

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 pb-12">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
          <BackButton />
          <div className="w-10 sm:w-16" aria-hidden />
        </div>
        <div className="max-w-5xl mx-auto">
          <ActionWizardForm
            title={t('add.title')}
            badge={t('add.badge')}
            submitText={t('add.submit')}
            submitLoadingText={t('add.adding')}
            guides={guides}
            initialValues={defaults}
            clubCurrency={clubCurrency}
            loading={loading}
            error={error}
            success={success}
            minDate={todayYmd}
            imageHelpText={t('fields.imageHelp')}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </div>
  )
}
