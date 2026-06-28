import { useEffect, useMemo, useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import type {
  ActionKind,
  OrganizerKind,
  VisibilityKind,
  WizardFerrataOption,
  WizardGuide,
  WizardValues,
} from '@beleg/shared'
import {
  buildWizardPatchFromFerrataRow,
  filterFerrataCatalog,
  parseLocalDate,
} from '@beleg/shared'
import { ChipRow } from '../../../components/ui/ChipRow'
import { Button, Card, DatePickerField, Input, Text, TimePickerField } from '../../../components/ui'
import { colors, fontSize, radius, spacing } from '../../../theme'

export interface ActionWizardFormProps {
  guides: WizardGuide[]
  ferrataCatalog: WizardFerrataOption[]
  clubCurrency: string
  initialValues: WizardValues
  lockActionKind?: boolean
  lockFerrataSelection?: boolean
  lockOrganizerType?: boolean
  loading: boolean
  error: string
  onSubmit: (values: WizardValues, image: { uri: string; name: string; type: string } | null) => Promise<void>
  onGeocode: (q: string) => Promise<{ lat: number; lng: number }>
}

type WizardImage = { uri: string; name: string; type: string }

function CheckboxRow({
  label,
  checked,
  onToggle,
}: {
  label: string
  checked: boolean
  onToggle: () => void
}) {
  return (
    <Pressable onPress={onToggle} style={styles.checkboxRow}>
      <View style={[styles.checkbox, checked && styles.checkboxOn]}>
        {checked ? <Text style={styles.checkMark}>✓</Text> : null}
      </View>
      <Text variant="body">{label}</Text>
    </Pressable>
  )
}

function GuidePicker({
  guides,
  value,
  onChange,
}: {
  guides: WizardGuide[]
  value: string
  onChange: (id: string) => void
}) {
  const club = guides.filter((g) => g.source !== 'profi')
  const profi = guides.filter((g) => g.source === 'profi')

  const renderGroup = (title: string, items: WizardGuide[]) =>
    items.length > 0 ? (
      <View style={styles.guideGroup}>
        <Text variant="small" color={colors.textMuted}>
          {title}
        </Text>
        {items.map((g) => {
          const id = String(g.id)
          const selected = value === id
          return (
            <Pressable
              key={id}
              onPress={() => onChange(id)}
              style={[styles.guideRow, selected && styles.guideRowSelected]}
            >
              <Text variant="label">
                {g.fullName} (@{g.username})
              </Text>
            </Pressable>
          )
        })}
      </View>
    ) : null

  return (
    <View style={styles.guidePicker}>
      {renderGroup('Vodiči kluba', club)}
      {renderGroup('Profi vodiči', profi)}
      {club.length === 0 && profi.length === 0
        ? guides.map((g) => {
            const id = String(g.id)
            const selected = value === id
            return (
              <Pressable
                key={id}
                onPress={() => onChange(id)}
                style={[styles.guideRow, selected && styles.guideRowSelected]}
              >
                <Text variant="label">
                  {g.fullName} (@{g.username})
                </Text>
              </Pressable>
            )
          })
        : null}
    </View>
  )
}

function FerrataAutocomplete({
  catalog,
  selectedId,
  disabled,
  onSelect,
  onClear,
}: {
  catalog: WizardFerrataOption[]
  selectedId: string
  disabled?: boolean
  onSelect: (row: WizardFerrataOption) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState('')
  const selected = catalog.find((x) => String(x.id) === selectedId.trim())

  useEffect(() => {
    if (selected) setQuery(selected.naziv)
  }, [selected?.id, selected?.naziv])

  const filtered = useMemo(() => filterFerrataCatalog(catalog, query), [catalog, query])

  return (
    <View style={styles.ferrataWrap}>
      <Input
        label="Via ferrata"
        value={query}
        editable={!disabled}
        onChangeText={(t) => {
          setQuery(t)
          if (selected && t !== selected.naziv) onClear()
        }}
        placeholder="Pretraži ferratu…"
      />
      {!disabled && query.trim().length > 0 && !selected ? (
        <View style={styles.ferrataList}>
          {filtered.map((row) => (
            <Pressable key={row.id} onPress={() => onSelect(row)} style={styles.ferrataItem}>
              <Text variant="label">{row.naziv}</Text>
              <Text variant="small" color={colors.textMuted}>
                {[row.tezina, row.drzava, row.gradOpstina].filter(Boolean).join(' · ')}
              </Text>
            </Pressable>
          ))}
          {filtered.length === 0 ? (
            <Text variant="small" color={colors.textMuted} style={styles.ferrataEmpty}>
              Nema rezultata
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

export function ActionWizardForm({
  guides,
  ferrataCatalog,
  clubCurrency,
  initialValues,
  lockActionKind = false,
  lockFerrataSelection = false,
  lockOrganizerType = false,
  loading,
  error,
  onSubmit,
  onGeocode,
}: ActionWizardFormProps) {
  const [step, setStep] = useState(1)
  const [values, setValues] = useState<WizardValues>(initialValues)
  const [image, setImage] = useState<WizardImage | null>(null)
  const [geoQuery, setGeoQuery] = useState('')
  const [geoBusy, setGeoBusy] = useState(false)
  const [geoErr, setGeoErr] = useState('')

  useEffect(() => {
    setValues(initialValues)
  }, [initialValues])

  const patch = (data: Partial<WizardValues>) => setValues((prev) => ({ ...prev, ...data }))

  const isVia = values.actionKind === 'via_ferrata'
  const maxStep = isVia ? 3 : 4
  const isPublic = values.visibility === 'javna'
  const isGuideOrganizer = values.organizerType === 'vodic'
  const brojDana = Number(values.brojDana || '1')
  const showSmestaj = brojDana > 1

  const selectedFerrata = useMemo(
    () => ferrataCatalog.find((x) => String(x.id) === values.ferrataId.trim()),
    [ferrataCatalog, values.ferrataId],
  )

  const rokMaxDate = useMemo(
    () => parseLocalDate(values.datum) ?? undefined,
    [values.datum],
  )

  const selectedGuide = guides.find((g) => String(g.id) === values.vodicId)
  const selectedGuideLabel = selectedGuide
    ? `${selectedGuide.fullName} (@${selectedGuide.username})`
    : ''

  const totalOptionalPreview = useMemo(() => {
    const sm = values.smestaj.reduce((acc, s) => acc + Number(s.cenaPoOsobiUkupno || 0), 0)
    const pr = values.prevoz.reduce((acc, p) => acc + Number(p.cenaPoOsobi || 0), 0)
    const op = values.oprema.reduce((acc, o) => acc + Number(o.cenaPoSetu || 0), 0)
    return sm + pr + op
  }, [values])

  useEffect(() => {
    if (isVia && step > 3) setStep(3)
  }, [isVia, step])

  const toStepLabel = (s: number) => {
    if (s === 1) return 'Osnovno'
    if (s === 2) return 'Logistika'
    if (isVia && s === 3) return 'Pregled'
    if (s === 3) return 'Oprema'
    return 'Prevoz'
  }

  const runGeocode = async () => {
    const q = (geoQuery.trim() || `${values.planina}, ${values.vrh}`).trim()
    if (q.length < 3) {
      setGeoErr('Unesite bar 3 karaktera za pretragu lokacije.')
      return
    }
    setGeoErr('')
    setGeoBusy(true)
    try {
      const coords = await onGeocode(q)
      patch({
        planinaLat: Number(coords.lat).toFixed(6),
        planinaLng: Number(coords.lng).toFixed(6),
      })
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } }).response?.data?.error ||
        'Lokacija nije pronađena.'
      setGeoErr(msg)
    } finally {
      setGeoBusy(false)
    }
  }

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    })
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      const filename = asset.uri.split('/').pop() || 'slika.jpg'
      const match = /\.(\w+)$/.exec(filename)
      const type = match ? `image/${match[1]}` : 'image/jpeg'
      setImage({ uri: asset.uri, name: filename, type })
    }
  }

  const addSmestaj = () =>
    patch({
      smestaj: [
        ...values.smestaj,
        { localId: `s-${Date.now()}`, naziv: '', cenaPoOsobiUkupno: '', opis: '' },
      ],
    })

  const addOprema = () =>
    patch({
      oprema: [
        ...values.oprema,
        { localId: `o-${Date.now()}`, naziv: '', dostupnaKolicina: '', cenaPoSetu: '' },
      ],
    })

  const addPrevoz = () =>
    patch({
      prevoz: [
        ...values.prevoz,
        { localId: `p-${Date.now()}`, tipPrevoza: '', nazivGrupe: '', kapacitet: '', cenaPoOsobi: '' },
      ],
    })

  const handleActionKindChange = (k: ActionKind) => {
    if (k === 'via_ferrata') {
      setImage(null)
      setGeoErr('')
      setValues((prev) => ({
        ...prev,
        actionKind: k,
        smestaj: [],
        oprema: [],
        prevoz: [],
        brojDana: '1',
        mestoPolaska: '',
        zimskiUspon: false,
        visinaVrhM: '',
        planinaLat: '',
        planinaLng: '',
      }))
      setStep((s) => Math.min(s, 3))
    } else {
      patch({ actionKind: k })
    }
  }

  const handleSubmit = async () => {
    if (step < maxStep) return
    await onSubmit(values, isVia ? null : image)
  }

  const visibilityOptions = useMemo(
    () => [
      {
        value: 'klubska',
        label: isGuideOrganizer ? 'Privatna' : 'Klubska',
      },
      { value: 'javna', label: 'Javna' },
    ],
    [isGuideOrganizer],
  )

  return (
    <View style={styles.form}>
      {error ? (
        <View style={styles.errorBox}>
          <Text variant="small" color={colors.danger}>
            {error}
          </Text>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stepBar}
        keyboardShouldPersistTaps="handled"
      >
        {Array.from({ length: maxStep }, (_, i) => i + 1).map((s) => (
          <Pressable
            key={s}
            onPress={() => setStep(s)}
            style={[styles.stepChip, step === s && styles.stepChipActive]}
          >
            <Text style={[styles.stepChipText, step === s && styles.stepChipTextActive]}>
              {s}. {toStepLabel(s)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Card style={styles.stepCard}>
        {step === 1 ? (
          <View style={styles.stepBody}>
            {lockActionKind ? (
              <View style={styles.lockedField}>
                <Text variant="label">Tip akcije</Text>
                <Text>{isVia ? 'Via ferrata' : 'Planina'}</Text>
              </View>
            ) : (
              <ChipRow
                label="Tip akcije"
                options={[
                  { value: 'planina', label: 'Planina' },
                  { value: 'via_ferrata', label: 'Via ferrata' },
                ]}
                value={values.actionKind}
                onChange={(v) => handleActionKindChange(v as ActionKind)}
              />
            )}

            <ChipRow
              label="Organizator"
              options={[
                { value: 'klub', label: 'Klub' },
                { value: 'vodic', label: 'Vodič' },
              ]}
              value={values.organizerType}
              onChange={(v) => patch({ organizerType: v as OrganizerKind })}
              disabled={lockOrganizerType}
            />

            <ChipRow
              label="Vidljivost"
              options={visibilityOptions}
              value={values.visibility}
              onChange={(v) => patch({ visibility: v as VisibilityKind })}
            />

            <Input
              label="Naziv akcije"
              value={values.naziv}
              onChangeText={(t) => patch({ naziv: t })}
              placeholder="npr. Uspon na…"
            />

            {isVia ? (
              <>
                <FerrataAutocomplete
                  catalog={ferrataCatalog}
                  selectedId={values.ferrataId}
                  disabled={lockFerrataSelection}
                  onSelect={(row) => patch(buildWizardPatchFromFerrataRow(row, values))}
                  onClear={() =>
                    patch({
                      ferrataId: '',
                      tezina: '',
                      vrh: '',
                      kumulativniUsponM: '',
                      duzinaStazeKm: '',
                      trajanjeSati: '',
                    })
                  }
                />
                {selectedFerrata ? (
                  <View style={styles.ferrataMeta}>
                    <Text variant="small">
                      Težina: <Text variant="label">{selectedFerrata.tezina}</Text>
                    </Text>
                    <Text variant="small">
                      Trajanje:{' '}
                      <Text variant="label">
                        {Math.round(selectedFerrata.trajanjeMin)}–{Math.round(selectedFerrata.trajanjeMax)} min
                      </Text>
                    </Text>
                    <Text variant="small">
                      Uspon: <Text variant="label">{selectedFerrata.visinskaRazlikaM} m</Text>
                    </Text>
                    <Text variant="small">
                      Dužina:{' '}
                      <Text variant="label">
                        {((selectedFerrata.duzinaM ?? 0) / 1000).toFixed(
                          selectedFerrata.duzinaM % 1000 === 0 ? 0 : 1,
                        )}{' '}
                        km
                      </Text>
                    </Text>
                  </View>
                ) : null}
              </>
            ) : (
              <>
                <Input
                  label="Planina"
                  value={values.planina}
                  onChangeText={(t) => patch({ planina: t })}
                />
                <Input label="Vrh" value={values.vrh} onChangeText={(t) => patch({ vrh: t })} />
                <Text variant="label">Lokacija planine</Text>
                <Text variant="small" color={colors.textMuted}>
                  Unesite koordinate ili pretražite adresu.
                </Text>
                <Input
                  label="Geografska širina"
                  value={values.planinaLat}
                  onChangeText={(t) => patch({ planinaLat: t })}
                  keyboardType="decimal-pad"
                />
                <Input
                  label="Geografska dužina"
                  value={values.planinaLng}
                  onChangeText={(t) => patch({ planinaLng: t })}
                  keyboardType="decimal-pad"
                />
                <Input
                  label="Pretraga lokacije"
                  value={geoQuery}
                  onChangeText={(t) => {
                    setGeoQuery(t)
                    setGeoErr('')
                  }}
                  placeholder={`${values.planina}, ${values.vrh}`}
                />
                <Button
                  title={geoBusy ? 'Pretraga…' : 'Pronađi koordinate'}
                  variant="secondary"
                  onPress={() => void runGeocode()}
                  loading={geoBusy}
                />
                {geoErr ? (
                  <Text variant="small" color={colors.danger}>
                    {geoErr}
                  </Text>
                ) : null}
              </>
            )}

            <DatePickerField
              label="Datum akcije"
              value={values.datum || null}
              onChange={(ymd) => patch({ datum: ymd ?? '' })}
              preset="future"
            />

            {isVia ? (
              <TimePickerField
                label="Vreme polaska"
                value={values.vremePolaska || null}
                onChange={(hhmm) => patch({ vremePolaska: hhmm ?? '' })}
              />
            ) : null}

            {values.actionKind === 'planina' ? (
              <ChipRow
                label="Težina"
                options={[
                  { value: 'lako', label: 'Lako' },
                  { value: 'srednje', label: 'Srednje' },
                  { value: 'tesko', label: 'Teško' },
                  { value: 'alpinizam', label: 'Alpinizam' },
                ]}
                value={values.tezina}
                onChange={(v) => patch({ tezina: v })}
              />
            ) : (
              <View style={styles.lockedField}>
                <Text variant="label">Težina</Text>
                <Text>{values.tezina || '—'}</Text>
              </View>
            )}

            {!isVia ? (
              <Input
                label="Trajanje (sati)"
                value={values.trajanjeSati}
                onChangeText={(t) => patch({ trajanjeSati: t })}
                keyboardType="decimal-pad"
              />
            ) : null}

            <DatePickerField
              label="Rok za prijavu"
              value={values.rokPrijava || null}
              onChange={(ymd) => patch({ rokPrijava: ymd ?? '' })}
              preset="future"
              maximumDate={rokMaxDate}
              optional
              placeholder="Izaberi rok (opciono)"
            />

            <Input
              label="Maks. broj ljudi"
              value={values.maxLjudi}
              onChangeText={(t) => patch({ maxLjudi: t })}
              keyboardType="number-pad"
            />

            {!isVia ? (
              <>
                <Input
                  label="Kumulativni uspon (m)"
                  value={values.kumulativniUsponM}
                  onChangeText={(t) => patch({ kumulativniUsponM: t })}
                  keyboardType="number-pad"
                />
                <Input
                  label="Dužina staze (km)"
                  value={values.duzinaStazeKm}
                  onChangeText={(t) => patch({ duzinaStazeKm: t })}
                  keyboardType="decimal-pad"
                />
                <Input
                  label="Visina vrha (m)"
                  value={values.visinaVrhM}
                  onChangeText={(t) => patch({ visinaVrhM: t })}
                  keyboardType="number-pad"
                />
                <CheckboxRow
                  label="Zimski uspon"
                  checked={values.zimskiUspon}
                  onToggle={() => patch({ zimskiUspon: !values.zimskiUspon })}
                />
              </>
            ) : null}

            <Text variant="label">Opis</Text>
            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={4}
              value={values.opis}
              onChangeText={(t) => patch({ opis: t })}
              placeholder="Opis akcije…"
              placeholderTextColor={colors.textSubtle}
              textAlignVertical="top"
            />

            <View style={styles.currencyNote}>
              <Text variant="small">
                Valuta kluba: <Text variant="label">{clubCurrency}</Text>. Sve cene unosite u ovoj valuti.
              </Text>
            </View>

            {isGuideOrganizer ? (
              <View style={styles.lockedField}>
                <Text variant="label">Vodič</Text>
                <Text>{selectedGuideLabel || 'Izaberite vodiča'}</Text>
              </View>
            ) : (
              <>
                {!values.drugiVodicCheck ? (
                  <>
                    <Text variant="label">Vodič</Text>
                    <GuidePicker
                      guides={guides}
                      value={values.vodicId}
                      onChange={(id) => patch({ vodicId: id })}
                    />
                  </>
                ) : null}
                <CheckboxRow
                  label="Drugi vodič (ručno)"
                  checked={values.drugiVodicCheck}
                  onToggle={() =>
                    patch({
                      drugiVodicCheck: !values.drugiVodicCheck,
                      vodicId: values.drugiVodicCheck ? values.vodicId : '',
                      drugiVodicIme: values.drugiVodicCheck ? values.drugiVodicIme : '',
                    })
                  }
                />
                {values.drugiVodicCheck ? (
                  <Input
                    label="Ime drugog vodiča"
                    value={values.drugiVodicIme}
                    onChangeText={(t) => patch({ drugiVodicIme: t })}
                  />
                ) : null}
              </>
            )}

            {!isVia ? (
              <View style={styles.imageSection}>
                <Text variant="label">Slika akcije</Text>
                <Button title="Izaberi sliku" variant="secondary" onPress={() => void pickImage()} />
                {image ? (
                  <Image source={{ uri: image.uri }} style={styles.previewImage} resizeMode="cover" />
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.stepBody}>
            <Text variant="small" color={colors.textMuted}>
              Iznosi u valuti <Text variant="label">{clubCurrency}</Text>
            </Text>

            {!isVia ? (
              <Input
                label="Mesto polaska"
                value={values.mestoPolaska}
                onChangeText={(t) => patch({ mestoPolaska: t })}
              />
            ) : null}

            <Input
              label="Kontakt telefon"
              value={values.kontaktTelefon}
              onChangeText={(t) => patch({ kontaktTelefon: t })}
              keyboardType="phone-pad"
              placeholder={isVia ? 'Opciono' : undefined}
            />
            {isVia ? (
              <Text variant="small" color={colors.textMuted}>
                Telefon je opcion za via ferrata akcije.
              </Text>
            ) : null}

            {!isVia ? (
              <Input
                label="Broj dana"
                value={values.brojDana}
                onChangeText={(t) => patch({ brojDana: t })}
                keyboardType="number-pad"
              />
            ) : null}

            {isVia ? (
              <Input
                label={`Cena (${clubCurrency})`}
                value={values.cenaClan}
                onChangeText={(t) => patch({ cenaClan: t, cenaOstali: t })}
                keyboardType="decimal-pad"
              />
            ) : (
              <>
                <Input
                  label={`Cena za članove (${clubCurrency})`}
                  value={values.cenaClan}
                  onChangeText={(t) => patch({ cenaClan: t })}
                  keyboardType="decimal-pad"
                />
                {isPublic ? (
                  <Input
                    label={`Cena za ostale (${clubCurrency})`}
                    value={values.cenaOstali}
                    onChangeText={(t) => patch({ cenaOstali: t })}
                    keyboardType="decimal-pad"
                  />
                ) : null}
              </>
            )}

            {!isVia ? (
              <View style={styles.subSection}>
                <View style={styles.subHeader}>
                  <Text variant="heading">Smeštaj</Text>
                  <Button title="Dodaj" variant="ghost" onPress={addSmestaj} />
                </View>
                {!showSmestaj ? (
                  <Text variant="small" color={colors.textMuted}>
                    Smeštaj je opcion za jednodnevne akcije.
                  </Text>
                ) : null}
                {values.smestaj.map((s) => (
                  <View key={s.localId} style={styles.repeatBlock}>
                    <Input
                      placeholder="Gde spavamo"
                      value={s.naziv}
                      onChangeText={(t) =>
                        patch({
                          smestaj: values.smestaj.map((it) =>
                            it.localId === s.localId ? { ...it, naziv: t } : it,
                          ),
                        })
                      }
                    />
                    <Input
                      placeholder={`Ukupno po osobi (${clubCurrency})`}
                      value={s.cenaPoOsobiUkupno}
                      onChangeText={(t) =>
                        patch({
                          smestaj: values.smestaj.map((it) =>
                            it.localId === s.localId ? { ...it, cenaPoOsobiUkupno: t } : it,
                          ),
                        })
                      }
                      keyboardType="decimal-pad"
                    />
                    <Input
                      placeholder="Opis smeštaja"
                      value={s.opis}
                      onChangeText={(t) =>
                        patch({
                          smestaj: values.smestaj.map((it) =>
                            it.localId === s.localId ? { ...it, opis: t } : it,
                          ),
                        })
                      }
                    />
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {step === 3 && !isVia ? (
          <View style={styles.stepBody}>
            <Text variant="small" color={colors.textMuted}>
              Cene iznajmljivanja u valuti <Text variant="label">{clubCurrency}</Text>
            </Text>
            <View style={styles.subHeader}>
              <Text variant="heading">Oprema</Text>
              <Button title="Dodaj" variant="ghost" onPress={addOprema} />
            </View>
            {values.oprema.length === 0 ? (
              <Text variant="small" color={colors.textMuted}>
                Nema stavki — dodajte opremu za iznajmljivanje.
              </Text>
            ) : null}
            {values.oprema.map((o) => (
              <View key={o.localId} style={styles.repeatBlock}>
                <Input
                  placeholder="Naziv opreme"
                  value={o.naziv}
                  onChangeText={(t) =>
                    patch({
                      oprema: values.oprema.map((it) =>
                        it.localId === o.localId ? { ...it, naziv: t } : it,
                      ),
                    })
                  }
                />
                <Input
                  placeholder="Dostupna količina"
                  value={o.dostupnaKolicina}
                  onChangeText={(t) =>
                    patch({
                      oprema: values.oprema.map((it) =>
                        it.localId === o.localId ? { ...it, dostupnaKolicina: t } : it,
                      ),
                    })
                  }
                  keyboardType="number-pad"
                />
                <Input
                  placeholder={`Cena po setu (${clubCurrency})`}
                  value={o.cenaPoSetu}
                  onChangeText={(t) =>
                    patch({
                      oprema: values.oprema.map((it) =>
                        it.localId === o.localId ? { ...it, cenaPoSetu: t } : it,
                      ),
                    })
                  }
                  keyboardType="decimal-pad"
                />
              </View>
            ))}
          </View>
        ) : null}

        {((step === 3 && isVia) || (step === 4 && !isVia)) ? (
          <View style={styles.stepBody}>
            <View style={styles.summaryBox}>
              <Text variant="small" color={colors.textMuted}>
                Pregled pre slanja
              </Text>
              <Text>
                {values.naziv || '—'} · {values.planina || '—'} — {values.vrh || '—'}
              </Text>
              <Text variant="small">
                {values.datum || '—'} · Težina: {values.tezina || '—'}
              </Text>
              <Text variant="small">
                Organizator: {values.organizerType === 'vodic' ? 'Vodič' : 'Klub'} · Vidljivost:{' '}
                {values.visibility === 'javna' ? 'Javna' : isGuideOrganizer ? 'Privatna' : 'Klubska'} · Valuta:{' '}
                {clubCurrency}
              </Text>
            </View>

            {!isVia ? (
              <View style={styles.subSection}>
                <View style={styles.subHeader}>
                  <Text variant="heading">Prevoz</Text>
                  <Button title="Dodaj" variant="ghost" onPress={addPrevoz} />
                </View>
                {values.prevoz.length === 0 ? (
                  <Pressable onPress={addPrevoz} style={styles.transportPlaceholder}>
                    <View style={styles.transportPlaceholderIcon}>
                      <Ionicons name="add" size={24} color={colors.brand} />
                    </View>
                    <Text variant="label">Dodaj prevoz</Text>
                    <Text variant="small" color={colors.textMuted} style={styles.transportPlaceholderHint}>
                      Nema opcija prevoza — dodajte svoju.
                    </Text>
                  </Pressable>
                ) : null}
                {values.prevoz.map((p) => (
                  <View key={p.localId} style={styles.repeatBlock}>
                    <Input
                      placeholder="Tip prevoza"
                      value={p.tipPrevoza}
                      onChangeText={(t) =>
                        patch({
                          prevoz: values.prevoz.map((it) =>
                            it.localId === p.localId ? { ...it, tipPrevoza: t } : it,
                          ),
                        })
                      }
                    />
                    <Input
                      placeholder="Naziv grupe"
                      value={p.nazivGrupe}
                      onChangeText={(t) =>
                        patch({
                          prevoz: values.prevoz.map((it) =>
                            it.localId === p.localId ? { ...it, nazivGrupe: t } : it,
                          ),
                        })
                      }
                    />
                    <Input
                      placeholder="Kapacitet"
                      value={p.kapacitet}
                      onChangeText={(t) =>
                        patch({
                          prevoz: values.prevoz.map((it) =>
                            it.localId === p.localId ? { ...it, kapacitet: t } : it,
                          ),
                        })
                      }
                      keyboardType="number-pad"
                    />
                    <Input
                      placeholder={`Cena po osobi (${clubCurrency})`}
                      value={p.cenaPoOsobi}
                      onChangeText={(t) =>
                        patch({
                          prevoz: values.prevoz.map((it) =>
                            it.localId === p.localId ? { ...it, cenaPoOsobi: t } : it,
                          ),
                        })
                      }
                      keyboardType="decimal-pad"
                    />
                  </View>
                ))}
              </View>
            ) : null}

            <CheckboxRow
              label="Prikaži listu prijavljenih"
              checked={values.prikaziListuPrijavljenih}
              onToggle={() => patch({ prikaziListuPrijavljenih: !values.prikaziListuPrijavljenih })}
            />

            <View style={styles.costPreview}>
              <Text variant="label" color={colors.brand}>
                Pregled troškova ({clubCurrency})
              </Text>
              {isVia ? (
                <Text>
                  Osnovna cena:{' '}
                  <Text variant="label">
                    {Number(values.cenaClan || 0).toFixed(2)} {clubCurrency}
                  </Text>
                </Text>
              ) : (
                <>
                  <Text>
                    Članovi:{' '}
                    <Text variant="label">
                      {Number(values.cenaClan || 0).toFixed(2)} {clubCurrency}
                    </Text>
                  </Text>
                  {isPublic ? (
                    <Text>
                      Ostali:{' '}
                      <Text variant="label">
                        {Number(values.cenaOstali || 0).toFixed(2)} {clubCurrency}
                      </Text>
                    </Text>
                  ) : null}
                </>
              )}
              <Text>
                Opcioni dodaci:{' '}
                <Text variant="label">
                  {totalOptionalPreview.toFixed(2)} {clubCurrency}
                </Text>
              </Text>
            </View>
          </View>
        ) : null}
      </Card>

      <View style={styles.navRow}>
        <Button
          title="Nazad"
          variant="secondary"
          onPress={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
        />
        {step < maxStep ? (
          <Button title="Sledeći korak" onPress={() => setStep((s) => Math.min(maxStep, s + 1))} />
        ) : (
          <Button title="Kreiraj akciju" onPress={() => void handleSubmit()} loading={loading} />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  errorBox: {
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  stepBar: { gap: spacing.sm, paddingVertical: spacing.xs },
  stepChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceAlt,
  },
  stepChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  stepChipText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textMuted },
  stepChipTextActive: { color: colors.white },
  stepCard: { gap: spacing.md },
  stepBody: { gap: spacing.md },
  lockedField: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    fontSize: fontSize.md,
    color: colors.text,
    minHeight: 100,
  },
  currencyNote: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkboxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  checkMark: { color: colors.white, fontSize: 14, fontWeight: '700' },
  guidePicker: { gap: spacing.sm },
  guideGroup: { gap: spacing.xs },
  guideRow: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  guideRowSelected: { borderColor: colors.brand, backgroundColor: '#ecfdf5' },
  ferrataWrap: { gap: spacing.xs },
  ferrataList: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    maxHeight: 220,
  },
  ferrataItem: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.xs,
  },
  ferrataEmpty: { padding: spacing.md },
  ferrataMeta: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  imageSection: { gap: spacing.sm },
  previewImage: { width: '100%', height: 160, borderRadius: radius.md },
  subSection: { gap: spacing.md, paddingTop: spacing.sm },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  transportPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#bae6fd',
    backgroundColor: '#f0f9ff',
    gap: spacing.xs,
  },
  transportPlaceholderIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transportPlaceholderHint: { textAlign: 'center' },
  repeatBlock: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryBox: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  costPreview: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: colors.brandLight,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
})
