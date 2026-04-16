import { useEffect, useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import api from '../../../services/api'
import { useNavigate, useParams } from 'react-router-dom'
import BackButton from '../../../components/buttons/BackButton'
import { canManageHostAkcija } from '../../../utils/canManageAkcija'
import { useTranslation } from 'react-i18next'
import { ActionWizardForm, type WizardGuide, type WizardValues } from './ActionWizardForm'

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
  visinaVrhM?: number
  zimskiUspon?: boolean
  tipAkcije?: 'planina' | 'via_ferrata'
  trajanjeSati?: number
  rokPrijava?: string
  maxLjudi?: number
  mestoPolaska?: string
  kontaktTelefon?: string
  brojDana?: number
  cenaClan?: number
  cenaOstali?: number
  prikaziListuPrijavljenih?: boolean
  omoguciGrupniChat?: boolean
  smestaj?: Array<{ id: number; naziv: string; cenaPoOsobiUkupno: number; opis?: string }>
  opremaRent?: Array<{ id: number; nazivOpreme: string; dostupnaKolicina: number; cenaPoSetu: number }>
  prevoz?: Array<{ id: number; tipPrevoza: string; nazivGrupe: string; kapacitet: number; cenaPoOsobi: number }>
}

const emptyWizardValues: WizardValues = {
  naziv: '',
  actionKind: 'planina',
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
}

