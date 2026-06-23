import { useCallback, useMemo, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AkcijaListItem } from '@beleg/shared'
import { getApiErrorMessage } from '@beleg/shared'
import { fetchAkcije, fetchMojePrijave, cancelSignupRequest, otkaziPrijavu } from '@beleg/shared/services'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useSuperadminClub } from '../../hooks/useSuperadminClub'
import { useModal } from '../../context/ModalContext'
import { ActionJoinSheet } from '../../components/actions/ActionJoinSheet'
import { ActionCard } from '../../components/shared/ActionCard'
import { ActionsFilterModal } from '../../components/actions/ActionsFilterModal'
import { AddActionChoiceModal } from '../../components/actions/AddActionChoiceModal'
import { GuideRequiredModal } from '../../components/actions/GuideRequiredModal'
import { AppTopBar } from '../../components/ui/AppTopBar'
import { Badge, Button, EmptyState, ErrorView, Loader, SegmentedToggle, Text } from '../../components/ui'
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

type ViewMode = 'active' | 'completed'

export default function ActionsScreen({ navigation }: Props) {
  const { user } = useAuth()
  const { hasSelectedClub, loading: superadminClubLoading } = useSuperadminClub()
  const isSuperadminNoClub = user?.role === 'superadmin' && !hasSelectedClub
  const { showAlert, showConfirm } = useModal()
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<ViewMode>('active')
  const [filters, setFilters] = useState<ActionsFilters>(EMPTY_ACTIONS_FILTERS)
  const [filterOpen, setFilterOpen] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [guideRequiredOpen, setGuideRequiredOpen] = useState(false)
  const [joinAction, setJoinAction] = useState<AkcijaListItem | null>(null)

  const akcijeQuery = useQuery({
    queryKey: ['akcije'],
    queryFn: () => fetchAkcije(client),
    enabled: !isSuperadminNoClub,
  })

  const prijaveQuery = useQuery({
    queryKey: ['moje-prijave'],
    queryFn: () => fetchMojePrijave(client),
  })

  useFocusEffect(
    useCallback(() => {
      void akcijeQuery.refetch()
      void prijaveQuery.refetch()
    }, []),
  )

  const signedUp = useMemo(
    () => new Set(prijaveQuery.data?.prijavljeneAkcije ?? []),
    [prijaveQuery.data],
  )
  const pendingSignup = useMemo(
    () => new Set(prijaveQuery.data?.pendingSignupAkcije ?? []),
    [prijaveQuery.data],
  )
  const cancellable = useMemo(
    () => new Set(prijaveQuery.data?.otkaziveAkcije ?? []),
    [prijaveQuery.data],
  )

  const activeFilterCount = countActiveFilters(filters)

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


  const listData = viewMode === 'active' ? aktivne : zavrsene
  const listTotal = viewMode === 'active' ? combinedAktivne.length : combinedZavrsene.length

  const availableMonths = useMemo(() => {
    const months = new Set<number>()
    for (const a of [...combinedAktivne, ...combinedZavrsene]) {
      if (!a.datum) continue
      const d = new Date(a.datum)
      if (!Number.isNaN(d.getTime())) months.add(d.getMonth() + 1)
    }
    return Array.from(months).sort((a, b) => a - b)
  }, [combinedAktivne, combinedZavrsene])

  const cancelMutation = useMutation({
    mutationFn: async (action: AkcijaListItem) => {
      if (pendingSignup.has(action.id)) {
        await cancelSignupRequest(client, action.id)
        return
      }
      await otkaziPrijavu(client, action.id)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['moje-prijave'] })
      void queryClient.invalidateQueries({ queryKey: ['akcije'] })
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Otkazivanje nije uspelo.')),
  })

  const handleJoin = (action: AkcijaListItem) => {
    setJoinAction(action)
  }

  const handleCancel = async (action: AkcijaListItem) => {
    const isPending = pendingSignup.has(action.id)
    const ok = await showConfirm(
      isPending ? 'Otkaži zahtev' : 'Otkaži prijavu',
      isPending
        ? `Otkazati zahtev za prijavu na „${action.naziv}"?`
        : `Otkazati prijavu na „${action.naziv}"?`,
      { variant: 'danger', confirmLabel: 'Otkaži' },
    )
    if (ok) cancelMutation.mutate(action)
  }

  const handlePlusPress = useCallback(() => {
    if (canManageActions(user?.role)) {
      setAddModalOpen(true)
    } else {
      setGuideRequiredOpen(true)
    }
  }, [user?.role])

  const handleBecomeGuide = useCallback(() => {
    setGuideRequiredOpen(false)
    navigation.getParent()?.navigate('ProfileTab', { screen: 'BecomeGuide' })
  }, [navigation])

  const goToClubPicker = useCallback(() => {
    navigation.getParent()?.navigate('ClubTab', { screen: 'ClubHome' })
  }, [navigation])

  const topBar = (
    <AppTopBar
      leftIcon="options-outline"
      onLeftPress={() => setFilterOpen(true)}
      rightIcon="add"
      onRightPress={handlePlusPress}
      center={
        activeFilterCount > 0 ? (
          <Badge label={`${activeFilterCount} filtera`} tone="brand" />
        ) : null
      }
    />
  )

  if (isSuperadminNoClub) {
    return (
      <View style={styles.root}>
        {topBar}
        <View style={styles.pickClub}>
          <Text variant="heading" style={styles.pickClubTitle}>
            Izaberite klub
          </Text>
          <Text color={colors.textMuted} style={styles.pickClubMessage}>
            Da biste videli akcije kluba, prvo uđite u klub na tabu Moj klub.
          </Text>
          <Button title="Idi na Moj klub" onPress={goToClubPicker} fullWidth />
        </View>
      </View>
    )
  }

  if (akcijeQuery.isLoading || superadminClubLoading) {
    return (
      <View style={styles.root}>
        {topBar}
        <Loader />
      </View>
    )
  }

  if (akcijeQuery.isError) {
    const message = getApiErrorMessage(akcijeQuery.error, 'Akcije nisu učitane.')
    return (
      <View style={styles.root}>
        {topBar}
        <ErrorView message={message} onRetry={() => akcijeQuery.refetch()} />
        {user?.role === 'superadmin' ? (
          <View style={styles.pickClub}>
            <Button title="Izaberi klub" variant="secondary" onPress={goToClubPicker} fullWidth />
          </View>
        ) : null}
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

      <GuideRequiredModal
        visible={guideRequiredOpen}
        onClose={() => setGuideRequiredOpen(false)}
        onBecomeGuide={handleBecomeGuide}
      />

      <ActionJoinSheet
        action={joinAction}
        visible={joinAction != null}
        onClose={() => setJoinAction(null)}
        onSuccess={() => void showAlert('Uspeh', 'Zahtev za prijavu je poslat na odobrenje.')}
        onError={(msg) => void showAlert('Greška', msg)}
      />

      <ActionsFilterModal
        visible={filterOpen}
        filters={filters}
        onChange={setFilters}
        onClose={() => setFilterOpen(false)}
        availableMonths={availableMonths}
      />

      <SegmentedToggle
        value={viewMode}
        options={[
          { value: 'active', label: 'Aktivne' },
          { value: 'completed', label: 'Završene' },
        ]}
        onChange={setViewMode}
      />

      <FlatList
        data={listData}
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
          activeFilterCount > 0 || filters.source !== 'all' ? (
            <View style={styles.countRow}>
              <Text variant="small" color={colors.textMuted}>
                {listData.length}/{listTotal} prikazano
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={<EmptyState title="Nema akcija" message="Pokušaj drugačije filtere." />}
        renderItem={({ item }) => (
          <ActionCard
            variant="feed"
            action={item}
            signedUp={signedUp.has(item.id)}
            pendingSignup={pendingSignup.has(item.id)}
            cancellable={cancellable.has(item.id) || pendingSignup.has(item.id)}
            joinLoading={joinAction?.id === item.id}
            onPress={() => navigation.navigate('ActionDetail', { id: item.id })}
            onJoin={
              !item.isCompleted && !signedUp.has(item.id) && !pendingSignup.has(item.id)
                ? () => void handleJoin(item)
                : undefined
            }
            onCancel={
              cancellable.has(item.id) || pendingSignup.has(item.id)
                ? () => void handleCancel(item)
                : undefined
            }
          />
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  list: { paddingBottom: spacing.xxl, paddingHorizontal: spacing.lg },
  countRow: { paddingVertical: spacing.xs, marginBottom: spacing.xs },
  pickClub: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  pickClubTitle: { textAlign: 'center' },
  pickClubMessage: { textAlign: 'center' },
})
