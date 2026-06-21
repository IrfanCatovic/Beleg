import { useEffect } from 'react'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useAuth } from '../../context/AuthContext'
import { Loader, Screen } from '../../components/ui'
import type { ProfileStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<ProfileStackParamList, 'MyProfile'>

export default function MyProfileScreen({ navigation }: Props) {
  const { user } = useAuth()

  useEffect(() => {
    if (user?.username) {
      navigation.replace('UserProfile', { username: user.username })
    }
  }, [user?.username, navigation])

  return (
    <Screen>
      <Loader />
    </Screen>
  )
}
