import { useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { Task } from '@beleg/shared'
import { Ionicons } from '@expo/vector-icons'
import { getApiErrorMessage } from '@beleg/shared'
import {
  fetchActionSignupRequestById,
  respondToActionSignupRequest,
} from '@beleg/shared/services'
import {
  fetchClubJoinRequests,
  fetchObavestenjeById,
  fetchParticipationRequestById,
  fetchZadatakById,
  markObavestenjeRead,
  respondClubJoinRequest,
  respondParticipationRequest,
} from '@beleg/shared/services'
import {
  ferrataGuideBookingToWizardParams,
  peakGuideBookingToWizardParams,
} from '@beleg/shared'
import {
  canGuideCreateActionFromBooking,
  canGuideCreateActionFromPeakBooking,
  getFerrataGuideBooking,
  getPeakGuideBooking,
  guideBookingBlockedMessage,
  peakGuideBookingBlockedMessage,
  rejectFerrataGuideBooking,
  rejectPeakGuideBooking,
} from '@beleg/shared/services'
import type { FerrataGuideBookingPublic, PeakGuideBookingPublic } from '@beleg/shared/services'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import { TaskCard } from '../../components/tasks/TaskCard'
import { TaskFormModal } from '../../components/tasks/TaskFormModal'
import { Avatar, Button, Card, ErrorView, Loader, Screen, Text } from '../../components/ui'
import { canManageClub } from '../../utils/roles'
import { invalidateActionQueries } from '../actions/hooks/invalidateActionQueries'
import { canSeeTask } from '../../utils/taskPermissions'
import { useTaskActions } from '../tasks/useTaskActions'
import { guideBookingLabels } from '../../utils/guideBookingLabels'
import { colors, spacing } from '../../theme'
import type { HomeStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<HomeStackParamList, 'NotificationDetail'>

interface ParsedMeta {
  akcijaId?: number
  actionId?: number
  requestId?: number
  userId?: number
  username?: string
  zadatakId?: number
  clubJoinRequestId?: number
  requesterUsername?: string
  requesterFullName?: string
  bookingRequestId?: number
  bookingKind?: string
}

function parseMetadata(metadata?: string): ParsedMeta {
  if (!metadata) return {}
  try {
    return JSON.parse(metadata) as ParsedMeta
  } catch {
    return {}
  }
}

function friendlyLinkLabel(link?: string): string | null {
  if (!link) return null
  const path = link.replace(/^https?:\/\/[^/]+/i, '').split('?')[0]
  if (path === '/klub' || path.startsWith('/klub')) return 'Stranica kluba'
  if (path.startsWith('/akcije')) return 'Lista akcija'
  if (path.startsWith('/profil')) return 'Profil korisnika'
  if (path.startsWith('/zadaci')) return 'Zadaci kluba'
  if (path.startsWith('/finansije')) return 'Finansije kluba'
  return 'Otvori u aplikaciji'
}

export default function NotificationDetailScreen({ route, navigation }: Props) {
  const { t } = useTranslation('notifications')
  const { id } = route.params
  const { user } = useAuth()
  const { showAlert, showConfirm } = useModal()
  const queryClient = useQueryClient()
  const [editTask, setEditTask] = useState<Task | null>(null)

  const {
    handleTake,
    handleLeave,
    handleFinish,
    handleDelete,
    handleUpdate,
    isLoading,
    isFormSubmitting,
  } = useTaskActions()

  const detailQuery = useQuery({
    queryKey: ['obavestenje', id],
    queryFn: () => fetchObavestenjeById(client, id),
  })

  const meta = useMemo(() => parseMetadata(detailQuery.data?.metadata), [detailQuery.data?.metadata])
  const zadatakId = meta.zadatakId
  const clubJoinRequestId = meta.clubJoinRequestId
  const signupRequestId = meta.requestId
  const signupAkcijaId = meta.akcijaId ?? meta.actionId
  const isSignupNotification = detailQuery.data?.type === 'action_signup_request'
  const isParticipationNotification = detailQuery.data?.type === 'action_participation_request'
  const isGuideBookingNotification = detailQuery.data?.type === 'guide_booking_request'
  const participationRequestId = isParticipationNotification ? meta.requestId : undefined
  const bookingRequestId = meta.bookingRequestId
  const bookingKind = meta.bookingKind === 'peak' ? 'peak' : 'ferrata'

  const guideBookingQuery = useQuery({
    queryKey: ['guide-booking', bookingKind, bookingRequestId],
    queryFn: async () => {
      if (bookingKind === 'peak') {
        return { kind: 'peak' as const, booking: await getPeakGuideBooking(client, bookingRequestId!) }
      }
      return { kind: 'ferrata' as const, booking: await getFerrataGuideBooking(client, bookingRequestId!) }
    },
    enabled: isGuideBookingNotification && bookingRequestId != null,
  })

  const rejectGuideBookingMutation = useMutation({
    mutationFn: async () => {
      if (!bookingRequestId) throw new Error('missing')
      if (bookingKind === 'peak') return rejectPeakGuideBooking(client, bookingRequestId)
      return rejectFerrataGuideBooking(client, bookingRequestId)
    },
    onSuccess: async () => {
      await markObavestenjeRead(client, id)
      void queryClient.invalidateQueries({ queryKey: ['obavestenja'] })
      void guideBookingQuery.refetch()
      await showAlert('Gotovo', 'Zahtev je odbijen.')
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Odbijanje nije uspelo.')),
  })

  const signupRequestQuery = useQuery({
    queryKey: ['signup-request', signupAkcijaId, signupRequestId],
    queryFn: () => fetchActionSignupRequestById(client, signupAkcijaId!, signupRequestId!),
    enabled: isSignupNotification && signupAkcijaId != null && signupRequestId != null,
  })

  const respondSignupMutation = useMutation({
    mutationFn: (action: 'accept' | 'reject') =>
      respondToActionSignupRequest(client, signupAkcijaId!, signupRequestId!, action),
    onSuccess: async (_data, action) => {
      await markObavestenjeRead(client, id)
      void queryClient.invalidateQueries({ queryKey: ['obavestenja'] })
      if (signupAkcijaId != null) {
        await invalidateActionQueries(queryClient, signupAkcijaId)
      }
      void signupRequestQuery.refetch()
      await showAlert('Gotovo', action === 'accept' ? 'Prijava je odobrena.' : 'Zahtev je odbijen.')
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Obrada nije uspela.')),
  })

  const participationRequestQuery = useQuery({
    queryKey: ['participation-request', participationRequestId],
    queryFn: () => fetchParticipationRequestById(client, participationRequestId!),
    enabled: isParticipationNotification && participationRequestId != null,
  })

  const respondParticipationMutation = useMutation({
    mutationFn: (decision: 'accept' | 'reject') =>
      respondParticipationRequest(client, participationRequestId!, decision),
    onSuccess: async (data, decision) => {
      await markObavestenjeRead(client, id)
      void queryClient.invalidateQueries({ queryKey: ['obavestenja'] })
      void participationRequestQuery.refetch()
      await showAlert(
        t('participationSuccessTitle'),
        data.message ||
          (decision === 'accept' ? t('participationAccepted') : t('participationRejected')),
      )
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, t('participationError'))),
  })

  const taskQuery = useQuery({
    queryKey: ['zadatak', zadatakId],
    queryFn: () => fetchZadatakById(client, zadatakId!),
    enabled: zadatakId != null,
  })

  const task = taskQuery.data
  const canSeeLinkedTask = task ? canSeeTask(task, user?.role) : false

  const joinRequestsQuery = useQuery({
    queryKey: ['klub', 'join-requests', 'notification'],
    queryFn: () => fetchClubJoinRequests(client, 'pending'),
    enabled: clubJoinRequestId != null && canManageClub(user, user?.klubId ?? undefined),
  })

  const joinRequest = useMemo(
    () => joinRequestsQuery.data?.find((r) => r.id === clubJoinRequestId),
    [joinRequestsQuery.data, clubJoinRequestId],
  )

  const respondMutation = useMutation({
    mutationFn: (action: 'accept' | 'reject' | 'block') =>
      respondClubJoinRequest(client, clubJoinRequestId!, action),
    onSuccess: async (_data, action) => {
      await markObavestenjeRead(client, id)
      void queryClient.invalidateQueries({ queryKey: ['obavestenja'] })
      void queryClient.invalidateQueries({ queryKey: ['klub', 'join-requests'] })
      const msg =
        action === 'accept'
          ? 'Korisnik je prihvaćen u klub.'
          : action === 'reject'
            ? 'Zahtev je odbijen.'
            : 'Korisnik je blokiran.'
      await showAlert('Gotovo', msg)
      navigation.goBack()
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Akcija nije uspela.')),
  })

  if (detailQuery.isLoading) {
    return (
      <Screen edges={['left', 'right']}>
        <Loader />
      </Screen>
    )
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <Screen edges={['left', 'right']}>
        <ErrorView message={t('loadError')} onRetry={() => detailQuery.refetch()} />
      </Screen>
    )
  }

  const item = detailQuery.data
  const actionId = meta.akcijaId ?? meta.actionId
  const userTarget = meta.username || meta.requesterUsername || (meta.userId ? String(meta.userId) : undefined)
  const displayName =
    joinRequest?.fullName ||
    meta.requesterFullName ||
    joinRequest?.username ||
    meta.requesterUsername ||
    userTarget
  const linkLabel = friendlyLinkLabel(item.link)
  const canRespondJoin =
    !!joinRequest &&
    joinRequest.status === 'pending' &&
    canManageClub(user, user?.klubId ?? undefined)
  const joinHandled = clubJoinRequestId != null && !joinRequest && !joinRequestsQuery.isLoading

  const openAllTasks = () => {
    navigation.getParent()?.navigate('ClubTab', { screen: 'Tasks' })
  }

  const handleAcceptGuideBooking = async () => {
    const data = guideBookingQuery.data
    if (!data) return
    const canRespond =
      data.kind === 'peak'
        ? canGuideCreateActionFromPeakBooking(data.booking as PeakGuideBookingPublic)
        : canGuideCreateActionFromBooking(data.booking as FerrataGuideBookingPublic)
    if (!canRespond) {
      const msg =
        data.kind === 'peak'
          ? peakGuideBookingBlockedMessage(data.booking as PeakGuideBookingPublic)
          : guideBookingBlockedMessage(data.booking as FerrataGuideBookingPublic)
      await showAlert('Zahtev za vođenje', msg)
      return
    }
    const params =
      data.kind === 'peak'
        ? peakGuideBookingToWizardParams(data.booking as PeakGuideBookingPublic)
        : ferrataGuideBookingToWizardParams(data.booking as FerrataGuideBookingPublic)
    navigation.getParent()?.navigate('ActionsTab', { screen: 'ActionWizard', params })
  }

  const guideBooking = guideBookingQuery.data?.booking
  const guideBookingKind = guideBookingQuery.data?.kind

  return (
    <Screen scroll edges={['left', 'right']}>
      <Text variant="title" style={styles.title}>
        {item.title}
      </Text>
      <Text style={styles.body}>{item.body}</Text>
      <Text variant="small" style={styles.date}>
        {new Date(item.createdAt).toLocaleString('sr-RS')}
      </Text>

      {isSignupNotification ? (
        <Card style={styles.signupCard}>
          <Text variant="label">Zahtev za prijavu na akciju</Text>
          {signupRequestQuery.isLoading ? <Loader /> : null}
          {signupRequestQuery.data ? (
            <>
              <Text variant="label">
                {signupRequestQuery.data.requester.fullName?.trim() ||
                  signupRequestQuery.data.requester.username}
              </Text>
              <Text variant="small" color={colors.textMuted}>
                @{signupRequestQuery.data.requester.username}
              </Text>
              {signupRequestQuery.data.status === 'pending' ? (
                <View style={styles.joinActions}>
                  <Button
                    title="Prihvati prijavu"
                    onPress={() => respondSignupMutation.mutate('accept')}
                    loading={respondSignupMutation.isPending}
                  />
                  <Button
                    title="Odbij"
                    variant="secondary"
                    onPress={async () => {
                      const ok = await showConfirm('Odbij zahtev', 'Odbiti zahtev za prijavu?')
                      if (ok) respondSignupMutation.mutate('reject')
                    }}
                    loading={respondSignupMutation.isPending}
                  />
                </View>
              ) : (
                <Text variant="small" color={colors.textMuted}>
                  Status: {signupRequestQuery.data.status}
                </Text>
              )}
            </>
          ) : null}
          {signupAkcijaId ? (
            <Button
              title="Pogledaj akciju"
              variant="secondary"
              onPress={() => navigation.navigate('ActionDetail', { id: signupAkcijaId })}
            />
          ) : null}
        </Card>
      ) : null}

      {isParticipationNotification ? (
        <Card style={styles.participationCard}>
          <Text variant="label">{t('participationTitle')}</Text>
          {participationRequestQuery.isLoading ? <Loader /> : null}
          {participationRequestQuery.data ? (
            <>
              <Text variant="heading">{participationRequestQuery.data.action.naziv}</Text>
              <Text color={colors.textMuted}>
                {participationRequestQuery.data.requestedBy.fullName?.trim() ||
                  participationRequestQuery.data.requestedBy.username}
                {participationRequestQuery.data.requestedBy.klubNaziv
                  ? ` · ${participationRequestQuery.data.requestedBy.klubNaziv}`
                  : ''}
              </Text>
              <Text variant="small" color={colors.textMuted}>
                {t('participationActionDate', {
                  date: new Date(participationRequestQuery.data.action.datum).toLocaleDateString('sr-RS'),
                })}
                {participationRequestQuery.data.action.klubNaziv
                  ? t('participationHomeClub', { name: participationRequestQuery.data.action.klubNaziv })
                  : ''}
              </Text>
              <Text variant="small" color={colors.textMuted}>
                {t('statusLabel', {
                  status:
                    participationRequestQuery.data.status === 'pending'
                      ? t('participationStatusPending')
                      : participationRequestQuery.data.status === 'accepted'
                        ? t('participationStatusAccepted')
                        : participationRequestQuery.data.status === 'rejected'
                          ? t('participationStatusRejected')
                          : t('participationStatusCancelled'),
                })}
              </Text>
              <Text variant="small" style={styles.participationInfo}>
                {t('participationInfo')}
              </Text>
              {participationRequestQuery.data.status === 'pending' ? (
                <View style={styles.joinActions}>
                  <Button
                    title={t('participationConfirm')}
                    onPress={() => respondParticipationMutation.mutate('accept')}
                    loading={respondParticipationMutation.isPending}
                  />
                  <Button
                    title={t('reject')}
                    variant="secondary"
                    onPress={async () => {
                      const ok = await showConfirm(t('participationRejectTitle'), t('participationRejectMessage'))
                      if (ok) respondParticipationMutation.mutate('reject')
                    }}
                    loading={respondParticipationMutation.isPending}
                  />
                </View>
              ) : null}
            </>
          ) : null}
          {participationRequestQuery.data?.action.id ? (
            <Button
              title={t('viewAction')}
              variant="secondary"
              onPress={() =>
                navigation.navigate('ActionDetail', { id: participationRequestQuery.data!.action.id })
              }
            />
          ) : null}
        </Card>
      ) : null}

      {isGuideBookingNotification && guideBooking ? (
        <Card style={styles.signupCard}>
          <Text variant="label">Zahtev za vođenje</Text>
          <Text variant="heading">
            {guideBookingKind === 'peak'
              ? (guideBooking as PeakGuideBookingPublic).peak.naziv
              : (guideBooking as FerrataGuideBookingPublic).ferrata.naziv}
          </Text>
          <Text color={colors.textMuted}>
            {guideBooking.requester.fullName?.trim() || guideBooking.requester.username}
            {guideBooking.requester.klubNaziv ? ` · ${guideBooking.requester.klubNaziv}` : ''}
          </Text>
          <Text variant="small">Datum: {guideBooking.desiredDate}{guideBooking.dateFlexible ? ' (fleksibilan)' : ''}</Text>
          <Text variant="small">Vreme: {guideBookingLabels(guideBooking).timeOfDay}</Text>
          <Text variant="small">Broj osoba: {guideBooking.numberOfPeople}</Text>
          <Text variant="small">Telefon: {guideBooking.contactPhone}</Text>
          {guideBooking.additionalMessage?.trim() ? (
            <Text variant="small" color={colors.textMuted}>{guideBooking.additionalMessage.trim()}</Text>
          ) : null}
          {guideBooking.guideResponse?.status ? (
            <Text variant="small" color={colors.textMuted}>
              Status: {guideBooking.guideResponse.status}
            </Text>
          ) : null}
          {guideBooking.guideResponse?.canRespond ? (
            <View style={styles.joinActions}>
              <Button
                title="Prihvati"
                onPress={() => void handleAcceptGuideBooking()}
              />
              <Button
                title="Odbij"
                variant="secondary"
                onPress={async () => {
                  const ok = await showConfirm('Odbij zahtev', 'Da li želite da odbijete ovaj zahtev?')
                  if (ok) rejectGuideBookingMutation.mutate()
                }}
                loading={rejectGuideBookingMutation.isPending}
              />
            </View>
          ) : null}
          {guideBooking.guideResponse?.status === 'accepted' && guideBooking.guideResponse.actionId ? (
            <Button
              title="Otvori akciju"
              variant="secondary"
              onPress={() =>
                navigation.getParent()?.navigate('ActionsTab', {
                  screen: 'ActionDetail',
                  params: { id: guideBooking.guideResponse!.actionId! },
                })
              }
            />
          ) : null}
        </Card>
      ) : null}

      {clubJoinRequestId ? (
        <Card style={styles.card}>
          <Text variant="label">Zahtev za članstvo</Text>
          {displayName ? (
            <View style={styles.userRow}>
              <Avatar uri={undefined} name={displayName} size={48} />
              <View style={styles.userInfo}>
                <Text variant="label">{displayName}</Text>
                {joinRequest?.username || meta.requesterUsername ? (
                  <Text variant="small" color={colors.textMuted}>
                    @{joinRequest?.username || meta.requesterUsername}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : (
            <Text color={colors.textMuted}>Korisnik je poslao zahtev za prijem u klub.</Text>
          )}

          {canRespondJoin ? (
            <View style={styles.joinActions}>
              <Button
                title="Prihvati u klub"
                onPress={async () => {
                  const ok = await showConfirm('Prihvati zahtev', `Prihvatiti ${displayName} u klub?`)
                  if (ok) respondMutation.mutate('accept')
                }}
                loading={respondMutation.isPending}
              />
              <Button
                title="Odbij"
                variant="secondary"
                onPress={async () => {
                  const ok = await showConfirm('Odbij zahtev', 'Odbiti zahtev za članstvo?')
                  if (ok) respondMutation.mutate('reject')
                }}
                loading={respondMutation.isPending}
              />
            </View>
          ) : null}

          {joinHandled ? (
            <Text variant="small" color={colors.textMuted}>
              Ovaj zahtev je već obrađen ili više nije aktivan.
            </Text>
          ) : null}
        </Card>
      ) : null}

      {zadatakId != null ? (
        <View style={styles.links}>
          {taskQuery.isLoading ? <Loader /> : null}
          {taskQuery.isError ? (
            <Card style={styles.card}>
              <Text color={colors.textMuted}>
                {getApiErrorMessage(taskQuery.error, 'Zadatak nije učitan.')}
              </Text>
              <Button title="Pokušaj ponovo" variant="secondary" onPress={() => taskQuery.refetch()} />
            </Card>
          ) : null}
          {task && canSeeLinkedTask ? (
            <>
              <TaskCard
                task={task}
                username={user?.username}
                userRole={user?.role}
                onTake={handleTake}
                onLeave={handleLeave}
                onFinish={handleFinish}
                onEdit={setEditTask}
                onDelete={handleDelete}
                isLoading={isLoading}
              />
              <Button title="Otvori sve zadatke" variant="secondary" onPress={openAllTasks} />
            </>
          ) : null}
          {task && !canSeeLinkedTask ? (
            <Card style={styles.card}>
              <Text color={colors.textMuted}>Nemaš dozvolu da vidiš ovaj zadatak.</Text>
            </Card>
          ) : null}
        </View>
      ) : null}

      <View style={styles.links}>
        {actionId ? (
          <Card style={styles.card}>
            <View style={styles.linkRow}>
              <Ionicons name="trail-sign-outline" size={20} color={colors.brand} />
              <Text variant="label">Povezana akcija</Text>
            </View>
            <Button
              title="Pogledaj akciju"
              variant="secondary"
              onPress={() => navigation.navigate('ActionDetail', { id: actionId })}
            />
          </Card>
        ) : null}

        {userTarget && !clubJoinRequestId ? (
          <Card style={styles.card}>
            <View style={styles.linkRow}>
              <Ionicons name="person-outline" size={20} color={colors.brand} />
              <Text variant="label">Korisnik</Text>
            </View>
            <Button
              title="Otvori profil"
              variant="secondary"
              onPress={() =>
                navigation.navigate('UserProfile', {
                  username: meta.username || meta.requesterUsername,
                  id: meta.userId,
                })
              }
            />
          </Card>
        ) : null}

        {linkLabel && !clubJoinRequestId ? (
          <Card style={styles.card}>
            <View style={styles.linkRow}>
              <Ionicons name="open-outline" size={20} color={colors.brand} />
              <Text variant="label">{linkLabel}</Text>
            </View>
            <Text variant="small" color={colors.textMuted}>
              Otvori odgovarajući deo aplikacije iz donjeg menija.
            </Text>
          </Card>
        ) : null}
      </View>

      <TaskFormModal
        mode="edit"
        visible={editTask != null}
        task={editTask}
        onClose={() => setEditTask(null)}
        onSubmit={handleUpdate}
        submitting={isFormSubmitting}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  title: { marginBottom: spacing.md },
  body: { marginBottom: spacing.sm },
  date: { marginBottom: spacing.lg, color: colors.textMuted },
  links: { gap: spacing.md },
  card: { gap: spacing.sm },
  signupCard: { gap: spacing.sm, marginBottom: spacing.md, borderColor: '#fcd34d', backgroundColor: '#fffbeb' },
  participationCard: { gap: spacing.sm, marginBottom: spacing.md, borderColor: '#fcd34d', backgroundColor: '#fffbeb' },
  participationInfo: {
    marginTop: spacing.xs,
    padding: spacing.sm,
    borderRadius: 8,
    backgroundColor: '#fef3c7',
    color: colors.text,
  },
  userRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  userInfo: { flex: 1, gap: 2 },
  joinActions: { gap: spacing.sm, marginTop: spacing.sm },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
})
