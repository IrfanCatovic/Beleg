import { useEffect, useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { fetchMeProfile } from '../../../services/auth'
import { fetchKlub } from '../../../services/club'
import { fetchPublicFerratasCatalog } from '../../../services/ferratasPublic'
import { fetchPeakById } from '../../../services/catalog'
import { createAkcija } from '../../../services/actions'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ActionWizardForm, type WizardFerrataOption, type WizardGuide, type WizardValues } from './ActionWizardForm'
import { parseClubCurrency } from '../../../utils/clubCurrency'
import { loadActionFormGuides } from '../../../services/actionFormGuides'
import {
  buildGuideBookingFormContext,
  buildGuideBookingWizardPrefill,
  type GuideBookingFormContext,
} from '../../../components/ferrate/guideBookingActionPrefill'
import {
  buildWizardPatchFromFerrataRow,
  ferrataCatalogFromApiRow,
} from '../../../components/ferrate/ferrataWizardPrefill'
import { peakActionPrefillFrom, type PeakDTO } from '../../../components/map/peakActionPrefill'
import {
  buildPeakGuideBookingFormContext,
  buildPeakGuideBookingWizardPrefill,
  type PeakGuideBookingFormContext,
} from '../../../components/map/peakGuideBookingActionPrefill'
import {
  acceptFerrataGuideBooking,
  canGuideCreateActionFromBooking,
  ensureGuideCanAcceptBooking,
  getFerrataGuideBooking,
  guideBookingBlockedMessage,
  parseGuideBookingAcceptConflict,
} from '../../../services/ferrataGuideBookings'
import {
  acceptPeakGuideBooking,
  canGuideCreateActionFromPeakBooking,
  ensureGuideCanAcceptPeakBooking,
  getPeakGuideBooking,
  peakGuideBookingBlockedMessage,
  parsePeakGuideBookingAcceptConflict,
} from '../../../services/peakGuideBookings'
import {
  labelGuideBookingEquipment,
  labelGuideBookingExperience,
  labelGuideBookingTimeOfDay,
} from '../../../components/ferrate/guideBookingDisplayLabels'
import Loader from '../../../components/Loader'
import { createEmptyWizardValues } from './wizardDefaults'

