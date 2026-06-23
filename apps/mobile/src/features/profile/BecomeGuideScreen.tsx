import { useCallback, useEffect, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { GuideApplyPayload, GuideProfile } from '@beleg/shared/services'
import type { GuideTourTypeKey } from '@beleg/shared'
import {
  GUIDE_TOUR_TYPE_KEYS,
  GUIDE_TOUR_TYPE_LABELS,
} from '@beleg/shared'
import {
  applyGuideProfile,
  getMyGuideProfile,
  updateMyGuideProfile,
} from '@beleg/shared/services'
import { fetchMeProfile } from '@beleg/shared/services'
import { getApiErrorMessage } from '@beleg/shared'
import { client } from '../../api/client'
import { Button, Card, Input, Loader, Screen, Text } from '../../components/ui'
import { colors, radius, spacing } from '../../theme'
import type { ProfileStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<ProfileStackParamList, 'BecomeGuide'>

interface WizardForm {
  opis: string
  drzava: string
  region: string
  grad: string
  baseLat: string
  baseLng: string
  jezici: string
  sertifikatiOpis: string
  tourTypes: GuideTourTypeKey[]
  telefon: string
}

function emptyForm(): WizardForm {
  return {
    opis: '',
    drzava: '',
    region: '',
    grad: '',
    baseLat: '',
    baseLng: '',
    jezici: '',
    sertifikatiOpis: '',
    tourTypes: [],
    telefon: '',
  }
}

function profileToForm(gp: GuideProfile): WizardForm {
  return {
    opis: gp.opis ?? '',
    drzava: gp.drzava ?? '',
    region: gp.region ?? '',
    grad: gp.grad ?? '',
    baseLat: gp.baseLat != null ? String(gp.baseLat) : '',
    baseLng: gp.baseLng != null ? String(gp.baseLng) : '',
    jezici: (gp.jezici ?? []).join(', '),
    sertifikatiOpis: gp.sertifikatiOpis ?? '',
    tourTypes: (gp.tourTypes ?? []).filter((t: string): t is GuideTourTypeKey =>
      (GUIDE_TOUR_TYPE_KEYS as readonly string[]).includes(t),
    ),
    telefon: gp.user?.telefon ?? '',
  }
}

function parseCoord(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function formToPayload(form: WizardForm, telefonFallback: string): GuideApplyPayload | null {
  const lat = parseCoord(form.baseLat)
  const lng = parseCoord(form.baseLng)
  if (lat == null || lng == null) return null
  const jezici = form.jezici.split(/[,;]+/).map((j) => j.trim()).filter(Boolean)
  if (jezici.length === 0 || form.tourTypes.length === 0) return null
  if (!form.grad.trim() && !form.region.trim()) return null
  return {
    opis: form.opis.trim(),
    drzava: form.drzava.trim() || undefined,
    region: form.region.trim() || undefined,
    grad: form.grad.trim() || undefined,
    baseLat: lat,
    baseLng: lng,
    jezici,
    sertifikatiOpis: form.sertifikatiOpis.trim() || undefined,
    tourTypes: form.tourTypes,
    telefon: (form.telefon.trim() || telefonFallback.trim()) || undefined,
  }
}

export default function BecomeGuideScreen({ navigation }: Props) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<WizardForm>(emptyForm)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [savedTelefon, setSavedTelefon] = useState('')

  const profileQuery = useQuery({
    queryKey: ['my-guide-profile'],
    queryFn: () => getMyGuideProfile(client),
  })

  const meQuery = useQuery({
    queryKey: ['me-profile-guide'],
    queryFn: () => fetchMeProfile(client),
  })

  useEffect(() => {
    const gp = profileQuery.data
    if (gp) setForm(profileToForm(gp))
  }, [profileQuery.data])

  useEffect(() => {
    const tel = meQuery.data?.telefon?.trim() ?? ''
    setSavedTelefon(tel)
  }, [meQuery.data?.telefon])

  const profile = profileQuery.data
  const canEdit = !profile || profile.status === 'rejected'
  const telefonForSubmit = savedTelefon || form.telefon.trim()
  const needsTelefon = savedTelefon === ''

  const patch = useCallback((data: Partial<WizardForm>) => {
    setForm((prev) => ({ ...prev, ...data }))
  }, [])

  const toggleTour = useCallback((key: GuideTourTypeKey) => {
    setForm((prev) => {
      const has = prev.tourTypes.includes(key)
      return {
        ...prev,
        tourTypes: has ? prev.tourTypes.filter((x) => x !== key) : [...prev.tourTypes, key],
      }
    })
  }, [])

  const validateStep = useCallback(
    (s: number): boolean => {
      if (s === 1) {
        if (form.opis.trim().length < 30) return false
        if (telefonForSubmit === '') return false
        const jezici = form.jezici.split(/[,;]+/).map((j) => j.trim()).filter(Boolean)
        return jezici.length > 0
      }
      if (s === 2) {
        const lat = parseCoord(form.baseLat)
        const lng = parseCoord(form.baseLng)
        if (lat == null || lng == null) return false
        return !!(form.grad.trim() || form.region.trim())
      }
      if (s === 3) return form.tourTypes.length > 0
      return true
    },
    [form, telefonForSubmit],
  )

  const submit = useCallback(async () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      setError('Popunite sva obavezna polja.')
      return
    }
    const payload = formToPayload(form, telefonForSubmit)
    if (!payload) {
      setError('Proverite koordinate i obavezna polja.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      if (profile?.status === 'rejected') {
        await updateMyGuideProfile(client, payload)
      } else {
        await applyGuideProfile(client, payload)
      }
      navigation.goBack()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Slanje zahteva nije uspelo.'))
    } finally {
      setSubmitting(false)
    }
  }, [form, telefonForSubmit, profile?.status, validateStep, navigation])

  if (profileQuery.isLoading) {
    return (
      <Screen>
        <Loader />
      </Screen>
    )
  }

  if (profile && profile.status !== 'rejected' && !canEdit) {
    const statusLabel =
      profile.status === 'pending'
        ? 'Na čekanju'
        : profile.status === 'approved'
          ? 'Odobren'
          : 'Suspendovan'
    return (
      <Screen scroll>
        <View style={styles.header}>
          <Text variant="title">Profil vodiča</Text>
          <Card>
            <Text variant="heading">Status: {statusLabel}</Text>
            {profile.status === 'approved' ? (
              <Text color={colors.textMuted}>Vaš profi vodič profil je aktivan.</Text>
            ) : (
              <Text color={colors.textMuted}>Zahtev je u obradi. Bićete obavešteni kada bude rešen.</Text>
            )}
          </Card>
          <Button title="Nazad" variant="ghost" onPress={() => navigation.goBack()} />
        </View>
      </Screen>
    )
  }

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text variant="title" color={colors.brand}>Postani vodič</Text>
        <View style={styles.steps}>
          {[1, 2, 3].map((n) => (
            <View key={n} style={[styles.stepDot, step === n && styles.stepDotActive]}>
              <Text variant="small" color={step === n ? '#fff' : colors.textMuted}>{n}</Text>
            </View>
          ))}
        </View>
      </View>

      {error ? <Text variant="small" color={colors.danger} style={styles.error}>{error}</Text> : null}

      {step === 1 ? (
        <View style={styles.form}>
          <Input
            label="O tebi *"
            multiline
            value={form.opis}
            onChangeText={(v) => patch({ opis: v })}
            placeholder="Minimum 30 karaktera — iskustvo, stil vođenja…"
          />
          <Input
            label="Jezici *"
            value={form.jezici}
            onChangeText={(v) => patch({ jezici: v })}
            placeholder="srpski, engleski…"
          />
          {needsTelefon ? (
            <Input
              label="Telefon *"
              keyboardType="phone-pad"
              value={form.telefon}
              onChangeText={(v) => patch({ telefon: v })}
            />
          ) : null}
          <Input
            label="Sertifikati (opciono)"
            multiline
            value={form.sertifikatiOpis}
            onChangeText={(v) => patch({ sertifikatiOpis: v })}
          />
        </View>
      ) : null}

      {step === 2 ? (
        <View style={styles.form}>
          <Input label="Država" value={form.drzava} onChangeText={(v) => patch({ drzava: v })} />
          <Input label="Region *" value={form.region} onChangeText={(v) => patch({ region: v })} />
          <Input label="Grad *" value={form.grad} onChangeText={(v) => patch({ grad: v })} />
          <Input label="Geografska širina (lat) *" value={form.baseLat} onChangeText={(v) => patch({ baseLat: v })} placeholder="44.1234" />
          <Input label="Geografska dužina (lng) *" value={form.baseLng} onChangeText={(v) => patch({ baseLng: v })} placeholder="20.5678" />
          <Text variant="small" color={colors.textMuted}>
            Unesite koordinate baze (možete kopirati sa Google Maps).
          </Text>
        </View>
      ) : null}

      {step === 3 ? (
        <View style={styles.form}>
          <Text variant="label">Tipovi tura *</Text>
          <View style={styles.chips}>
            {GUIDE_TOUR_TYPE_KEYS.map((key) => {
              const selected = form.tourTypes.includes(key)
              return (
                <Pressable
                  key={key}
                  onPress={() => toggleTour(key)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text variant="small" color={selected ? '#fff' : colors.text}>
                    {GUIDE_TOUR_TYPE_LABELS[key]}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.nav}>
        {step > 1 ? (
          <Button title="Nazad" variant="ghost" onPress={() => setStep((s) => s - 1)} />
        ) : (
          <Button title="Otkaži" variant="ghost" onPress={() => navigation.goBack()} />
        )}
        {step < 3 ? (
          <Button
            title="Dalje"
            onPress={() => {
              if (!validateStep(step)) {
                setError('Popunite obavezna polja pre nego nastavite.')
                return
              }
              setError('')
              setStep((s) => s + 1)
            }}
          />
        ) : (
          <Button title={profile?.status === 'rejected' ? 'Pošalji ponovo' : 'Pošalji zahtev'} loading={submitting} onPress={submit} />
        )}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { gap: spacing.md, marginBottom: spacing.lg },
  steps: { flexDirection: 'row', gap: spacing.sm },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  stepDotActive: { backgroundColor: colors.brand },
  form: { gap: spacing.md, marginBottom: spacing.lg },
  error: { marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.brand, borderColor: colors.brand },
  nav: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingBottom: spacing.xxl },
})
