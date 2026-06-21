import { useState, type ReactNode } from 'react'
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
import { getApiErrorMessage } from '@beleg/shared'
import {
  createFerrataGuideBooking,
  listGuidesNearby,
  type GuideNearbyPublic,
} from '@beleg/shared/services'
import { client } from '../../../api/client'
import { useAuth } from '../../../context/AuthContext'
import { useModal } from '../../../context/ModalContext'
import { Avatar, Button, Text } from '../../../components/ui'
import { colors, radius, spacing } from '../../../theme'

interface FerrataGuideBookingModalProps {
  visible: boolean
  onClose: () => void
  ferrataId: number
  ferrataName: string
  ferrataLat?: number
  ferrataLng?: number
}

export function FerrataGuideBookingModal({
  visible,
  onClose,
  ferrataId,
  ferrataName,
  ferrataLat,
  ferrataLng,
}: FerrataGuideBookingModalProps) {
  const { user } = useAuth()
  const { showAlert } = useModal()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [desiredDate, setDesiredDate] = useState('')
  const [timeOfDay, setTimeOfDay] = useState('jutro')
  const [exactTime, setExactTime] = useState('')
  const [dateFlexible, setDateFlexible] = useState(false)
  const [numberOfPeople, setNumberOfPeople] = useState('2')
  const [groupExperience, setGroupExperience] = useState('srednje')
  const [equipmentStatus, setEquipmentStatus] = useState('imam')
  const [contactPhone, setContactPhone] = useState('')
  const [additionalMessage, setAdditionalMessage] = useState('')
  const [guides, setGuides] = useState<GuideNearbyPublic[]>([])
  const [guidesLoading, setGuidesLoading] = useState(false)
  const [selectedGuideIds, setSelectedGuideIds] = useState<Set<number>>(new Set())
  const [skipGuides, setSkipGuides] = useState(false)

  const submitMutation = useMutation({
    mutationFn: () =>
      createFerrataGuideBooking(client, {
        ferrataId,
        guideProfileIds: Array.from(selectedGuideIds),
        skipGuides,
        desiredDate,
        timeOfDay,
        exactTime,
        dateFlexible,
        numberOfPeople: Math.max(1, Number(numberOfPeople) || 1),
        groupExperience,
        equipmentStatus,
        contactPhone: contactPhone.trim(),
        additionalMessage: additionalMessage.trim(),
      }),
    onSuccess: async (data) => {
      await showAlert(
        'Zahtev poslat',
        `Obavešteno je ${data.notifiedCount} vodiča. Očekujte odgovor uskoro.`,
      )
      onClose()
      resetForm()
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Slanje zahteva nije uspelo.')),
  })

  const resetForm = () => {
    setStep(1)
    setSelectedGuideIds(new Set())
    setSkipGuides(false)
  }

  const loadGuides = async () => {
    if (ferrataLat == null || ferrataLng == null) {
      setGuides([])
      return
    }
    setGuidesLoading(true)
    try {
      const list = await listGuidesNearby(client, {
        lat: ferrataLat,
        lng: ferrataLng,
        tourType: 'via_ferrata',
      })
      setGuides(list)
    } catch {
      setGuides([])
    } finally {
      setGuidesLoading(false)
    }
  }

  const goStep2 = async () => {
    if (!desiredDate.trim()) {
      await showAlert('Datum', 'Unesite željeni datum.')
      return
    }
    if (!contactPhone.trim()) {
      await showAlert('Telefon', 'Unesite kontakt telefon.')
      return
    }
    await loadGuides()
    setStep(2)
  }

  const goStep3 = () => {
    if (!skipGuides && selectedGuideIds.size === 0) {
      void showAlert('Vodič', 'Izaberite bar jednog vodiča ili uključite „Bez vodiča”.')
      return
    }
    setStep(3)
  }

  const toggleGuide = (id: number) => {
    setSelectedGuideIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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

        <ScrollView contentContainerStyle={styles.body}>
          <Text variant="small" color={colors.textMuted} style={styles.ferrataName}>
            {ferrataName}
          </Text>

          {step === 1 ? (
            <View style={styles.gap}>
              <Field label="Željeni datum (YYYY-MM-DD)">
                <TextInput
                  style={styles.input}
                  value={desiredDate}
                  onChangeText={setDesiredDate}
                  placeholder="2026-07-15"
                  placeholderTextColor={colors.textSubtle}
                />
              </Field>
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
              <Field label="Broj osoba">
                <TextInput
                  style={styles.input}
                  value={numberOfPeople}
                  onChangeText={setNumberOfPeople}
                  keyboardType="number-pad"
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
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.gap}>
              <View style={styles.switchRow}>
                <Text variant="body">Preskoči izbor vodiča</Text>
                <Switch value={skipGuides} onValueChange={setSkipGuides} trackColor={{ true: colors.brand }} />
              </View>
              {guidesLoading ? (
                <ActivityIndicator color={colors.brand} />
              ) : guides.length === 0 ? (
                <Text variant="body" color={colors.textMuted}>
                  Nema vodiča u blizini. Možete nastaviti bez vodiča.
                </Text>
              ) : (
                guides.map((g) => {
                  const name = g.user?.fullName || g.user?.username || g.naslov || 'Vodič'
                  const selected = selectedGuideIds.has(g.id)
                  return (
                    <Pressable
                      key={g.id}
                      style={[styles.guideRow, selected && styles.guideRowSelected]}
                      onPress={() => toggleGuide(g.id)}
                    >
                      <Avatar uri={g.user?.avatarUrl} name={name} size={44} />
                      <View style={styles.guideInfo}>
                        <Text variant="label">{name}</Text>
                        {g.distanceKm != null ? (
                          <Text variant="small" color={colors.textMuted}>
                            {g.distanceKm.toFixed(0)} km
                          </Text>
                        ) : null}
                      </View>
                      {selected ? <Ionicons name="checkmark-circle" size={22} color={colors.brand} /> : null}
                    </Pressable>
                  )
                })
              )}
            </View>
          ) : null}

          {step === 3 ? (
            <View style={styles.gap}>
              <Text variant="body">Pregled zahteva</Text>
              <Text variant="small" color={colors.textMuted}>
                Datum: {desiredDate}
              </Text>
              <Text variant="small" color={colors.textMuted}>
                Osoba: {numberOfPeople}
              </Text>
              <Text variant="small" color={colors.textMuted}>
                Telefon: {contactPhone}
              </Text>
              {!skipGuides ? (
                <Text variant="small" color={colors.textMuted}>
                  Vodiči: {selectedGuideIds.size}
                </Text>
              ) : (
                <Text variant="small" color={colors.textMuted}>
                  Bez vodiča — samo obaveštenje
                </Text>
              )}
              <Text variant="small" color={colors.textMuted}>
                Nakon slanja, vodiči će biti obavešteni. Preporučujemo i pregled hotela u blizini ferate.
              </Text>
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
            <Button title="Dalje" onPress={goStep3} />
          ) : (
            <Button
              title="Pošalji zahtev"
              onPress={() => submitMutation.mutate()}
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
  ferrataName: { marginBottom: spacing.md },
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
