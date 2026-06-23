import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { PeakRow, WizardFerrataOption, WizardGuide, WizardValues } from '@beleg/shared'
import {
  buildActionWizardFormData,
  buildWizardPatchFromFerrataRow,
  createEmptyWizardValues,
  ferrataCatalogFromApiRow,
  getApiErrorMessage,
  buildGuideBookingWizardPrefill,
  buildPeakGuideBookingWizardPrefill,
} from '@beleg/shared'
import {
  acceptFerrataGuideBooking,
  acceptPeakGuideBooking,
  createAkcija,
  fetchKlub,
  fetchPeakById,
  fetchPublicFerratasCatalog,
  geocodeQuery,
  getFerrataGuideBooking,
  getPeakGuideBooking,
  loadActionFormGuides,
} from '@beleg/shared/services'
import { guideBookingLabels } from '../../utils/guideBookingLabels'
import { client } from '../../api/client'
import { AppTopBar, Loader, Screen, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { ActionsStackParamList } from '../../navigation/types'
import { ActionWizardForm } from './wizard/ActionWizardForm'

type Props = NativeStackScreenProps<ActionsStackParamList, 'ActionWizard'>

function todayYmd() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function peakPrefillFrom(peak: PeakRow): Partial<WizardValues> {
  const nazivVrha = (peak.naziv ?? '').trim()
  const lat = peak.lat
  const lng = peak.lng
  const visina = peak.visinaM
  const opis = typeof peak.opis === 'string' ? peak.opis.trim() : ''
  return {
    planina: (peak.planina ?? '').trim(),
    vrh: nazivVrha,
    visinaVrhM: visina != null && visina > 0 ? String(Math.round(visina)) : '',
    planinaLat: lat != null ? String(lat) : '',
    planinaLng: lng != null ? String(lng) : '',
    naziv: nazivVrha ? `Uspon na ${nazivVrha}` : '',
    opis,
  }
}

export default function ActionWizardScreen({ navigation, route }: Props) {
  const { tip, peakId, ferrataId, organizator, bookingId } = route.params
  const queryClient = useQueryClient()

  const fromGuideOrganizer = organizator === 'vodic'
  const lockFerrataSelection = tip === 'via_ferrata' && Boolean(ferrataId)

  const [guides, setGuides] = useState<WizardGuide[]>([])
  const [ferrataCatalog, setFerrataCatalog] = useState<WizardFerrataOption[]>([])
  const [clubCurrency, setClubCurrency] = useState('RSD')
  const [initialValues, setInitialValues] = useState<WizardValues>(() =>
    createEmptyWizardValues(tip, fromGuideOrganizer),
  )
  const [dataLoading, setDataLoading] = useState(true)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setDataLoading(true)
      try {
        const [guideRows, ferrataRows, klub] = await Promise.all([
          loadActionFormGuides(client),
          tip === 'via_ferrata' ? fetchPublicFerratasCatalog(client) : Promise.resolve([]),
          fetchKlub(client).catch(() => null),
        ])
        if (cancelled) return

        setGuides(guideRows)
        const catalog = ferrataRows.map((r) =>
          ferrataCatalogFromApiRow({
            ...r,
            tezina: r.tezina ?? '',
          }),
        )
        setFerrataCatalog(catalog)
        setClubCurrency((klub?.valuta || 'RSD').trim() || 'RSD')

        let next = createEmptyWizardValues(tip, fromGuideOrganizer)

        if (tip === 'via_ferrata' && ferrataId) {
          const row = catalog.find((x) => x.id === ferrataId)
          if (row) {
            next = {
              ...next,
              ...buildWizardPatchFromFerrataRow(row, next, { fillOpis: false }),
              actionKind: 'via_ferrata',
            }
          }
        }

        if (tip === 'planina' && peakId) {
          try {
            const peakData = await fetchPeakById(client, peakId)
            if (!cancelled && peakData) {
              const patch = peakPrefillFrom(peakData)
              next = {
                ...next,
                actionKind: 'planina',
                planina: patch.planina || next.planina,
                vrh: patch.vrh || next.vrh,
                visinaVrhM: patch.visinaVrhM || next.visinaVrhM,
                planinaLat: patch.planinaLat || next.planinaLat,
                planinaLng: patch.planinaLng || next.planinaLng,
                naziv: next.naziv || patch.naziv || '',
                opis: next.opis || patch.opis || '',
              }
            }
          } catch {
            /* prefill nije kritičan */
          }
        }

        if (bookingId) {
          try {
            if (tip === 'via_ferrata') {
              const booking = await getFerrataGuideBooking(client, bookingId)
              const row = catalog.find((x) => x.id === booking.ferrataId)
              const labels = guideBookingLabels(booking)
              const prefill = buildGuideBookingWizardPrefill(booking, row, labels)
              next = {
                ...next,
                actionKind: 'via_ferrata',
                ferrataId: prefill.ferrataId,
                naziv: prefill.naziv || next.naziv,
                datum: prefill.datum,
                vremePolaska: prefill.vremePolaska,
                maxLjudi: prefill.maxLjudi,
                kontaktTelefon: prefill.kontaktTelefon,
                opis: prefill.opis,
                trajanjeSati: prefill.trajanjeSati,
                planina: prefill.planina,
                vrh: prefill.vrh,
                tezina: prefill.tezina,
                kumulativniUsponM: prefill.kumulativniUsponM,
                duzinaStazeKm: prefill.duzinaStazeKm,
                organizerType: 'vodic',
              }
            } else if (tip === 'planina') {
              const booking = await getPeakGuideBooking(client, bookingId)
              let peakData: PeakRow | undefined
              try {
                peakData = await fetchPeakById(client, booking.peakId)
              } catch {
                peakData = undefined
              }
              const labels = guideBookingLabels(booking)
              const prefill = buildPeakGuideBookingWizardPrefill(booking, peakData, labels)
              next = {
                ...next,
                actionKind: 'planina',
                naziv: prefill.naziv,
                datum: prefill.datum,
                vremePolaska: prefill.vremePolaska,
                maxLjudi: prefill.maxLjudi,
                kontaktTelefon: prefill.kontaktTelefon,
                opis: prefill.opis,
                planina: prefill.planina,
                vrh: prefill.vrh,
                visinaVrhM: prefill.visinaVrhM,
                planinaLat: prefill.planinaLat,
                planinaLng: prefill.planinaLng,
                organizerType: 'vodic',
              }
            }
          } catch {
            /* booking prefill nije kritičan */
          }
        }

        if (!cancelled) setInitialValues(next)
      } catch {
        if (!cancelled) {
          setGuides([])
          setFerrataCatalog([])
          setClubCurrency('RSD')
        }
      } finally {
        if (!cancelled) setDataLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [tip, peakId, ferrataId, fromGuideOrganizer, bookingId])

  const title = useMemo(
    () => (tip === 'via_ferrata' ? 'Nova via ferrata akcija' : 'Nova planinarska akcija'),
    [tip],
  )

  const handleSubmit = async (
    values: WizardValues,
    image: { uri: string; name: string; type: string } | null,
  ) => {
    setSubmitLoading(true)
    setError('')

    const minDate = todayYmd()

    if (!values.datum.trim()) {
      setError('Izaberite datum akcije.')
      setSubmitLoading(false)
      return
    }
    if (values.datum < minDate) {
      setError('Datum akcije ne može biti u prošlosti.')
      setSubmitLoading(false)
      return
    }

    if (values.actionKind === 'via_ferrata') {
      if (!values.ferrataId.trim()) {
        setError('Izaberite via ferratu.')
        setSubmitLoading(false)
        return
      }
      if (!values.vremePolaska.trim()) {
        setError('Unesite vreme polaska.')
        setSubmitLoading(false)
        return
      }
    } else {
      if (!values.tezina.trim()) {
        setError('Izaberite težinu.')
        setSubmitLoading(false)
        return
      }
      const allowed = ['lako', 'srednje', 'tesko', 'alpinizam']
      if (!allowed.includes(values.tezina.trim().toLowerCase())) {
        setError('Težina mora biti iz liste.')
        setSubmitLoading(false)
        return
      }
      const la = parseFloat(String(values.planinaLat).replace(',', '.'))
      const ln = parseFloat(String(values.planinaLng).replace(',', '.'))
      if (!Number.isFinite(la) || !Number.isFinite(ln) || la < -90 || la > 90 || ln < -180 || ln > 180) {
        setError('Unesite ispravne koordinate planine.')
        setSubmitLoading(false)
        return
      }
    }

    try {
      const formData = buildActionWizardFormData(values, image)
      const res = await createAkcija(client, formData)
      const newId = res.akcija?.id
      if (bookingId && newId) {
        if (tip === 'via_ferrata') {
          await acceptFerrataGuideBooking(client, bookingId, newId)
        } else if (tip === 'planina') {
          await acceptPeakGuideBooking(client, bookingId, newId)
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['akcije'] })
      if (newId) {
        navigation.replace('ActionDetail', { id: newId })
      } else {
        navigation.goBack()
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Kreiranje akcije nije uspelo.'))
    } finally {
      setSubmitLoading(false)
    }
  }

  return (
    <View style={styles.root}>
      <AppTopBar
        leftIcon="arrow-back"
        onLeftPress={() => navigation.goBack()}
        center={<Text style={styles.topTitle}>{title}</Text>}
      />
      {dataLoading ? (
        <Loader />
      ) : (
        <Screen scroll padded edges={['left', 'right', 'bottom']}>
          <ActionWizardForm
            guides={guides}
            ferrataCatalog={ferrataCatalog}
            clubCurrency={clubCurrency}
            initialValues={initialValues}
            lockActionKind
            lockFerrataSelection={lockFerrataSelection}
            lockOrganizerType={fromGuideOrganizer}
            loading={submitLoading}
            error={error}
            onSubmit={handleSubmit}
            onGeocode={(q) => geocodeQuery(client, q)}
          />
        </Screen>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topTitle: { color: colors.textOnDark, fontWeight: '600', fontSize: 16 },
})
