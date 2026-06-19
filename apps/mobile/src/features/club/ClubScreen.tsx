import { StyleSheet, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { getApiErrorMessage } from '@beleg/shared'
import { fetchKlub, leaveClub } from '@beleg/shared/services'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import { Avatar, Button, Card, ErrorView, Loader, Screen, Text } from '../../components/ui'
import { hasClubContext } from '../../utils/roles'
import { colors, spacing } from '../../theme'
import NoClubJoinView from './NoClubJoinView'
import type { ClubStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<ClubStackParamList, 'ClubHome'>

export default function ClubScreen(_props: Props) {
  const { user, refreshUser } = useAuth()
  const { showConfirm, showAlert } = useModal()
  const queryClient = useQueryClient()

  const klubQuery = useQuery({
    queryKey: ['klub'],
    queryFn: () => fetchKlub(client),
    enabled: hasClubContext(user),
  })

  const leaveMutation = useMutation({
    mutationFn: () => leaveClub(client),
    onSuccess: async () => {
      await refreshUser()
      void queryClient.invalidateQueries({ queryKey: ['klub'] })
      await showAlert('Uspeh', 'Napustili ste klub.')
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Napuštanje nije uspelo.')),
  })

  if (!hasClubContext(user)) {
    return (
      <Screen scroll>
        <NoClubJoinView />
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

      <Card style={styles.meta}>
        {klub.adresa ? <Text>Adresa: {klub.adresa}</Text> : null}
        {klub.telefon ? <Text>Telefon: {klub.telefon}</Text> : null}
        {klub.email ? <Text>Email: {klub.email}</Text> : null}
        {klub.web_sajt ? <Text>Web: {klub.web_sajt}</Text> : null}
      </Card>

      <Button
        title="Napusti klub"
        variant="danger"
        onPress={async () => {
          const ok = await showConfirm('Napusti klub', 'Da li ste sigurni?')
          if (ok) leaveMutation.mutate()
        }}
        loading={leaveMutation.isPending}
        fullWidth
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  headerText: { flex: 1, justifyContent: 'center' },
  meta: { gap: spacing.xs, marginBottom: spacing.xl },
})
