import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { getApiErrorMessage } from '@beleg/shared'
import { fetchMeProfile, getMyGuideProfile, updateMe } from '@beleg/shared/services'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import { navigateToBecomeGuide } from '../../navigation/navigationRef'
import { Button, ChipRow, DatePickerField, Input, Loader, Screen, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { ProfileStackParamList } from '../../navigation/types'
import { SettingsSection } from './SettingsSection'
import {
  computeProfileCompletion,
  hasMembershipDocsFilled,
  summarizeCompletionDisplay,
} from './profileCompletion'
import {
  PRIVACY_COPY,
  buildGuideSettingsBlock,
  mapGuideProfileToCompletionStatus,
} from './profileSettingsModel'

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileSettings'>

function dateOnly(s?: string | null): string {
  if (!s) return ''
  return s.slice(0, 10)
}

export default function ProfileSettingsScreen({ navigation }: Props) {
  const { refreshUser } = useAuth()
  const { showAlert } = useModal()
  const submitLockRef = useRef(false)

  const [username, setUsername] = useState('')
  const [role, setRole] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [imeRoditelja, setImeRoditelja] = useState('')
  const [pol, setPol] = useState('')
  const [datumRodjenja, setDatumRodjenja] = useState('')
  const [drzavljanstvo, setDrzavljanstvo] = useState('')
  const [email, setEmail] = useState('')
  const [telefon, setTelefon] = useState('')
  const [adresa, setAdresa] = useState('')
  const [brojLicnogDokumenta, setBrojLicnogDokumenta] = useState('')
  const [brojPlaninarskeLegitimacije, setBrojPlaninarskeLegitimacije] = useState('')
  const [brojPlaninarskeMarkice, setBrojPlaninarskeMarkice] = useState('')
  const [datumUclanjenja, setDatumUclanjenja] = useState('')
  const [klubNaziv, setKlubNaziv] = useState('')
  const [emailVerified, setEmailVerified] = useState(false)
  const [hasAvatar, setHasAvatar] = useState(false)
  const [hasCover, setHasCover] = useState(false)
  const [baseline, setBaseline] = useState('')
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [resendingEmail, setResendingEmail] = useState(false)

  const profileQuery = useQuery({
    queryKey: ['me-profile'],
    queryFn: () => fetchMeProfile(client),
  })

  const guideQuery = useQuery({
    queryKey: ['my-guide-profile'],
    queryFn: () => getMyGuideProfile(client),
  })

  useEffect(() => {
    const k = profileQuery.data
    if (!k) return
    setUsername(k.username ?? '')
    setRole(k.role ?? '')
    setFullName(k.fullName ?? '')
    setImeRoditelja(k.ime_roditelja ?? '')
    setPol(k.pol ?? '')
    setDatumRodjenja(dateOnly(k.datum_rodjenja))
    setDrzavljanstvo(k.drzavljanstvo ?? '')
    setEmail(k.email ?? '')
    setTelefon(k.telefon ?? '')
    setAdresa(k.adresa ?? '')
    setBrojLicnogDokumenta(k.broj_licnog_dokumenta ?? '')
    setBrojPlaninarskeLegitimacije(k.broj_planinarske_legitimacije ?? '')
    setBrojPlaninarskeMarkice(k.broj_planinarske_markice ?? '')
    setDatumUclanjenja(dateOnly(k.datum_uclanjenja))
    setKlubNaziv(k.klubNaziv ?? '')
    setEmailVerified(!!k.email_verified_at)
    setHasAvatar(!!k.avatar_url)
    setHasCover(!!k.cover_image_url)
    setBaseline(
      JSON.stringify({
        username: k.username ?? '',
        fullName: k.fullName ?? '',
        imeRoditelja: k.ime_roditelja ?? '',
        pol: k.pol ?? '',
        datumRodjenja: dateOnly(k.datum_rodjenja),
        drzavljanstvo: k.drzavljanstvo ?? '',
        email: k.email ?? '',
        telefon: k.telefon ?? '',
        adresa: k.adresa ?? '',
        brojLicnogDokumenta: k.broj_licnog_dokumenta ?? '',
        brojPlaninarskeLegitimacije: k.broj_planinarske_legitimacije ?? '',
        brojPlaninarskeMarkice: k.broj_planinarske_markice ?? '',
        datumUclanjenja: dateOnly(k.datum_uclanjenja),
      }),
    )
  }, [profileQuery.data])

  const guideStatus = mapGuideProfileToCompletionStatus(guideQuery.data)
  const guideBlock = buildGuideSettingsBlock(guideStatus)

  const completionInput = useMemo(
    () => ({
      fullName,
      username,
      email,
      emailVerified,
      hasAvatar,
      hasCover,
      hasClub: !!klubNaziv.trim(),
      hasMembershipDocs: hasMembershipDocsFilled({
        legitimacija: brojPlaninarskeLegitimacije,
        markica: brojPlaninarskeMarkice,
        licniDokument: brojLicnogDokumenta,
      }),
      guideStatus,
    }),
    [
      fullName,
      username,
      email,
      emailVerified,
      hasAvatar,
      hasCover,
      klubNaziv,
      brojPlaninarskeLegitimacije,
      brojPlaninarskeMarkice,
      brojLicnogDokumenta,
      guideStatus,
    ],
  )

  const completion = useMemo(() => computeProfileCompletion(completionInput), [completionInput])
  const completionDisplay = useMemo(() => summarizeCompletionDisplay(completion), [completion])

  const isDirty = useMemo(() => {
    if (!baseline) return false
    const current = JSON.stringify({
      username,
      fullName,
      imeRoditelja,
      pol,
      datumRodjenja,
      drzavljanstvo,
      email,
      telefon,
      adresa,
      brojLicnogDokumenta,
      brojPlaninarskeLegitimacije,
      brojPlaninarskeMarkice,
      datumUclanjenja,
    })
    if (current !== baseline) return true
    return !!(newPassword || confirmPassword || currentPassword)
  }, [
    baseline,
    username,
    fullName,
    imeRoditelja,
    pol,
    datumRodjenja,
    drzavljanstvo,
    email,
    telefon,
    adresa,
    brojLicnogDokumenta,
    brojPlaninarskeLegitimacije,
    brojPlaninarskeMarkice,
    datumUclanjenja,
    newPassword,
    confirmPassword,
    currentPassword,
  ])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) {
        throw new Error('Lozinke se ne poklapaju.')
      }
      if (newPassword && newPassword.length < 8) {
        throw new Error('Lozinka mora imati najmanje 8 karaktera.')
      }
      if (newPassword && !currentPassword.trim()) {
        throw new Error('Unesite trenutnu lozinku da biste postavili novu.')
      }

      const fd = new FormData()
      fd.append('username', username.trim().toLowerCase())
      fd.append('fullName', fullName.trim())
      fd.append('imeRoditelja', imeRoditelja.trim())
      fd.append('pol', pol)
      fd.append('drzavljanstvo', drzavljanstvo.trim())
      fd.append('adresa', adresa.trim())
      fd.append('telefon', telefon.trim())
      fd.append('email', email.trim())
      fd.append('brojLicnogDokumenta', brojLicnogDokumenta.trim())
      fd.append('brojPlaninarskeLegitimacije', brojPlaninarskeLegitimacije.trim())
      fd.append('brojPlaninarskeMarkice', brojPlaninarskeMarkice.trim())
      if (datumRodjenja) fd.append('datumRodjenja', datumRodjenja)
      if (datumUclanjenja) fd.append('datumUclanjenja', datumUclanjenja)
      if (newPassword) {
        fd.append('newPassword', newPassword)
        fd.append('currentPassword', currentPassword)
      }

      return updateMe(client, fd)
    },
    onSuccess: async () => {
      setNewPassword('')
      setConfirmPassword('')
      setCurrentPassword('')
      setFormError('')
      setFormSuccess('Profil je ažuriran.')
      setBaseline(
        JSON.stringify({
          username,
          fullName,
          imeRoditelja,
          pol,
          datumRodjenja,
          drzavljanstvo,
          email,
          telefon,
          adresa,
          brojLicnogDokumenta,
          brojPlaninarskeLegitimacije,
          brojPlaninarskeMarkice,
          datumUclanjenja,
        }),
      )
      await refreshUser()
      await profileQuery.refetch()
      await showAlert('Sačuvano', 'Profil je ažuriran.')
    },
    onError: (err) => {
      setFormSuccess('')
      const msg =
        err instanceof Error && err.message ? err.message : getApiErrorMessage(err, 'Čuvanje nije uspelo.')
      setFormError(msg)
      void showAlert('Greška', msg)
    },
    onSettled: () => {
      submitLockRef.current = false
    },
  })

  const handleSave = () => {
    if (saveMutation.isPending || submitLockRef.current || !isDirty) return
    submitLockRef.current = true
    setFormError('')
    setFormSuccess('')
    saveMutation.mutate()
  }

  const handleResendEmail = async () => {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || resendingEmail) return
    setResendingEmail(true)
    try {
      await client.post('/api/email/resend', { email: trimmed })
      setFormSuccess('Potvrda je poslata na vaš email.')
      setFormError('')
    } catch (err) {
      setFormSuccess('')
      setFormError(getApiErrorMessage(err, 'Slanje potvrde nije uspelo.'))
    } finally {
      setResendingEmail(false)
    }
  }

  const openPublicProfile = () => {
    const u = username.trim()
    if (!u) return
    navigation.navigate('UserProfile', { username: u })
  }

  if (profileQuery.isLoading) {
    return (
      <Screen>
        <Loader />
      </Screen>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <Screen scroll edges={['top', 'left', 'right', 'bottom']}>
        <Text variant="heading" style={styles.title} accessibilityRole="header">
          Podešavanja profila
        </Text>
        <Text variant="small" color={colors.textMuted} style={styles.subtitle}>
          Javni, privatni i klupski podaci Planinarskog pasoša.
        </Text>

        <View
          style={styles.completionCard}
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 0,
            max: 100,
            now: completion.percentage,
            text: completionDisplay.headline,
          }}
          accessibilityLabel={completionDisplay.headline}
        >
          <Text variant="label">Dovršenost Planinarskog pasoša</Text>
          <Text variant="small" color={colors.textMuted} style={styles.completionHeadline}>
            {completionDisplay.headline}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${completion.percentage}%` }]} />
          </View>
          {!completion.isBasicComplete
            ? completionDisplay.missingPreview.map((item) => (
                <Text key={item.id} variant="small" color={colors.textMuted}>
                  • {item.label}
                </Text>
              ))
            : null}
          {completionDisplay.moreRecommendationsLabel ? (
            <Text variant="small" color={colors.textMuted}>
              {completionDisplay.moreRecommendationsLabel}
            </Text>
          ) : null}
        </View>

        {(formError || formSuccess) && (
          <View
            accessibilityLiveRegion="polite"
            accessibilityRole="text"
            style={formError ? styles.errorBox : styles.successBox}
          >
            <Text variant="small" color={formError ? colors.danger : colors.brand}>
              {formError || formSuccess}
            </Text>
          </View>
        )}

        <SettingsSection
          icon="person-circle-outline"
          title="Javni profil"
          badge={PRIVACY_COPY.publicBadge}
          description={PRIVACY_COPY.publicHint}
        >
          <Input label="Puno ime i prezime" value={fullName} onChangeText={setFullName} />
          <Input
            label="Korisničko ime"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            textContentType="username"
            autoComplete="username"
          />
          {username.trim() ? (
            <Button
              title={PRIVACY_COPY.publicProfileLink}
              variant="secondary"
              onPress={openPublicProfile}
              accessibilityLabel={PRIVACY_COPY.publicProfileLink}
            />
          ) : null}
        </SettingsSection>

        <SettingsSection
          icon="call-outline"
          title="Kontakt i lični podaci"
          badge={PRIVACY_COPY.privateBadge}
          description={PRIVACY_COPY.privateHint}
        >
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            textContentType="emailAddress"
            autoComplete="email"
          />
          <Input
            label="Telefon"
            value={telefon}
            onChangeText={setTelefon}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
          />
          <Input label="Adresa" value={adresa} onChangeText={setAdresa} textContentType="fullStreetAddress" />
          <Input label="Ime roditelja" value={imeRoditelja} onChangeText={setImeRoditelja} />
          <ChipRow
            label="Pol"
            value={pol}
            onChange={setPol}
            options={[
              { value: 'M', label: 'Muški' },
              { value: 'Ž', label: 'Ženski' },
            ]}
          />
          <DatePickerField
            label="Datum rođenja"
            value={datumRodjenja || null}
            onChange={(ymd) => setDatumRodjenja(ymd ?? '')}
            preset="birth"
          />
          <Input label="Državljanstvo" value={drzavljanstvo} onChangeText={setDrzavljanstvo} />
        </SettingsSection>

        <SettingsSection
          icon="document-text-outline"
          title="Planinarsko članstvo i dokumentacija"
          badge={PRIVACY_COPY.clubBadge}
          description={PRIVACY_COPY.clubHint}
        >
          <Input
            label="Planinarski klub"
            value={klubNaziv || 'Niste povezani sa klubom'}
            editable={false}
            accessibilityHint={PRIVACY_COPY.clubManagedHint}
          />
          <Text variant="small" color={colors.textMuted}>
            {PRIVACY_COPY.clubManagedHint}
          </Text>
          <Input
            label="Broj planinarske legitimacije"
            value={brojPlaninarskeLegitimacije}
            onChangeText={setBrojPlaninarskeLegitimacije}
          />
          <Input
            label="Broj planinarske markice"
            value={brojPlaninarskeMarkice}
            onChangeText={setBrojPlaninarskeMarkice}
          />
          <Input
            label="Broj ličnog dokumenta"
            value={brojLicnogDokumenta}
            onChangeText={setBrojLicnogDokumenta}
          />
          <DatePickerField
            label="Datum učlanjenja"
            value={datumUclanjenja || null}
            onChange={(ymd) => setDatumUclanjenja(ymd ?? '')}
            preset="past"
          />
        </SettingsSection>

        {guideBlock ? (
          <SettingsSection icon="compass-outline" title="Vodički profil">
            {guideBlock.kind === 'apply' ? (
              <Button
                title={guideBlock.ctaLabel}
                variant="secondary"
                onPress={() => navigateToBecomeGuide()}
              />
            ) : null}
            {guideBlock.kind === 'pending' ||
            guideBlock.kind === 'approved' ||
            guideBlock.kind === 'suspended' ? (
              <Text variant="small" color={colors.textMuted}>
                {guideBlock.message}
              </Text>
            ) : null}
            {guideBlock.kind === 'rejected' ? (
              <>
                <Text variant="small" color={colors.textMuted}>
                  {guideBlock.message}
                </Text>
                <Button
                  title={guideBlock.ctaLabel}
                  variant="secondary"
                  onPress={() => navigateToBecomeGuide()}
                />
              </>
            ) : null}
          </SettingsSection>
        ) : null}

        <SettingsSection icon="key-outline" title="Nalog i sigurnost">
          <View style={styles.emailStatusRow}>
            <Text variant="label">Status potvrde emaila</Text>
            <Text
              variant="small"
              color={emailVerified ? colors.brand : colors.warning}
              accessibilityLabel={emailVerified ? 'Email je potvrđen' : 'Email nije potvrđen'}
            >
              {emailVerified ? 'Email je potvrđen' : 'Email nije potvrđen'}
            </Text>
            {!emailVerified && email.trim() ? (
              <Pressable onPress={() => void handleResendEmail()} disabled={resendingEmail}>
                <Text variant="small" color={colors.brand}>
                  {resendingEmail ? 'Šaljem…' : 'Pošalji ponovo potvrdu'}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <Input label="Uloga" value={role} editable={false} />
          <Input
            label="Trenutna lozinka"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            placeholder="Obavezna samo ako menjate lozinku"
            textContentType="password"
            autoComplete="password"
            accessibilityLabel="Trenutna lozinka"
          />
          <Input
            label="Nova lozinka (ostavite prazno ako ne menjate)"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholder="Min. 8 karaktera"
            textContentType="newPassword"
            autoComplete="password-new"
            accessibilityLabel="Nova lozinka"
          />
          <Input
            label="Ponovite lozinku"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholder="Ponovite lozinku"
            textContentType="newPassword"
            autoComplete="password-new"
            accessibilityLabel="Potvrda nove lozinke"
          />
        </SettingsSection>

        <View style={styles.footer}>
          {saveMutation.isPending ? <ActivityIndicator color={colors.brand} /> : null}
          <Button
            title={saveMutation.isPending ? 'Čuvanje...' : 'Sačuvaj izmjene'}
            loading={saveMutation.isPending}
            disabled={saveMutation.isPending || !isDirty}
            onPress={handleSave}
            fullWidth
            accessibilityLabel={saveMutation.isPending ? 'Čuvanje izmjena' : 'Sačuvaj izmjene'}
            accessibilityState={{ disabled: saveMutation.isPending || !isDirty, busy: saveMutation.isPending }}
          />
          <Button title="Otkaži" variant="secondary" onPress={() => navigation.goBack()} fullWidth />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { marginBottom: spacing.xs },
  subtitle: { marginBottom: spacing.lg },
  completionCard: {
    gap: spacing.xs,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  completionHeadline: { marginBottom: spacing.xs },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressFill: { height: '100%', backgroundColor: colors.brand },
  emailStatusRow: { gap: spacing.xs },
  errorBox: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 10,
    backgroundColor: '#fff1f2',
  },
  successBox: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 10,
    backgroundColor: '#ecfdf5',
  },
  footer: { gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.xxl },
})
