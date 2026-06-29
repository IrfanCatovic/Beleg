import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { getApiErrorMessage } from '@beleg/shared'
import { fetchMeProfile, updateMe } from '@beleg/shared/services'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import { Button, ChipRow, DatePickerField, Input, Loader, Screen, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { ProfileStackParamList } from '../../navigation/types'
import { PushDebugPanel } from '../../components/PushDebugPanel'
import { SettingsSection } from './SettingsSection'

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileSettings'>

function dateOnly(s?: string | null): string {
  if (!s) return ''
  return s.slice(0, 10)
}

export default function ProfileSettingsScreen({ navigation }: Props) {
  const { refreshUser } = useAuth()
  const { showAlert } = useModal()

  const [username, setUsername] = useState('')
  const [role, setRole] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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

  const profileQuery = useQuery({
    queryKey: ['me-profile'],
    queryFn: () => fetchMeProfile(client),
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
  }, [profileQuery.data])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) {
        throw new Error('Lozinke se ne poklapaju.')
      }
      if (newPassword && newPassword.length < 8) {
        throw new Error('Lozinka mora imati najmanje 8 karaktera.')
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
      if (newPassword) fd.append('newPassword', newPassword)

      return updateMe(client, fd)
    },
    onSuccess: async () => {
      await refreshUser()
      await showAlert('Sačuvano', 'Profil je ažuriran.')
      navigation.goBack()
    },
    onError: (err) => {
      const msg = err instanceof Error && err.message ? err.message : getApiErrorMessage(err, 'Čuvanje nije uspelo.')
      void showAlert('Greška', msg)
    },
  })

  if (profileQuery.isLoading) {
    return (
      <Screen>
        <Loader />
      </Screen>
    )
  }

  return (
    <Screen scroll>
      <Text variant="heading" style={styles.title}>
        Podešavanja profila
      </Text>
      <Text variant="small" color={colors.textMuted} style={styles.subtitle}>
        Ažurirajte nalog, lične podatke, kontakt i planinarske dokumente.
      </Text>

      <SettingsSection icon="person-circle-outline" title="Nalog">
        <Input label="Korisničko ime" value={username} onChangeText={setUsername} autoCapitalize="none" />
        <Input label="Uloga" value={role} editable={false} />
        <Input
          label="Nova lozinka (ostavite prazno ako ne menjate)"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          placeholder="Min. 8 karaktera"
        />
        <Input
          label="Ponovite lozinku"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          placeholder="Ponovite lozinku"
        />
      </SettingsSection>

      <SettingsSection icon="id-card-outline" title="Lični podaci">
        <Input label="Puno ime i prezime" value={fullName} onChangeText={setFullName} />
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

      <SettingsSection icon="call-outline" title="Kontakt">
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Input label="Telefon" value={telefon} onChangeText={setTelefon} keyboardType="phone-pad" />
        <Input label="Adresa" value={adresa} onChangeText={setAdresa} />
      </SettingsSection>

      <SettingsSection icon="document-text-outline" title="Dokumenti i planinarski podaci">
        <Input
          label="Broj ličnog dokumenta"
          value={brojLicnogDokumenta}
          onChangeText={setBrojLicnogDokumenta}
        />
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
        <DatePickerField
          label="Datum učlanjenja"
          value={datumUclanjenja || null}
          onChange={(ymd) => setDatumUclanjenja(ymd ?? '')}
          preset="past"
        />
      </SettingsSection>

      <PushDebugPanel />

      <View style={styles.footer}>
        {saveMutation.isPending ? <ActivityIndicator color={colors.brand} /> : null}
        <Button title="Sačuvaj izmene" loading={saveMutation.isPending} onPress={() => saveMutation.mutate()} fullWidth />
        <Button title="Otkaži" variant="secondary" onPress={() => navigation.goBack()} fullWidth />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  title: { marginBottom: spacing.xs },
  subtitle: { marginBottom: spacing.lg },
  footer: { gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.xxl },
})
