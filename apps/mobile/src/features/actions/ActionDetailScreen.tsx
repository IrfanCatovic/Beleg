import { useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import {
  cancelSignupRequest,
  fetchActionSignupRequests,
  fetchAkcijaById,
  fetchMojaPrijavaZaAkciju,
  fetchMojePrijave,
  fetchPrijaveZaAkciju,
  otkaziPrijavu,
  prijaviNaAkciju,
  respondToActionSignupRequest,
  updateMojaPrijava,
} from '@beleg/shared/services'
import { getApiErrorMessage } from '@beleg/shared'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import { Button, Card, ErrorView, Loader, Screen, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import { buildPrevozOccupancy, countActivePrijave } from '../../utils/actionDetails'
import type {
  ActionsStackParamList,
  ExploreStackParamList,
  HomeStackParamList,
  ProfileStackParamList,
} from '../../navigation/types'
import { ActionDetailHeader } from './detail/ActionDetailHeader'
import { ActionDetailStats } from './detail/ActionDetailStats'
import { ActionDetailInfo } from './detail/ActionDetailInfo'
import { ActionDetailLogistics } from './detail/ActionDetailLogistics'
import { ActionDetailPriceSummary } from './detail/ActionDetailPriceSummary'
import { ActionDetailMembers } from './detail/ActionDetailMembers'

type Props =
  | NativeStackScreenProps<ActionsStackParamList, 'ActionDetail'>
  | NativeStackScreenProps<HomeStackParamList, 'ActionDetail'>
  | NativeStackScreenProps<ProfileStackParamList, 'ActionDetail'>
  | NativeStackScreenProps<ExploreStackParamList, 'ActionDetail'>

function registrationErrorMessage(err: unknown): string {
  const msg = getApiErrorMessage(err, 'Čuvanje nije uspelo.')
  if (/popunjen|maksimalan|pun/i.test(msg)) {
    return 'Sva mesta su popunjena. Pokušajte kasnije ili izaberite drugu opciju.'
  }
  return msg
}

export default function ActionDetailScreen({ route }: Props) {
  const { id } = route.params
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { showConfirm, showAlert } = useModal()

  const [selSmestaj, setSelSmestaj] = useState<Set<number>>(new Set())
  const [selPrevoz, setSelPrevoz] = useState<Set<number>>(new Set())
  const [selRent, setSelRent] = useState<Record<number, number>>({})

  const detailQuery = useQuery({
    queryKey: ['akcija', id],
    queryFn: () => fetchAkcijaById(client, id),
  })

  const prijaveQuery = useQuery({
    queryKey: ['moje-prijave'],
    queryFn: () => fetchMojePrijave(client),
  })

  const mojaPrijavaQuery = useQuery({
    queryKey: ['moja-prijava', id],
    queryFn: () => fetchMojaPrijavaZaAkciju(client, id),
  })

  const membersQuery = useQuery({
    queryKey: ['akcija', id, 'prijave'],
    queryFn: () => fetchPrijaveZaAkciju(client, id),
  })

  const canTryHost =
    !!user && ['admin', 'sekretar', 'vodic', 'superadmin'].includes(user.role ?? '')

  const signupRequestsQuery = useQuery({
    queryKey: ['signup-requests', id],
    queryFn: () => fetchActionSignupRequests(client, id, 'pending'),
    enabled: canTryHost && !detailQuery.data?.isCompleted,
    retry: false,
  })

  const akcija = detailQuery.data
  const prijava = mojaPrijavaQuery.data?.prijava
  const pendingSignup = mojaPrijavaQuery.data?.signupRequest
  const isPendingSignup = pendingSignup?.status === 'pending'
  const isRegistered = prijava?.status === 'prijavljen'
  const logisticsDisabled =
    !!akcija?.isCompleted || isPendingSignup || (isRegistered && prijava?.status !== 'prijavljen')

  useEffect(() => {
    const source = prijava ?? (isPendingSignup ? pendingSignup : null)
    if (!source) return
    setSelSmestaj(new Set(source.selectedSmestajIds ?? []))
    const prev = source.selectedPrevozIds ?? []
    setSelPrevoz(prev.length ? new Set([prev[prev.length - 1]]) : new Set())
    const rent: Record<number, number> = {}
    for (const it of source.selectedRentItems ?? []) {
      if (it.rentId && it.kolicina > 0) rent[it.rentId] = it.kolicina
    }
    setSelRent(rent)
  }, [prijava, pendingSignup, isPendingSignup])

  const signedUp = (prijaveQuery.data?.prijavljeneAkcije ?? []).includes(id)
  const canCancel = (prijaveQuery.data?.otkaziveAkcije ?? []).includes(id)
  const pendingOnList = (prijaveQuery.data?.pendingSignupAkcije ?? []).includes(id)

  const payload = useMemo(() => {
    const selectedSmestajIds = Array.from(selSmestaj)
    const prevArr = Array.from(selPrevoz)
    const selectedPrevozIds = prevArr.length <= 1 ? prevArr : [prevArr[prevArr.length - 1]]
    const selectedRentItems = Object.entries(selRent)
      .map(([rentId, kolicina]) => ({ rentId: Number(rentId), kolicina }))
      .filter((x) => x.kolicina > 0)
    return { selectedSmestajIds, selectedPrevozIds, selectedRentItems }
  }, [selSmestaj, selPrevoz, selRent])

  const prevozOccupied = useMemo(
    () => buildPrevozOccupancy(membersQuery.data ?? []),
    [membersQuery.data],
  )

  const priceTotals = useMemo(() => {
    if (!akcija) return { smestaj: 0, prevoz: 0, rent: 0 }
    let smestaj = 0
    for (const s of akcija.smestaj ?? []) {
      if (selSmestaj.has(s.id)) smestaj += s.cenaPoOsobiUkupno
    }
    let prevoz = 0
    for (const p of akcija.prevoz ?? []) {
      if (selPrevoz.has(p.id)) prevoz += p.cenaPoOsobi
    }
    let rent = 0
    for (const r of akcija.opremaRent ?? []) {
      const qty = selRent[r.id] ?? 0
      if (qty > 0) rent += r.cenaPoSetu * qty
    }
    return { smestaj, prevoz, rent }
  }, [akcija, selSmestaj, selPrevoz, selRent])

  const invalidateRegistration = async () => {
    await queryClient.invalidateQueries({ queryKey: ['moje-prijave'] })
    await queryClient.invalidateQueries({ queryKey: ['moja-prijava', id] })
    await queryClient.invalidateQueries({ queryKey: ['akcija', id] })
    await queryClient.invalidateQueries({ queryKey: ['akcija', id, 'prijave'] })
    await queryClient.invalidateQueries({ queryKey: ['signup-requests', id] })
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isRegistered) return updateMojaPrijava(client, id, payload)
      return prijaviNaAkciju(client, id, payload)
    },
    onSuccess: async () => {
      await invalidateRegistration()
      await showAlert(
        'Uspeh',
        isRegistered ? 'Prijava je ažurirana.' : 'Zahtev za prijavu je poslat na odobrenje.',
      )
    },
    onError: (err) => showAlert('Greška', registrationErrorMessage(err)),
  })

  const otkaziMutation = useMutation({
    mutationFn: () => otkaziPrijavu(client, id),
    onSuccess: async () => {
      await invalidateRegistration()
      await showAlert('Uspeh', 'Prijava je otkazana.')
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Otkazivanje nije uspelo.')),
  })

  const cancelSignupMutation = useMutation({
    mutationFn: () => cancelSignupRequest(client, id),
    onSuccess: async () => {
      await invalidateRegistration()
      await showAlert('Uspeh', 'Zahtev za prijavu je otkazan.')
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Otkazivanje nije uspelo.')),
  })

  const respondSignupMutation = useMutation({
    mutationFn: ({ requestId, action }: { requestId: number; action: 'accept' | 'reject' }) =>
      respondToActionSignupRequest(client, id, requestId, action),
    onSuccess: async () => {
      await invalidateRegistration()
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Obrada zahteva nije uspela.')),
  })

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

  const locationSubtitle = [akcija.planina, akcija.vrh].filter(Boolean).join(' · ') || akcija.ferrataSnapshot?.lokacija || '—'
  const memberCount = countActivePrijave(membersQuery.data ?? [])
  const hostRequests = signupRequestsQuery.data ?? []

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll} nestedScrollEnabled>
        <ActionDetailHeader akcija={akcija} locationSubtitle={locationSubtitle} />

        <View style={styles.body}>
          <ActionDetailStats akcija={akcija} memberCount={memberCount} />
          <ActionDetailInfo akcija={akcija} />

          <ActionDetailLogistics
            akcija={akcija}
            selSmestaj={selSmestaj}
            selPrevoz={selPrevoz}
            selRent={selRent}
            prevozOccupied={prevozOccupied}
            disabled={logisticsDisabled}
            onToggleSmestaj={(sid) => {
              if (logisticsDisabled) return
              setSelSmestaj((prev) => {
                const next = new Set(prev)
                if (next.has(sid)) next.delete(sid)
                else next.add(sid)
                return next
              })
            }}
            onSelectPrevoz={(pid) => {
              if (logisticsDisabled) return
              setSelPrevoz(new Set([pid]))
            }}
            onChangeRent={(rid, delta, max) => {
              if (logisticsDisabled) return
              setSelRent((prev) => ({
                ...prev,
                [rid]: Math.max(0, Math.min(max, (prev[rid] ?? 0) + delta)),
              }))
            }}
          />

          <ActionDetailPriceSummary
            akcija={akcija}
            smestajTotal={priceTotals.smestaj}
            prevozTotal={priceTotals.prevoz}
            rentTotal={priceTotals.rent}
          />

          {hostRequests.length > 0 ? (
            <Card style={styles.hostCard}>
              <Text variant="heading">Zahtevi za prijavu</Text>
              {hostRequests.map((req) => {
                const name = req.requester.fullName?.trim() || req.requester.username
                return (
                  <View key={req.id} style={styles.hostRow}>
                    <View style={styles.hostRowText}>
                      <Text variant="label">{name}</Text>
                      <Text variant="small" color={colors.textMuted}>@{req.requester.username}</Text>
                    </View>
                    <View style={styles.hostActions}>
                      <Button
                        title="Odbij"
                        variant="ghost"
                        loading={respondSignupMutation.isPending}
                        onPress={() => respondSignupMutation.mutate({ requestId: req.id, action: 'reject' })}
                      />
                      <Button
                        title="Prihvati"
                        loading={respondSignupMutation.isPending}
                        onPress={() => respondSignupMutation.mutate({ requestId: req.id, action: 'accept' })}
                      />
                    </View>
                  </View>
                )
              })}
            </Card>
          ) : null}

          {akcija.prikaziListuPrijavljenih !== false ? (
            <ActionDetailMembers prijave={membersQuery.data ?? []} />
          ) : null}

          {isPendingSignup || isRegistered ? (
            <Card style={styles.block}>
              <Text variant="label">Vaša prijava</Text>
              <Text color={colors.textMuted}>
                Status: {isPendingSignup ? 'Na čekanju odobrenja' : prijava?.status || 'prijavljen'}
              </Text>
            </Card>
          ) : null}

          <View style={styles.actions}>
            {!akcija.isCompleted && !isRegistered && !isPendingSignup ? (
              <Button
                title="Pošalji zahtev za prijavu"
                loading={saveMutation.isPending}
                onPress={() => saveMutation.mutate()}
                fullWidth
              />
            ) : null}
            {!akcija.isCompleted && isRegistered ? (
              <Button
                title="Sačuvaj izbore"
                loading={saveMutation.isPending}
                onPress={() => saveMutation.mutate()}
                fullWidth
              />
            ) : null}
            {isPendingSignup ? (
              <Button
                title="Otkaži zahtev"
                variant="secondary"
                loading={cancelSignupMutation.isPending}
                onPress={async () => {
                  const ok = await showConfirm(
                    'Otkaži zahtev',
                    `Otkazati zahtev za prijavu na „${akcija.naziv}"?`,
                    { variant: 'danger', confirmLabel: 'Otkaži' },
                  )
                  if (ok) cancelSignupMutation.mutate()
                }}
                fullWidth
              />
            ) : null}
            {isRegistered && canCancel ? (
              <Button
                title="Otkaži prijavu"
                variant="secondary"
                loading={otkaziMutation.isPending}
                onPress={async () => {
                  const ok = await showConfirm(
                    'Otkaži prijavu',
                    `Da li ste sigurni da želite da otkažete prijavu na „${akcija.naziv}"?`,
                    { variant: 'danger', confirmLabel: 'Otkaži' },
                  )
                  if (ok) otkaziMutation.mutate()
                }}
                fullWidth
              />
            ) : null}
          </View>
        </View>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  body: { padding: spacing.lg },
  block: { marginBottom: spacing.md, gap: spacing.sm },
  hostCard: { marginBottom: spacing.md, gap: spacing.md, borderColor: '#fcd34d', backgroundColor: '#fffbeb' },
  hostRow: { gap: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  hostRowText: { gap: 2 },
  hostActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  actions: { marginTop: spacing.md, gap: spacing.sm },
})
