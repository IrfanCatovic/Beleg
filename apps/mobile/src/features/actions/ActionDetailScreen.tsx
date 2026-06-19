import { StyleSheet, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import {
  fetchAkcijaById,
  fetchMojaPrijavaZaAkciju,
  fetchMojePrijave,
  otkaziPrijavu,
  prijaviNaAkciju,
} from '@beleg/shared/services'
import { getApiErrorMessage } from '@beleg/shared'
import { client } from '../../api/client'
import { useModal } from '../../context/ModalContext'
import { Badge, Button, Card, ErrorView, Loader, Screen, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { ActionsStackParamList } from '../../navigation/types'
import type { HomeStackParamList } from '../../navigation/types'
import type { NotificationsStackParamList } from '../../navigation/types'

type Props =
  | NativeStackScreenProps<ActionsStackParamList, 'ActionDetail'>
  | NativeStackScreenProps<HomeStackParamList, 'ActionDetail'>
  | NativeStackScreenProps<NotificationsStackParamList, 'ActionDetail'>

export default function ActionDetailScreen({ route }: Props) {
  const { id } = route.params
  const queryClient = useQueryClient()
  const { showConfirm, showAlert } = useModal()

  const detailQuery = useQuery({
    queryKey: ['akcija', id],
    queryFn: () => fetchAkcijaById(client, id),
  })

  const prijaveQuery = useQuery({
    queryKey: ['moje-prijave'],
    queryFn: () => fetchMojePrijave(client),
  })

  const mojaPrijavaQuery = useQuery({
    queryKey: ['moja-prijava', id],
    queryFn: () => fetchMojaPrijavaZaAkciju(client, id),
  })

  const signedUp = (prijaveQuery.data?.prijavljeneAkcije ?? []).includes(id)
  const canCancel = (prijaveQuery.data?.otkaziveAkcije ?? []).includes(id)

  const prijaviMutation = useMutation({
    mutationFn: () => prijaviNaAkciju(client, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['moje-prijave'] })
      await queryClient.invalidateQueries({ queryKey: ['moja-prijava', id] })
      await showAlert('Uspeh', 'Uspešno ste se prijavili na akciju.')
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Prijava nije uspela.')),
  })

  const otkaziMutation = useMutation({
    mutationFn: () => otkaziPrijavu(client, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['moje-prijave'] })
      await queryClient.invalidateQueries({ queryKey: ['moja-prijava', id] })
      await showAlert('Uspeh', 'Prijava je otkazana.')
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Otkazivanje nije uspelo.')),
  })

  if (detailQuery.isLoading) {
    return (
      <Screen>
        <Loader />
      </Screen>
    )
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <Screen>
        <ErrorView message="Akcija nije učitana." onRetry={() => detailQuery.refetch()} />
      </Screen>
    )
  }

  const akcija = detailQuery.data
  const status = mojaPrijavaQuery.data?.prijava?.status

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text variant="title">{akcija.naziv}</Text>
        {akcija.isCompleted ? <Badge label="Završena" /> : <Badge label="Aktivna" tone="brand" />}
      </View>

      {akcija.planina ? (
        <Text color={colors.textMuted}>
          {akcija.planina}
          {akcija.vrh ? ` · ${akcija.vrh}` : ''}
        </Text>
      ) : null}

      <Text color={colors.brand}>
        {new Date(akcija.datum).toLocaleDateString('sr-RS', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
      </Text>

      {akcija.opis ? (
        <Card style={styles.block}>
          <Text>{akcija.opis}</Text>
        </Card>
      ) : null}

      {akcija.vodic ? (
        <Card style={styles.block}>
          <Text variant="label">Vodič</Text>
          <Text>
            {akcija.vodic.fullName} (@{akcija.vodic.username})
          </Text>
        </Card>
      ) : null}

      {signedUp ? (
        <Card style={styles.block}>
          <Text variant="label">Vaša prijava</Text>
          <Text color={colors.textMuted}>Status: {status || 'prijavljen'}</Text>
        </Card>
      ) : null}

      <View style={styles.actions}>
        {!signedUp && !akcija.isCompleted ? (
          <Button
            title="Prijavi se"
            loading={prijaviMutation.isPending}
            onPress={() => prijaviMutation.mutate()}
            fullWidth
          />
        ) : null}
        {signedUp && canCancel ? (
          <Button
            title="Otkaži prijavu"
            variant="secondary"
            loading={otkaziMutation.isPending}
            onPress={async () => {
              const ok = await showConfirm('Otkaži prijavu', 'Da li ste sigurni?')
              if (ok) otkaziMutation.mutate()
            }}
            fullWidth
          />
        ) : null}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  block: { marginTop: spacing.md },
  actions: { marginTop: spacing.xl, gap: spacing.sm },
})
