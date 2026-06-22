import { useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import {
  fetchAkcijaById,
  fetchMojaPrijavaZaAkciju,
  fetchMojePrijave,
  fetchPrijaveZaAkciju,
  otkaziPrijavu,
  prijaviNaAkciju,
  updateMojaPrijava,
} from '@beleg/shared/services'
import { getApiErrorMessage } from '@beleg/shared'
import { client } from '../../api/client'
import { useModal } from '../../context/ModalContext'
import { Button, Card, ErrorView, Loader, Screen, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
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

export default function ActionDetailScreen({ route, navigation }: Props) {
  const { id } = route.params
  const queryClient = useQueryClient()
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

  const akcija = detailQuery.data
  const prijava = mojaPrijavaQuery.data?.prijava

  useEffect(() => {
    if (!prijava) return
    setSelSmestaj(new Set(prijava.selectedSmestajIds ?? []))
    const prev = prijava.selectedPrevozIds ?? []
    setSelPrevoz(prev.length ? new Set([prev[prev.length - 1]]) : new Set())
    const rent: Record<number, number> = {}
    for (const it of prijava.selectedRentItems ?? []) {
      if (it.rentId && it.kolicina > 0) rent[it.rentId] = it.kolicina
    }
    setSelRent(rent)
  }, [prijava])

  const signedUp = (prijaveQuery.data?.prijavljeneAkcije ?? []).includes(id)
  const canCancel = (prijaveQuery.data?.otkaziveAkcije ?? []).includes(id)

  const payload = useMemo(() => {
    const selectedSmestajIds = Array.from(selSmestaj)
    const prevArr = Array.from(selPrevoz)
    const selectedPrevozIds = prevArr.length <= 1 ? prevArr : [prevArr[prevArr.length - 1]]
    const selectedRentItems = Object.entries(selRent)
      .map(([rentId, kolicina]) => ({ rentId: Number(rentId), kolicina }))
      .filter((x) => x.kolicina > 0)
    return { selectedSmestajIds, selectedPrevozIds, selectedRentItems }
  }, [selSmestaj, selPrevoz, selRent])

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

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (signedUp) return updateMojaPrijava(client, id, payload)
      return prijaviNaAkciju(client, id, payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['moje-prijave'] })
      await queryClient.invalidateQueries({ queryKey: ['moja-prijava', id] })
      await queryClient.invalidateQueries({ queryKey: ['akcija', id, 'prijave'] })
      await showAlert('Uspeh', signedUp ? 'Prijava je ažurirana.' : 'Uspešno ste se prijavili.')
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Čuvanje nije uspelo.')),
  })

  const otkaziMutation = useMutation({
    mutationFn: () => otkaziPrijavu(client, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['moje-prijave'] })
      await queryClient.invalidateQueries({ queryKey: ['moja-prijava', id] })
      await showAlert('Uspeh', 'Prijava je otkazana.')
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Otkazivanje nije uspelo.')),
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
  const memberCount = membersQuery.data?.length ?? akcija.prijaveCount ?? 0

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
            onToggleSmestaj={(sid) => {
              setSelSmestaj((prev) => {
                const next = new Set(prev)
                if (next.has(sid)) next.delete(sid)
                else next.add(sid)
                return next
              })
            }}
            onSelectPrevoz={(pid) => setSelPrevoz(new Set([pid]))}
            onChangeRent={(rid, delta, max) => {
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

          {akcija.prikaziListuPrijavljenih !== false ? (
            <ActionDetailMembers prijave={membersQuery.data ?? []} />
          ) : null}

          {signedUp ? (
            <Card style={styles.block}>
              <Text variant="label">Vaša prijava</Text>
              <Text color={colors.textMuted}>Status: {prijava?.status || 'prijavljen'}</Text>
            </Card>
          ) : null}

          <View style={styles.actions}>
            {!akcija.isCompleted ? (
              <Button
                title={signedUp ? 'Sačuvaj izbore' : 'Prijavi se'}
                loading={saveMutation.isPending}
                onPress={() => saveMutation.mutate()}
                fullWidth
              />
            ) : null}
            {signedUp && canCancel ? (
              <Button
                title="Otkaži prijavu"
                variant="secondary"
                loading={otkaziMutation.isPending}
                onPress={async () => {
                  const ok = await showConfirm('Otkaži prijavu', 'Da li ste sigurni?')
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
  actions: { marginTop: spacing.md, gap: spacing.sm },
})
