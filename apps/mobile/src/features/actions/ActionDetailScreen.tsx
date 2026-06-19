import { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import {
  fetchAkcijaById,
  fetchMojaPrijavaZaAkciju,
  fetchMojePrijave,
  otkaziPrijavu,
  prijaviNaAkciju,
  updateMojaPrijava,
} from '@beleg/shared/services'
import { getApiErrorMessage } from '@beleg/shared'
import { client } from '../../api/client'
import { useModal } from '../../context/ModalContext'
import { Badge, Button, Card, ErrorView, Loader, Screen, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { ActionsStackParamList } from '../../navigation/types'
import type { HomeStackParamList } from '../../navigation/types'
import type { ProfileStackParamList } from '../../navigation/types'

type Props =
  | NativeStackScreenProps<ActionsStackParamList, 'ActionDetail'>
  | NativeStackScreenProps<HomeStackParamList, 'ActionDetail'>
  | NativeStackScreenProps<ProfileStackParamList, 'ActionDetail'>

function SelectionRow({
  label,
  sub,
  selected,
  onPress,
}: {
  label: string
  sub?: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable onPress={onPress} style={[styles.option, selected && styles.optionSelected]}>
      <Text variant="label">{label}</Text>
      {sub ? <Text variant="small" color={colors.textMuted}>{sub}</Text> : null}
    </Pressable>
  )
}

export default function ActionDetailScreen({ route }: Props) {
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

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (signedUp) {
        return updateMojaPrijava(client, id, payload)
      }
      return prijaviNaAkciju(client, id, payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['moje-prijave'] })
      await queryClient.invalidateQueries({ queryKey: ['moja-prijava', id] })
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
      <Screen>
        <Loader />
      </Screen>
    )
  }

  if (detailQuery.isError || !akcija) {
    return (
      <Screen>
        <ErrorView message="Akcija nije učitana." onRetry={() => detailQuery.refetch()} />
      </Screen>
    )
  }

  const smestaj = akcija.smestaj ?? []
  const prevoz = akcija.prevoz ?? []
  const rent = akcija.opremaRent ?? []

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text variant="title">{akcija.naziv}</Text>
        {akcija.isCompleted ? <Badge label="Završena" /> : <Badge label="Aktivna" tone="brand" />}
      </View>

      {akcija.planina ? (
        <Text color={colors.textMuted}>
          {akcija.planina}
          {akcija.vrh ? ` · ${akcija.vrh}` : ''}
        </Text>
      ) : null}

      <Text color={colors.brand}>
        {new Date(akcija.datum).toLocaleDateString('sr-RS', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
      </Text>

      {akcija.opis ? (
        <Card style={styles.block}>
          <Text>{akcija.opis}</Text>
        </Card>
      ) : null}

      {smestaj.length > 0 ? (
        <Card style={styles.block}>
          <Text variant="label">Smeštaj</Text>
          {smestaj.map((s) => (
            <SelectionRow
              key={s.id}
              label={s.naziv}
              sub={`${s.cenaPoOsobiUkupno} RSD`}
              selected={selSmestaj.has(s.id)}
              onPress={() => {
                setSelSmestaj((prev) => {
                  const next = new Set(prev)
                  if (next.has(s.id)) next.delete(s.id)
                  else next.add(s.id)
                  return next
                })
              }}
            />
          ))}
        </Card>
      ) : null}

      {prevoz.length > 0 ? (
        <Card style={styles.block}>
          <Text variant="label">Prevoz</Text>
          {prevoz.map((p) => (
            <SelectionRow
              key={p.id}
              label={`${p.nazivGrupe} (${p.tipPrevoza})`}
              sub={`${p.cenaPoOsobi} RSD · mesta ${p.kapacitet}`}
              selected={selPrevoz.has(p.id)}
              onPress={() => setSelPrevoz(new Set([p.id]))}
            />
          ))}
        </Card>
      ) : null}

      {rent.length > 0 ? (
        <Card style={styles.block}>
          <Text variant="label">Iznajmljiva oprema</Text>
          {rent.map((r) => (
            <View key={r.id} style={styles.rentRow}>
              <Text>{r.nazivOpreme}</Text>
              <View style={styles.rentQty}>
                <Pressable onPress={() => setSelRent((prev) => ({ ...prev, [r.id]: Math.max(0, (prev[r.id] ?? 0) - 1) }))}>
                  <Text variant="label">−</Text>
                </Pressable>
                <Text>{selRent[r.id] ?? 0}</Text>
                <Pressable
                  onPress={() =>
                    setSelRent((prev) => ({
                      ...prev,
                      [r.id]: Math.min(r.dostupnaKolicina, (prev[r.id] ?? 0) + 1),
                    }))
                  }
                >
                  <Text variant="label">+</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </Card>
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
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  block: { marginTop: spacing.md, gap: spacing.sm },
  option: {
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionSelected: { borderColor: colors.brand, backgroundColor: '#ecfdf5' },
  rentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rentQty: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actions: { marginTop: spacing.xl, gap: spacing.sm, marginBottom: spacing.xl },
})
