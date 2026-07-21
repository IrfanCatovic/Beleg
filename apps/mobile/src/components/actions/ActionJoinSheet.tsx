import { useEffect, useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AkcijaListItem } from '@beleg/shared'
import {
  buildChoicesPayload,
  computeLogisticsTotals,
  computeParticipantSaldo,
  effectiveBaseCena,
  effectiveIsClanKluba,
  getActionCapacityUsedCount,
  isActionCapacityFull,
  getApiErrorMessage,
  isBlockingPrijavaStatus,
  isCancelledPrijavaStatus,
  isConfirmedPrijavaStatus,
} from '@beleg/shared'
import {
  fetchAkcijaById,
  fetchKlub,
  fetchMojaPrijavaZaAkciju,
  fetchPrijaveZaAkciju,
  prijaviNaAkciju,
} from '@beleg/shared/services'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { Button, Loader, Text } from '../ui'
import { colors, spacing } from '../../theme'
import { buildPrevozOccupancy } from '../../utils/actionDetails'
import { ActionDetailLogistics } from '../../features/actions/detail/ActionDetailLogistics'
import { ActionDetailPriceSummary } from '../../features/actions/detail/ActionDetailPriceSummary'
import { invalidateActionQueries } from '../../features/actions/hooks/invalidateActionQueries'

interface ActionJoinSheetProps {
  action: AkcijaListItem | null
  visible: boolean
  onClose: () => void
  onSuccess: () => void
  onError: (message: string) => void
}

