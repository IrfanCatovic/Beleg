import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import {
  buildActionInviteWhatsAppMessage,
  countActivePrijave,
  getApiErrorMessage,
  resolveActionInviteShareUrl,
} from '@beleg/shared'
import {
  deleteAkcija,
  fetchActionSignupRequests,
  fetchAkcijaById,
  fetchKlub,
  fetchMojaPrijavaZaAkciju,
  fetchMojePrijave,
  fetchPrijaveZaAkciju,
  respondToActionSignupRequest,
  zavrsiAkciju,
  dodajPrevoz,
} from '@beleg/shared/services'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import { Button, ErrorView, Loader, Screen } from '../../components/ui'
import { colors, spacing } from '../../theme'
import { buildPrevozOccupancy } from '../../utils/actionDetails'
import { canApproveSignupRequest, canManageHostAkcija } from '../../utils/canManageAkcija'
import { openWhatsAppWithMessage } from '../../utils/openWhatsApp'
import { generateActionPdfPrePolaska, generateActionPdfZavrsena } from '../../utils/actionPdf'
import type {
  ActionsStackParamList,
  ExploreStackParamList,
  HomeStackParamList,
  ProfileStackParamList,
} from '../../navigation/types'
import { ActionDetailHero } from './detail/ActionDetailHero'
import { ActionDetailStatsBar } from './detail/ActionDetailStatsBar'
import { ActionDetailMembershipBanner } from './detail/ActionDetailMembershipBanner'
import { ActionDetailDescription } from './detail/ActionDetailDescription'
import { ActionDetailAddTransportSheet } from './detail/ActionDetailAddTransportSheet'
import { ActionDetailExternalInvite } from './detail/ActionDetailExternalInvite'
import { ActionDetailLogistics } from './detail/ActionDetailLogistics'
import { ActionDetailPriceSummary } from './detail/ActionDetailPriceSummary'
import { ActionDetailShareRow } from './detail/ActionDetailShareRow'
import { ActionDetailMembersList } from './detail/ActionDetailMembersList'
import { ActionDetailMemberSheet } from './detail/ActionDetailMemberSheet'
import { ActionDetailSignupRequests } from './detail/ActionDetailSignupRequests'
import { ActionDetailPaymentSummary } from './detail/ActionDetailPaymentSummary'
import { ActionDetailHostPanel } from './detail/ActionDetailHostPanel'
import { ActionDetailBottomBar } from './detail/ActionDetailBottomBar'
import { ActionDetailFinishModal } from './detail/ActionDetailFinishModal'
import { GuideRatingModal } from './detail/GuideRatingModal'
import { ActionDetailInfo } from './detail/ActionDetailInfo'
import { useActionDetailRegistration } from './hooks/useActionDetailRegistration'
import { useActionDetailPayments } from './hooks/useActionDetailPayments'
import { useExternalInvite } from './hooks/useExternalInvite'
import { useGuideRatings } from './hooks/useGuideRatings'
import { invalidateActionQueries } from './hooks/invalidateActionQueries'
import { getWebBaseUrl } from '../../utils/webBaseUrl'
import { navigateToActionEdit } from '../../navigation/navigationRef'

type Props =
  | NativeStackScreenProps<ActionsStackParamList, 'ActionDetail'>
  | NativeStackScreenProps<HomeStackParamList, 'ActionDetail'>
  | NativeStackScreenProps<ProfileStackParamList, 'ActionDetail'>
  | NativeStackScreenProps<ExploreStackParamList, 'ActionDetail'>

