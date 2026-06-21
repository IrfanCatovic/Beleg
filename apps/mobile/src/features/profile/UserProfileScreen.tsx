import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack'
import { getApiErrorMessage } from '@beleg/shared'
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
  updateMyAvatar,
  updateMyCover,
} from '@beleg/shared/services'
import { client } from '../../api/client'
import { appendImageToFormData, prepareImagePickerAssetForUpload } from '../../lib/imageUpload'
import { debugLog, serializeUploadError } from '../../lib/debugLog'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import { Avatar, Button, ErrorView, Loader, Screen, Text } from '../../components/ui'
import { colors, radius, spacing } from '../../theme'
import { computeProfileRank, getRoleColor, getRoleLabel } from '../../utils/profileRank'
import type {
  ActionsStackParamList,
  ExploreStackParamList,
  HomeStackParamList,
  ProfileStackParamList,
} from '../../navigation/types'
import { FollowListModal } from './FollowListModal'
import { ProfileActionGrid } from './ProfileActionGrid'
import { ProfileActionsToggle } from './ProfileActionsToggle'
import { ProfileImageActionModal } from './ProfileImageActionModal'

type Props =
  | NativeStackScreenProps<ProfileStackParamList, 'UserProfile'>
  | NativeStackScreenProps<HomeStackParamList, 'UserProfile'>
  | NativeStackScreenProps<ActionsStackParamList, 'UserProfile'>
  | NativeStackScreenProps<ExploreStackParamList, 'UserProfile'>

type ActionsTab = 'climbed' | 'guided'

function formatMemberSince(createdAt?: string): string {
  if (!createdAt) return '—'
  const d = new Date(createdAt)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'long', year: 'numeric' })
}

function showRoleBadge(role?: string, klubNaziv?: string): boolean {
  if (!role || role === 'clan') return false
  return role === 'superadmin' || !!klubNaziv
}

