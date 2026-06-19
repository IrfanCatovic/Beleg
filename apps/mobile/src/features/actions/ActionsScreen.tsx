import { useMemo } from 'react'
import { FlatList, RefreshControl, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { fetchAkcije, fetchMojePrijave } from '@beleg/shared/services'
import { client } from '../../api/client'
import { ActionCard } from '../../components/shared/ActionCard'
import { EmptyState, ErrorView, Loader, Screen, Text } from '../../components/ui'
import { spacing } from '../../theme'
import type { ActionsStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<ActionsStackParamList, 'ActionsList'>

export default function ActionsScreen({ navigation }: Props) {
  const akcijeQuery = useQuery({
    queryKey: ['akcije'],
    queryFn: () => fetchAkcije(client),
  })

  const prijaveQuery = useQuery({
    queryKey: ['moje-prijave'],
    queryFn: () => fetchMojePrijave(client),
  })

  const signedUp = useMemo(
    () => new Set(prijaveQuery.data?.prijavljeneAkcije ?? []),
    [prijaveQuery.data],
  )

  const aktivne = akcijeQuery.data?.aktivne ?? []
  const zavrsene = akcijeQuery.data?.zavrsene ?? []
  const items = [...aktivne, ...zavrsene]

  if (akcijeQuery.isLoading) {
    return (
      <Screen>
        <Loader />
      </Screen>
    )
  }

  if (akcijeQuery.isError) {
    return (
      <Screen>
        <ErrorView message="Akcije nisu učitane." onRetry={() => akcijeQuery.refetch()} />
      </Screen>
    )
  }

  return (
    <Screen padded={false}>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={akcijeQuery.isRefetching || prijaveQuery.isRefetching}
            onRefresh={() => {
              void akcijeQuery.refetch()
              void prijaveQuery.refetch()
            }}
          />
        }
        ListHeaderComponent={
          aktivne.length > 0 ? (
            <Text variant="heading" style={styles.section}>
              Aktivne akcije
            </Text>
          ) : null
        }
        ListEmptyComponent={<EmptyState title="Nema akcija" />}
        renderItem={({ item }) => (
          <ActionCard
            action={item}
            signedUp={signedUp.has(item.id)}
            onPress={() => navigation.navigate('ActionDetail', { id: item.id })}
          />
        )}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg },
  section: { marginBottom: spacing.md },
})
