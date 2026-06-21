import { useEffect, useMemo, useState } from 'react'
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack'
import { computePERForAkcija, getApiErrorMessage } from '@beleg/shared'
import {
  acceptFollowRequest,
  blockUser,
  cancelFollowRequest,
  fetchBlockStatus,
  fetchFollowCounts,
  fetchFollowStatus,
  fetchKorisnikByIdOrUsername,
  fetchKorisnikPopeoSe,
  fetchKorisnikStatistika,
  fetchKorisnikVodio,
  fetchUserFollowersList,
  fetchUserFollowingList,
  sendFollowRequest,
  unfollowUser,
  unblockUser,
} from '@beleg/shared/services'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import { Avatar, Badge, Button, ErrorView, Loader, Screen, Text } from '../../components/ui'
import { canManageClub, canSeeFinance } from '../../utils/roles'
import { colors, spacing } from '../../theme'
import type {
  ActionsStackParamList,
  ExploreStackParamList,
  HomeStackParamList,
  ProfileStackParamList,
} from '../../navigation/types'
import { FollowListModal } from './FollowListModal'
import { ProfileActionGrid } from './ProfileActionGrid'

type Props =
  | NativeStackScreenProps<ProfileStackParamList, 'UserProfile'>
  | NativeStackScreenProps<HomeStackParamList, 'UserProfile'>
  | NativeStackScreenProps<ActionsStackParamList, 'UserProfile'>
  | NativeStackScreenProps<ExploreStackParamList, 'UserProfile'>

type ActionsTab = 'climbed' | 'guided'

