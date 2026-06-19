import { StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useAuth } from '../../context/AuthContext'
import { Avatar, Button, Card, Screen, Text } from '../../components/ui'
import { canManageClub, canSeeFinance } from '../../utils/roles'
import { colors, spacing } from '../../theme'
import type { ProfileStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<ProfileStackParamList, 'MyProfile'>

export default function MyProfileScreen({ navigation }: Props) {
  const { user, logout } = useAuth()

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Avatar uri={user?.avatarUrl} name={user?.fullName || user?.username} size={80} />
        <View style={styles.headerText}>
          <Text variant="title">{user?.fullName || user?.username}</Text>
          <Text color={colors.textMuted}>@{user?.username}</Text>
          <Text variant="small" color={colors.textMuted}>
            Uloga: {user?.role}
          </Text>
        </View>
      </View>

      <View style={styles.menu}>
        <Button title="Podešavanja profila" variant="secondary" onPress={() => navigation.navigate('ProfileSettings')} />
        {canSeeFinance(user?.role) ? (
          <Button title="Finansije" variant="secondary" onPress={() => navigation.navigate('Finance')} />
        ) : null}
        {canManageClub(user?.role) || user?.role === 'admin' ? (
          <Button title="Zadaci" variant="secondary" onPress={() => navigation.navigate('Tasks')} />
        ) : null}
        <Button title="Odjavi se" variant="ghost" onPress={() => logout()} />
      </View>

      {user?.profileIncomplete ? (
        <Card style={styles.warn}>
          <Text color={colors.warning}>Profil nije kompletan. Dopunite podatke u podešavanjima.</Text>
        </Card>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  headerText: { flex: 1, justifyContent: 'center' },
  menu: { gap: spacing.sm },
  warn: { marginTop: spacing.lg },
})
