import { SectionList, RefreshControl, StyleSheet, View } from 'react-native'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AkcijaListItem } from '@beleg/shared'
import { fetchAkcije, fetchMojePrijave } from '@beleg/shared/services'
import { client } from '../../api/client'
import { ActionCard } from '../../components/shared/ActionCard'
import { EmptyState, ErrorView, Loader, Screen, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { ActionsStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<ActionsStackParamList, 'ActionsList'>

type Section = { title: string; data: AkcijaListItem[] }

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

  const sections = useMemo((): Section[] => {
    const aktivne = akcijeQuery.data?.aktivne ?? []
    const zavrsene = akcijeQuery.data?.zavrsene ?? []
    const out: Section[] = []
    if (aktivne.length) out.push({ title: 'Aktivne akcije', data: aktivne })
    if (zavrsene.length) out.push({ title: 'Završene akcije', data: zavrsene })
    return out
  }, [akcijeQuery.data])

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
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={akcijeQuery.isRefetching || prijaveQuery.isRefetching}
            onRefresh={() => {
              void akcijeQuery.refetch()
              void prijaveQuery.refetch()
            }}
          />
        }
        ListEmptyComponent={<EmptyState title="Nema akcija" />}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text variant="heading">{section.title}</Text>
          </View>
        )}
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
  sectionHeader: {
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.sm,
  },
})