export default function AddAction() {
  const { t } = useTranslation('actionForms')
  const { t: tFr } = useTranslation('ferrate')
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [vodici, setVodici] = useState<WizardGuide[]>([])
  const [clubCurrency, setClubCurrency] = useState(() => parseClubCurrency('RSD'))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [ferrataCatalog, setFerrataCatalog] = useState<WizardFerrataOption[]>([])

  const tipAkcije = (searchParams.get('tip') === 'via_ferrata' ? 'via_ferrata' : 'planina') as 'planina' | 'via_ferrata'
  const bookingIdParam = searchParams.get('booking_id')
  const bookingId = bookingIdParam ? Number(bookingIdParam) : 0
  const fromFerrataGuideBooking = tipAkcije === 'via_ferrata' && bookingId > 0
  const fromPeakGuideBooking = tipAkcije === 'planina' && bookingId > 0
  const fromGuideBooking = fromFerrataGuideBooking || fromPeakGuideBooking
  const fromFerrataProfiGuide =
    tipAkcije === 'via_ferrata' &&
    !fromGuideBooking &&
    searchParams.get('organizator') === 'vodic' &&
    Boolean(searchParams.get('ferrata_id'))
  const peakIdParam = searchParams.get('peak_id')
  const peakId = peakIdParam ? Number(peakIdParam) : 0
  const fromPeak = tipAkcije === 'planina' && peakId > 0
  const fromPeakGuide = fromPeak && searchParams.get('organizator') === 'vodic'
  const fromGuideOrganizer = fromGuideBooking || fromFerrataProfiGuide || fromPeakGuide

  const [bookingContext, setBookingContext] = useState<GuideBookingFormContext | PeakGuideBookingFormContext | null>(null)
  const [bookingPrefillLoading, setBookingPrefillLoading] = useState(fromGuideBooking)
  const [bookingPrefillError, setBookingPrefillError] = useState('')
  const [raceLostActionId, setRaceLostActionId] = useState<number | null>(null)

  const [initial, setInitial] = useState<WizardValues>(() => createEmptyWizardValues(tipAkcije, fromGuideOrganizer))
  const [myKorisnikId, setMyKorisnikId] = useState<number | null>(null)

  const resolveMyKorisnikId = async (): Promise<number | null> => {
    try {
      const profile = await fetchMeProfile()
      const id = (profile as { id?: number } | null)?.id
      if (typeof id === 'number' && id > 0) return id
    } catch {
      /* fallback na listu vodiča kluba */
    }
    if (!user?.username) return null
    const fromClub = vodici.find((v) => v.username === user.username)
    return fromClub?.id ?? null
  }

  useEffect(() => {
    // Ne resetuj formu dok učitavamo zahtev: inače kratko “blinkuje” prazna forma pa prefill.
    if (fromGuideOrganizer) return
    setInitial(createEmptyWizardValues(tipAkcije, false))
  }, [tipAkcije, fromGuideOrganizer])

  useEffect(() => {
    let cancelled = false

    async function loadFerrateAndBookingPrefill() {
      if (fromGuideBooking) {
        setBookingPrefillLoading(true)
        setBookingPrefillError('')
      }

      try {
        if (fromPeakGuideBooking) {
          try {
            const booking = await getPeakGuideBooking(bookingId)
            if (cancelled) return

            if (!canGuideCreateActionFromPeakBooking(booking)) {
              setBookingPrefillError(peakGuideBookingBlockedMessage(booking))
              setBookingContext(null)
              return
            }

            const timeOfDayLabel = labelGuideBookingTimeOfDay(tFr, booking.timeOfDay, booking.exactTime)
            let peakRow: PeakDTO | undefined
            try {
              peakRow = (await fetchPeakById(booking.peakId)) as PeakDTO
            } catch {
              peakRow = undefined
            }
            const prefill = buildPeakGuideBookingWizardPrefill(booking, peakRow, {
              experience: labelGuideBookingExperience(tFr, booking.groupExperience),
              equipment: labelGuideBookingEquipment(tFr, booking.equipmentStatus),
              timeOfDay: timeOfDayLabel,
            })

            setBookingContext(buildPeakGuideBookingFormContext(booking, timeOfDayLabel))
            const selfId = await resolveMyKorisnikId()
            if (!cancelled && selfId) setMyKorisnikId(selfId)
            setInitial((prev) => ({
              ...prev,
              ...prefill,
              organizerType: 'vodic',
              vodicId: selfId ? String(selfId) : prev.vodicId,
            }))
          } catch {
            if (!cancelled) {
              setBookingPrefillError('Zahtev za vođenje nije učitan. Proverite da li vam je i dalje dostupan.')
              setBookingContext(null)
            }
          } finally {
            if (!cancelled) setBookingPrefillLoading(false)
          }
          return
        }

        const rows = await fetchPublicFerratasCatalog()
        if (cancelled) return

        const catalog: WizardFerrataOption[] = rows.map((r) =>
          ferrataCatalogFromApiRow(r as Parameters<typeof ferrataCatalogFromApiRow>[0]),
        )
        setFerrataCatalog(catalog)

        const fid = searchParams.get('ferrata_id')

        if (fromFerrataGuideBooking) {
          try {
            const booking = await getFerrataGuideBooking(bookingId)
            if (cancelled) return

            if (!canGuideCreateActionFromBooking(booking)) {
              setBookingPrefillError(guideBookingBlockedMessage(booking))
              setBookingContext(null)
              return
            }

            const timeOfDayLabel = labelGuideBookingTimeOfDay(tFr, booking.timeOfDay, booking.exactTime)
            const ferrataRow = catalog.find((x) => x.id === booking.ferrataId)
            const prefill = buildGuideBookingWizardPrefill(booking, ferrataRow, {
              experience: labelGuideBookingExperience(tFr, booking.groupExperience),
              equipment: labelGuideBookingEquipment(tFr, booking.equipmentStatus),
              timeOfDay: timeOfDayLabel,
            })

            setBookingContext(buildGuideBookingFormContext(booking, timeOfDayLabel))
            const selfId = await resolveMyKorisnikId()
            if (!cancelled && selfId) setMyKorisnikId(selfId)
            setInitial((prev) => ({
              ...prev,
              ...prefill,
              organizerType: 'vodic',
              vodicId: selfId ? String(selfId) : prev.vodicId,
            }))
          } catch {
            if (!cancelled) {
              setBookingPrefillError('Zahtev za vođenje nije učitan. Proverite da li vam je i dalje dostupan.')
              setBookingContext(null)
            }
          } finally {
            if (!cancelled) setBookingPrefillLoading(false)
          }
          return
        }

        if (tipAkcije === 'via_ferrata' && fid) {
          const row = catalog.find((x) => String(x.id) === fid)
          if (row) {
            const selfId = fromFerrataProfiGuide ? await resolveMyKorisnikId() : null
            if (!cancelled && selfId) setMyKorisnikId(selfId)
            setInitial((prev) => ({
              ...prev,
              ...buildWizardPatchFromFerrataRow(row, prev, { fillOpis: false }),
              actionKind: 'via_ferrata',
              ...(fromFerrataProfiGuide
                ? {
                    organizerType: 'vodic' as const,
                    vodicId: selfId ? String(selfId) : prev.vodicId,
                  }
                : {}),
            }))
          }
        }
      } catch {
        if (!cancelled) {
          setFerrataCatalog([])
          if (fromGuideBooking) {
            setBookingPrefillError('Greška pri učitavanju podataka za akciju.')
            setBookingPrefillLoading(false)
          }
        }
      }
    }

    void loadFerrateAndBookingPrefill()
    return () => {
      cancelled = true
    }
  }, [tipAkcije, searchParams, tFr, fromGuideBooking, fromFerrataGuideBooking, fromPeakGuideBooking, fromFerrataProfiGuide, bookingId])

  useEffect(() => {
    if (!fromGuideBooking || !user?.username) return
    let cancelled = false
    void (async () => {
      const selfId = await resolveMyKorisnikId()
      if (cancelled || !selfId) return
      setMyKorisnikId(selfId)
      setInitial((prev) =>
        prev.vodicId ? prev : { ...prev, organizerType: 'vodic', vodicId: String(selfId) },
      )
    })()
    return () => {
      cancelled = true
    }
  }, [fromGuideBooking, user?.username, vodici])

  useEffect(() => {
    if (!fromPeak) return
    let cancelled = false
    void (async () => {
      try {
        const data = await fetchPeakById(peakId)
        if (cancelled) return
        const peak = data?.peak as PeakDTO | undefined
        if (!peak) return
        const patch = peakActionPrefillFrom(peak)
        const selfId = fromPeakGuide ? await resolveMyKorisnikId() : null
        if (!cancelled && selfId) setMyKorisnikId(selfId)
        setInitial((prev) => ({
          ...prev,
          actionKind: 'planina',
          planina: patch.planina || prev.planina,
          vrh: patch.vrh || prev.vrh,
          visinaVrhM: patch.visinaVrhM || prev.visinaVrhM,
          planinaLat: patch.planinaLat || prev.planinaLat,
          planinaLng: patch.planinaLng || prev.planinaLng,
          naziv: prev.naziv || patch.naziv,
          opis: prev.opis || patch.opis,
          ...(fromPeakGuide
            ? {
                organizerType: 'vodic' as const,
                vodicId: selfId ? String(selfId) : prev.vodicId,
              }
            : {}),
        }))
      } catch {
        /* prefill nije kritičan — forma ostaje upotrebljiva i bez njega */
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromPeak, fromPeakGuide, peakId])

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
        setVodici(await loadActionFormGuides())
      } catch {
        setVodici([])
      }
    }
    fetchVodici()
  }, [])

  useEffect(() => {
    const loadKlubValuta = async () => {
      try {
        const klub = await fetchKlub()
        const raw = klub?.valuta
        setClubCurrency(parseClubCurrency(raw))
      } catch {
        setClubCurrency(parseClubCurrency('RSD'))
      }
    }
    void loadKlubValuta()
  }, [])

  if (fromGuideBooking && bookingPrefillLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <Loader />
        <p className="text-sm text-gray-500 font-medium">Učitavamo podatke iz zahteva za vođenje…</p>
      </div>
    )
  }

  if (fromGuideBooking && bookingPrefillError) {
    return (
      <div className="max-w-lg mx-auto py-24 px-4 text-center space-y-4">
        <p className="text-sm text-rose-700 font-medium">{bookingPrefillError}</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Nazad
        </button>
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
      if (fromGuideBooking && bookingId > 0) {
        try {
          if (fromPeakGuideBooking) {
            await ensureGuideCanAcceptPeakBooking(bookingId)
          } else {
            await ensureGuideCanAcceptBooking(bookingId)
          }
        } catch (preCheckErr: unknown) {
          const msg =
            preCheckErr instanceof Error
              ? preCheckErr.message
              : 'Zahtev više nije dostupan za prihvatanje.'
          setError(msg)
          setLoading(false)
          return
        }
      }

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
      formData.append('organizatorTip', values.organizerType)
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
      const cenaClan = values.cenaClan
      const cenaOstali = values.actionKind === 'via_ferrata' ? cenaClan : values.cenaOstali
      formData.append('cenaClan', cenaClan)
      formData.append('cenaOstali', cenaOstali)
      formData.append('prikaziListuPrijavljenih', String(values.prikaziListuPrijavljenih))
      formData.append('omoguciGrupniChat', 'false')
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

      const res = await createAkcija(formData)

      const newActionId = res?.akcija?.id as number | undefined
      if (fromFerrataGuideBooking && newActionId) {
        try {
          await acceptFerrataGuideBooking(bookingId, newActionId)
        } catch (acceptErr: unknown) {
          const conflict = parseGuideBookingAcceptConflict(acceptErr)
          setRaceLostActionId(newActionId)
          const who = conflict.fulfilledByGuideName?.trim()
          const lostTo = who ? ` (${who})` : ''
          setError(
            conflict.error ||
              `Drugi vodič${lostTo} je stigao prvi. Akcija #${newActionId} je sačuvana ali nije povezana sa zahtevom. Obrišite je ako vam ne treba.`,
          )
          setLoading(false)
          return
        }
      }
      if (fromPeakGuideBooking && newActionId) {
        try {
          await acceptPeakGuideBooking(bookingId, newActionId)
        } catch (acceptErr: unknown) {
          const conflict = parsePeakGuideBookingAcceptConflict(acceptErr)
          setRaceLostActionId(newActionId)
          const who = conflict.fulfilledByGuideName?.trim()
          const lostTo = who ? ` (${who})` : ''
          setError(
            conflict.error ||
              `Drugi vodič${lostTo} je stigao prvi. Akcija #${newActionId} je sačuvana ali nije povezana sa zahtevom. Obrišite je ako vam ne treba.`,
          )
          setLoading(false)
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

  const guides: WizardGuide[] = (() => {
    const base = vodici
    if (!fromGuideBooking || !user?.username) return base
    if (base.some((g) => g.username === user.username)) return base
    const id = myKorisnikId ?? (initial.vodicId ? Number(initial.vodicId) : 0)
    if (!id || !Number.isFinite(id)) return base
    return [{ id, username: user.username, fullName: user.fullName || user.username }, ...base]
  })()

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 pb-12">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">

          <div className="w-10 sm:w-16" aria-hidden />
        </div>
        <div className="max-w-5xl mx-auto">
          {raceLostActionId && (
            <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-4 text-sm text-amber-950">
              <p className="font-semibold">Zahtev je u međuvremenu rešen</p>
              <p className="mt-1 text-amber-900/90">
                Vaša akcija #{raceLostActionId} je kreirana, ali zahtev je već povezan sa drugim vodičem.
              </p>
              <Link
                to={`/akcije/${raceLostActionId}`}
                className="mt-2 inline-flex font-semibold text-amber-800 hover:text-amber-950"
              >
                Otvori vašu akciju →
              </Link>
            </div>
          )}
          {bookingContext && (
            <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-4 sm:px-5 sm:py-5">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Akcija iz zahteva za vođenje</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {'ferrataNaziv' in bookingContext ? bookingContext.ferrataNaziv : bookingContext.peakNaziv} ·{' '}
                {bookingContext.requesterName}
              </p>
              <p className="mt-2 text-xs text-gray-600 leading-relaxed">
                Predloženo: {bookingContext.desiredDate} · {bookingContext.suggestedTime}. Datum i tačno vreme polaska
                možete izmeniti u formi ispod pre kreiranja akcije.
              </p>
            </div>
          )}
          <ActionWizardForm
            title={fromGuideBooking ? 'Kreiraj akciju iz zahteva' : tipAkcije === 'via_ferrata' ? tFr('wizardAddActionTitle') : t('add.title')}
            badge={
              fromPeakGuideBooking
                ? 'Planina · zahtev'
                : fromGuideBooking
                  ? 'Via ferrata · zahtev'
                  : tipAkcije === 'via_ferrata'
                    ? tFr('wizardAddActionBadge')
                    : t('add.badge')
            }
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
            lockOrganizerType={fromGuideBooking}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </div>
  )
}