export function ActionJoinSheet({ action, visible, onClose, onSuccess, onError }: ActionJoinSheetProps) {
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const actionId = action?.id

  const [selSmestaj, setSelSmestaj] = useState<Set<number>>(new Set())
  const [selPrevoz, setSelPrevoz] = useState<Set<number>>(new Set())
  const [selRent, setSelRent] = useState<Record<number, number>>({})
  const [confirmStep, setConfirmStep] = useState(false)

  const detailQuery = useQuery({
    queryKey: ['akcija', actionId, 'join'],
    queryFn: () => fetchAkcijaById(client, actionId!),
    enabled: visible && actionId != null,
  })

  const mojaQuery = useQuery({
    queryKey: ['moja-prijava', actionId, 'join'],
    queryFn: () => fetchMojaPrijavaZaAkciju(client, actionId!),
    enabled: visible && actionId != null && !!user,
  })

  const prijaveQuery = useQuery({
    queryKey: ['akcija', actionId, 'prijave', 'join'],
    queryFn: () => fetchPrijaveZaAkciju(client, actionId!),
    enabled: visible && actionId != null && !!user,
  })

  const klubQuery = useQuery({
    queryKey: ['klub'],
    queryFn: () => fetchKlub(client),
    enabled: visible && !!user,
  })

  useEffect(() => {
    if (!visible) {
      setSelSmestaj(new Set())
      setSelPrevoz(new Set())
      setSelRent({})
      setConfirmStep(false)
      return
    }
    const prijava = mojaQuery.data?.prijava
    const pending = mojaQuery.data?.signupRequest
    if (pending?.status === 'pending') {
      setSelSmestaj(new Set(pending.selectedSmestajIds ?? []))
      const prev = pending.selectedPrevozIds ?? []
      setSelPrevoz(prev.length ? new Set([prev[prev.length - 1]]) : new Set())
      const rent: Record<number, number> = {}
      for (const it of pending.selectedRentItems ?? []) {
        if (it.rentId && it.kolicina > 0) rent[it.rentId] = it.kolicina
      }
      setSelRent(rent)
      return
    }
    if (isCancelledPrijavaStatus(prijava?.status)) {
      setSelSmestaj(new Set(prijava?.selectedSmestajIds ?? []))
      const prev = prijava?.selectedPrevozIds ?? []
      setSelPrevoz(prev.length ? new Set([prev[prev.length - 1]]) : new Set())
      const rent: Record<number, number> = {}
      for (const it of prijava?.selectedRentItems ?? []) {
        if (it.rentId && it.kolicina > 0) rent[it.rentId] = it.kolicina
      }
      setSelRent(rent)
    }
  }, [visible, actionId, mojaQuery.data])

  const akcija = detailQuery.data
  const currency = klubQuery.data?.valuta || 'RSD'
  const isClan = akcija && user ? effectiveIsClanKluba(user, akcija) : false
  const baseCena = akcija ? effectiveBaseCena(akcija, isClan) : 0
  const selections = useMemo(() => ({ selSmestaj, selPrevoz, selRent }), [selSmestaj, selPrevoz, selRent])
  const priceTotals = akcija ? computeLogisticsTotals(akcija, selections) : { smestaj: 0, prevoz: 0, rent: 0 }
  const total = akcija
    ? computeParticipantSaldo(akcija, undefined, isClan, selections, { username: user?.username })
    : 0
  const prevozOccupied = buildPrevozOccupancy(prijaveQuery.data ?? [])

  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!akcija || !actionId) throw new Error('Nema akcije')
      const payload = buildChoicesPayload(akcija, selections)
      return prijaviNaAkciju(client, actionId, payload)
    },
    onSuccess: async () => {
      await invalidateActionQueries(queryClient, actionId!)
      onSuccess()
      onClose()
    },
    onError: (err) => onError(getApiErrorMessage(err, 'Prijava nije uspela.')),
  })

  const pending = mojaQuery.data?.signupRequest?.status === 'pending'
  const prijavaStatus = mojaQuery.data?.prijava?.status
  const registered = isConfirmedPrijavaStatus(prijavaStatus)
  const blockingNonCancelled =
    isBlockingPrijavaStatus(prijavaStatus) && !isCancelledPrijavaStatus(prijavaStatus)
  const capacityUsedCount = akcija
    ? getActionCapacityUsedCount(akcija, prijaveQuery.data)
    : 0
  const isCapacityFull = akcija
    ? !akcija.isCompleted && isActionCapacityFull(akcija.maxLjudi, capacityUsedCount)
    : false

  if (!visible || !action) return null

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md, maxHeight: '92%' }]}>
        <View style={styles.handle} />
        <Text variant="heading" style={styles.title}>
          Prijava na akciju
        </Text>
        <Text variant="body" color={colors.textMuted}>
          {action.naziv}
        </Text>

        {detailQuery.isLoading ? (
          <Loader />
        ) : pending || registered || blockingNonCancelled ? (
          <View style={styles.center}>
            <Text color={colors.textMuted}>
              {pending
                ? 'Već imate zahtev na čekanju.'
                : registered
                  ? 'Već ste prijavljeni.'
                  : 'Prijava na ovu akciju više nije dostupna.'}
            </Text>
            <Button title="Zatvori" variant="ghost" onPress={onClose} />
          </View>
        ) : isCapacityFull ? (
          <View style={styles.center}>
            <Text color={colors.textMuted}>Sva mesta su popunjena.</Text>
            <Button title="Zatvori" variant="ghost" onPress={onClose} />
          </View>
        ) : !akcija ? (
          <Text color={colors.textMuted}>Akcija nije učitana.</Text>
        ) : !confirmStep ? (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <ActionDetailLogistics
              akcija={akcija}
              selSmestaj={selSmestaj}
              selPrevoz={selPrevoz}
              selRent={selRent}
              prevozOccupied={prevozOccupied}
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
              baseCena={baseCena}
              smestajTotal={priceTotals.smestaj}
              prevozTotal={priceTotals.prevoz}
              rentTotal={priceTotals.rent}
              total={total}
              currency={currency}
            />
            <Button title="Nastavi" onPress={() => setConfirmStep(true)} fullWidth />
          </ScrollView>
        ) : (
          <View style={styles.confirm}>
            <Text variant="label">Da li želite da se prijavite?</Text>
            <Text variant="small" color={colors.textMuted}>
              Pregled vaših izbora i ukupne cene:
            </Text>
            <ActionDetailPriceSummary
              baseCena={baseCena}
              smestajTotal={priceTotals.smestaj}
              prevozTotal={priceTotals.prevoz}
              rentTotal={priceTotals.rent}
              total={total}
              currency={currency}
            />
            <View style={styles.confirmActions}>
              <Button title="Nazad" variant="ghost" onPress={() => setConfirmStep(false)} />
              <Button
                title="Potvrdi prijavu"
                loading={joinMutation.isPending}
                disabled={joinMutation.isPending}
                onPress={() => {
                  if (joinMutation.isPending) return
                  joinMutation.mutate()
                }}
              />
            </View>
          </View>
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    minHeight: 200,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: { marginBottom: 4 },
  scroll: { marginTop: spacing.md },
  scrollContent: { gap: spacing.md, paddingBottom: spacing.md },
  center: { padding: spacing.lg, gap: spacing.md, alignItems: 'center' },
  confirm: { marginTop: spacing.md, gap: spacing.md },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
})
