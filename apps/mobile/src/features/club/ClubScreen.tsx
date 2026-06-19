import { StyleSheet, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { fetchKlub } from '@beleg/shared/services'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { Avatar, Card, ErrorView, Loader, Screen, Text } from '../../components/ui'
import { hasClubContext } from '../../utils/roles'
import { colors, spacing } from '../../theme'
import type { ProfileStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<ProfileStackParamList, 'Club'>

export default function ClubScreen(_props: Props) {
  const { user } = useAuth()

  const klubQuery = useQuery({
    queryKey: ['klub'],
    queryFn: () => fetchKlub(client),
    enabled: hasClubContext(user),
  })

  if (!hasClubContext(user)) {
    return (
      <Screen>
        <Text>Niste član kluba. Pridružite se preko web aplikacije ili kontaktirajte sekretara.</Text>
      </Screen>
    )
  }

  if (klubQuery.isLoading) {
    return (
      <Screen>
        <Loader />
      </Screen>
    )
  }

  if (klubQuery.isError || !klubQuery.data) {
    return (
      <Screen>
        <ErrorView message="Podaci o klubu nisu učitani." onRetry={() => klubQuery.refetch()} />
      </Screen>
    )
  }

  const klub = klubQuery.data

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Avatar uri={klub.logoUrl} name={klub.naziv} size={72} />
        <View style={styles.headerText}>
          <Text variant="title">{klub.naziv}</Text>
          {klub.sediste ? <Text color={colors.textMuted}>{klub.sediste}</Text> : null}
        </View>
      </View>

      {klub.web_sajt ? (
        <Card>
          <Text>{klub.web_sajt}</Text>
        </Card>
      ) : null}

      {klub.email ? (
        <Card style={styles.meta}>
          <Text variant="label">Kontakt</Text>
          <Text>{klub.email}</Text>
        </Card>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  headerText: { flex: 1, justifyContent: 'center' },
  meta: { marginTop: spacing.md, gap: spacing.xs },
})
