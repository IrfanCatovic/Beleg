import { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import * as ImagePicker from 'expo-image-picker'
import { getApiErrorMessage } from '@beleg/shared'
import { updateMe, updateMyAvatar } from '@beleg/shared/services'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import { Avatar, Button, Input, Screen, Text } from '../../components/ui'
import { spacing } from '../../theme'
import type { ProfileStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileSettings'>

export default function ProfileSettingsScreen({ navigation }: Props) {
  const { user, refreshUser } = useAuth()
  const { showAlert } = useModal()
  const [fullName, setFullName] = useState(user?.fullName ?? '')
  const [phone, setPhone] = useState('')
  const [adresa, setAdresa] = useState('')
  const [email, setEmail] = useState('')
  const [legitimacija, setLegitimacija] = useState('')

  const avatarMutation = useMutation({
    mutationFn: async (uri: string) => {
      const fd = new FormData()
      const filename = uri.split('/').pop() || 'avatar.jpg'
      const match = /\.(\w+)$/.exec(filename)
      const type = match ? `image/${match[1]}` : 'image/jpeg'
      fd.append('avatar', { uri, name: filename, type } as unknown as Blob)
      return updateMyAvatar(client, fd)
    },
    onSuccess: async () => {
      await refreshUser()
      await showAlert('Sačuvano', 'Avatar je ažuriran.')
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Upload nije uspeo.')),
  })

  const pickAvatar = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      await showAlert('Dozvola', 'Potrebna je dozvola za galeriju.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    })
    if (!result.canceled && result.assets[0]) {
      avatarMutation.mutate(result.assets[0].uri)
    }
  }, [avatarMutation, showAlert])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      if (fullName) fd.append('fullName', fullName)
      if (phone) fd.append('telefon', phone)
      if (adresa) fd.append('adresa', adresa)
      if (email) fd.append('email', email)
      if (legitimacija) fd.append('broj_planinarske_legitimacije', legitimacija)
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
      <View style={styles.avatarSection}>
        <Avatar uri={user?.avatarUrl} name={user?.fullName || user?.username} size={88} />
        <Button title="Promeni avatar" variant="secondary" onPress={pickAvatar} loading={avatarMutation.isPending} />
      </View>

      <Text variant="heading" style={styles.section}>
        Osnovni podaci
      </Text>
      <View style={styles.form}>
        <Input label="Ime i prezime" value={fullName} onChangeText={setFullName} />
        <Input label="Telefon" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Input label="Adresa" value={adresa} onChangeText={setAdresa} />
        <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Input
          label="Broj planinarske legitimacije"
          value={legitimacija}
          onChangeText={setLegitimacija}
        />
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
  avatarSection: { alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  section: { marginBottom: spacing.md },
  form: { gap: spacing.md },
})
