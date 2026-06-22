import { useCallback, useEffect, useState } from 'react'
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getApiErrorMessage } from '@beleg/shared'
import type { NoClubUserRow, SuperadminAppStatClub, SuperadminKlub } from '@beleg/shared/services'
import {
  createSuperadminKlub,
  deleteSuperadminKlub,
  deleteUserById,
  fetchSuperadminAppStats,
  fetchSuperadminKlubovi,
  fetchSuperadminUsersWithoutClub,
  updateSuperadminKlub,
} from '@beleg/shared/services'
import { client } from '../../api/client'
import { useModal } from '../../context/ModalContext'
import { useSuperadminClub } from '../../hooks/useSuperadminClub'
import { AppTopBar } from '../../components/ui/AppTopBar'
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorView,
  Input,
  Loader,
  SegmentedToggle,
  Text,
} from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { ClubStackParamList } from '../../navigation/types'

type Tab = 'clubs' | 'info' | 'otherUsers'

type SubscriptionStatus = 'active' | 'warning' | 'expired'

interface ClubForm {
  naziv: string
  adresa: string
  telefon: string
  email: string
  korisnik_admin_limit: string
  korisnik_limit: string
  max_storage_gb: string
  subscribedAt: string
  subscriptionEndsAt: string
  onHold: boolean
}

const DEFAULT_FORM: ClubForm = {
  naziv: '',
  adresa: '',
  telefon: '',
  email: '',
  korisnik_admin_limit: '3',
  korisnik_limit: '100',
  max_storage_gb: '10',
  subscribedAt: '',
  subscriptionEndsAt: '',
  onHold: false,
}

function getSubscriptionStatus(endsAt: string | null | undefined): SubscriptionStatus {
  if (!endsAt) return 'expired'
  const end = new Date(endsAt)
  end.setHours(23, 59, 59, 999)
  const now = new Date()
  if (end < now) return 'expired'
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
  if (daysLeft <= 5) return 'warning'
  return 'active'
}

const STATUS_COLORS: Record<SubscriptionStatus, string> = {
  active: colors.brand,
  warning: '#d97706',
  expired: colors.danger,
}

interface Props {
  navigation?: NativeStackNavigationProp<ClubStackParamList, 'SuperadminKlubovi'>
}

