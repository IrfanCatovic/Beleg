import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import * as ImagePicker from 'expo-image-picker'
import type { AkcijaListItem, Korisnik } from '@beleg/shared'
import { getApiErrorMessage } from '@beleg/shared'
import {
  addClubMembersCompleted,
  addPastActionToUser,
  createParticipationRequest,
  fetchAkcije,
  fetchEligibleClubMembers,
  fetchEligibleExternalUsers,
  fetchKorisnici,
  type ExternalUserCandidate,
} from '@beleg/shared/services'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import { AppTopBar } from '../../components/ui/AppTopBar'
import { Button, Card, ErrorView, Input, Loader, Screen, Text } from '../../components/ui'
import { colors, radius, spacing } from '../../theme'
import { canManageActions } from '../../utils/roles'
import type { ActionsStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<ActionsStackParamList, 'AddPastAction'>

const PAGE_SIZE = 5

const TEZINE = [
  { value: 'lako', label: 'Lako' },
  { value: 'srednje', label: 'Srednje' },
  { value: 'tesko', label: 'Teško' },
  { value: 'alpinizam', label: 'Alpinizam' },
] as const

function Chip({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text variant="small" color={active ? colors.textOnDark : colors.text}>
        {label}
      </Text>
    </Pressable>
  )
}

function CheckRow({
  label,
  sub,
  checked,
  onPress,
}: {
  label: string
  sub?: string
  checked: boolean
  onPress: () => void
}) {
  return (
    <Pressable onPress={onPress} style={[styles.checkRow, checked && styles.checkRowSelected]}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <Text style={styles.checkMark}>✓</Text> : null}
      </View>
      <View style={styles.checkText}>
        <Text variant="label">{label}</Text>
        {sub ? (
          <Text variant="small" color={colors.textMuted}>
            {sub}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
}

export default function AddPastActionScreen({ navigation, route }: Props) {
  const { tip: tipAkcije } = route.params
  const { user } = useAuth()
  const { showAlert } = useModal()

  const [korisnici, setKorisnici] = useState<Korisnik[]>([])
  const [zavrseneAkcije, setZavrseneAkcije] = useState<AkcijaListItem[]>([])
  const [actionQuery, setActionQuery] = useState('')
  const [showLegacyCreate, setShowLegacyCreate] = useState(false)
  const [selectedExistingAction, setSelectedExistingAction] = useState<AkcijaListItem | null>(null)
  const [showManageModal, setShowManageModal] = useState(false)
  const [manageTab, setManageTab] = useState<'club' | 'external'>('club')
  const [manageError, setManageError] = useState('')
  const [manageSuccess, setManageSuccess] = useState('')

  const [clubUsers, setClubUsers] = useState<ExternalUserCandidate[]>([])
  const [clubQuery, setClubQuery] = useState('')
  const [clubOffset, setClubOffset] = useState(0)
  const [clubHasMore, setClubHasMore] = useState(true)
  const [clubLoading, setClubLoading] = useState(false)
  const [selectedClubUserIds, setSelectedClubUserIds] = useState<number[]>([])

  const [externalUsers, setExternalUsers] = useState<ExternalUserCandidate[]>([])
  const [externalQuery, setExternalQuery] = useState('')
  const [externalOffset, setExternalOffset] = useState(0)
  const [externalHasMore, setExternalHasMore] = useState(true)
  const [externalLoading, setExternalLoading] = useState(false)
  const [selectedExternalUserIds, setSelectedExternalUserIds] = useState<number[]>([])
  const [sendingAction, setSendingAction] = useState(false)

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
  const [dodajUIstorijuKluba, setDodajUIstorijuKluba] = useState(true)
  const [javna, setJavna] = useState(false)
  const [slikaUri, setSlikaUri] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const vodici = useMemo(
    () => korisnici.filter((k) => k.role === 'vodic'),
    [korisnici],
  )

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const [list, akcijeData] = await Promise.all([fetchKorisnici(client), fetchAkcije(client)])
        if (cancelled) return
        setKorisnici(list)
        setZavrseneAkcije(akcijeData.zavrsene ?? [])
      } catch (err) {
        if (!cancelled) setError(getApiErrorMessage(err, 'Greška pri učitavanju podataka.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user])

  const filteredActions = useMemo(() => {
    const q = actionQuery.trim().toLowerCase()
    if (!q) return zavrseneAkcije
    return zavrseneAkcije.filter((a) =>
      [a.naziv, a.planina, a.vrh, a.datum].some((part) => (part || '').toLowerCase().includes(q)),
    )
  }, [actionQuery, zavrseneAkcije])

  const fetchClubUsers = useCallback(
    async (replace: boolean, queryOverride?: string, actionIdOverride?: number) => {
      const targetId = actionIdOverride ?? selectedExistingAction?.id
      if (!targetId || clubLoading) return
      const q = queryOverride ?? clubQuery
      const nextOffset = replace ? 0 : clubOffset
      setClubLoading(true)
      try {
        const users = await fetchEligibleClubMembers(client, targetId, {
          q,
          limit: PAGE_SIZE,
          offset: nextOffset,
        })
        setClubUsers((prev) => (replace ? users : [...prev, ...users]))
        setClubOffset(nextOffset + users.length)
        setClubHasMore(users.length === PAGE_SIZE)
      } catch (err) {
        setManageError(getApiErrorMessage(err, 'Greška pri učitavanju članova kluba.'))
      } finally {
        setClubLoading(false)
      }
    },
    [clubLoading, clubOffset, clubQuery, selectedExistingAction],
  )

  const fetchExternalUsers = useCallback(
    async (replace: boolean, queryOverride?: string, actionIdOverride?: number) => {
      const targetId = actionIdOverride ?? selectedExistingAction?.id
      if (!targetId || externalLoading) return
      const q = (queryOverride ?? externalQuery).trim()
      const nextOffset = replace ? 0 : externalOffset
      setExternalLoading(true)
      try {
        const users = await fetchEligibleExternalUsers(client, targetId, {
          scope: 'other-clubs',
          q,
          limit: PAGE_SIZE,
          offset: nextOffset,
        })
        setExternalUsers((prev) => (replace ? users : [...prev, ...users]))
        setExternalOffset(nextOffset + users.length)
        setExternalHasMore(users.length === PAGE_SIZE)
      } catch (err) {
        setManageError(getApiErrorMessage(err, 'Greška pri učitavanju korisnika van kluba.'))
      } finally {
        setExternalLoading(false)
      }
    },
    [externalLoading, externalOffset, externalQuery, selectedExistingAction],
  )

  const openManageModal = (akcija: AkcijaListItem) => {
    setSelectedExistingAction(akcija)
    setShowManageModal(true)
    setManageTab('club')
    setManageError('')
    setManageSuccess('')
    setClubUsers([])
    setClubOffset(0)
    setClubHasMore(true)
    setClubQuery('')
    setSelectedClubUserIds([])
    setExternalUsers([])
    setExternalOffset(0)
    setExternalHasMore(true)
    setExternalQuery('')
    setSelectedExternalUserIds([])
    void fetchClubUsers(true, '', akcija.id)
    void fetchExternalUsers(true, '', akcija.id)
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
      const res = (await addClubMembersCompleted(client, selectedExistingAction.id, {
        korisnikIds: selectedClubUserIds,
      })) as { added?: number; updated?: number; skipped?: number }
      setManageSuccess(
        `Obrađeno: dodato ${res?.added ?? 0}, ažurirano ${res?.updated ?? 0}, preskočeno ${res?.skipped ?? 0}.`,
      )
      setSelectedClubUserIds([])
      await fetchClubUsers(true)
    } catch (err) {
      setManageError(getApiErrorMessage(err, 'Greška pri dodavanju članova.'))
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
          createParticipationRequest(client, selectedExistingAction.id, targetUserId),
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
      await fetchExternalUsers(true, undefined, selectedExistingAction.id)
    } catch (err) {
      setManageError(getApiErrorMessage(err, 'Greška pri slanju zahteva.'))
    } finally {
      setSendingAction(false)
    }
  }

  const onClubListScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 24) {
      if (!clubLoading && clubHasMore) void fetchClubUsers(false)
    }
  }

  const onExternalListScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 24) {
      if (!externalLoading && externalHasMore) void fetchExternalUsers(false)
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

  const pickImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      await showAlert('Dozvola', 'Potrebna je dozvola za galeriju.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    })
    if (!result.canceled && result.assets[0]) {
      setSlikaUri(result.assets[0].uri)
    }
  }, [showAlert])

  const handleSubmit = async () => {
    if (selectedKorisnikIds.length === 0) {
      setError('Izaberi bar jednog korisnika.')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
      setError('Datum mora biti u formatu YYYY-MM-DD.')
      return
    }
    if (!tezina.trim()) {
      setError('Izaberi težinu.')
      return
    }
    const dozvoljeneTezine = ['lako', 'srednje', 'tesko', 'alpinizam']
    if (!dozvoljeneTezine.includes(tezina.trim().toLowerCase())) {
      setError('Težina mora biti iz liste.')
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
      formData.append('dodaj_u_istoriju_kluba', dodajUIstorijuKluba ? 'true' : 'false')
      formData.append('javna', String(javna))
      formData.append('korisnik_ids', selectedKorisnikIds.join(','))
      if (slikaUri) {
        const filename = slikaUri.split('/').pop() || 'slika.jpg'
        const match = /\.(\w+)$/.exec(filename)
        const type = match ? `image/${match[1]}` : 'image/jpeg'
        formData.append('slika', { uri: slikaUri, name: filename, type } as unknown as Blob)
      }

      await addPastActionToUser(client, Number(targetKorisnikId), formData)

      if (selectedKorisnikIds.length === 1) {
        const selected = korisnici.find((k) => String(k.id) === targetKorisnikId)
        if (selected?.username) {
          navigation.navigate('UserProfile', { username: selected.username })
          return
        }
      }
      navigation.navigate('ActionsList')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Greška pri dodavanju prošle akcije.'))
      setSubmitting(false)
    }
  }

  if (!user || !canManageActions(user.role)) {
    return (
      <View style={styles.root}>
        <AppTopBar leftIcon="chevron-back" onLeftPress={() => navigation.goBack()} />
        <Screen>
          <ErrorView message="Samo administratori i vodiči mogu dodavati prošle akcije." />
        </Screen>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={styles.root}>
        <AppTopBar leftIcon="chevron-back" onLeftPress={() => navigation.goBack()} />
        <Loader />
      </View>
    )
  }

  const tipLabel = tipAkcije === 'via_ferrata' ? 'Via ferrata' : 'Planina'

  return (
    <View style={styles.root}>
      <AppTopBar
        leftIcon="chevron-back"
        onLeftPress={() => navigation.goBack()}
        center={
          <View style={styles.topCenter}>
            <Text variant="small" color={colors.textOnDarkMuted}>
              Prošla akcija · {tipLabel}
            </Text>
            <Text variant="label" color={colors.textOnDark}>
              Dodaj prošlu akciju
            </Text>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.sectionCard}>
          <Text variant="heading">Dodaj članove na postojeću završenu akciju</Text>
          <Text variant="small" color={colors.textMuted} style={styles.sectionHint}>
            Pretraži završene akcije kluba i otvori modal za unos učesnika.
          </Text>

          <Input
            label="Pretraga"
            value={actionQuery}
            onChangeText={setActionQuery}
            placeholder="Naziv, planina, vrh ili datum"
          />

          <View style={styles.actionList}>
            {filteredActions.length === 0 ? (
              <Text variant="small" color={colors.textMuted} style={styles.emptyList}>
                Nema pronađenih završenih akcija.
              </Text>
            ) : (
              filteredActions.map((akcija) => (
                <View key={akcija.id} style={styles.actionRow}>
                  <View style={styles.actionInfo}>
                    <Text variant="label">{akcija.naziv}</Text>
                    <Text variant="small" color={colors.textMuted}>
                      {[akcija.planina, akcija.vrh, akcija.datum].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Button
                    title="Učesnici"
                    variant="secondary"
                    onPress={() => openManageModal(akcija)}
                  />
                </View>
              ))
            )}
          </View>

          <Pressable onPress={() => setShowLegacyCreate((prev) => !prev)} style={styles.toggleCreate}>
            <Text variant="small" color={colors.brand}>
              {showLegacyCreate
                ? 'Sakrij kreiranje nove prošle akcije'
                : 'Akcija ne postoji? Kreiraj novu prošlu akciju'}
            </Text>
          </Pressable>
        </Card>

        {showLegacyCreate ? (
          <Card style={styles.formCard}>
            {error ? (
              <View style={styles.errorBox}>
                <Text variant="small" color={colors.danger}>
                  {error}
                </Text>
              </View>
            ) : null}

            <Text variant="heading">Kreiraj novu prošlu akciju</Text>

            <View style={styles.korisniciHeader}>
              <Text variant="small" color={colors.textMuted}>
                Izabrano: {selectedKorisnikIds.length}
              </Text>
              <Pressable onPress={toggleAllKorisnici}>
                <Text variant="small" color={colors.brand}>
                  {selectedKorisnikIds.length === korisnici.length ? 'Poništi sve' : 'Izaberi sve'}
                </Text>
              </Pressable>
            </View>
            <View style={styles.userList}>
              {korisnici.map((k) => {
                const id = String(k.id)
                return (
                  <CheckRow
                    key={k.id}
                    label={k.fullName || k.username}
                    sub={`@${k.username}`}
                    checked={selectedKorisnikIds.includes(id)}
                    onPress={() => toggleKorisnik(id)}
                  />
                )
              })}
            </View>

            <Input label="Naziv akcije" value={naziv} onChangeText={setNaziv} placeholder="Naziv" />
            <Input label="Planina" value={planina} onChangeText={setPlanina} placeholder="Planina" />
            <Input label="Vrh" value={vrh} onChangeText={setVrh} placeholder="Vrh" />
            <Input
              label="Datum (YYYY-MM-DD)"
              value={datum}
              onChangeText={setDatum}
              placeholder="2024-06-15"
              autoCapitalize="none"
            />

            <Text variant="label">Težina</Text>
            <View style={styles.chipRow}>
              {TEZINE.map((t) => (
                <Chip
                  key={t.value}
                  label={t.label}
                  active={tezina === t.value}
                  onPress={() => setTezina(t.value)}
                />
              ))}
            </View>

            <Input
              label="Kumulativni uspon (m)"
              value={kumulativniUsponM}
              onChangeText={setKumulativniUsponM}
              keyboardType="number-pad"
              placeholder="npr. 1200"
            />
            <Input
              label="Dužina staze (km)"
              value={duzinaStazeKm}
              onChangeText={setDuzinaStazeKm}
              keyboardType="decimal-pad"
              placeholder="npr. 12.5"
            />
            <Input
              label="Visina vrha (m)"
              value={visinaVrhM}
              onChangeText={setVisinaVrhM}
              keyboardType="number-pad"
              placeholder="npr. 2466"
            />

            <View style={styles.switchRow}>
              <Text variant="label">Zimski uspon</Text>
              <Switch
                value={zimskiUspon}
                onValueChange={setZimskiUspon}
                trackColor={{ false: colors.border, true: colors.brandLight }}
                thumbColor={colors.white}
              />
            </View>

            <Text variant="label">Vodič (opciono)</Text>
            <View style={styles.chipRow}>
              <Chip label="Bez vodiča" active={!vodicId} onPress={() => setVodicId('')} />
              {vodici.map((v) => (
                <Chip
                  key={v.id}
                  label={v.fullName || v.username}
                  active={vodicId === String(v.id)}
                  onPress={() => setVodicId(String(v.id))}
                />
              ))}
            </View>

            <Input
              label="Opis"
              value={opis}
              onChangeText={setOpis}
              placeholder="Opis akcije"
              multiline
              style={styles.textArea}
            />

            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text variant="label">Javna akcija</Text>
                <Text variant="small" color={colors.textMuted}>
                  Vidljiva svima u feedu
                </Text>
              </View>
              <Switch
                value={javna}
                onValueChange={setJavna}
                trackColor={{ false: colors.border, true: colors.accentLight }}
                thumbColor={colors.white}
              />
            </View>

            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text variant="label">Dodaj u istoriju kluba</Text>
                <Text variant="small" color={colors.textMuted}>
                  Upisuje akciju u klupsku istoriju
                </Text>
              </View>
              <Switch
                value={dodajUIstorijuKluba}
                onValueChange={setDodajUIstorijuKluba}
                trackColor={{ false: colors.border, true: colors.brandLight }}
                thumbColor={colors.white}
              />
            </View>

            <Button
              title={slikaUri ? 'Promeni sliku' : 'Izaberi sliku (opciono)'}
              variant="secondary"
              onPress={pickImage}
              fullWidth
            />
            {slikaUri ? (
              <Text variant="small" color={colors.textMuted}>
                Slika je izabrana.
              </Text>
            ) : null}

            <View style={styles.formActions}>
              <Button title="Dodaj prošlu akciju" loading={submitting} onPress={handleSubmit} fullWidth />
              <Button title="Otkaži" variant="secondary" onPress={() => navigation.goBack()} fullWidth />
            </View>
          </Card>
        ) : null}
      </ScrollView>

      <Modal visible={showManageModal} transparent animationType="fade" onRequestClose={closeManageModal}>
        <Pressable style={styles.modalOverlay} onPress={closeManageModal}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            {selectedExistingAction ? (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderText}>
                    <Text variant="heading">{selectedExistingAction.naziv}</Text>
                    <Text variant="small" color={colors.textMuted}>
                      {[selectedExistingAction.planina, selectedExistingAction.vrh, selectedExistingAction.datum]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  <Button title="Zatvori" variant="ghost" onPress={closeManageModal} />
                </View>

                <View style={styles.tabRow}>
                  <Chip
                    label="Članovi kluba"
                    active={manageTab === 'club'}
                    onPress={() => setManageTab('club')}
                  />
                  <Chip
                    label="Van kluba"
                    active={manageTab === 'external'}
                    onPress={() => setManageTab('external')}
                  />
                </View>

                {manageError ? (
                  <View style={[styles.feedbackBox, styles.feedbackError]}>
                    <Text variant="small" color={colors.danger}>
                      {manageError}
                    </Text>
                  </View>
                ) : null}
                {manageSuccess ? (
                  <View style={[styles.feedbackBox, styles.feedbackSuccess]}>
                    <Text variant="small" color={colors.success}>
                      {manageSuccess}
                    </Text>
                  </View>
                ) : null}

                {manageTab === 'club' ? (
                  <>
                    <View style={styles.searchRow}>
                      <View style={styles.searchInput}>
                        <Input
                          value={clubQuery}
                          onChangeText={setClubQuery}
                          placeholder="Pretraga članova kluba"
                        />
                      </View>
                      <Button
                        title="Traži"
                        variant="secondary"
                        onPress={() => {
                          setClubOffset(0)
                          setClubHasMore(true)
                          setSelectedClubUserIds([])
                          void fetchClubUsers(true)
                        }}
                      />
                    </View>
                    <ScrollView
                      style={styles.modalList}
                      nestedScrollEnabled
                      onScroll={onClubListScroll}
                      scrollEventThrottle={200}
                    >
                      {clubUsers.length === 0 && !clubLoading ? (
                        <Text variant="small" color={colors.textMuted} style={styles.emptyList}>
                          Nema kandidata.
                        </Text>
                      ) : (
                        clubUsers.map((item) => (
                          <CheckRow
                            key={item.id}
                            label={item.fullName || item.username}
                            sub={`@${item.username}`}
                            checked={selectedClubUserIds.includes(item.id)}
                            onPress={() => toggleClubUser(item.id)}
                          />
                        ))
                      )}
                      {clubLoading ? (
                        <Text variant="small" color={colors.textMuted} style={styles.emptyList}>
                          Učitavanje...
                        </Text>
                      ) : null}
                    </ScrollView>
                    <View style={styles.modalFooter}>
                      <Text variant="small" color={colors.textMuted}>
                        Izabrano: {selectedClubUserIds.length}
                      </Text>
                      <Button
                        title="Dodaj na akciju"
                        loading={sendingAction}
                        onPress={() => void handleAddClubMembers()}
                      />
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.searchRow}>
                      <View style={styles.searchInput}>
                        <Input
                          value={externalQuery}
                          onChangeText={setExternalQuery}
                          placeholder="Pretraga korisnika van kluba"
                        />
                      </View>
                      <Button
                        title="Traži"
                        variant="secondary"
                        onPress={() => {
                          setExternalOffset(0)
                          setExternalHasMore(true)
                          setSelectedExternalUserIds([])
                          void fetchExternalUsers(true)
                        }}
                      />
                    </View>
                    <ScrollView
                      style={styles.modalList}
                      nestedScrollEnabled
                      onScroll={onExternalListScroll}
                      scrollEventThrottle={200}
                    >
                      {externalUsers.length === 0 && !externalLoading ? (
                        <Text variant="small" color={colors.textMuted} style={styles.emptyList}>
                          Nema kandidata.
                        </Text>
                      ) : (
                        externalUsers.map((item) => (
                          <CheckRow
                            key={item.id}
                            label={item.fullName || item.username}
                            sub={[
                              `@${item.username}`,
                              item.klubNaziv ? item.klubNaziv : '',
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                            checked={selectedExternalUserIds.includes(item.id)}
                            onPress={() => toggleExternalUser(item.id)}
                          />
                        ))
                      )}
                      {externalLoading ? (
                        <Text variant="small" color={colors.textMuted} style={styles.emptyList}>
                          Učitavanje...
                        </Text>
                      ) : null}
                    </ScrollView>
                    <View style={styles.modalFooter}>
                      <Text variant="small" color={colors.textMuted}>
                        Izabrano: {selectedExternalUserIds.length}
                      </Text>
                      <Button
                        title="Pošalji zahteve"
                        loading={sendingAction}
                        onPress={() => void handleSendExternalRequests()}
                      />
                    </View>
                  </>
                )}
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topCenter: { alignItems: 'center' },
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 2 },
  sectionCard: { gap: spacing.md },
  sectionHint: { marginTop: -spacing.xs },
  actionList: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  actionInfo: { flex: 1, gap: 2 },
  emptyList: { padding: spacing.md },
  toggleCreate: { marginTop: spacing.xs },
  formCard: { gap: spacing.md },
  errorBox: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerBg,
  },
  korisniciHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userList: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    maxHeight: 220,
    overflow: 'hidden',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  chipActive: {
    backgroundColor: colors.navBgMid,
    borderColor: colors.navBgMid,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  switchLabel: { flex: 1, gap: 2 },
  textArea: { minHeight: 88, textAlignVertical: 'top' },
  formActions: { gap: spacing.sm, marginTop: spacing.sm },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  checkRowSelected: { backgroundColor: colors.surfaceAlt },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  checkboxChecked: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  checkMark: { color: colors.white, fontSize: 14, fontWeight: '700', marginTop: -1 },
  checkText: { flex: 1, gap: 2 },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  modalHeaderText: { flex: 1, gap: 2 },
  tabRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  feedbackBox: {
    padding: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
  },
  feedbackError: { borderColor: colors.danger, backgroundColor: colors.dangerBg },
  feedbackSuccess: { borderColor: colors.brandLight, backgroundColor: '#ecfdf5' },
  searchRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginBottom: spacing.sm },
  searchInput: { flex: 1 },
  modalList: { maxHeight: 280, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
})
