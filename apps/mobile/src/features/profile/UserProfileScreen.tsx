import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
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
import { Avatar, Button, EmptyState, ErrorView, Loader, Screen, Text } from '../../components/ui'
import { colors, radius, spacing } from '../../theme'
import { computeProfileRank } from '../../utils/profileRank'
import {
  formatPassportAscentM,
  formatPassportKm,
  formatPassportSummits,
} from '../../utils/profilePassportKpis'
import { useDailySteps } from '../../context/DailyStepsContext'
import {
  getOwnerPrimaryCtaLabel,
  getPublicPrimaryCtaLabel,
  shouldShowOwnerPassportShortcut,
  shouldShowOwnerStepsCard,
} from './profilePassportHeaderModel'
import {
  getClimbedEmptyCopy,
  getGuidedEmptyCopy,
  getHistoryErrorCopy,
  getNoClubOwnCopy,
  getStatsErrorCopy,
  shouldShowGuidedActionsTab,
} from './profileEmptyStates'
import { createRefreshGuard, runProfilePullToRefresh } from './profileRefresh'
import { isOwnProfile } from './profileOwnership'
import { profileKeys } from './profileKeys'
import {
  buildGuideExperienceA11yLabel,
  CLUB_MEMBER_SUBTITLE,
  getGuideRatingPresentation,
  PLANINER_RANK_HINT,
  PLANINER_RANK_LABEL,
  PRIVATE_PASSPORT_BADGE,
  readGuideRatingSummary,
} from './profileIdentity'
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