export default function UserProfileScreen({ route, navigation }: Props) {
  const { user: me, refreshUser } = useAuth()
  const { showConfirm, showAlert } = useModal()
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()
  const idOrUsername = route.params.username || String(route.params.id ?? '')

  const [actionsTab, setActionsTab] = useState<ActionsTab>('climbed')
  const [followModal, setFollowModal] = useState<'following' | 'followers' | null>(null)
  const [followModalUsers, setFollowModalUsers] = useState<Awaited<ReturnType<typeof fetchUserFollowingList>>>([])
  const [followModalLoading, setFollowModalLoading] = useState(false)
  const [avatarFocus, setAvatarFocus] = useState(false)
  const [coverFocus, setCoverFocus] = useState(false)
  const [avatarModalOpen, setAvatarModalOpen] = useState(false)
  const [coverModalOpen, setCoverModalOpen] = useState(false)

  const routeNames = (navigation.getState()?.routeNames ?? []) as string[]
  const inProfileStack = routeNames.includes('ProfileSettings')
  const profileNavigation = navigation as NativeStackNavigationProp<ProfileStackParamList, 'UserProfile'>

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: !inProfileStack })
  }, [inProfileStack, navigation])

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
      if (status?.outgoing === 'accepted') await unfollowUser(client, targetId)
      else if (status?.outgoing === 'pending') await cancelFollowRequest(client, targetId)
      else if (status?.incoming === 'pending' && status.incomingFollowId) {
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
      if (blockStatusQuery.data?.blockedByMe) await unblockUser(client, targetId)
      else await blockUser(client, targetId)
    },
    onSuccess: invalidateSocial,
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Blokiranje nije uspelo.')),
  })

  const invalidateProfile = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['korisnik', idOrUsername] })
    void refreshUser()
  }, [queryClient, idOrUsername, refreshUser])

  const pickFromGallery = useCallback(async (aspect?: [number, number]) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      await showAlert('Dozvola', 'Potrebna je dozvola za galeriju.')
      return null
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect,
      quality: 0.85,
    })
    // #region agent log
    debugLog(
      'UserProfileScreen.tsx:pickFromGallery',
      'ImagePicker result',
      {
        canceled: result.canceled,
        assetCount: result.assets?.length ?? 0,
        uri: result.assets?.[0]?.uri?.slice(0, 80),
        mimeType: result.assets?.[0]?.mimeType,
        fileName: result.assets?.[0]?.fileName,
        width: result.assets?.[0]?.width,
        height: result.assets?.[0]?.height,
      },
      'H5',
    )
    // #endregion
    if (result.canceled || !result.assets[0]) return null
    return result.assets[0]
  }, [showAlert])

  const avatarMutation = useMutation({
    mutationFn: async (action: 'pick' | 'remove') => {
      const fd = new FormData()
      if (action === 'remove') {
        fd.append('removeAvatar', '1')
        return updateMyAvatar(client, fd)
      }
      const asset = await pickFromGallery([1, 1])
      if (!asset) return null
      const file = await prepareImagePickerAssetForUpload(asset, 'avatar', { maxWidth: 1024 })
      appendImageToFormData(fd, 'avatar', file)
      return updateMyAvatar(client, fd)
    },
    onSuccess: async (res) => {
      if (res === null) return
      setAvatarModalOpen(false)
      setAvatarFocus(false)
      invalidateProfile()
      await showAlert('Sačuvano', 'Profilna slika je ažurirana.')
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Profilna slika nije sačuvana.')),
  })

  const coverMutation = useMutation({
    mutationFn: async (action: 'pick' | 'remove') => {
      // #region agent log
      debugLog('UserProfileScreen.tsx:coverMutation', 'mutation start', { action }, 'H5')
      // #endregion
      const fd = new FormData()
      if (action === 'remove') {
        fd.append('removeCover', '1')
        return updateMyCover(client, fd)
      }
      const asset = await pickFromGallery([16, 9])
      if (!asset) {
        // #region agent log
        debugLog('UserProfileScreen.tsx:coverMutation', 'picker returned null', {}, 'H5')
        // #endregion
        return null
      }
      let file
      try {
        file = await prepareImagePickerAssetForUpload(asset, 'cover', { maxWidth: 1920 })
        // #region agent log
        debugLog(
          'UserProfileScreen.tsx:coverMutation',
          'file prepared',
          { uri: file.uri.slice(0, 80), name: file.name, type: file.type },
          'H1',
        )
        // #endregion
      } catch (prepErr) {
        // #region agent log
        debugLog(
          'UserProfileScreen.tsx:coverMutation',
          'prepareImage failed',
          serializeUploadError(prepErr),
          'H1',
        )
        // #endregion
        throw prepErr
      }
      appendImageToFormData(fd, 'coverImage', file)
      // #region agent log
      debugLog(
        'UserProfileScreen.tsx:coverMutation',
        'calling updateMyCover',
        { apiBase: process.env.EXPO_PUBLIC_API_URL },
        'H2',
      )
      // #endregion
      return updateMyCover(client, fd)
    },
    onSuccess: async (res) => {
      if (res === null) return
      // #region agent log
      debugLog('UserProfileScreen.tsx:coverMutation', 'upload success', { hasRes: !!res }, 'H2')
      // #endregion
      setCoverModalOpen(false)
      setCoverFocus(false)
      invalidateProfile()
      await showAlert('Sačuvano', 'Cover slika je ažurirana.')
    },
    onError: (err) => {
      const details = serializeUploadError(err)
      // #region agent log
      debugLog('UserProfileScreen.tsx:coverMutation', 'upload error', details, 'H2')
      // #endregion
      const msg = getApiErrorMessage(err, 'Cover slika nije sačuvana.')
      const debugHint = details.serverError || details.message || details.code
      showAlert('Greška', debugHint ? `${msg}\n\n(${String(debugHint)})` : msg)
    },
  })

  useEffect(() => {
    if (!profileQuery.data?.isProfiGuide) setActionsTab('climbed')
  }, [profileQuery.data?.isProfiGuide, idOrUsername])

  const rank = useMemo(() => {
    return computeProfileRank(popeoQuery.data ?? [], statsQuery.data ?? {}, profileQuery.data?.createdAt)
  }, [popeoQuery.data, statsQuery.data, profileQuery.data?.createdAt])

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
  if (profileQuery.isError || !korisnik) {
    return (
      <Screen>
        <ErrorView message="Profil nije učitan." onRetry={() => profileQuery.refetch()} />
      </Screen>
    )
  }

  const isMe = me?.username === korisnik.username
  const isProfiGuide = !!korisnik.isProfiGuide
  const followStatus = followStatusQuery.data
  const blockedByTarget = blockStatusQuery.data?.blockedByTarget
  const stats = statsQuery.data
  const showSettings = isMe && inProfileStack
  const roleVisible = showRoleBadge(korisnik.role, korisnik.klubNaziv)

  let followLabel = 'Zaprati'
  if (followStatus?.outgoing === 'accepted') followLabel = 'Otprati'
  else if (followStatus?.outgoing === 'pending') followLabel = 'Otkaži zahtev'
  else if (followStatus?.incoming === 'pending') followLabel = 'Prihvati zahtev'

  const rankTextColor = rank.boja === '#000000' ? '#FFD700' : '#ffffff'

  const handleAvatarPress = () => {
    if (!isMe) return
    if (!avatarFocus) {
      setAvatarFocus(true)
      setCoverFocus(false)
      return
    }
    setAvatarModalOpen(true)
  }

  const handleCoverPress = () => {
    if (!isMe) return
    if (!coverFocus) {
      setCoverFocus(true)
      setAvatarFocus(false)
      return
    }
    setCoverModalOpen(true)
  }

  return (
    <Screen padded={false} edges={inProfileStack ? [] : ['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        onScrollBeginDrag={() => {
          setAvatarFocus(false)
          setCoverFocus(false)
        }}
      >
        <Pressable style={styles.coverWrap} onPress={handleCoverPress} disabled={!isMe}>
          {korisnik.cover_image_url ? (
            <Image source={{ uri: korisnik.cover_image_url }} style={styles.cover} resizeMode="cover" />
          ) : (
            <View style={[styles.cover, styles.coverFallback]} />
          )}
          <View style={styles.coverGradient} />
          {isMe && coverFocus ? (
            <View style={styles.imageEditOverlay}>
              <Ionicons name="create-outline" size={28} color={colors.white} />
            </View>
          ) : null}

          {showSettings ? (
            <Pressable
              style={[styles.settingsBtn, { top: insets.top + spacing.sm }]}
              onPress={() => profileNavigation.navigate('ProfileSettings')}
              hitSlop={8}
            >
              <Ionicons name="settings-outline" size={22} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </Pressable>

        <View style={styles.headerCard}>
          <View style={styles.identityRow}>
            <Pressable onPress={handleAvatarPress} disabled={!isMe} style={styles.avatarWrap}>
              <Avatar uri={korisnik.avatar_url} name={korisnik.fullName || korisnik.username} size={80} />
              {isMe && avatarFocus ? (
                <View style={styles.avatarEditOverlay}>
                  <Ionicons name="create-outline" size={22} color={colors.white} />
                </View>
              ) : null}
            </Pressable>

            <View style={styles.identityText}>
              <View style={styles.nameRow}>
                <Text variant="title" style={styles.name}>
                  {korisnik.fullName || korisnik.username}
                </Text>
                {isProfiGuide ? (
                  <Ionicons name="shield-checkmark" size={18} color={colors.brand} style={styles.profiIcon} />
                ) : null}
              </View>
              <Text color={colors.textMuted}>@{korisnik.username}</Text>
              <View style={styles.memberSinceRow}>
                <Ionicons name="calendar-outline" size={13} color={colors.textSubtle} />
                <Text variant="small" color={colors.textMuted}>
                  Član od {formatMemberSince(korisnik.createdAt)}
                </Text>
              </View>
            </View>

            {roleVisible ? (
              <View style={[styles.roleBadge, { backgroundColor: getRoleColor(korisnik.role) }]}>
                <Text variant="small" color={colors.white} style={styles.roleText}>
                  {getRoleLabel(korisnik.role).toUpperCase()}
                </Text>
              </View>
            ) : null}
          </View>

          {korisnik.klubNaziv ? (
            <View style={styles.clubRow}>
              <View style={styles.clubBadge}>
                {korisnik.klubLogoUrl ? (
                  <Image source={{ uri: korisnik.klubLogoUrl }} style={styles.clubLogo} />
                ) : (
                  <Ionicons name="business-outline" size={12} color="#7c3aed" />
                )}
                <Text variant="small" style={styles.clubText}>
                  {korisnik.klubNaziv}
                </Text>
              </View>
            </View>
          ) : null}

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
        </View>

        {blockedByTarget ? (
          <View style={styles.blocked}>
            <Text color={colors.textMuted}>Ovaj korisnik vas je blokirao.</Text>
          </View>
        ) : (
          <>
            <View style={styles.statsSection}>
              <View style={styles.rankCard}>
                <View style={[styles.rankBadge, { backgroundColor: rank.boja }]}>
                  <Text variant="label" style={{ color: rankTextColor }}>
                    {rank.naziv}
                  </Text>
                  <View style={styles.rankDivider} />
                  <Text variant="label" style={{ color: rankTextColor }}>
                    {rank.per} PER
                  </Text>
                </View>

                <View style={styles.followPanel}>
                  <Pressable style={styles.followCell} onPress={() => void openFollowModal('following')}>
                    <Text variant="label">{followQuery.data?.following ?? 0}</Text>
                    <Text variant="small" color={colors.textMuted} style={styles.followLabel}>
                      PRATI
                    </Text>
                  </Pressable>
                  <View style={styles.followSep} />
                  <Pressable style={styles.followCell} onPress={() => void openFollowModal('followers')}>
                    <Text variant="label">{followQuery.data?.followers ?? 0}</Text>
                    <Text variant="small" color={colors.textMuted} style={styles.followLabel}>
                      PRATIOCI
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.metricsRow}>
                <MetricCell
                  value={`${(stats?.ukupnoMetaraUspona ?? 0).toLocaleString('sr-RS')} m`}
                  label="USPON"
                  accent={colors.brand}
                />
                <MetricCell
                  value={`${(stats?.ukupnoKm ?? 0).toLocaleString('sr-RS', {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })} km`}
                  label="STAZA"
                  accent="#0ea5e9"
                />
                <MetricCell value={String(stats?.brojPopeoSe ?? 0)} label="OSVOJENIH" accent="#f59e0b" />
                <MetricCell
                  value={(stats?.ukupnoKoraka ?? 0).toLocaleString('sr-RS')}
                  label="KORACI"
                  accent="#8b5cf6"
                />
              </View>
            </View>

            <View style={styles.actionsSection}>
              {isProfiGuide ? (
                <View style={styles.toggleWrap}>
                  <ProfileActionsToggle
                    tab={actionsTab}
                    climbedCount={popeoQuery.data?.length ?? 0}
                    guidedCount={vodioQuery.data?.length ?? 0}
                    onChange={setActionsTab}
                  />
                </View>
              ) : null}

              <ProfileActionGrid actions={displayedActions} onPressAction={goAction} fullWidth />
            </View>
          </>
        )}
      </ScrollView>

      <FollowListModal
        visible={followModal !== null}
        title={followModal === 'followers' ? 'Pratioci' : 'Prati'}
        users={followModalUsers}
        loading={followModalLoading}
        onClose={() => setFollowModal(null)}
        onSelectUser={goUserProfile}
      />

      {isMe ? (
        <>
          <ProfileImageActionModal
            visible={avatarModalOpen}
            title="Promena profilne slike"
            subtitle="Izaberite šta želite da uradite."
            onClose={() => setAvatarModalOpen(false)}
            onPickGallery={() => avatarMutation.mutate('pick')}
            onRemove={() => avatarMutation.mutate('remove')}
            canRemove={!!korisnik.avatar_url}
          />
          <ProfileImageActionModal
            visible={coverModalOpen}
            title="Promena cover slike"
            subtitle="Izaberite šta želite da uradite."
            onClose={() => setCoverModalOpen(false)}
            onPickGallery={() => coverMutation.mutate('pick')}
            onRemove={() => coverMutation.mutate('remove')}
            canRemove={!!korisnik.cover_image_url}
          />
        </>
      ) : null}
    </Screen>
  )
}

function MetricCell({ value, label, accent }: { value: string; label: string; accent: string }) {
  return (
    <View style={styles.metricCell}>
      <Text variant="small" style={[styles.metricValue, { color: accent }]}>
        {value}
      </Text>
      <Text variant="small" color={colors.textMuted} style={styles.metricLabel}>
        {label}
      </Text>
    </View>
  )
}

const COVER_HEIGHT = 224

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, backgroundColor: colors.bg },
  coverWrap: {
    height: COVER_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: colors.navBgMid,
  },
  cover: { width: '100%', height: '100%' },
  coverFallback: {
    backgroundColor: '#0f766e',
  },
  coverGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  imageEditOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsBtn: {
    position: 'absolute',
    right: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  headerCard: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginTop: -40,
  },
  avatarWrap: {
    borderRadius: 999,
    borderWidth: 3,
    borderColor: colors.white,
    overflow: 'hidden',
    backgroundColor: colors.white,
  },
  identityText: { flex: 1, paddingTop: 44, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  name: { fontSize: 18, lineHeight: 22 },
  profiIcon: { marginLeft: 4 },
  memberSinceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  roleBadge: {
    marginTop: 48,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  roleText: { fontWeight: '800', fontSize: 10, letterSpacing: 0.5 },
  clubRow: { marginTop: spacing.sm },
  clubBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
  },
  clubLogo: { width: 14, height: 14, borderRadius: 2 },
  clubText: { color: '#6d28d9', fontWeight: '800', fontSize: 10 },
  socialRow: { gap: spacing.sm, marginTop: spacing.md },
  blocked: { padding: spacing.xl, alignItems: 'center' },
  statsSection: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rankCard: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fafafa',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    gap: spacing.sm,
    flexShrink: 1,
  },
  rankDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  followPanel: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.white,
  },
  followCell: { alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  followSep: { width: 1, backgroundColor: colors.border },
  followLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1, marginTop: 2 },
  metricsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  metricCell: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: 2 },
  metricValue: { fontWeight: '800', fontSize: 13, textAlign: 'center' },
  metricLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.6, marginTop: 4, textAlign: 'center' },
  actionsSection: {
    backgroundColor: '#f8fafc',
    paddingTop: spacing.md,
  },
  toggleWrap: {
    paddingHorizontal: spacing.lg,
  },
})