export default function SuperadminKluboviScreen({ navigation: navigationProp }: Props = {}) {
  const stackNav = useNavigation<NativeStackNavigationProp<ClubStackParamList>>()
  const navigation = navigationProp ?? stackNav
  const { enterClub } = useSuperadminClub()
  const { showConfirm } = useModal()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<Tab>('clubs')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<ClubForm>(DEFAULT_FORM)
  const [formError, setFormError] = useState('')
  const [deleteKlubId, setDeleteKlubId] = useState<number | null>(null)
  const [deleteCountdown, setDeleteCountdown] = useState(0)
  const [noClubSearch, setNoClubSearch] = useState('')
  const [debouncedNoClubSearch, setDebouncedNoClubSearch] = useState('')
  const [noClubDeleteId, setNoClubDeleteId] = useState<number | null>(null)

  const kluboviQuery = useQuery({
    queryKey: ['superadmin-klubovi'],
    queryFn: () => fetchSuperadminKlubovi(client),
    enabled: activeTab === 'clubs' || modalOpen,
  })

  const statsQuery = useQuery({
    queryKey: ['superadmin-app-stats'],
    queryFn: () => fetchSuperadminAppStats(client),
    enabled: activeTab === 'info',
  })

  const noClubQuery = useQuery({
    queryKey: ['superadmin-no-club-users', debouncedNoClubSearch],
    queryFn: () => fetchSuperadminUsersWithoutClub(client, debouncedNoClubSearch.trim() || undefined),
    enabled: activeTab === 'otherUsers',
  })

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedNoClubSearch(noClubSearch), 300)
    return () => clearTimeout(timer)
  }, [noClubSearch])

  useEffect(() => {
    if (deleteKlubId == null || deleteCountdown <= 0) return
    const timer = setInterval(() => {
      setDeleteCountdown((c) => (c <= 1 ? 0 : c - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [deleteKlubId, deleteCountdown])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        naziv: form.naziv.trim(),
        adresa: form.adresa.trim() || undefined,
        telefon: form.telefon.trim() || undefined,
        email: form.email.trim() || undefined,
        korisnik_admin_limit: Number(form.korisnik_admin_limit) || 3,
        korisnik_limit: Number(form.korisnik_limit) || 100,
        max_storage_gb: Number(form.max_storage_gb) || 10,
        subscribedAt: form.subscribedAt.trim() || null,
        subscriptionEndsAt: form.subscriptionEndsAt.trim() || null,
        onHold: form.onHold,
      }
      if (editingId != null) {
        await updateSuperadminKlub(client, editingId, payload)
      } else {
        await createSuperadminKlub(client, payload)
      }
    },
    onSuccess: () => {
      setModalOpen(false)
      setFormError('')
      void queryClient.invalidateQueries({ queryKey: ['superadmin-klubovi'] })
    },
    onError: (err) => setFormError(getApiErrorMessage(err, 'Čuvanje nije uspelo.')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteSuperadminKlub(client, id),
    onSuccess: () => {
      setDeleteKlubId(null)
      setDeleteCountdown(0)
      void queryClient.invalidateQueries({ queryKey: ['superadmin-klubovi'] })
    },
  })

  const openAddModal = () => {
    setEditingId(null)
    setForm(DEFAULT_FORM)
    setFormError('')
    setModalOpen(true)
  }

  const openEditModal = (k: SuperadminKlub) => {
    setEditingId(k.id)
    setForm({
      naziv: k.naziv ?? '',
      adresa: k.adresa ?? '',
      telefon: k.telefon ?? '',
      email: k.email ?? '',
      korisnik_admin_limit: String(k.korisnik_admin_limit ?? 3),
      korisnik_limit: String(k.korisnik_limit ?? 100),
      max_storage_gb: String(k.max_storage_gb ?? 10),
      subscribedAt: k.subscribedAt ? String(k.subscribedAt).slice(0, 10) : '',
      subscriptionEndsAt: k.subscriptionEndsAt ? String(k.subscriptionEndsAt).slice(0, 10) : '',
      onHold: k.onHold ?? false,
    })
    setFormError('')
    setModalOpen(true)
  }

  const startDelete = (id: number) => {
    setDeleteKlubId(id)
    setDeleteCountdown(5)
  }

  const handleEnterClub = useCallback(
    async (k: SuperadminKlub) => {
      await enterClub(k.id, k.naziv ?? '')
    },
    [enterClub],
  )

  const handleDeleteNoClubUser = async (u: NoClubUserRow) => {
    const displayName = (u.fullName || u.username || '').trim() || `#${u.id}`
    const ok = await showConfirm('Obriši korisnika', `Obrisati korisnika „${displayName}"?`, {
      variant: 'danger',
      confirmLabel: 'Obriši',
    })
    if (!ok) return
    setNoClubDeleteId(u.id)
    try {
      await deleteUserById(client, u.id)
      void queryClient.invalidateQueries({ queryKey: ['superadmin-no-club-users'] })
    } catch (err) {
      // query error state handles display on refetch
      console.warn(getApiErrorMessage(err, 'Brisanje nije uspelo.'))
    } finally {
      setNoClubDeleteId(null)
    }
  }

  const renderClubCard = ({ item: k }: { item: SuperadminKlub }) => {
    const status = getSubscriptionStatus(k.subscriptionEndsAt)
    const isDeleting = deleteKlubId === k.id

    return (
      <Card style={[styles.clubCard, { borderLeftColor: STATUS_COLORS[status] }]}>
        <View style={styles.clubCardHeader}>
          <View style={styles.clubCardTitle}>
            <Text variant="heading">{k.naziv}</Text>
            {k.onHold ? (
              <Text variant="small" color={colors.danger}>
                Na čekanju
              </Text>
            ) : null}
          </View>
          <View style={styles.clubActions}>
            <Pressable onPress={() => openEditModal(k)} hitSlop={8} style={styles.iconBtn}>
              <Ionicons name="create-outline" size={20} color={colors.textMuted} />
            </Pressable>
            {!isDeleting ? (
              <Pressable onPress={() => startDelete(k.id)} hitSlop={8} style={styles.iconBtn}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {k.subscriptionEndsAt ? (
          <Text variant="small" color={colors.textMuted}>
            Pretplata do: {String(k.subscriptionEndsAt).slice(0, 10)}
          </Text>
        ) : null}

        {isDeleting ? (
          <View style={styles.deleteRow}>
            <Text variant="small" color={colors.danger}>
              {deleteCountdown > 0
                ? `Potvrdi brisanje za ${deleteCountdown}s`
                : 'Spremno za brisanje'}
            </Text>
            <View style={styles.deleteActions}>
              {deleteCountdown === 0 ? (
                <Button
                  title="Obriši"
                  variant="danger"
                  onPress={() => deleteMutation.mutate(k.id)}
                  loading={deleteMutation.isPending}
                />
              ) : null}
              <Button
                title="Otkaži"
                variant="ghost"
                onPress={() => {
                  setDeleteKlubId(null)
                  setDeleteCountdown(0)
                }}
              />
            </View>
          </View>
        ) : (
          <Button title="Ulazi u klub" onPress={() => void handleEnterClub(k)} fullWidth />
        )}
      </Card>
    )
  }

  const renderStatsClub = ({ item }: { item: SuperadminAppStatClub }) => (
    <Card style={styles.statsCard}>
      <Text variant="label">{item.naziv}</Text>
      <Text variant="small" color={colors.textMuted}>
        Članovi: {item.memberCount} · Akcije: {item.actionCount}
      </Text>
    </Card>
  )

  const renderNoClubUser = ({ item: u }: { item: NoClubUserRow }) => (
    <Pressable
      onPress={() => navigation?.navigate('UserProfile', { id: u.id, username: u.username })}
      style={styles.userRow}
    >
      <Avatar uri={u.avatar_url} name={u.fullName || u.username} size={40} />
      <View style={styles.userInfo}>
        <Text variant="label">{u.fullName || u.username}</Text>
        {u.email ? (
          <Text variant="small" color={colors.textMuted}>
            {u.email}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={() => void handleDeleteNoClubUser(u)}
        hitSlop={8}
        disabled={noClubDeleteId === u.id}
      >
        <Ionicons name="trash-outline" size={20} color={colors.danger} />
      </Pressable>
    </Pressable>
  )

  const clubsContent = () => {
    if (kluboviQuery.isLoading) return <Loader />
    if (kluboviQuery.isError) {
      return (
        <ErrorView
          message={getApiErrorMessage(kluboviQuery.error, 'Klubovi nisu učitani.')}
          onRetry={() => kluboviQuery.refetch()}
        />
      )
    }
    const list = kluboviQuery.data ?? []
    if (list.length === 0) return <EmptyState title="Nema klubova" message="Dodajte prvi klub." />
    return (
      <FlatList
        data={list}
        keyExtractor={(k) => String(k.id)}
        renderItem={renderClubCard}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={kluboviQuery.isFetching} onRefresh={() => kluboviQuery.refetch()} />
        }
      />
    )
  }

  const infoContent = () => {
    if (statsQuery.isLoading) return <Loader />
    if (statsQuery.isError) {
      return (
        <ErrorView
          message={getApiErrorMessage(statsQuery.error, 'Statistike nisu učitane.')}
          onRetry={() => statsQuery.refetch()}
        />
      )
    }
    const data = statsQuery.data
    const totalUsers = Number(data?.totalUsers ?? data?.totalMembers) || 0
    const totalMembers = Number(data?.totalClubMembers ?? data?.totalMembers) || 0
    const totalActions = Number(data?.totalActions) || 0
    return (
      <FlatList
        data={data?.clubs ?? []}
        keyExtractor={(c) => String(c.klubId)}
        renderItem={renderStatsClub}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.statsSummary}>
            <Card style={styles.statsSummaryCard}>
              <Text variant="small" color={colors.textMuted}>
                Ukupno korisnika
              </Text>
              <Text variant="title">{totalUsers}</Text>
            </Card>
            <Card style={styles.statsSummaryCard}>
              <Text variant="small" color={colors.textMuted}>
                Članovi klubova
              </Text>
              <Text variant="title">{totalMembers}</Text>
            </Card>
            <Card style={styles.statsSummaryCard}>
              <Text variant="small" color={colors.textMuted}>
                Ukupno akcija
              </Text>
              <Text variant="title">{totalActions}</Text>
            </Card>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={statsQuery.isFetching} onRefresh={() => statsQuery.refetch()} />
        }
      />
    )
  }

  const otherUsersContent = () => {
    if (noClubQuery.isLoading) return <Loader />
    if (noClubQuery.isError) {
      return (
        <ErrorView
          message={getApiErrorMessage(noClubQuery.error, 'Korisnici nisu učitani.')}
          onRetry={() => noClubQuery.refetch()}
        />
      )
    }
    const users = noClubQuery.data ?? []
    return (
      <FlatList
        data={users}
        keyExtractor={(u) => String(u.id)}
        renderItem={renderNoClubUser}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Input
            value={noClubSearch}
            onChangeText={setNoClubSearch}
            placeholder="Pretraži korisnike..."
            style={styles.searchInput}
          />
        }
        ListEmptyComponent={<EmptyState title="Nema korisnika" message="Nema korisnika bez kluba." />}
        refreshControl={
          <RefreshControl refreshing={noClubQuery.isFetching} onRefresh={() => noClubQuery.refetch()} />
        }
      />
    )
  }

  return (
    <View style={styles.root}>
      <AppTopBar
        title="Superadmin"
        rightIcon={activeTab === 'clubs' ? 'add' : undefined}
        onRightPress={activeTab === 'clubs' ? openAddModal : undefined}
      />

      <SegmentedToggle
        value={activeTab}
        options={[
          { value: 'clubs', label: 'Klubovi' },
          { value: 'info', label: 'Info' },
          { value: 'otherUsers', label: 'Ostali' },
        ]}
        onChange={setActiveTab}
      />

      <View style={styles.content}>
        {activeTab === 'clubs' ? clubsContent() : null}
        {activeTab === 'info' ? infoContent() : null}
        {activeTab === 'otherUsers' ? otherUsersContent() : null}
      </View>

      <Modal visible={modalOpen} animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Text variant="heading">{editingId != null ? 'Izmeni klub' : 'Novi klub'}</Text>
            <Pressable onPress={() => setModalOpen(false)} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            {formError ? (
              <Text variant="small" color={colors.danger} style={styles.formError}>
                {formError}
              </Text>
            ) : null}
            <Input
              label="Naziv *"
              value={form.naziv}
              onChangeText={(v) => setForm((f) => ({ ...f, naziv: v }))}
            />
            <Input
              label="Adresa"
              value={form.adresa}
              onChangeText={(v) => setForm((f) => ({ ...f, adresa: v }))}
            />
            <Input
              label="Telefon"
              value={form.telefon}
              onChangeText={(v) => setForm((f) => ({ ...f, telefon: v }))}
            />
            <Input
              label="Email"
              value={form.email}
              onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Input
              label="Limit admina"
              value={form.korisnik_admin_limit}
              onChangeText={(v) => setForm((f) => ({ ...f, korisnik_admin_limit: v }))}
              keyboardType="number-pad"
            />
            <Input
              label="Limit članova"
              value={form.korisnik_limit}
              onChangeText={(v) => setForm((f) => ({ ...f, korisnik_limit: v }))}
              keyboardType="number-pad"
            />
            <Input
              label="Max storage (GB)"
              value={form.max_storage_gb}
              onChangeText={(v) => setForm((f) => ({ ...f, max_storage_gb: v }))}
              keyboardType="number-pad"
            />
            <Input
              label="Pretplata od (YYYY-MM-DD)"
              value={form.subscribedAt}
              onChangeText={(v) => setForm((f) => ({ ...f, subscribedAt: v }))}
              placeholder="2025-01-01"
            />
            <Input
              label="Pretplata do (YYYY-MM-DD)"
              value={form.subscriptionEndsAt}
              onChangeText={(v) => setForm((f) => ({ ...f, subscriptionEndsAt: v }))}
              placeholder="2026-01-01"
            />
            <View style={styles.switchRow}>
              <Text variant="label">Na čekanju (on hold)</Text>
              <Switch value={form.onHold} onValueChange={(v) => setForm((f) => ({ ...f, onHold: v }))} />
            </View>
            <Button
              title="Sačuvaj"
              onPress={() => {
                if (!form.naziv.trim()) {
                  setFormError('Naziv je obavezan.')
                  return
                }
                saveMutation.mutate()
              }}
              loading={saveMutation.isPending}
              fullWidth
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.navBg },
  content: { flex: 1 },
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  clubCard: { borderLeftWidth: 4, gap: spacing.sm },
  clubCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  clubCardTitle: { flex: 1, gap: 2 },
  clubActions: { flexDirection: 'row', gap: spacing.xs },
  iconBtn: { padding: spacing.xs },
  deleteRow: { gap: spacing.sm, marginTop: spacing.xs },
  deleteActions: { flexDirection: 'row', gap: spacing.sm },
  statsSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  statsSummaryCard: { flex: 1, minWidth: '45%', gap: spacing.xs },
  statsCard: { gap: spacing.xs },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  userInfo: { flex: 1, gap: 2 },
  searchInput: { marginBottom: spacing.md },
  modalRoot: { flex: 1, backgroundColor: colors.surface, paddingTop: spacing.xl },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalBody: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  formError: { marginBottom: spacing.sm },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
})
