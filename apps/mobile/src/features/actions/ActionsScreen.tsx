import { useMemo, useState } from 'react'
import { Pressable, SectionList, RefreshControl, StyleSheet, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AkcijaListItem } from '@beleg/shared'
import { getApiErrorMessage } from '@beleg/shared'
import { fetchAkcije, fetchMojePrijave, otkaziPrijavu, prijaviNaAkciju } from '@beleg/shared/services'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import { ActionCard } from '../../components/shared/ActionCard'
import { ActionsFilterModal } from '../../components/actions/ActionsFilterModal'
import { AddActionChoiceModal } from '../../components/actions/AddActionChoiceModal'
import { AppTopBar } from '../../components/ui/AppTopBar'
import { Badge, EmptyState, ErrorView, Loader, Text } from '../../components/ui'
import { colors, radius, spacing } from '../../theme'
import {
  EMPTY_ACTIONS_FILTERS,
  countActiveFilters,
  isClubListedAkcija,
  matchesActionFilters,
  mergeAkcijeById,
  type ActionSourceFilter,
  type ActionsFilters,
} from '../../utils/actionFilters'
import { canManageActions } from '../../utils/roles'
import type { ActionsStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<ActionsStackParamList, 'ActionsList'>

type Section = { title: string; data: AkcijaListItem[]; total: number }

const SOURCE_OPTIONS: { value: ActionSourceFilter; label: string }[] = [
  { value: 'all', label: 'Sve' },
  { value: 'club', label: 'Klupske' },
  { value: 'guide', label: 'Vodičke' },
]

export default function ActionsScreen({ navigation }: Props) {
  const { user } = useAuth()
  const { showAlert, showConfirm } = useModal()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<ActionsFilters>(EMPTY_ACTIONS_FILTERS)
  const [filterOpen, setFilterOpen] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [joiningId, setJoiningId] = useState<number | null>(null)

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
  const cancellable = useMemo(
    () => new Set(prijaveQuery.data?.otkaziveAkcije ?? []),
    [prijaveQuery.data],
  )

  const activeFilterCount = countActiveFilters(filters)
  const canAdd = canManageActions(user?.role)

  const { combinedAktivne, combinedZavrsene } = useMemo(() => {
    const data = akcijeQuery.data
    if (!data) return { combinedAktivne: [] as AkcijaListItem[], combinedZavrsene: [] as AkcijaListItem[] }

    const clubAktivne = (data.aktivne ?? []).filter(isClubListedAkcija)
    const clubZavrsene = (data.zavrsene ?? []).filter(isClubListedAkcija)
    const vodeneAktivne = data.vodeneAktivne ?? []
    const vodeneZavrsene = data.vodeneZavrsene ?? []
    const mojePrivatneAktivne = data.mojePrivatneAktivne ?? []
    const mojePrivatneZavrsene = data.mojePrivatneZavrsene ?? []

    if (filters.source === 'guide') {
      return {
        combinedAktivne: mergeAkcijeById(vodeneAktivne, mojePrivatneAktivne),
        combinedZavrsene: mergeAkcijeById(vodeneZavrsene, mojePrivatneZavrsene),
      }
    }
    if (filters.source === 'club') {
      return {
        combinedAktivne: mergeAkcijeById(clubAktivne, mojePrivatneAktivne),
        combinedZavrsene: mergeAkcijeById(clubZavrsene, mojePrivatneZavrsene),
      }
    }
    return {
      combinedAktivne: mergeAkcijeById(clubAktivne, vodeneAktivne, mojePrivatneAktivne),
      combinedZavrsene: mergeAkcijeById(clubZavrsene, vodeneZavrsene, mojePrivatneZavrsene),
    }
  }, [akcijeQuery.data, filters.source])

  const { aktivne, zavrsene } = useMemo(() => {
    const attrFilters = { ...filters, source: 'all' as const }
    return {
      aktivne: combinedAktivne.filter((a) => matchesActionFilters(a, attrFilters)),
      zavrsene: combinedZavrsene.filter((a) => matchesActionFilters(a, attrFilters)),
    }
  }, [combinedAktivne, combinedZavrsene, filters])

  const sections = useMemo((): Section[] => {
    const out: Section[] = []
    if (aktivne.length || combinedAktivne.length) {
      out.push({ title: 'Aktivne akcije', data: aktivne, total: combinedAktivne.length })
    }
    if (zavrsene.length || combinedZavrsene.length) {
      out.push({ title: 'Završene akcije', data: zavrsene, total: combinedZavrsene.length })
    }
    return out
  }, [aktivne, zavrsene, combinedAktivne.length, combinedZavrsene.length])

  const availableMonths = useMemo(() => {
    const months = new Set<number>()
    for (const a of [...combinedAktivne, ...combinedZavrsene]) {
      if (!a.datum) continue
      const d = new Date(a.datum)
      if (!Number.isNaN(d.getTime())) months.add(d.getMonth() + 1)
    }
    return Array.from(months).sort((a, b) => a - b)
  }, [combinedAktivne, combinedZavrsene])

  const joinMutation = useMutation({
    mutationFn: (id: number) => prijaviNaAkciju(client, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['moje-prijave'] })
      void queryClient.invalidateQueries({ queryKey: ['akcije'] })
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Prijava nije uspela.')),
    onSettled: () => setJoiningId(null),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: number) => otkaziPrijavu(client, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['moje-prijave'] })
      void queryClient.invalidateQueries({ queryKey: ['akcije'] })
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Otkazivanje nije uspelo.')),
  })

  const handleJoin = async (action: AkcijaListItem) => {
    setJoiningId(action.id)
    joinMutation.mutate(action.id)
  }

  const handleCancel = async (action: AkcijaListItem) => {
    const ok = await showConfirm('Otkaži prijavu', `Otkazati prijavu na „${action.naziv}"?`, {
      variant: 'danger',
      confirmLabel: 'Otkaži',
    })
    if (ok) cancelMutation.mutate(action.id)
  }

  const topBar = (
    <AppTopBar
      leftIcon="options-outline"
      onLeftPress={() => setFilterOpen(true)}
      rightIcon={canAdd ? 'add' : undefined}
      onRightPress={canAdd ? () => setAddModalOpen(true) : undefined}
      center={
        activeFilterCount > 0 ? (
          <Badge label={`${activeFilterCount} filtera`} tone="brand" />
        ) : null
      }
    />
  )

  if (akcijeQuery.isLoading) {
    return (
      <View style={styles.root}>
        {topBar}
        <Loader />
      </View>
    )
  }

  if (akcijeQuery.isError) {
    return (
      <View style={styles.root}>
        {topBar}
        <ErrorView message="Akcije nisu učitane." onRetry={() => akcijeQuery.refetch()} />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      {topBar}

      <AddActionChoiceModal
        visible={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onPickNova={(tip) => navigation.navigate('ActionWizard', { tip })}
        onPickProsla={(tip) => navigation.navigate('AddPastAction', { tip })}
      />

      <ActionsFilterModal
        visible={filterOpen}
        filters={filters}
        onChange={setFilters}
        onClose={() => setFilterOpen(false)}
        hideSource
        availableMonths={availableMonths}
      />

      <View style={styles.sourceRow}>
        {SOURCE_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => setFilters((f) => ({ ...f, source: opt.value }))}
            style={[styles.sourcePill, filters.source === opt.value && styles.sourcePillActive]}
          >
            <Text
              variant="small"
              color={filters.source === opt.value ? colors.white : colors.textMuted}
              style={styles.sourcePillText}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

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
            {activeFilterCount > 0 || filters.source !== 'all' ? (
              <Text variant="small" color={colors.textMuted}>
                {section.data.length}/{section.total}
              </Text>
            ) : null}
          </View>
        )}
        renderItem={({ item }) => (
          <ActionCard
            action={item}
            signedUp={signedUp.has(item.id)}
            cancellable={cancellable.has(item.id)}
            joinLoading={joiningId === item.id}
            onPress={() => navigation.navigate('ActionDetail', { id: item.id })}
            onJoin={!item.isCompleted && !signedUp.has(item.id) ? () => void handleJoin(item) : undefined}
            onCancel={cancellable.has(item.id) ? () => void handleCancel(item) : undefined}
          />
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  sourceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sourcePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sourcePillActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  sourcePillText: { fontWeight: '600' },
  list: { padding: spacing.lg, paddingTop: 0 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.sm,
  },
})
