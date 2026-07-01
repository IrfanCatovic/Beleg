import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack'
import { useFocusEffect } from '@react-navigation/native'
import { getApiErrorMessage } from '@beleg/shared'
import type { Korisnik } from '@beleg/shared/types'
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
import { navigateToBecomeGuide } from '../../navigation/navigationRef'
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
  const { user: me, refreshUser, logout } = useAuth()
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
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null)
  const [localCoverUrl, setLocalCoverUrl] = useState<string | null>(null)

  const routeNames = (navigation.getState()?.routeNames ?? []) as string[]
  const inProfileStack = routeNames.includes('ProfileSettings')
  const profileNavigation = navigation as NativeStackNavigationProp<ProfileStackParamList, 'UserProfile'>

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
    enabled: !!idOrUsername,
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

  const patchProfileCache = useCallback(
    (patch: Partial<Korisnik>) => {
      queryClient.setQueryData<Korisnik>(['korisnik', idOrUsername], (old) =>
        old ? { ...old, ...patch } : old,
      )
    },
    [queryClient, idOrUsername],
  )

  const dismissImageFocus = useCallback(() => {
    setAvatarFocus(false)
    setCoverFocus(false)
  }, [])

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
    if (result.canceled || !result.assets[0]) return null
    return result.assets[0]
  }, [showAlert])

  const handleAvatarImageAction = useCallback(
    async (action: 'pick' | 'remove') => {
      setAvatarModalOpen(false)
      dismissImageFocus()

      if (action === 'remove') {
        setAvatarUploading(true)
        try {
          const fd = new FormData()
          fd.append('removeAvatar', '1')
          await updateMyAvatar(client, fd)
          setLocalAvatarUrl(null)
          patchProfileCache({ avatar_url: '' })
          invalidateProfile()
        } catch (err) {
          showAlert('Greška', getApiErrorMessage(err, 'Profilna slika nije uklonjena.'))
        } finally {
          setAvatarUploading(false)
        }
        return
      }

      const asset = await pickFromGallery([1, 1])
      if (!asset) return

      const file = await prepareImagePickerAssetForUpload(asset, 'avatar', { maxWidth: 1024 })
      setLocalAvatarUrl(file.uri)
      setAvatarUploading(true)
      try {
        const fd = new FormData()
        appendImageToFormData(fd, 'avatar', file)
        const res = await updateMyAvatar(client, fd)
        const url = res.avatar_url ?? file.uri
        setLocalAvatarUrl(url)
        patchProfileCache({ avatar_url: url })
        invalidateProfile()
      } catch (err) {
        setLocalAvatarUrl(null)
        showAlert('Greška', getApiErrorMessage(err, 'Profilna slika nije sačuvana.'))
      } finally {
        setAvatarUploading(false)
      }
    },
    [dismissImageFocus, invalidateProfile, patchProfileCache, pickFromGallery, showAlert],
  )

  const handleCoverImageAction = useCallback(
    async (action: 'pick' | 'remove') => {
      setCoverModalOpen(false)
      dismissImageFocus()

      if (action === 'remove') {
        setCoverUploading(true)
        try {
          const fd = new FormData()
          fd.append('removeCover', '1')
          await updateMyCover(client, fd)
          setLocalCoverUrl(null)
          patchProfileCache({ cover_image_url: '' })
          invalidateProfile()
        } catch (err) {
          showAlert('Greška', getApiErrorMessage(err, 'Cover slika nije uklonjena.'))
        } finally {
          setCoverUploading(false)
        }
        return
      }

      const asset = await pickFromGallery([16, 9])
      if (!asset) return

      const file = await prepareImagePickerAssetForUpload(asset, 'cover', { maxWidth: 1920 })
      setLocalCoverUrl(file.uri)
      setCoverUploading(true)
      try {
        const fd = new FormData()
        appendImageToFormData(fd, 'coverImage', file)
        const res = await updateMyCover(client, fd)
        const url = res.cover_image_url ?? file.uri
        setLocalCoverUrl(url)
        patchProfileCache({ cover_image_url: url })
        invalidateProfile()
      } catch (err) {
        setLocalCoverUrl(null)
        showAlert('Greška', getApiErrorMessage(err, 'Cover slika nije sačuvana.'))
      } finally {
        setCoverUploading(false)
      }
    },
    [dismissImageFocus, invalidateProfile, patchProfileCache, pickFromGallery, showAlert],
  )

  useEffect(() => {
    const guidedCount = vodioQuery.data?.length ?? 0
    if (!profileQuery.data?.isProfiGuide && guidedCount === 0) setActionsTab('climbed')
  }, [profileQuery.data?.isProfiGuide, vodioQuery.data?.length, idOrUsername])

  useFocusEffect(
    useCallback(() => () => dismissImageFocus(), [dismissImageFocus]),
  )

  const rank = useMemo(() => {
    return computeProfileRank(
      popeoQuery.data ?? [],
      statsQuery.data ?? {},
      vodioQuery.data ?? [],
    )
  }, [popeoQuery.data, statsQuery.data, vodioQuery.data])

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
    if (routeNames.includes('UserProfile')) {
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
  const showGuidedActionsTab = isProfiGuide || (vodioQuery.data?.length ?? 0) > 0
  const followStatus = followStatusQuery.data
  const blockedByTarget = blockStatusQuery.data?.blockedByTarget
  const stats = statsQuery.data
  const showMenu = isMe && inProfileStack
  const roleVisible = showRoleBadge(korisnik.role, korisnik.klubNaziv)

  let followLabel = 'Zaprati'
  if (followStatus?.outgoing === 'accepted') followLabel = 'Otprati'
  else if (followStatus?.outgoing === 'pending') followLabel = 'Otkaži zahtev'
  else if (followStatus?.incoming === 'pending') followLabel = 'Prihvati zahtev'

  const rankTextColor = rank.boja === '#000000' ? '#FFD700' : '#ffffff'
  const displayCoverUrl = localCoverUrl ?? korisnik.cover_image_url
  const displayAvatarUrl = localAvatarUrl ?? korisnik.avatar_url

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
    <Screen padded={false} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        onScrollBeginDrag={dismissImageFocus}
      >
        <Pressable style={styles.coverWrap} onPress={handleCoverPress} disabled={!isMe || coverUploading}>
          {displayCoverUrl ? (
            <Image source={{ uri: displayCoverUrl }} style={styles.cover} resizeMode="cover" />
          ) : (
            <View style={[styles.cover, styles.coverFallback]} />
          )}
          <View style={styles.coverGradient} />
          {navigation.canGoBack() ? (
            <Pressable
              style={[styles.backBtn, { top: insets.top + spacing.sm }]}
              onPress={() => navigation.goBack()}
              hitSlop={8}
            >
              <Ionicons name="arrow-back" size={22} color={colors.white} />
            </Pressable>
          ) : null}
          {isMe && coverFocus && !coverUploading ? (
            <View style={styles.imageEditOverlay}>
              <Ionicons name="create-outline" size={28} color={colors.white} />
            </View>
          ) : null}
          {coverUploading ? (
            <View style={styles.uploadOverlay}>
              <ActivityIndicator size="large" color={colors.white} />
            </View>
          ) : null}

          {showMenu ? (
            <Pressable
              style={[styles.settingsBtn, { top: insets.top + spacing.sm }]}
              onPress={() => {
                dismissImageFocus()
                setMenuOpen(true)
              }}
              hitSlop={8}
            >
              <Ionicons name="menu-outline" size={22} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </Pressable>

        <View style={styles.headerCard}>
          <View style={styles.identityRow}>
            <Pressable onPress={handleAvatarPress} disabled={!isMe || avatarUploading} style={styles.avatarWrap}>
              <Avatar uri={displayAvatarUrl} name={korisnik.fullName || korisnik.username} size={80} />
              {isMe && avatarFocus && !avatarUploading ? (
                <View style={styles.avatarEditOverlay}>
                  <Ionicons name="create-outline" size={22} color={colors.white} />
                </View>
              ) : null}
              {avatarUploading ? (
                <View style={styles.avatarUploadOverlay}>
                  <ActivityIndicator size="small" color={colors.white} />
                </View>
              ) : null}
            </Pressable>

            <Pressable style={styles.identityText} onPress={dismissImageFocus}>
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
            </Pressable>

            {roleVisible ? (
              <Pressable
                style={[styles.roleBadge, { backgroundColor: getRoleColor(korisnik.role) }]}
                onPress={dismissImageFocus}
              >
                <Text variant="small" color={colors.white} style={styles.roleText}>
                  {getRoleLabel(korisnik.role).toUpperCase()}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {korisnik.klubNaziv ? (
            <Pressable style={styles.clubRow} onPress={dismissImageFocus}>
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
            </Pressable>
          ) : null}

          {isMe && !isProfiGuide && inProfileStack ? (
            <View style={styles.becomeGuideRow}>
              <Button
                title="Postani vodič"
                variant="secondary"
                onPress={() => navigateToBecomeGuide()}
                fullWidth
              />
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
          <Pressable onPress={dismissImageFocus}>
            <View style={styles.blocked}>
              <Text color={colors.textMuted}>Ovaj korisnik vas je blokirao.</Text>
            </View>
          </Pressable>
        ) : (
          <Pressable onPress={dismissImageFocus}>
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
              {showGuidedActionsTab ? (
                <View style={styles.toggleWrap}>
                  <ProfileActionsToggle
                    tab={actionsTab}
                    climbedCount={popeoQuery.data?.length ?? 0}
                    guidedCount={vodioQuery.data?.length ?? 0}
                    onChange={setActionsTab}
                  />
                </View>
              ) : null}

              <ProfileActionGrid
                actions={displayedActions}
                onPressAction={goAction}
                fullWidth
                mode={actionsTab === 'guided' ? 'guided' : 'climbed'}
              />
            </View>
          </Pressable>
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
          <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
            <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
              <Pressable style={styles.menuSheet} onPress={(e) => e.stopPropagation()}>
                <Pressable
                  style={styles.menuItem}
                  onPress={() => {
                    setMenuOpen(false)
                    profileNavigation.navigate('ProfileSettings')
                  }}
                >
                  <Ionicons name="settings-outline" size={20} color={colors.text} />
                  <Text variant="body">Podešavanja</Text>
                </Pressable>
                <Pressable
                  style={styles.menuItem}
                  onPress={async () => {
                    setMenuOpen(false)
                    const ok = await showConfirm('Odjava', 'Da li želite da se odjavite?')
                    if (ok) await logout()
                  }}
                >
                  <Ionicons name="log-out-outline" size={20} color={colors.danger} />
                  <Text variant="body" color={colors.danger}>
                    Odjavi me
                  </Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>
          <ProfileImageActionModal
            visible={avatarModalOpen}
            title="Promena profilne slike"
            subtitle="Izaberite šta želite da uradite."
            onClose={() => setAvatarModalOpen(false)}
            onPickGallery={() => void handleAvatarImageAction('pick')}
            onRemove={() => void handleAvatarImageAction('remove')}
            canRemove={!!displayAvatarUrl}
          />
          <ProfileImageActionModal
            visible={coverModalOpen}
            title="Promena cover slike"
            subtitle="Izaberite šta želite da uradite."
            onClose={() => setCoverModalOpen(false)}
            onPickGallery={() => void handleCoverImageAction('pick')}
            onRemove={() => void handleCoverImageAction('remove')}
            canRemove={!!displayCoverUrl}
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
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
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
  avatarUploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.35)',
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
  backBtn: {
    position: 'absolute',
    left: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.xs,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  becomeGuideRow: { marginTop: spacing.md },
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
