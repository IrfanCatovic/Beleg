import { useEffect, useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import api from '../../../services/api'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ActionWizardForm, type WizardFerrataOption, type WizardGuide, type WizardValues } from './ActionWizardForm'
import { parseClubCurrency } from '../../../utils/clubCurrency'
import {
  bookingDepartureTime,
  buildGuideBookingActionDescription,
} from '../../../components/ferrate/guideBookingActionPrefill'
import {
  acceptFerrataGuideBooking,
  getFerrataGuideBooking,
} from '../../../services/ferrataGuideBookings'
import {
  labelGuideBookingEquipment,
  labelGuideBookingExperience,
  labelGuideBookingTimeOfDay,
} from '../../../components/ferrate/guideBookingDisplayLabels'

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
  vremePolaska: '09:00',
  ferrataId: '',
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
  planinaLat: '',
  planinaLng: '',
  smestaj: [],
  oprema: [],
  prevoz: [],
})

export default function AddAction() {
  const { t } = useTranslation('actionForms')
  const { t: tFr } = useTranslation('ferrate')
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [vodici, setVodici] = useState<Korisnik[]>([])
  const [clubCurrency, setClubCurrency] = useState(() => parseClubCurrency('RSD'))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [ferrataCatalog, setFerrataCatalog] = useState<WizardFerrataOption[]>([])

  const tipAkcije = (searchParams.get('tip') === 'via_ferrata' ? 'via_ferrata' : 'planina') as 'planina' | 'via_ferrata'
  const [initial, setInitial] = useState<WizardValues>(() => initialWizardValues(tipAkcije))

  useEffect(() => {
    setInitial(initialWizardValues(tipAkcije))
  }, [tipAkcije])

  useEffect(() => {
    let cancelled = false
    async function loadFerrate() {
      try {
        const res = await api.get('/api/ferratas')
        const rows = (res.data?.ferrate ?? []) as Array<{
          id: number
          naziv: string
          tezina: string
          drzava?: string
          duzinaM: number
          visinskaRazlikaM: number
          trajanjeMin: number
          trajanjeMax: number
        }>
        if (cancelled) return
        const catalog: WizardFerrataOption[] = rows.map((r) => ({
          id: r.id,
          naziv: r.naziv,
          tezina: r.tezina,
          drzava: r.drzava,
          duzinaM: r.duzinaM,
          visinskaRazlikaM: r.visinskaRazlikaM,
          trajanjeMin: Number(r.trajanjeMin ?? 0),
          trajanjeMax: Number(r.trajanjeMax ?? 0),
        }))
        setFerrataCatalog(catalog)
        const fid = searchParams.get('ferrata_id')
        const bookingIdRaw = searchParams.get('booking_id')
        const bookingId = bookingIdRaw ? Number(bookingIdRaw) : 0

        let bookingPrefill: Partial<WizardValues> | null = null
        if (tipAkcije === 'via_ferrata' && bookingId > 0) {
          try {
            const booking = await getFerrataGuideBooking(bookingId)
            if (cancelled) return
            const ferrataRow = catalog.find((x) => x.id === booking.ferrataId)
            const trajanje =
              ferrataRow && (ferrataRow.trajanjeMax > 0 || ferrataRow.trajanjeMin > 0)
                ? String(
                    Math.round(
                      ((ferrataRow.trajanjeMin || 0) + (ferrataRow.trajanjeMax || ferrataRow.trajanjeMin || 0)) / 2,
                    ) || ferrataRow.trajanjeMax || ferrataRow.trajanjeMin,
                  )
                : ''
            bookingPrefill = {
              actionKind: 'via_ferrata',
              ferrataId: String(booking.ferrataId),
              naziv: booking.ferrata.naziv ? `${booking.ferrata.naziv} — vođenje` : '',
              datum: booking.desiredDate,
              vremePolaska: bookingDepartureTime(booking.timeOfDay, booking.exactTime),
              maxLjudi: String(booking.numberOfPeople),
              kontaktTelefon: booking.contactPhone,
              opis: buildGuideBookingActionDescription(booking, {
                experience: labelGuideBookingExperience(tFr, booking.groupExperience),
                equipment: labelGuideBookingEquipment(tFr, booking.equipmentStatus),
                timeOfDay: labelGuideBookingTimeOfDay(tFr, booking.timeOfDay, booking.exactTime),
              }),
              trajanjeSati: trajanje,
              planina: (booking.ferrata.drzava || '').trim() || 'Via ferrata',
              vrh: booking.ferrata.naziv || '',
              tezina: ferrataRow?.tezina ?? '',
              kumulativniUsponM: ferrataRow ? String(ferrataRow.visinskaRazlikaM ?? 0) : '',
              duzinaStazeKm: ferrataRow ? String((ferrataRow.duzinaM ?? 0) / 1000) : '',
            }
          } catch {
            bookingPrefill = null
          }
        }

        if (tipAkcije === 'via_ferrata' && (fid || bookingPrefill?.ferrataId)) {
          const effectiveFid = bookingPrefill?.ferrataId || fid || ''
          const row = catalog.find((x) => String(x.id) === effectiveFid)
          if (row || bookingPrefill) {
            setInitial((prev) => ({
              ...prev,
              actionKind: 'via_ferrata',
              ferrataId: effectiveFid,
              tezina: bookingPrefill?.tezina || row?.tezina || prev.tezina,
              planina: bookingPrefill?.planina || (row?.drzava || '').trim() || 'Via ferrata',
              vrh: bookingPrefill?.vrh || row?.naziv || prev.vrh,
              kumulativniUsponM:
                bookingPrefill?.kumulativniUsponM || (row ? String(row.visinskaRazlikaM ?? 0) : prev.kumulativniUsponM),
              duzinaStazeKm:
                bookingPrefill?.duzinaStazeKm || (row ? String((row.duzinaM ?? 0) / 1000) : prev.duzinaStazeKm),
              ...bookingPrefill,
            }))
          }
        }
      } catch {
        if (!cancelled) setFerrataCatalog([])
      }
    }
    void loadFerrate()
    return () => {
      cancelled = true
    }
  }, [tipAkcije, searchParams, tFr])

  useEffect(() => {
    if (!user?.username || !searchParams.get('booking_id')) return
    const me = vodici.find((v) => v.username === user.username)
    if (!me) return
    setInitial((prev) => (prev.vodicId ? prev : { ...prev, vodicId: String(me.id) }))
  }, [vodici, user?.username, searchParams])

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
    if (values.actionKind === 'via_ferrata') {
      if (!values.ferrataId.trim()) {
        setError(tFr('wizardFerrataRequired'))
        setLoading(false)
        return
      }
      if (!values.vremePolaska.trim()) {
        setError(tFr('wizardStartAtRequired'))
        setLoading(false)
        return
      }
    } else {
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
      const la = parseFloat(String(values.planinaLat).replace(',', '.'))
      const ln = parseFloat(String(values.planinaLng).replace(',', '.'))
      if (!Number.isFinite(la) || !Number.isFinite(ln) || la < -90 || la > 90 || ln < -180 || ln > 180) {
        setError(t('errors.missingPlaninaLocation'))
        setLoading(false)
        return
      }
    }

    try {
      const formData = new FormData()
      formData.append('naziv', values.naziv)
      formData.append('planina', values.planina.trim())
      formData.append('vrh', values.vrh)
      formData.append('datum', values.datum)
      if (values.actionKind === 'via_ferrata') {
        formData.append('ferrataId', values.ferrataId.trim())
        formData.append('startAt', `${values.datum}T${values.vremePolaska.trim()}`)
        formData.append('brojDana', '1')
        formData.append('mestoPolaska', '')
        formData.append('zimskiUspon', 'false')
        formData.append('visinaVrhM', '0')
      }
      formData.append('opis', values.opis)
      formData.append('tezina', values.tezina)
      formData.append('kumulativniUsponM', values.kumulativniUsponM)
      formData.append('duzinaStazeKm', values.duzinaStazeKm)
      formData.append('visinaVrhM', values.visinaVrhM)
      formData.append('zimskiUspon', String(values.zimskiUspon))
      formData.append('javna', String(values.visibility === 'javna'))
      formData.append('tipAkcije', values.actionKind)
      if (values.actionKind === 'planina') {
        formData.append('planinaLat', values.planinaLat.trim())
        formData.append('planinaLng', values.planinaLng.trim())
        formData.append('trajanjeSati', values.trajanjeSati)
      }
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
      if (values.actionKind !== 'via_ferrata' && image) formData.append('slika', image)

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

      const newActionId = res.data?.akcija?.id as number | undefined
      const bookingIdRaw = searchParams.get('booking_id')
      const bookingId = bookingIdRaw ? Number(bookingIdRaw) : 0
      if (values.actionKind === 'via_ferrata' && bookingId > 0 && newActionId) {
        try {
          await acceptFerrataGuideBooking(bookingId, newActionId)
        } catch {
          setSuccess(
            t('add.successWithId', { id: newActionId }) +
              ' (zahtev za vođenje nije automatski povezan — pokušajte ručno.)',
          )
          navigate('/akcije')
          return
        }
      }

      setSuccess(t('add.successWithId', { id: newActionId }))
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

          <div className="w-10 sm:w-16" aria-hidden />
        </div>
        <div className="max-w-5xl mx-auto">
          <ActionWizardForm
            title={t('add.title')}
            badge={t('add.badge')}
            submitText={t('add.submit')}
            submitLoadingText={t('add.adding')}
            guides={guides}
            initialValues={initial}
            clubCurrency={clubCurrency}
            loading={loading}
            error={error}
            success={success}
            minDate={todayYmd}
            imageHelpText={t('fields.imageHelp')}
            lockActionKind={searchParams.has('tip')}
            ferrataCatalog={ferrataCatalog}
            lockFerrataSelection={
              tipAkcije === 'via_ferrata' &&
              (!!searchParams.get('ferrata_id') || !!searchParams.get('booking_id'))
            }
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </div>
  )
}