export default function UserProfileScreen({ route, navigation }: Props) {
  const { user: me, refreshUser, logout } = useAuth()
  const { showConfirm, showAlert } = useModal()
  const dailySteps = useDailySteps()
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
  const [refreshing, setRefreshing] = useState(false)
  const refreshGuardRef = useRef(createRefreshGuard())

  useEffect(() => {
    setLocalAvatarUrl(null)
    setLocalCoverUrl(null)
    setActionsTab('climbed')
    setAvatarFocus(false)
    setCoverFocus(false)
    setMenuOpen(false)
    setFollowModal(null)
  }, [idOrUsername])

  const routeNames = (navigation.getState()?.routeNames ?? []) as string[]
  const inProfileStack = routeNames.includes('ProfileSettings')
  const profileNavigation = navigation as NativeStackNavigationProp<ProfileStackParamList, 'UserProfile'>

  const profileQuery = useQuery({
    queryKey: profileKeys.detail(idOrUsername),
    queryFn: () => fetchKorisnikByIdOrUsername(client, idOrUsername),
    enabled: !!idOrUsername,
  })

  const targetId = profileQuery.data?.id

  const statsQuery = useQuery({
    queryKey: profileKeys.stats(idOrUsername),
    queryFn: () => fetchKorisnikStatistika(client, idOrUsername),
    enabled: !!idOrUsername,
  })

  const popeoQuery = useQuery({
    queryKey: profileKeys.climbed(idOrUsername),
    queryFn: () => fetchKorisnikPopeoSe(client, idOrUsername),
    enabled: !!idOrUsername,
  })

  const vodioQuery = useQuery({
    queryKey: profileKeys.guided(idOrUsername),
    queryFn: () => fetchKorisnikVodio(client, idOrUsername),
    enabled: !!idOrUsername,
  })

  const followQuery = useQuery({
    queryKey: targetId != null ? profileKeys.followCounts(targetId) : (['follows', 'idle'] as const),
    queryFn: () => fetchFollowCounts(client, targetId!),
    enabled: !!targetId,
  })

  const followStatusQuery = useQuery({
    queryKey: targetId != null ? profileKeys.followStatus(targetId) : (['follows', 'idle', 'status'] as const),
    queryFn: () => fetchFollowStatus(client, targetId!),
    enabled:
      !!targetId &&
      !isOwnProfile({
        viewerUsername: me?.username,
        profileUsername: profileQuery.data?.username,
        profileId: profileQuery.data?.id,
      }),
  })

  const blockStatusQuery = useQuery({
    queryKey: targetId != null ? profileKeys.blockStatus(targetId) : (['blocks', 'idle', 'status'] as const),
    queryFn: () => fetchBlockStatus(client, targetId!),
    enabled:
      !!targetId &&
      !isOwnProfile({
        viewerUsername: me?.username,
        profileUsername: profileQuery.data?.username,
        profileId: profileQuery.data?.id,
      }),
  })

  const invalidateSocial = () => {
    if (!targetId) return
    void queryClient.invalidateQueries({ queryKey: profileKeys.followRoot(targetId) })
    void queryClient.invalidateQueries({ queryKey: profileKeys.blockRoot(targetId) })
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
    void queryClient.invalidateQueries({ queryKey: profileKeys.detail(idOrUsername) })
    void refreshUser()
  }, [queryClient, idOrUsername, refreshUser])

  const patchProfileCache = useCallback(
    (patch: Partial<Korisnik>) => {
      queryClient.setQueryData<Korisnik>(profileKeys.detail(idOrUsername), (old) =>
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

  const goFindActions = () => {
    navigation.getParent()?.navigate('ActionsTab', { screen: 'ActionsList' })
  }

  const onPullToRefresh = useCallback(() => {
    void refreshGuardRef.current.run(async () => {
      setRefreshing(true)
      try {
        const isOwnProfileView = isOwnProfile({
          viewerUsername: me?.username,
          profileUsername: profileQuery.data?.username,
          profileId: profileQuery.data?.id,
        })
        await runProfilePullToRefresh(isOwnProfileView ? 'own' : 'public', {
          refetchProfile: () => profileQuery.refetch(),
          refetchStats: () => statsQuery.refetch(),
          refetchClimbed: () => popeoQuery.refetch(),
          refetchGuided: () => vodioQuery.refetch(),
          refetchFollowCounts: targetId ? () => followQuery.refetch() : undefined,
          refetchFollowStatus:
            targetId && !isOwnProfileView ? () => followStatusQuery.refetch() : undefined,
          refetchBlockStatus:
            targetId && !isOwnProfileView ? () => blockStatusQuery.refetch() : undefined,
          refreshDailySteps: isOwnProfileView ? () => dailySteps.refresh() : undefined,
        })
      } finally {
        setRefreshing(false)
      }
    })
  }, [
    me?.username,
    profileQuery,
    statsQuery,
    popeoQuery,
    vodioQuery,
    followQuery,
    followStatusQuery,
    blockStatusQuery,
    targetId,
    dailySteps,
  ])


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

  const isMe = isOwnProfile({
    viewerUsername: me?.username,
    profileUsername: korisnik.username,
    profileId: korisnik.id,
  })
  const isProfiGuide = !!korisnik.isProfiGuide
  const showGuidedActionsTab = shouldShowGuidedActionsTab({
    isProfiGuide,
    guidedCount: vodioQuery.data?.length ?? 0,
  })
  const followStatus = followStatusQuery.data
  const blockedByTarget = blockStatusQuery.data?.blockedByTarget
  const stats = statsQuery.data
  const statsPending = statsQuery.isLoading || (statsQuery.isFetching && !stats)
  const statsFailed = statsQuery.isError && !stats
  const climbedPending = popeoQuery.isLoading || (popeoQuery.isFetching && !popeoQuery.data)
  const climbedFailed = popeoQuery.isError && !popeoQuery.data
  const guidedPending = vodioQuery.isLoading || (vodioQuery.isFetching && !vodioQuery.data)
  const guidedFailed = vodioQuery.isError && !vodioQuery.data
  const canOpenSettings = isMe && inProfileStack
  const showOwnerMenu = canOpenSettings
  const showPublicOverflowMenu = !isMe && !blockedByTarget

  let followLabel = 'Zaprati'
  if (followStatus?.outgoing === 'accepted') followLabel = 'Otprati'
  else if (followStatus?.outgoing === 'pending') followLabel = 'Otkaži zahtev'
  else if (followStatus?.incoming === 'pending') followLabel = 'Prihvati zahtev'

  const ownerPrimaryLabel = getOwnerPrimaryCtaLabel(canOpenSettings)
  const publicPrimaryLabel = getPublicPrimaryCtaLabel({
    isMe,
    blockedByTarget: !!blockedByTarget,
    followLabel,
  })
  const showPassportShortcut = shouldShowOwnerPassportShortcut(isMe, canOpenSettings)
  const showStepsCard = shouldShowOwnerStepsCard(isMe)

  const openSettings = () => {
    if (!canOpenSettings) return
    dismissImageFocus()
    profileNavigation.navigate('ProfileSettings')
  }

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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onPullToRefresh} tintColor={colors.brand} />
        }
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
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Nazad"
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

          {showOwnerMenu || showPublicOverflowMenu ? (
            <Pressable
              style={[styles.settingsBtn, { top: insets.top + spacing.sm }]}
              onPress={() => {
                dismissImageFocus()
                setMenuOpen(true)
              }}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Meni profila"
            >
              <Ionicons name="menu-outline" size={22} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </Pressable>

        <View style={styles.headerCard}>
          <View style={styles.identityRow}>
            <Pressable
              onPress={handleAvatarPress}
              disabled={!isMe || avatarUploading}
              style={styles.avatarWrap}
              accessibilityRole="imagebutton"
              accessibilityLabel={
                isMe ? 'Profilna slika, dodirnite za izmjenu' : `Profilna slika, ${korisnik.fullName || korisnik.username}`
              }
            >
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
                <Text variant="title" style={styles.name} numberOfLines={2}>
                  {korisnik.fullName || korisnik.username}
                </Text>
                {isProfiGuide ? (
                  <View style={styles.profiBadge} accessibilityLabel="Profi vodič">
                    <Ionicons name="shield-checkmark" size={14} color={colors.brand} />
                    <Text variant="small" style={styles.profiBadgeText}>
                      Profi vodič
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text color={colors.textMuted} numberOfLines={1}>
                @{korisnik.username}
              </Text>
              <View style={styles.memberSinceRow}>
                <Ionicons name="calendar-outline" size={13} color={colors.textSubtle} />
                <Text variant="small" color={colors.textMuted}>
                  Član od {formatMemberSince(korisnik.createdAt)}
                </Text>
              </View>
            </Pressable>

          </View>

          {korisnik.klubNaziv ? (
            <Pressable
              style={styles.clubRow}
              onPress={() => {
                dismissImageFocus()
                if (isMe) {
                  navigation.getParent()?.navigate('ClubTab', { screen: 'ClubHome' })
                }
              }}
              disabled={!isMe}
              accessibilityRole={isMe ? 'button' : 'text'}
              accessibilityLabel={
                isMe
                  ? `Otvori klub ${korisnik.klubNaziv}`
                  : `Logo kluba ${korisnik.klubNaziv}`
              }
            >
              <View style={styles.clubBadge}>
                {korisnik.klubLogoUrl ? (
                  <Image
                    source={{ uri: korisnik.klubLogoUrl }}
                    style={styles.clubLogo}
                    accessibilityLabel={`Logo kluba ${korisnik.klubNaziv}`}
                  />
                ) : (
                  <Ionicons name="business-outline" size={12} color="#7c3aed" />
                )}
                <View style={styles.clubTextCol}>
                  <Text variant="small" style={styles.clubText} numberOfLines={1}>
                    {korisnik.klubNaziv}
                  </Text>
                  <Text variant="small" style={styles.clubSubtext} numberOfLines={1}>
                    {CLUB_MEMBER_SUBTITLE}
                  </Text>
                </View>
              </View>
            </Pressable>
          ) : isMe ? (
            <Text variant="small" color={colors.textMuted} style={styles.noClubText}>
              {getNoClubOwnCopy()}
            </Text>
          ) : null}

          {ownerPrimaryLabel ? (
            <View style={styles.primaryActionsRow}>
              <Button
                title={ownerPrimaryLabel}
                onPress={openSettings}
                fullWidth
                accessibilityLabel="Uredi profil"
              />
            </View>
          ) : null}

          {isMe && !isProfiGuide && inProfileStack ? (
            <View style={styles.becomeGuideRow}>
              <Button
                title="Postani vodič"
                variant="secondary"
                onPress={() => navigateToBecomeGuide()}
                fullWidth
                accessibilityLabel="Pošalji prijavu za vodiča"
              />
            </View>
          ) : null}

          {publicPrimaryLabel ? (
            <View style={styles.primaryActionsRow}>
              <Button
                title={publicPrimaryLabel}
                onPress={() => followMutation.mutate()}
                loading={followMutation.isPending}
                fullWidth
                accessibilityLabel={publicPrimaryLabel}
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
                <View
                  style={[styles.rankBadge, { backgroundColor: rank.boja }]}
                  accessibilityLabel={`${PLANINER_RANK_LABEL}. ${PLANINER_RANK_HINT}`}
                >
                  <Text variant="small" style={{ color: rankTextColor, opacity: 0.9 }}>
                    {PLANINER_RANK_LABEL}
                  </Text>
                  <View style={styles.rankNameRow}>
                    <Text variant="label" style={{ color: rankTextColor }}>
                      {rank.naziv}
                    </Text>
                    <View style={styles.rankDivider} />
                    <Text variant="label" style={{ color: rankTextColor }}>
                      {rank.per} PER
                    </Text>
                  </View>
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

              <View style={styles.metricsRow} accessibilityRole="summary">
                {statsFailed ? (
                  <View style={styles.sectionErrorWrap}>
                    <Text variant="small" color={colors.textMuted} style={styles.sectionErrorText}>
                      {getStatsErrorCopy()}
                    </Text>
                    <Button
                      title="Pokušaj ponovo"
                      variant="secondary"
                      onPress={() => void statsQuery.refetch()}
                      accessibilityLabel="Pokušaj ponovo učitati statistiku"
                    />
                  </View>
                ) : statsPending ? (
                  <>
                    <MetricSkeleton />
                    <MetricSkeleton />
                    <MetricSkeleton />
                  </>
                ) : (
                  <>
                    <MetricCell
                      value={formatPassportSummits(stats?.brojPopeoSe)}
                      label="OSVOJENO"
                      accent="#f59e0b"
                      accessibilityLabel={`${formatPassportSummits(stats?.brojPopeoSe)} osvojeno`}
                    />
                    <MetricCell
                      value={`${formatPassportKm(stats?.ukupnoKm)} km`}
                      label="KILOMETRI"
                      accent="#0ea5e9"
                      accessibilityLabel={`${formatPassportKm(stats?.ukupnoKm)} kilometara`}
                    />
                    <MetricCell
                      value={`${formatPassportAscentM(stats?.ukupnoMetaraUspona)} m`}
                      label="USPON"
                      accent={colors.brand}
                      accessibilityLabel={`${formatPassportAscentM(stats?.ukupnoMetaraUspona)} metara uspona`}
                    />
                  </>
                )}
              </View>

              {showPassportShortcut ? (
                <Pressable
                  style={styles.passportShortcut}
                  onPress={openSettings}
                  accessibilityRole="button"
                  accessibilityLabel="Planinarska legitimacija i članski podaci, privatno, otvori podešavanja"
                >
                  <View style={styles.passportTitleRow}>
                    <Text variant="label" style={styles.passportTitle}>
                      Planinarska legitimacija i članski podaci
                    </Text>
                    <View style={styles.privateBadge} accessibilityLabel={PRIVATE_PASSPORT_BADGE}>
                      <Ionicons name="lock-closed-outline" size={12} color="#065f46" />
                      <Text variant="small" style={styles.privateBadgeText}>
                        {PRIVATE_PASSPORT_BADGE}
                      </Text>
                    </View>
                  </View>
                  <Text variant="small" color={colors.textMuted} style={styles.passportBody}>
                    Legitimacija, markica i privatni članski podaci dostupni su samo vama i ovlašćenom klubu.
                  </Text>
                  <Text variant="label" style={styles.passportCta}>
                    Otvori podešavanja
                  </Text>
                </Pressable>
              ) : null}

              {isProfiGuide ? (
                <GuideExperienceCard
                  summary={readGuideRatingSummary(korisnik)}
                  guidedCount={vodioQuery.data?.length ?? 0}
                />
              ) : null}

              {showStepsCard ? (
                <View
                  style={styles.stepsCard}
                  accessibilityRole="summary"
                  accessibilityLabel={`Današnja aktivnost, ${dailySteps.todaySteps.toLocaleString('sr-RS')} koraka`}
                >
                  <Text variant="label" style={styles.stepsTitle}>
                    Današnja aktivnost
                  </Text>
                  <Text variant="title" style={styles.stepsValue}>
                    {dailySteps.todaySteps.toLocaleString('sr-RS')} koraka
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.actionsSection}>
              {showGuidedActionsTab ? (
                <View style={styles.toggleWrap}>
                  <ProfileActionsToggle
                    tab={actionsTab}
                    climbedCount={climbedPending || climbedFailed ? null : (popeoQuery.data?.length ?? 0)}
                    guidedCount={guidedPending || guidedFailed ? null : (vodioQuery.data?.length ?? 0)}
                    onChange={setActionsTab}
                  />
                </View>
              ) : null}

              {(() => {
                const showingGuided = showGuidedActionsTab && actionsTab === 'guided'
                const pending = showingGuided ? guidedPending : climbedPending
                const failed = showingGuided ? guidedFailed : climbedFailed
                const data = showingGuided ? (vodioQuery.data ?? []) : (popeoQuery.data ?? [])
                const hasCached = data.length > 0

                if (failed && !hasCached) {
                  return (
                    <View style={styles.sectionErrorWrap}>
                      <Text variant="small" color={colors.textMuted} style={styles.sectionErrorText}>
                        {getHistoryErrorCopy()}
                      </Text>
                      <Button
                        title="Pokušaj ponovo"
                        variant="secondary"
                        onPress={() =>
                          void (showingGuided ? vodioQuery.refetch() : popeoQuery.refetch())
                        }
                        accessibilityLabel="Pokušaj ponovo učitati planinarsku istoriju"
                      />
                    </View>
                  )
                }

                if (pending && !hasCached) {
                  return (
                    <View style={styles.actionsSkeleton} accessibilityRole="progressbar">
                      <ActivityIndicator color={colors.brand} />
                      <Text variant="small" color={colors.textMuted}>
                        Učitavanje istorije…
                      </Text>
                    </View>
                  )
                }

                if (data.length === 0) {
                  const copy = showingGuided ? getGuidedEmptyCopy(isMe) : getClimbedEmptyCopy(isMe)
                  return (
                    <EmptyState
                      icon="images-outline"
                      title={copy.title}
                      message={copy.body || undefined}
                      actionLabel={copy.ctaLabel ?? undefined}
                      onAction={copy.ctaLabel ? goFindActions : undefined}
                    />
                  )
                }

                return (
                  <ProfileActionGrid
                    actions={data}
                    onPressAction={goAction}
                    fullWidth
                    mode={showingGuided ? 'guided' : 'climbed'}
                  />
                )
              })()}
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

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.menuSheet} onPress={(e) => e.stopPropagation()}>
            {showOwnerMenu ? (
              <>
                <Pressable
                  style={styles.menuItem}
                  onPress={() => {
                    setMenuOpen(false)
                    openSettings()
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Podešavanja"
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
                  accessibilityRole="button"
                  accessibilityLabel="Odjavi me"
                >
                  <Ionicons name="log-out-outline" size={20} color={colors.danger} />
                  <Text variant="body" color={colors.danger}>
                    Odjavi me
                  </Text>
                </Pressable>
              </>
            ) : null}
            {showPublicOverflowMenu ? (
              <Pressable
                style={styles.menuItem}
                onPress={async () => {
                  setMenuOpen(false)
                  if (!blockStatusQuery.data?.blockedByMe) {
                    const ok = await showConfirm('Blokiraj korisnika', 'Da li ste sigurni?')
                    if (!ok) return
                  }
                  blockMutation.mutate()
                }}
                accessibilityRole="button"
                accessibilityLabel={
                  blockStatusQuery.data?.blockedByMe ? 'Odblokiraj korisnika' : 'Blokiraj korisnika'
                }
              >
                <Ionicons
                  name={blockStatusQuery.data?.blockedByMe ? 'lock-open-outline' : 'ban-outline'}
                  size={20}
                  color={colors.danger}
                />
                <Text variant="body" color={colors.danger}>
                  {blockStatusQuery.data?.blockedByMe ? 'Odblokiraj' : 'Blokiraj'}
                </Text>
              </Pressable>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {isMe ? (
        <>
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

function GuideExperienceCard({
  summary,
  guidedCount,
}: {
  summary: ReturnType<typeof readGuideRatingSummary>
  guidedCount: number
}) {
  const presentation = getGuideRatingPresentation(summary ?? undefined)
  const a11y = buildGuideExperienceA11yLabel({
    hasRatings: presentation.hasRatings,
    averageLabel: presentation.averageLabel,
    reviewCount: presentation.reviewCount,
    guidedCount,
  })

  return (
    <View
      style={styles.guideCard}
      accessibilityRole="summary"
      accessibilityLabel={a11y}
    >
      <Text variant="label" style={styles.guideCardTitle}>
        Vodičko iskustvo
      </Text>
      <View style={styles.guideCardRow}>
        <Ionicons name="star" size={16} color="#f59e0b" />
        {presentation.hasRatings && presentation.averageLabel ? (
          <Text variant="title" style={styles.guideRatingValue}>
            {presentation.averageLabel}
          </Text>
        ) : (
          <Text variant="small" color={colors.textMuted}>
            {presentation.emptyLabel}
          </Text>
        )}
      </View>
      {presentation.hasRatings ? (
        <Text variant="small" color={colors.textMuted}>
          {presentation.reviewCount} recenzija
        </Text>
      ) : null}
      {guidedCount > 0 ? (
        <Text variant="small" color={colors.textMuted}>
          {guidedCount} vođenih tura
        </Text>
      ) : null}
    </View>
  )
}

function MetricSkeleton() {
  return (
    <View style={styles.metricCell} accessibilityRole="progressbar">
      <View style={styles.metricSkeletonValue} />
      <View style={styles.metricSkeletonLabel} />
    </View>
  )
}

function MetricCell({
  value,
  label,
  accent,
  accessibilityLabel,
}: {
  value: string
  label: string
  accent: string
  accessibilityLabel: string
}) {
  return (
    <View style={styles.metricCell} accessibilityRole="text" accessibilityLabel={accessibilityLabel}>
      <Text variant="small" style={[styles.metricValue, { color: accent }]}>
        {value}
      </Text>
      <Text variant="small" color={colors.textMuted} style={styles.metricLabel}>
        {label}
      </Text>
    </View>
  )
}

const COVER_HEIGHT = 180

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
    width: 44,
    height: 44,
    borderRadius: 22,
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
    width: 44,
    height: 44,
    borderRadius: 22,
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
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  name: { fontSize: 18, lineHeight: 22 },
  profiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  profiBadgeText: { color: '#065f46', fontWeight: '800', fontSize: 10 },
  memberSinceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  clubRow: { marginTop: spacing.sm },
  noClubText: { marginTop: spacing.sm },
  clubBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    maxWidth: '100%',
    minHeight: 44,
  },
  clubLogo: { width: 16, height: 16, borderRadius: 2 },
  clubTextCol: { flexShrink: 1, minWidth: 0 },
  clubText: { color: '#6d28d9', fontWeight: '800', fontSize: 11 },
  clubSubtext: { color: '#7c3aed', fontSize: 10, marginTop: 1 },
  primaryActionsRow: { marginTop: spacing.md, minHeight: 44 },
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    gap: 2,
    flexShrink: 1,
  },
  rankNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
  metricSkeletonValue: {
    width: 40,
    height: 14,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  metricSkeletonLabel: {
    width: 52,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    marginTop: 6,
  },
  sectionErrorWrap: {
    flex: 1,
    width: '100%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionErrorText: { textAlign: 'center' },
  actionsSkeleton: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  passportShortcut: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    backgroundColor: '#ecfdf5',
    gap: 4,
  },
  passportTitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  passportTitle: { color: '#064e3b', fontWeight: '800', flexShrink: 1 },
  privateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  privateBadgeText: { color: '#065f46', fontWeight: '800', fontSize: 10 },
  passportBody: { lineHeight: 18 },
  passportCta: { marginTop: 6, color: colors.brand, fontWeight: '800' },
  guideCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    backgroundColor: colors.white,
    gap: 4,
  },
  guideCardTitle: { color: '#065f46', fontWeight: '800', letterSpacing: 0.6, fontSize: 10 },
  guideCardRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  guideRatingValue: { fontSize: 18 },
  stepsCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fafafa',
  },
  stepsTitle: { color: colors.textMuted, marginBottom: 4 },
  stepsValue: { fontSize: 18 },
  actionsSection: {
    backgroundColor: '#f8fafc',
    paddingTop: spacing.md,
  },
  toggleWrap: {
    paddingHorizontal: spacing.lg,
  },
})