export default function ActionDetailScreen({ route, navigation }: Props) {
  const { id, inviteToken } = route.params
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { showConfirm, showAlert } = useModal()

  const [finishOpen, setFinishOpen] = useState(false)
  const [finishError, setFinishError] = useState('')
  const [shareLoading, setShareLoading] = useState(false)
  const [shareCachedUrl, setShareCachedUrl] = useState('')
  const [addTransportOpen, setAddTransportOpen] = useState(false)

  const detailQuery = useQuery({
    queryKey: ['akcija', id, inviteToken ?? ''],
    queryFn: () => fetchAkcijaById(client, id, inviteToken),
  })

  const klubQuery = useQuery({
    queryKey: ['klub'],
    queryFn: () => fetchKlub(client),
    enabled: !!user,
  })

  const prijaveQuery = useQuery({
    queryKey: ['moje-prijave'],
    queryFn: () => fetchMojePrijave(client),
  })

  const mojaPrijavaQuery = useQuery({
    queryKey: ['moja-prijava', id],
    queryFn: () => fetchMojaPrijavaZaAkciju(client, id),
    enabled: !!user,
  })

  const membersQuery = useQuery({
    queryKey: ['akcija', id, 'prijave'],
    queryFn: () => fetchPrijaveZaAkciju(client, id),
    enabled: !!user,
  })

  const akcija = detailQuery.data
  const currency = klubQuery.data?.valuta || 'RSD'

  const manageCtx = akcija
    ? {
        klubId: akcija.klubId,
        organizatorTip: akcija.organizatorTip,
        vodicId: akcija.vodicId,
        vodicUsername: akcija.vodic?.username,
        addedByUsername: akcija.addedBy?.username,
      }
    : {}

  const canManageHost = canManageHostAkcija(user, manageCtx)
  const canApprove = canApproveSignupRequest(user, manageCtx)

  const signupRequestsQuery = useQuery({
    queryKey: ['signup-requests', id],
    queryFn: () => fetchActionSignupRequests(client, id, 'pending'),
    enabled: canApprove && !akcija?.isCompleted,
    retry: false,
  })

  const canCancel = (prijaveQuery.data?.otkaziveAkcije ?? []).includes(id)

  const registration = useActionDetailRegistration({
    actionId: id,
    akcija,
    user,
    inviteToken,
    mojaPrijavaData: mojaPrijavaQuery.data,
    canCancel,
    showAlert,
    showConfirm,
  })

  const payments = useActionDetailPayments({
    actionId: id,
    akcija,
    prijave: membersQuery.data ?? [],
    canManageHost,
    inviteToken,
    showAlert,
    showConfirm,
  })

  const guideRatings = useGuideRatings({
    actionId: id,
    user,
    akcija,
    mojaPrijava: mojaPrijavaQuery.data?.prijava ?? undefined,
    showAlert,
  })

  const externalInvite = useExternalInvite(id, !!(canManageHost && akcija?.isCompleted))

  const addTransportMutation = useMutation({
    mutationFn: (data: Parameters<typeof dodajPrevoz>[2]) => dodajPrevoz(client, id, data),
    onSuccess: async () => {
      setAddTransportOpen(false)
      await invalidateActionQueries(queryClient, id, inviteToken)
      await showAlert('Uspeh', 'Prevoz je dodat.')
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Dodavanje prevoza nije uspelo.')),
  })

  const canAddTransport =
    !!user && !akcija?.isCompleted && (canManageHost || registration.isRegistered)

  useFocusEffect(
    useCallback(() => {
      void detailQuery.refetch()
      if (user) {
        void membersQuery.refetch()
        void mojaPrijavaQuery.refetch()
      }
    }, [user]),
  )

  const respondSignupMutation = useMutation({
    mutationFn: ({ requestId, action }: { requestId: number; action: 'accept' | 'reject' }) =>
      respondToActionSignupRequest(client, id, requestId, action),
    onSuccess: async () => {
      await invalidateActionQueries(queryClient, id, inviteToken)
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Obrada zahteva nije uspela.')),
  })

  const finishMutation = useMutation({
    mutationFn: (rashod: number) => zavrsiAkciju(client, id, rashod),
    onSuccess: async (res) => {
      setFinishOpen(false)
      await invalidateActionQueries(queryClient, id, inviteToken)
      const tip = res.finansijeTip
      const neto = res.netoFinansije
      if (tip === 'uplata') {
        await showAlert('Uspeh', `Akcija završena. Uplata u klub: ${neto?.toLocaleString('sr-RS')} ${currency}`)
      } else if (tip === 'isplata') {
        await showAlert('Uspeh', `Akcija završena. Isplata iz kluba: ${Math.abs(neto ?? 0).toLocaleString('sr-RS')} ${currency}`)
      } else {
        await showAlert('Uspeh', 'Akcija je završena.')
      }
    },
    onError: (err) => setFinishError(getApiErrorMessage(err, 'Završetak nije uspeo.')),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteAkcija(client, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['akcije'] })
      navigation.goBack()
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Brisanje nije uspelo.')),
  })

  const handleShare = async () => {
    if (!akcija) return
    const webBaseUrl = getWebBaseUrl()
    if (!webBaseUrl) {
      await showAlert('Greška', 'Link za deljenje nije dostupan.')
      return
    }
    setShareLoading(true)
    try {
      const url = await resolveActionInviteShareUrl(client, {
        actionId: akcija.id,
        isPublic: !!akcija.javna,
        webBaseUrl,
        inviteToken,
        canManageHost,
        cachedUrl: shareCachedUrl,
      })
      setShareCachedUrl(url)
      await openWhatsAppWithMessage(buildActionInviteWhatsAppMessage(akcija.naziv, url))
    } catch (err) {
      await showAlert('Greška', getApiErrorMessage(err, 'Deljenje nije uspelo.'))
    } finally {
      setShareLoading(false)
    }
  }

  const openFinish = async () => {
    const neoznaceni = (membersQuery.data ?? []).filter((p) => p.status === 'prijavljen')
    if (neoznaceni.length > 0) {
      await showAlert('Nedostaju statusi', 'Označite sve članove kao popeo se ili nije uspeo pre završetka.')
      return
    }
    setFinishError('')
    setFinishOpen(true)
  }

  const handleDelete = async () => {
    const ok = await showConfirm('Obriši akciju', 'Da li ste sigurni?', { variant: 'danger', confirmLabel: 'Obriši' })
    if (ok) deleteMutation.mutate()
  }

  const handlePdfPrePolaska = async () => {
    if (!akcija) return
    try {
      const names = (membersQuery.data ?? [])
        .filter((p) => p.status !== 'otkazano')
        .map((p) => p.fullName || p.korisnik)
        .join(', ')
      await generateActionPdfPrePolaska({
        clubName: akcija.klubNaziv || '',
        naziv: akcija.naziv,
        planina: akcija.planina || '',
        vrh: akcija.vrh,
        datum: akcija.datum,
        opis: akcija.opis || '',
        tezina: akcija.tezina || '',
        vodicIme: akcija.vodic?.fullName || akcija.vodic?.username || '',
        addedBy: akcija.addedBy?.fullName || '',
        brojPolaznika: countActivePrijave(membersQuery.data ?? []),
        imenaPolaznika: names,
      })
    } catch {
      await showAlert('Greška', 'Generisanje PDF-a nije uspelo.')
    }
  }

  const handlePdfZavrsena = async () => {
    if (!akcija) return
    try {
      const active = (membersQuery.data ?? []).filter((p) => p.status === 'popeo se')
      await generateActionPdfZavrsena({
        clubName: akcija.klubNaziv || '',
        naziv: akcija.naziv,
        planina: akcija.planina || '',
        vrh: akcija.vrh,
        datum: akcija.datum,
        opis: akcija.opis || '',
        tezina: akcija.tezina || '',
        vodicIme: akcija.vodic?.fullName || akcija.vodic?.username || '',
        addedBy: akcija.addedBy?.fullName || '',
        brojPrijavljenih: membersQuery.data?.length ?? 0,
        brojUspesnoPopeli: active.length,
        imenaUspesnoPopeli: active.map((p) => p.fullName || p.korisnik).join(', '),
      })
    } catch {
      await showAlert('Greška', 'Generisanje PDF-a nije uspelo.')
    }
  }

  if (detailQuery.isLoading) {
    return (
      <Screen edges={['left', 'right']}>
        <Loader />
      </Screen>
    )
  }

  if (detailQuery.isError || !akcija) {
    return (
      <Screen edges={['left', 'right']}>
        <ErrorView message="Akcija nije učitana." onRetry={() => detailQuery.refetch()} />
      </Screen>
    )
  }

  const locationSubtitle =
    [akcija.planina, akcija.vrh].filter(Boolean).join(' · ') ||
    akcija.ferrataSnapshot?.lokacija ||
    '—'
  const memberCount = countActivePrijave(membersQuery.data ?? [])
  const prevozOccupied = buildPrevozOccupancy(membersQuery.data ?? [])
  const showPriceBanner =
    !!user && (akcija.cenaClan != null || akcija.cenaOstali != null)
  const showMembers = akcija.prikaziListuPrijavljenih !== false && !!user
  const bottomPad = spacing.xxl + 100

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]} nestedScrollEnabled>
        <ActionDetailHero
          akcija={akcija}
          locationSubtitle={locationSubtitle}
          onBack={() => navigation.goBack()}
        />

        <ActionDetailStatsBar akcija={akcija} memberCount={memberCount} />

        <View style={styles.body}>
          <ActionDetailMembershipBanner
            akcija={akcija}
            isClan={registration.isClan}
            isActionHost={canManageHost}
            currency={currency}
            visible={showPriceBanner}
          />

          <ActionDetailDescription opis={akcija.opis} />
          <ActionDetailInfo akcija={akcija} />

          {user && !akcija.isCompleted ? (
            <ActionDetailLogistics
              akcija={akcija}
              selSmestaj={registration.selSmestaj}
              selPrevoz={registration.selPrevoz}
              selRent={registration.selRent}
              prevozOccupied={prevozOccupied}
              disabled={registration.logisticsDisabled}
              showAddTransport={canAddTransport}
              onAddTransport={() => setAddTransportOpen(true)}
              onToggleSmestaj={(sid) => {
                if (registration.logisticsDisabled) return
                registration.markDirty()
                registration.setSelSmestaj((prev) => {
                  const next = new Set(prev)
                  if (next.has(sid)) next.delete(sid)
                  else next.add(sid)
                  return next
                })
              }}
              onSelectPrevoz={(pid) => {
                if (registration.logisticsDisabled) return
                registration.markDirty()
                registration.setSelPrevoz(new Set([pid]))
              }}
              onChangeRent={(rid, delta, max) => {
                if (registration.logisticsDisabled) return
                registration.markDirty()
                registration.setSelRent((prev) => ({
                  ...prev,
                  [rid]: Math.max(0, Math.min(max, (prev[rid] ?? 0) + delta)),
                }))
              }}
            />
          ) : null}

          {user ? (
            <ActionDetailPriceSummary
              baseCena={registration.baseCena}
              smestajTotal={registration.priceTotals.smestaj}
              prevozTotal={registration.priceTotals.prevoz}
              rentTotal={registration.priceTotals.rent}
              total={registration.totalPrice}
              currency={currency}
              serverSaldo={akcija.mojSaldo}
            />
          ) : null}

          <ActionDetailShareRow
            akcija={akcija}
            canManageHost={canManageHost}
            inviteToken={inviteToken}
            onError={(msg) => void showAlert('Greška', msg)}
          />

          {showMembers ? (
            <ActionDetailMembersList
              prijave={membersQuery.data ?? []}
              akcija={akcija}
              currency={currency}
              canManageHost={canManageHost}
              onPressMember={payments.setSelectedMember}
            />
          ) : null}

          {canManageHost && akcija.isCompleted ? (
            <ActionDetailExternalInvite
              state={externalInvite}
              onCancelRequest={(requestId) => {
                const req = externalInvite.requests.find((r: { id: number }) => r.id === requestId)
                if (req) void externalInvite.cancelRequest(req)
              }}
            />
          ) : null}

          {canApprove ? (
            <ActionDetailSignupRequests
              requests={signupRequestsQuery.data ?? []}
              akcija={akcija}
              loading={respondSignupMutation.isPending}
              onRespond={(requestId, action) => respondSignupMutation.mutate({ requestId, action })}
            />
          ) : null}

          {canManageHost && !akcija.isCompleted ? (
            <ActionDetailPaymentSummary
              paidCount={payments.paidCount}
              totalCount={payments.tracked.length}
              paidTotal={payments.paidTotal}
              expectedTotal={payments.expectedTotal}
              currency={currency}
              onBulkMarkPaid={() => void payments.bulkMarkPaid()}
            />
          ) : null}

          <ActionDetailHostPanel
            akcija={akcija}
            canManageHost={canManageHost}
            onFinish={() => void openFinish()}
            onEdit={() => navigateToActionEdit(id)}
            onDelete={() => void handleDelete()}
            onPdfPrePolaska={() => void handlePdfPrePolaska()}
            onPdfZavrsena={() => void handlePdfZavrsena()}
            onShare={() => void handleShare()}
            loading={deleteMutation.isPending || shareLoading}
          />

          {guideRatings.canShowGuideRatingPrompt ? (
            <Button
              title={`Oceni vodiča (${guideRatings.guideRatingGuideName})`}
              variant="secondary"
              onPress={() => guideRatings.setGuideRatingOpen(true)}
              fullWidth
            />
          ) : null}
          {guideRatings.guideRatingSubmitted ? (
            <Button title="Hvala na oceni vodiča" variant="ghost" disabled fullWidth />
          ) : null}
        </View>
      </ScrollView>

      <ActionDetailBottomBar
        visible={!!user}
        isPendingSignup={registration.isPendingSignup}
        isRegistered={registration.isRegistered}
        isCompleted={!!akcija.isCompleted}
        canCancel={canCancel}
        saving={registration.saveMutation.isPending}
        onSave={() => registration.saveMutation.mutate()}
        onCancelSignup={() => void registration.handleCancelSignup()}
        onCancelPrijava={() => void registration.handleCancelPrijava()}
      />

      <ActionDetailMemberSheet
        visible={payments.selectedMember != null}
        member={payments.selectedMember}
        akcija={akcija}
        currency={currency}
        canManageHost={canManageHost}
        showPaymentControls={canManageHost && !akcija.isCompleted}
        loading={
          payments.togglePlatioMutation.isPending ||
          payments.statusMutation.isPending ||
          payments.deleteMutation.isPending
        }
        onClose={() => payments.setSelectedMember(null)}
        onTogglePayment={(platio) => {
          if (!payments.selectedMember) return
          payments.togglePlatioMutation.mutate({
            prijavaId: payments.selectedMember.id,
            platio,
          })
        }}
        onStatusChange={(status) => {
          if (!payments.selectedMember) return
          payments.statusMutation.mutate({ prijavaId: payments.selectedMember.id, status })
        }}
        onRemove={() => {
          if (payments.selectedMember) void payments.handleRemoveMember(payments.selectedMember)
        }}
      />

      <ActionDetailFinishModal
        visible={finishOpen}
        currency={currency}
        prihodUkupan={payments.paidTotal}
        skipClubFinances={akcija.organizatorTip === 'vodic'}
        loading={finishMutation.isPending}
        error={finishError}
        onClose={() => setFinishOpen(false)}
        onConfirm={(rashod) => finishMutation.mutate(rashod)}
      />

      <GuideRatingModal
        visible={guideRatings.guideRatingOpen && guideRatings.canShowGuideRatingPrompt}
        guideName={guideRatings.guideRatingGuideName}
        saving={guideRatings.guideRatingSaving}
        onClose={() => guideRatings.setGuideRatingOpen(false)}
        onSkip={() => void guideRatings.handleGuideRatingSkip()}
        onSubmit={(payload) => void guideRatings.handleGuideRatingSubmit(payload)}
      />

      <ActionDetailAddTransportSheet
        visible={addTransportOpen}
        currency={currency}
        loading={addTransportMutation.isPending}
        onClose={() => setAddTransportOpen(false)}
        onSubmit={(data) => addTransportMutation.mutate(data)}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: {},
  body: { padding: spacing.lg },
})