export default function UserProfileScreen({ route, navigation }: Props) {
  const { user: me, logout } = useAuth()
  const { showConfirm, showAlert } = useModal()
  const queryClient = useQueryClient()
  const idOrUsername = route.params.username || String(route.params.id ?? '')

  const [actionsTab, setActionsTab] = useState<ActionsTab>('climbed')
  const [menuOpen, setMenuOpen] = useState(false)
  const [followModal, setFollowModal] = useState<'following' | 'followers' | null>(null)
  const [followModalUsers, setFollowModalUsers] = useState<Awaited<ReturnType<typeof fetchUserFollowingList>>>([])
  const [followModalLoading, setFollowModalLoading] = useState(false)

  const profileQuery = useQuery({
    queryKey: ['korisnik', idOrUsername],
    queryFn: () => fetchKorisnikByIdOrUsername(client, idOrUsername),
    enabled: !!idOrUsername,
  })

  const targetId = profileQuery.data?.id

  const statsQuery = useQuery({
    queryKey: ['korisnik', idOrUsername, 'statistika'],
    queryFn: () => fetchKorisnikStatistika(client, idOrUsername),
    enabled: !!idOrUsername,
  })

  const popeoQuery = useQuery({
    queryKey: ['korisnik', idOrUsername, 'popeo-se'],
    queryFn: () => fetchKorisnikPopeoSe(client, idOrUsername),
    enabled: !!idOrUsername,
  })

  const vodioQuery = useQuery({
    queryKey: ['korisnik', idOrUsername, 'vodio'],
    queryFn: () => fetchKorisnikVodio(client, idOrUsername),
    enabled: !!idOrUsername && !!profileQuery.data?.isProfiGuide,
  })

  const followQuery = useQuery({
    queryKey: ['follows', targetId, 'counts'],
    queryFn: () => fetchFollowCounts(client, targetId!),
    enabled: !!targetId,
  })

  const followStatusQuery = useQuery({
    queryKey: ['follows', targetId, 'status'],
    queryFn: () => fetchFollowStatus(client, targetId!),
    enabled: !!targetId && me?.username !== profileQuery.data?.username,
  })

  const blockStatusQuery = useQuery({
    queryKey: ['blocks', targetId, 'status'],
    queryFn: () => fetchBlockStatus(client, targetId!),
    enabled: !!targetId && me?.username !== profileQuery.data?.username,
  })

  const invalidateSocial = () => {
    void queryClient.invalidateQueries({ queryKey: ['follows', targetId] })
    void queryClient.invalidateQueries({ queryKey: ['blocks', targetId] })
  }

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!targetId) return
      const status = followStatusQuery.data
      if (status?.outgoing === 'accepted') {
        await unfollowUser(client, targetId)
      } else if (status?.outgoing === 'pending') {
        await cancelFollowRequest(client, targetId)
      } else if (status?.incoming === 'pending' && status.incomingFollowId) {
        await acceptFollowRequest(client, status.incomingFollowId)
      } else {
        await sendFollowRequest(client, targetId)
      }
    },
    onSuccess: invalidateSocial,
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Akcija nije uspela.')),
  })

  const blockMutation = useMutation({
    mutationFn: async () => {
      if (!targetId) return
      if (blockStatusQuery.data?.blockedByMe) {
        await unblockUser(client, targetId)
      } else {
        await blockUser(client, targetId)
      }
    },
    onSuccess: invalidateSocial,
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Blokiranje nije uspelo.')),
  })

  const routeNames = (navigation.getState()?.routeNames ?? []) as string[]
  const inProfileStack = routeNames.includes('ProfileSettings')
  const profileNavigation = navigation as NativeStackNavigationProp<ProfileStackParamList, 'UserProfile'>

  useEffect(() => {
    if (!profileQuery.data?.isProfiGuide) setActionsTab('climbed')
  }, [profileQuery.data?.isProfiGuide, idOrUsername])

  const totalPer = useMemo(() => {
    return (popeoQuery.data ?? []).reduce((sum, a) => sum + computePERForAkcija(a), 0)
  }, [popeoQuery.data])

  const displayedActions = actionsTab === 'guided' ? (vodioQuery.data ?? []) : (popeoQuery.data ?? [])

  const openFollowModal = async (mode: 'following' | 'followers') => {
    if (!targetId) return
    setFollowModal(mode)
    setFollowModalLoading(true)
    setFollowModalUsers([])
    try {
      const users =
        mode === 'following'
          ? await fetchUserFollowingList(client, targetId)
          : await fetchUserFollowersList(client, targetId)
      setFollowModalUsers(users)
    } catch {
      setFollowModalUsers([])
    } finally {
      setFollowModalLoading(false)
    }
  }

  const goAction = (actionId: number) => {
    if (routeNames.includes('ActionDetail')) {
      profileNavigation.navigate('ActionDetail', { id: actionId })
      return
    }
    navigation.getParent()?.navigate('ActionsTab', {
      screen: 'ActionDetail',
      params: { id: actionId },
    })
  }

  const goUserProfile = (username: string) => {
    setFollowModal(null)
    if (inProfileStack) {
      profileNavigation.push('UserProfile', { username })
      return
    }
    navigation.getParent()?.navigate('ProfileTab', {
      screen: 'UserProfile',
      params: { username },
    })
  }

  if (profileQuery.isLoading) {
    return (
      <Screen>
        <Loader />
      </Screen>
    )
  }

  const korisnik = profileQuery.data
  const isMe = me?.username === korisnik?.username
  const isProfiGuide = !!korisnik?.isProfiGuide

  if (profileQuery.isError || !korisnik) {
    return (
      <Screen>
        <ErrorView message="Profil nije učitan." onRetry={() => profileQuery.refetch()} />
      </Screen>
    )
  }

  const followStatus = followStatusQuery.data
  const blockedByTarget = blockStatusQuery.data?.blockedByTarget

  let followLabel = 'Zaprati'
  if (followStatus?.outgoing === 'accepted') followLabel = 'Otprati'
  else if (followStatus?.outgoing === 'pending') followLabel = 'Otkaži zahtev'
  else if (followStatus?.incoming === 'pending') followLabel = 'Prihvati zahtev'

  const stats = statsQuery.data
  const showOwnMenu = isMe && inProfileStack

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.coverWrap}>
          {korisnik.cover_image_url ? (
            <Image source={{ uri: korisnik.cover_image_url }} style={styles.cover} resizeMode="cover" />
          ) : (
            <View style={[styles.cover, styles.coverFallback]} />
          )}
          <View style={styles.coverOverlay} />
          {showOwnMenu ? (
            <Pressable style={styles.menuBtn} onPress={() => setMenuOpen(true)}>
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.textOnDark} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.body}>
          <View style={styles.identity}>
            <Avatar uri={korisnik.avatar_url} name={korisnik.fullName || korisnik.username} size={72} />
            <View style={styles.identityText}>
              <Text variant="title">{korisnik.fullName || korisnik.username}</Text>
              <Text color={colors.textMuted}>@{korisnik.username}</Text>
              <View style={styles.badges}>
                {korisnik.role && korisnik.role !== 'clan' ? (
                  <Badge label={korisnik.role} tone="muted" />
                ) : null}
                {isProfiGuide ? <Badge label="Profi vodič" tone="brand" /> : null}
              </View>
            </View>
          </View>

          {!isMe && !blockedByTarget ? (
            <View style={styles.socialRow}>
              <Button
                title={followLabel}
                onPress={() => followMutation.mutate()}
                loading={followMutation.isPending}
                fullWidth
              />
              <Button
                title={blockStatusQuery.data?.blockedByMe ? 'Odblokiraj' : 'Blokiraj'}
                variant="secondary"
                onPress={async () => {
                  if (!blockStatusQuery.data?.blockedByMe) {
                    const ok = await showConfirm('Blokiraj korisnika', 'Da li ste sigurni?')
                    if (!ok) return
                  }
                  blockMutation.mutate()
                }}
                loading={blockMutation.isPending}
                fullWidth
              />
            </View>
          ) : null}

          {blockedByTarget ? (
            <View style={styles.blocked}>
              <Text color={colors.textMuted}>Ovaj korisnik vas je blokirao.</Text>
            </View>
          ) : (
            <>
              <View style={styles.statsBar}>
                <StatCell label="Km" value={String(stats?.ukupnoKm ?? 0)} />
                <StatCell label="Uspon" value={`${stats?.ukupnoMetaraUspona ?? 0} m`} />
                <StatCell label="Popeo se" value={String(stats?.brojPopeoSe ?? 0)} />
                <StatCell label="PER" value={String(totalPer)} />
              </View>

              <View style={styles.followRow}>
                <Pressable onPress={() => void openFollowModal('followers')}>
                  <Text variant="label">
                    {followQuery.data?.followers ?? 0}{' '}
                    <Text color={colors.textMuted}>pratioca</Text>
                  </Text>
                </Pressable>
                <Pressable onPress={() => void openFollowModal('following')}>
                  <Text variant="label">
                    {followQuery.data?.following ?? 0}{' '}
                    <Text color={colors.textMuted}>prati</Text>
                  </Text>
                </Pressable>
              </View>

              {isProfiGuide ? (
                <View style={styles.actionsToggle}>
                  <ToggleChip
                    label="Popeo se"
                    active={actionsTab === 'climbed'}
                    onPress={() => setActionsTab('climbed')}
                  />
                  <ToggleChip
                    label="Vodio"
                    active={actionsTab === 'guided'}
                    onPress={() => setActionsTab('guided')}
                  />
                </View>
              ) : (
                <Text variant="label" style={styles.sectionTitle}>
                  Popeo se
                </Text>
              )}

              {displayedActions.length === 0 ? (
                <Text color={colors.textMuted}>Nema akcija.</Text>
              ) : (
                <ProfileActionGrid actions={displayedActions} onPressAction={goAction} />
              )}
            </>
          )}
        </View>
      </ScrollView>

      <FollowListModal
        visible={followModal !== null}
        title={followModal === 'followers' ? 'Pratioci' : 'Prati'}
        users={followModalUsers}
        loading={followModalLoading}
        onClose={() => setFollowModal(null)}
        onSelectUser={goUserProfile}
      />

      {showOwnMenu ? (
        <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
          <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
            <View style={styles.menuSheet}>
              <MenuRow
                label="Podešavanja profila"
                onPress={() => {
                  setMenuOpen(false)
                  profileNavigation.navigate('ProfileSettings')
                }}
              />
              {canSeeFinance(me?.role) ? (
                <MenuRow
                  label="Finansije"
                  onPress={() => {
                    setMenuOpen(false)
                    profileNavigation.navigate('Finance')
                  }}
                />
              ) : null}
              {canManageClub(me, me?.klubId ?? undefined) ? (
                <MenuRow
                  label="Zadaci"
                  onPress={() => {
                    setMenuOpen(false)
                    profileNavigation.navigate('Tasks')
                  }}
                />
              ) : null}
              <MenuRow
                label="Odjavi se"
                danger
                onPress={() => {
                  setMenuOpen(false)
                  void logout()
                }}
              />
            </View>
          </Pressable>
        </Modal>
      ) : null}
    </Screen>
  )
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCell}>
      <Text variant="label">{value}</Text>
      <Text variant="small" color={colors.textMuted}>
        {label}
      </Text>
    </View>
  )
}

function ToggleChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text variant="label" color={active ? colors.brand : colors.textMuted}>
        {label}
      </Text>
    </Pressable>
  )
}

function MenuRow({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={styles.menuRow}>
      <Text color={danger ? colors.danger : colors.text}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  coverWrap: { height: 180, position: 'relative' },
  cover: { width: '100%', height: '100%' },
  coverFallback: { backgroundColor: colors.navBgMid },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  menuBtn: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: spacing.lg, marginTop: -36 },
  identity: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  identityText: { flex: 1, justifyContent: 'center', gap: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  socialRow: { gap: spacing.sm, marginBottom: spacing.md },
  blocked: { paddingVertical: spacing.lg },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  statCell: { alignItems: 'center', flex: 1 },
  followRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  actionsToggle: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
  },
  chipActive: { backgroundColor: '#ecfdf5' },
  sectionTitle: { marginBottom: spacing.sm },
  menuOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  menuRow: { paddingVertical: spacing.md },
})
