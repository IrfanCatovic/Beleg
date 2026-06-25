import { useEffect, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { formatActionDate, getApiErrorMessage, isValidHHMM } from '@beleg/shared'
import type {
  GuideBookingEquipmentStatus,
  GuideBookingGroupExperience,
  GuideBookingTimeOfDay,
} from '@beleg/shared/types'
import {
  createPeakGuideBooking,
  listGuidesCatalog,
  listGuidesNearby,
  type GuideNearbyPublic,
} from '@beleg/shared/services'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import { Avatar, Button, DatePickerField, Text, TimePickerField } from '../../components/ui'
import { colors, radius, spacing } from '../../theme'

interface PeakGuideBookingModalProps {
  visible: boolean
  onClose: () => void
  peakId: number
  peakName: string
  peakLat?: number
  peakLng?: number
}

const TIME_OPTIONS: { value: GuideBookingTimeOfDay; label: string }[] = [
  { value: 'morning', label: 'Jutro' },
  { value: 'afternoon', label: 'Popodne' },
  { value: 'any', label: 'Bilo kada' },
  { value: 'exact', label: 'Tačno vreme' },
]

const EXPERIENCE_OPTIONS: { value: GuideBookingGroupExperience; label: string }[] = [
  { value: 'beginners', label: 'Početnici' },
  { value: 'recreational', label: 'Rekreativci' },
  { value: 'experienced', label: 'Iskusni' },
  { value: 'mixed', label: 'Mešovita grupa' },
]

const EQUIPMENT_OPTIONS: { value: GuideBookingEquipmentStatus; label: string }[] = [
  { value: 'complete', label: 'Imamo kompletnu opremu' },
  { value: 'none', label: 'Nemamo opremu' },
  { value: 'partial', label: 'Delimična oprema' },
  { value: 'unsure', label: 'Nismo sigurni' },
]

function guideName(g: GuideNearbyPublic): string {
  return g.user?.fullName || g.user?.username || g.naslov || 'Vodič'
}

export function PeakGuideBookingModal({
  visible,
  onClose,
  peakId,
  peakName,
  peakLat,
  peakLng,
}: PeakGuideBookingModalProps) {
  const { user } = useAuth()
  const { showAlert } = useModal()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [desiredDate, setDesiredDate] = useState('')
  const [timeOfDay, setTimeOfDay] = useState<GuideBookingTimeOfDay>('any')
  const [exactTime, setExactTime] = useState('')
  const [dateFlexible, setDateFlexible] = useState(false)
  const [numberOfPeople, setNumberOfPeople] = useState('2')
  const [groupExperience, setGroupExperience] = useState<GuideBookingGroupExperience | ''>('')
  const [equipmentStatus, setEquipmentStatus] = useState<GuideBookingEquipmentStatus | ''>('')
  const [contactPhone, setContactPhone] = useState('')
  const [additionalMessage, setAdditionalMessage] = useState('')
  const [guides, setGuides] = useState<GuideNearbyPublic[]>([])
  const [guidesLoading, setGuidesLoading] = useState(false)
  const [showAllGuides, setShowAllGuides] = useState(false)
  const [selectedGuideIds, setSelectedGuideIds] = useState<Set<number>>(new Set())
  const [localError, setLocalError] = useState('')
  const [step2Error, setStep2Error] = useState('')

  const hasCoords = peakLat != null && peakLng != null

  useEffect(() => {
    if (!visible) return
    setStep(1)
    setDesiredDate('')
    setTimeOfDay('any')
    setExactTime('09:00')
    setDateFlexible(false)
    setNumberOfPeople('2')
    setGroupExperience('')
    setEquipmentStatus('')
    setContactPhone('')
    setAdditionalMessage('')
    setGuides([])
    setShowAllGuides(false)
    setSelectedGuideIds(new Set())
    setLocalError('')
    setStep2Error('')
  }, [visible])

  const submitMutation = useMutation({
    mutationFn: (skipGuides: boolean) => {
      if (!desiredDate.trim()) throw new Error('Izaberite datum.')
      return createPeakGuideBooking(client, {
        peakId,
        guideProfileIds: skipGuides ? [] : Array.from(selectedGuideIds),
        skipGuides,
        desiredDate: desiredDate.trim(),
        timeOfDay,
        exactTime: timeOfDay === 'exact' ? exactTime : '',
        dateFlexible,
        numberOfPeople: Math.max(1, Number(numberOfPeople) || 1),
        groupExperience: groupExperience || 'mixed',
        equipmentStatus: equipmentStatus || 'unsure',
        contactPhone: contactPhone.trim(),
        additionalMessage: additionalMessage.trim(),
      })
    },
    onSuccess: async (data) => {
      await showAlert(
        'Zahtev poslat',
        `Obavešteno je ${data.notifiedCount} vodiča. Očekujte odgovor uskoro.`,
      )
      onClose()
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Slanje zahteva nije uspelo.')),
  })

  const validateStep1 = (): string | null => {
    if (!desiredDate.trim()) return 'Izaberite željeni datum.'
    if (timeOfDay === 'exact' && !isValidHHMM(exactTime)) return 'Izaberite tačno vreme polaska.'
    const n = Number(numberOfPeople)
    if (!Number.isFinite(n) || n < 1) return 'Unesite validan broj osoba.'
    if (!groupExperience) return 'Izaberite iskustvo grupe.'
    if (!equipmentStatus) return 'Izaberite status opreme.'
    if (!contactPhone.trim()) return 'Unesite kontakt telefon.'
    return null
  }

  const loadNearbyGuides = async () => {
    if (!hasCoords) {
      setGuides([])
      return
    }
    setGuidesLoading(true)
    try {
      const list = await listGuidesNearby(client, {
        lat: peakLat!,
        lng: peakLng!,
        radiusKm: 100,
        limit: 30,
        tourType: 'uspon_na_vrh',
      })
      if (list.length > 0) {
        setGuides(list)
        setShowAllGuides(false)
        setSelectedGuideIds(new Set(list.map((g) => g.id)))
        return
      }
      const catalog = await listGuidesCatalog(client, { category: 'planine', limit: 100 })
      setGuides(catalog)
      setShowAllGuides(true)
      setSelectedGuideIds(new Set())
    } catch {
      setGuides([])
    } finally {
      setGuidesLoading(false)
    }
  }

  const loadAllGuides = async () => {
    setGuidesLoading(true)
    try {
      const list = await listGuidesCatalog(client, { category: 'planine', limit: 100 })
      setGuides(list)
      setShowAllGuides(true)
    } catch {
      setGuides([])
    } finally {
      setGuidesLoading(false)
    }
  }

  const goStep2 = async () => {
    const err = validateStep1()
    if (err) {
      setLocalError(err)
      return
    }
    setLocalError('')
    if (!hasCoords) {
      submitMutation.mutate(true)
      return
    }
    await loadNearbyGuides()
    setStep(2)
  }

  const goStep3 = () => {
    if (selectedGuideIds.size === 0) {
      setStep2Error('Izaberite bar jednog vodiča.')
      return
    }
    setStep2Error('')
    setStep(3)
  }

  const toggleGuide = (id: number) => {
    setStep2Error('')
    setSelectedGuideIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const reviewDate = desiredDate ? formatActionDate(desiredDate) : '—'

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
          <Text variant="label">Zakaži vodiča</Text>
          <Text variant="small" color={colors.textMuted}>
            {step}/3
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text variant="small" color={colors.textMuted} style={styles.spotName}>
            {peakName}
          </Text>

          {step === 1 ? (
            <View style={styles.gap}>
              <DatePickerField
                label="Željeni datum"
                value={desiredDate || null}
                onChange={(ymd) => {
                  setDesiredDate(ymd ?? '')
                  setLocalError('')
                }}
                preset="future"
                nestedInModal
              />

              <ChipField label="Vreme dana" options={TIME_OPTIONS} value={timeOfDay} onChange={setTimeOfDay} />
              {timeOfDay === 'exact' ? (
                <TimePickerField
                  label="Tačno vreme"
                  value={exactTime || null}
                  onChange={(hhmm) => {
                    setExactTime(hhmm ?? '')
                    setLocalError('')
                  }}
                  nestedInModal
                />
              ) : null}

              <Field label="Broj osoba">
                <TextInput
                  style={styles.input}
                  value={numberOfPeople}
                  onChangeText={setNumberOfPeople}
                  keyboardType="number-pad"
                />
              </Field>

              <ChipField
                label="Iskustvo grupe"
                options={EXPERIENCE_OPTIONS}
                value={groupExperience}
                onChange={(v) => setGroupExperience(v as GuideBookingGroupExperience)}
              />

              <ChipField
                label="Oprema"
                options={EQUIPMENT_OPTIONS}
                value={equipmentStatus}
                onChange={(v) => setEquipmentStatus(v as GuideBookingEquipmentStatus)}
                vertical
              />

              <Field label="Kontakt telefon">
                <TextInput
                  style={styles.input}
                  value={contactPhone}
                  onChangeText={setContactPhone}
                  keyboardType="phone-pad"
                  placeholder={user?.username ? '' : '+381...'}
                  placeholderTextColor={colors.textSubtle}
                />
              </Field>

              <Field label="Dodatna poruka">
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={additionalMessage}
                  onChangeText={setAdditionalMessage}
                  multiline
                  placeholderTextColor={colors.textSubtle}
                />
              </Field>

              <View style={styles.switchRow}>
                <Text variant="body">Fleksibilan datum</Text>
                <Switch value={dateFlexible} onValueChange={setDateFlexible} trackColor={{ true: colors.brand }} />
              </View>

              {localError ? (
                <Text variant="small" color={colors.danger}>
                  {localError}
                </Text>
              ) : null}
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.gap}>
              {guidesLoading ? (
                <ActivityIndicator color={colors.brand} />
              ) : guides.length === 0 && !showAllGuides ? (
                <View style={styles.emptyGuides}>
                  <Text variant="body" color={colors.textMuted}>
                    Nema vodiča u blizini.
                  </Text>
                  <Button title="Prikaži sve vodiče" variant="secondary" onPress={() => void loadAllGuides()} />
                </View>
              ) : (
                <>
                  {showAllGuides ? (
                    <Text variant="small" color={colors.textMuted}>
                      Prikazani su svi vodiči za planine.
                    </Text>
                  ) : (
                    <Text variant="small" color={colors.textMuted}>
                      Vodiči u blizini vrha — izaberite jednog ili više.
                    </Text>
                  )}
                  {guides.map((g) => {
                    const name = guideName(g)
                    const selected = selectedGuideIds.has(g.id)
                    return (
                      <Pressable
                        key={g.id}
                        style={[styles.guideRow, selected && styles.guideRowSelected]}
                        onPress={() => toggleGuide(g.id)}
                      >
                        <Avatar uri={g.user?.avatarUrl} name={name} size={48} />
                        <View style={styles.guideInfo}>
                          <Text variant="label">{name}</Text>
                          <Text variant="small" color={colors.textMuted}>
                            {[g.grad, g.region].filter(Boolean).join(' · ')}
                            {g.distanceKm != null ? ` · ${g.distanceKm.toFixed(0)} km` : ''}
                          </Text>
                        </View>
                        {selected ? <Ionicons name="checkmark-circle" size={22} color={colors.brand} /> : null}
                      </Pressable>
                    )
                  })}
                  {!showAllGuides && guides.length > 0 ? (
                    <Button title="Prikaži sve vodiče" variant="ghost" onPress={() => void loadAllGuides()} />
                  ) : null}
                </>
              )}
              {step2Error ? (
                <Text variant="small" color={colors.danger}>
                  {step2Error}
                </Text>
              ) : null}
            </View>
          ) : null}

          {step === 3 ? (
            <View style={styles.gap}>
              <Text variant="body">Pregled zahteva</Text>
              <Text variant="small" color={colors.textMuted}>
                Datum: {reviewDate}
                {dateFlexible ? ' (fleksibilan)' : ''}
              </Text>
              <Text variant="small" color={colors.textMuted}>
                Vreme: {TIME_OPTIONS.find((o) => o.value === timeOfDay)?.label}
                {timeOfDay === 'exact' && exactTime ? ` — ${exactTime}` : ''}
              </Text>
              <Text variant="small" color={colors.textMuted}>
                Osoba: {numberOfPeople}
              </Text>
              <Text variant="small" color={colors.textMuted}>
                Iskustvo: {EXPERIENCE_OPTIONS.find((o) => o.value === groupExperience)?.label}
              </Text>
              <Text variant="small" color={colors.textMuted}>
                Oprema: {EQUIPMENT_OPTIONS.find((o) => o.value === equipmentStatus)?.label}
              </Text>
              <Text variant="small" color={colors.textMuted}>
                Telefon: {contactPhone}
              </Text>
              <Text variant="small" color={colors.textMuted}>
                Vodiči: {selectedGuideIds.size}
              </Text>
              {additionalMessage.trim() ? (
                <Text variant="small" color={colors.textMuted}>
                  Poruka: {additionalMessage.trim()}
                </Text>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {step > 1 ? (
            <Button title="Nazad" variant="ghost" onPress={() => setStep((s) => (s - 1) as 1 | 2 | 3)} />
          ) : null}
          {step === 1 ? (
            <Button title="Dalje" onPress={() => void goStep2()} />
          ) : step === 2 ? (
            <Button title="Dalje" onPress={goStep3} disabled={selectedGuideIds.size === 0} />
          ) : (
            <Button
              title="Pošalji zahtev"
              onPress={() => submitMutation.mutate(false)}
              loading={submitMutation.isPending}
            />
          )}
        </View>
      </View>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text variant="small" color={colors.textMuted} style={styles.fieldLabel}>
        {label}
      </Text>
      {children}
    </View>
  )
}

function ChipField<T extends string>({
  label,
  options,
  value,
  onChange,
  vertical,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T | ''
  onChange: (v: T) => void
  vertical?: boolean
}) {
  return (
    <Field label={label}>
      <View style={[styles.chips, vertical && styles.chipsVertical]}>
        {options.map((opt) => {
          const active = value === opt.value
          return (
            <Pressable
              key={opt.value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onChange(opt.value)}
            >
              <Text variant="small" color={active ? colors.brandDark : colors.text}>
                {opt.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </Field>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  body: { padding: spacing.lg, paddingBottom: spacing.xxl },
  spotName: { marginBottom: spacing.md },
  gap: { gap: spacing.md },
  field: { gap: spacing.xs },
  fieldLabel: { textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 11 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chipsVertical: { flexDirection: 'column' },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.brand, backgroundColor: '#ecfdf5' },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  guideRowSelected: { borderColor: colors.brand, backgroundColor: '#ecfdf5' },
  guideInfo: { flex: 1 },
  emptyGuides: { gap: spacing.md, alignItems: 'flex-start' },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
})