export default function EditAction() {
  const { t } = useTranslation('actionForms')
  const { user } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const [vodici, setVodici] = useState<Korisnik[]>([])
  const [values, setValues] = useState<WizardValues>(emptyWizardValues)
  const [initialImageUrl, setInitialImageUrl] = useState<string | undefined>(undefined)
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

        const canKnowHost = user.role === 'superadmin' || user.klubId != null
        if (a.klubId != null && canKnowHost && !canManageHostAkcija(user, a.klubId)) {
          navigate(`/akcije/${id}`, { replace: true })
          return
        }

        const datumStr = typeof a.datum === 'string' ? a.datum.slice(0, 10) : new Date(a.datum).toISOString().slice(0, 10)
        const rokPrijavaStr = a.rokPrijava ? new Date(a.rokPrijava).toISOString().slice(0, 10) : ''

        setValues({
          naziv: a.naziv || '',
          actionKind: a.tipAkcije || 'planina',
          visibility: a.javna ? 'javna' : 'klubska',
          planina: a.planina || '',
          vrh: a.vrh || '',
          datum: datumStr,
          opis: a.opis || '',
          tezina: (a.tezina === 'teško' ? 'tesko' : a.tezina) || '',
          kumulativniUsponM: a.kumulativniUsponM != null ? String(a.kumulativniUsponM) : '',
          duzinaStazeKm: a.duzinaStazeKm != null ? String(a.duzinaStazeKm) : '',
          visinaVrhM: a.visinaVrhM != null ? String(a.visinaVrhM) : '',
          zimskiUspon: a.zimskiUspon ?? false,
          vodicId: a.vodicId ? String(a.vodicId) : '',
          drugiVodicCheck: !!a.drugiVodicIme,
          drugiVodicIme: a.drugiVodicIme || '',
          trajanjeSati: a.trajanjeSati != null ? String(a.trajanjeSati) : '',
          rokPrijava: rokPrijavaStr,
          maxLjudi: a.maxLjudi != null ? String(a.maxLjudi) : '',
          mestoPolaska: a.mestoPolaska || '',
          kontaktTelefon: a.kontaktTelefon || '',
          brojDana: a.brojDana != null ? String(a.brojDana) : '1',
          cenaClan: a.cenaClan != null ? String(a.cenaClan) : '',
          cenaOstali: a.cenaOstali != null ? String(a.cenaOstali) : '',
          prikaziListuPrijavljenih: a.prikaziListuPrijavljenih ?? true,
          omoguciGrupniChat: a.omoguciGrupniChat ?? false,
          smestaj: (a.smestaj || []).map((s) => ({
            localId: `s-${s.id}`,
            naziv: s.naziv || '',
            cenaPoOsobiUkupno: String(s.cenaPoOsobiUkupno || 0),
            opis: s.opis || '',
          })),
          oprema: (a.opremaRent || []).map((o) => ({
            localId: `o-${o.id}`,
            naziv: o.nazivOpreme || '',
            dostupnaKolicina: String(o.dostupnaKolicina || 0),
            cenaPoSetu: String(o.cenaPoSetu || 0),
          })),
          prevoz: (a.prevoz || []).map((p) => ({
            localId: `p-${p.id}`,
            tipPrevoza: p.tipPrevoza || '',
            nazivGrupe: p.nazivGrupe || '',
            kapacitet: String(p.kapacitet || 0),
            cenaPoOsobi: String(p.cenaPoOsobi || 0),
          })),
        })
        setInitialImageUrl(a.slikaUrl)
      } catch (err: any) {
        setError(err.response?.data?.error || t('errors.loadAction'))
      } finally {
        setLoadingData(false)
      }
    }

    fetchAkcija()
  }, [id, user, navigate, t])

  if (!user || !['superadmin', 'admin', 'vodic'].includes(user.role)) {
    return <div className="text-center py-10 text-red-600">{t('edit.onlyAdminGuide')}</div>
  }

  const handleSubmit = async (formValues: WizardValues, image: File | null) => {
    if (!id) return
    setLoading(true)
    setError('')
    setSuccess('')

    if (!/^\d{4}-\d{2}-\d{2}$/.test(formValues.datum)) {
      setError(t('errors.invalidDateFormat'))
      setLoading(false)
      return
    }
    if (!formValues.tezina.trim()) {
      setError(t('errors.selectDifficulty'))
      setLoading(false)
      return
    }
    const dozvoljeneTezine = ['lako', 'srednje', 'tesko', 'alpinizam']
    if (!dozvoljeneTezine.includes(formValues.tezina.trim().toLowerCase())) {
      setError(t('errors.selectDifficultyFromList'))
      setLoading(false)
      return
    }

    try {
      const formData = new FormData()
      formData.append('naziv', formValues.naziv)
      formData.append('planina', formValues.planina.trim())
      formData.append('vrh', formValues.vrh)
      formData.append('datum', formValues.datum)
      formData.append('opis', formValues.opis)
      formData.append('tezina', formValues.tezina)
      formData.append('kumulativniUsponM', formValues.kumulativniUsponM)
      formData.append('duzinaStazeKm', formValues.duzinaStazeKm)
      formData.append('visinaVrhM', formValues.visinaVrhM)
      formData.append('zimskiUspon', String(formValues.zimskiUspon))
      formData.append('javna', String(formValues.visibility === 'javna'))
      formData.append('tipAkcije', formValues.actionKind)
      formData.append('trajanjeSati', formValues.trajanjeSati)
      formData.append('rokPrijava', formValues.rokPrijava)
      formData.append('maxLjudi', formValues.maxLjudi)
      formData.append('mestoPolaska', formValues.mestoPolaska)
      formData.append('kontaktTelefon', formValues.kontaktTelefon)
      formData.append('brojDana', formValues.brojDana)
      formData.append('cenaClan', formValues.cenaClan)
      formData.append('cenaOstali', formValues.cenaOstali)
      formData.append('prikaziListuPrijavljenih', String(formValues.prikaziListuPrijavljenih))
      formData.append('omoguciGrupniChat', String(formValues.omoguciGrupniChat))
      if (formValues.vodicId) formData.append('vodic_id', formValues.vodicId)
      if (formValues.drugiVodicCheck && formValues.drugiVodicIme.trim()) formData.append('drugi_vodic_ime', formValues.drugiVodicIme.trim())
      if (image) formData.append('slika', image)

      formData.append(
        'smestajJson',
        JSON.stringify(
          formValues.smestaj
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
          formValues.oprema
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
          formValues.prevoz
            .filter((p) => p.tipPrevoza.trim() && p.nazivGrupe.trim())
            .map((p) => ({
              tipPrevoza: p.tipPrevoza.trim(),
              nazivGrupe: p.nazivGrupe.trim(),
              kapacitet: Number(p.kapacitet || 0),
              cenaPoOsobi: Number(p.cenaPoOsobi || 0),
            })),
        ),
      )

      await api.patch(`/api/akcije/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setSuccess(t('edit.success'))
      navigate(`/akcije/${id}`)
    } catch (err: any) {
      setError(err.response?.data?.error || t('errors.editAction'))
    } finally {
      setLoading(false)
    }
  }

  const guides: WizardGuide[] = vodici.map((v) => ({ id: v.id, username: v.username, fullName: v.fullName }))

  if (loadingData) {
    return (
      <div className="py-8 px-4 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#41ac53] mx-auto mb-4"></div>
        <p className="text-gray-600">{t('edit.loading')}</p>
      </div>
    )
  }

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 pb-12">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
          <BackButton />
          <div className="w-10 sm:w-16" aria-hidden />
        </div>
        <div className="max-w-5xl mx-auto">
          <ActionWizardForm
            title={t('edit.title')}
            badge="Izmena akcije"
            submitText={t('edit.saveChanges')}
            submitLoadingText={t('edit.saving')}
            guides={guides}
            initialValues={values}
            initialImageUrl={initialImageUrl}
            loading={loading}
            error={error}
            success={success}
            imageHelpText={t('edit.imageKeepHint')}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </div>
  )
}
