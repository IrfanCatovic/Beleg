import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { getApiErrorMessage } from '@beleg/shared'
import { updateMe } from '@beleg/shared/services'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import { Button, Input, Screen, Text } from '../../components/ui'
import { spacing } from '../../theme'
import type { ProfileStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileSettings'>

export default function ProfileSettingsScreen({ navigation }: Props) {
  const { user, refreshUser } = useAuth()
  const { showAlert } = useModal()
  const [fullName, setFullName] = useState(user?.fullName ?? '')
  const [phone, setPhone] = useState('')

  const saveMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      if (fullName) fd.append('fullName', fullName)
      if (phone) fd.append('telefon', phone)
      return updateMe(client, fd)
    },
    onSuccess: async () => {
      await refreshUser()
      await showAlert('Sačuvano', 'Profil je ažuriran.')
      navigation.goBack()
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Čuvanje nije uspelo.')),
  })

  return (
    <Screen scroll>
      <Text variant="heading" style={styles.section}>
        Osnovni podaci
      </Text>
      <View style={styles.form}>
        <Input label="Ime i prezime" value={fullName} onChangeText={setFullName} />
        <Input label="Telefon" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Button
          title="Sačuvaj"
          loading={saveMutation.isPending}
          onPress={() => saveMutation.mutate()}
          fullWidth
        />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.md },
  form: { gap: spacing.md },
})
