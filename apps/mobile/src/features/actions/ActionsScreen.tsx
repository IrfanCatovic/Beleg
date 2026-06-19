import { useMemo, useState } from 'react'
import { SectionList, RefreshControl, StyleSheet, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AkcijaListItem } from '@beleg/shared'
import { fetchAkcije, fetchMojePrijave } from '@beleg/shared/services'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import { ActionCard } from '../../components/shared/ActionCard'
import { ActionsFilterModal } from '../../components/actions/ActionsFilterModal'
import { AppTopBar } from '../../components/ui/AppTopBar'
import { Badge, EmptyState, ErrorView, Loader, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import {
  EMPTY_ACTIONS_FILTERS,
  countActiveFilters,
  isClubListedAkcija,
  matchesActionFilters,
  mergeAkcijeById,
  type ActionsFilters,
} from '../../utils/actionFilters'
import { canManageActions } from '../../utils/roles'
import type { ActionsStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<ActionsStackParamList, 'ActionsList'>

type Section = { title: string; data: AkcijaListItem[] }

export default function ActionsScreen({ navigation }: Props) {
  const { user } = useAuth()
  const { showAlert } = useModal()
  const [filters, setFilters] = useState<ActionsFilters>(EMPTY_ACTIONS_FILTERS)
  const [filterOpen, setFilterOpen] = useState(false)

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

  const activeFilterCount = countActiveFilters(filters)
  const canAdd = canManageActions(user?.role)

  const { aktivne, zavrsene } = useMemo(() => {
    const data = akcijeQuery.data
    if (!data) return { aktivne: [] as AkcijaListItem[], zavrsene: [] as AkcijaListItem[] }

    const clubAktivne = (data.aktivne ?? []).filter(isClubListedAkcija)
    const clubZavrsene = (data.zavrsene ?? []).filter(isClubListedAkcija)
    const vodeneAktivne = data.vodeneAktivne ?? []
    const vodeneZavrsene = data.vodeneZavrsene ?? []
    const mojePrivatneAktivne = data.mojePrivatneAktivne ?? []
    const mojePrivatneZavrsene = data.mojePrivatneZavrsene ?? []

    let combinedAktivne: AkcijaListItem[]
    let combinedZavrsene: AkcijaListItem[]

    if (filters.source === 'guide') {
      combinedAktivne = mergeAkcijeById(vodeneAktivne, mojePrivatneAktivne)
      combinedZavrsene = mergeAkcijeById(vodeneZavrsene, mojePrivatneZavrsene)
    } else if (filters.source === 'all') {
      combinedAktivne = mergeAkcijeById(clubAktivne, vodeneAktivne, mojePrivatneAktivne)
      combinedZavrsene = mergeAkcijeById(clubZavrsene, vodeneZavrsene, mojePrivatneZavrsene)
    } else {
      combinedAktivne = clubAktivne
      combinedZavrsene = clubZavrsene
    }

    return {
      aktivne: combinedAktivne.filter((a) => matchesActionFilters(a, filters)),
      zavrsene: combinedZavrsene.filter((a) => matchesActionFilters(a, filters)),
    }
  }, [akcijeQuery.data, filters])

  const sections = useMemo((): Section[] => {
    const out: Section[] = []
    if (aktivne.length) out.push({ title: 'Aktivne akcije', data: aktivne })
    if (zavrsene.length) out.push({ title: 'Završene akcije', data: zavrsene })
    return out
  }, [aktivne, zavrsene])

  if (akcijeQuery.isLoading) {
    return (
      <View style={styles.root}>
        <AppTopBar leftIcon="options-outline" onLeftPress={() => setFilterOpen(true)} />
        <Loader />
      </View>
    )
  }

  if (akcijeQuery.isError) {
    return (
      <View style={styles.root}>
        <AppTopBar leftIcon="options-outline" onLeftPress={() => setFilterOpen(true)} />
        <ErrorView message="Akcije nisu učitane." onRetry={() => akcijeQuery.refetch()} />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <AppTopBar
        leftIcon="options-outline"
        onLeftPress={() => setFilterOpen(true)}
        rightIcon={canAdd ? 'add' : undefined}
        onRightPress={
          canAdd
            ? () =>
                void showAlert(
                  'Dodaj akciju',
                  'Kreiranje akcija je trenutno dostupno u web aplikaciji. Mobilni wizard dolazi uskoro.',
                )
            : undefined
        }
        center={
          activeFilterCount > 0 ? (
            <Badge label={`${activeFilterCount} filtera`} tone="brand" />
          ) : null
        }
      />

      <ActionsFilterModal
        visible={filterOpen}
        filters={filters}
        onChange={setFilters}
        onClose={() => setFilterOpen(false)}
      />

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
        ListEmptyComponent={<EmptyState title="Nema akcija" message="Pokušaj drugačije filtere." />}
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
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg },
  sectionHeader: {
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.sm,
  },
})
