import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { getApiErrorMessage } from '@beleg/shared'
import type { Transakcija } from '@beleg/shared/types'
import {
  createClanarina,
  createTransakcija,
  deleteTransakcija,
  fetchClanarine,
  fetchFinansijeDashboard,
  fetchKlub,
} from '@beleg/shared/services'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import { Button, Card, EmptyState, ErrorView, Input, Loader, Screen, SegmentedToggle, Text } from '../../components/ui'
import { canSeeFinance } from '../../utils/roles'
import { colors, spacing } from '../../theme'
import type { ClubStackParamList, ProfileStackParamList } from '../../navigation/types'

type Props =
  | NativeStackScreenProps<ClubStackParamList, 'Finance'>
  | NativeStackScreenProps<ProfileStackParamList, 'Finance'>

type FinanceTab = 'dashboard' | 'clanarine' | 'transakcije'

interface DashboardData {
  saldo?: number
  uplate?: number
  isplate?: number
  transakcije?: Transakcija[]
}

function monthBounds(): { from: string; to: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const from = `${y}-${String(m + 1).padStart(2, '0')}-01`
  const lastDay = new Date(y, m + 1, 0).getDate()
  const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { from, to }
}

export default function FinanceScreen(_props: Props) {
  const { user } = useAuth()
  const { showAlert, showConfirm } = useModal()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<FinanceTab>('dashboard')
  const period = useMemo(() => monthBounds(), [])
  const year = new Date().getFullYear()

  const [txTip, setTxTip] = useState<'uplata' | 'isplata'>('uplata')
  const [txIznos, setTxIznos] = useState('')
  const [txOpis, setTxOpis] = useState('')
  const [txUplatilac, setTxUplatilac] = useState('')

  const canManage = canSeeFinance(user?.role)
  const canDelete = user?.role === 'superadmin' || user?.role === 'admin'

  const klubQuery = useQuery({
    queryKey: ['klub'],
    queryFn: () => fetchKlub(client),
    enabled: canManage,
  })

  const dashboardQuery = useQuery({
    queryKey: ['finansije', period],
    queryFn: () => fetchFinansijeDashboard(client, period) as Promise<DashboardData>,
    enabled: canManage,
  })

  const clanarineQuery = useQuery({
    queryKey: ['finansije', 'clanarine', year],
    queryFn: () =>
      fetchClanarine(client, year) as Promise<{ clanarine?: Array<{ id: number; fullName: string; username: string; platio: boolean }> }>,
    enabled: canManage && tab === 'clanarine',
  })

  const createTxMutation = useMutation({
    mutationFn: () =>
      createTransakcija(client, {
        tip: txTip,
        iznos: Number(txIznos),
        datum: new Date().toISOString().slice(0, 10),
        opis: txOpis.trim(),
        uplatilac: txUplatilac.trim(),
      }),
    onSuccess: async () => {
      setTxIznos('')
      setTxOpis('')
      setTxUplatilac('')
      await queryClient.invalidateQueries({ queryKey: ['finansije'] })
      await showAlert('Uspeh', 'Transakcija je sačuvana.')
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Čuvanje nije uspelo.')),
  })

  const payClanarinaMutation = useMutation({
    mutationFn: (memberId: number) =>
      createClanarina(client, { korisnikId: memberId, godina: year, iznos: 2320 }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['finansije', 'clanarine'] }),
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Uplata nije sačuvana.')),
  })

  const deleteTxMutation = useMutation({
    mutationFn: (id: number) => deleteTransakcija(client, id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['finansije'] }),
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Brisanje nije uspelo.')),
  })

  if (!canManage) {
    return (
      <Screen edges={['left', 'right']}>
        <EmptyState title="Nema pristupa" message="Finansije su dostupne blagajniku i administratorima." />
      </Screen>
    )
  }

  if (dashboardQuery.isLoading && tab === 'dashboard') {
    return (
      <Screen edges={['left', 'right']}>
        <Loader />
      </Screen>
    )
  }

  if (dashboardQuery.isError) {
    return (
      <Screen edges={['left', 'right']}>
        <ErrorView message="Finansije nisu učitane." onRetry={() => dashboardQuery.refetch()} />
      </Screen>
    )
  }

  const dash = dashboardQuery.data
  const currency = klubQuery.data?.valuta ?? 'RSD'
  const fmt = (n: number) => `${n.toLocaleString('sr-RS')} ${currency}`
  const transactions = dash?.transakcije ?? []
  const clanarine = clanarineQuery.data?.clanarine ?? []

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <View style={styles.tabs}>
        <SegmentedToggle
          options={[
            { value: 'dashboard', label: 'Pregled' },
            { value: 'clanarine', label: 'Članarine' },
            { value: 'transakcije', label: 'Unos' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {tab === 'dashboard' ? (
          <>
            <View style={styles.summaryRow}>
              <Card style={styles.summaryCard}>
                <Text variant="small" color={colors.textMuted}>
                  Saldo
                </Text>
                <Text variant="title">{fmt(dash?.saldo ?? 0)}</Text>
              </Card>
              <Card style={styles.summaryCard}>
                <Text variant="small" color={colors.textMuted}>
                  Uplate
                </Text>
                <Text variant="title" color={colors.brand}>
                  {fmt(dash?.uplate ?? 0)}
                </Text>
              </Card>
              <Card style={styles.summaryCard}>
                <Text variant="small" color={colors.textMuted}>
                  Isplate
                </Text>
                <Text variant="title" color={colors.danger}>
                  {fmt(dash?.isplate ?? 0)}
                </Text>
              </Card>
            </View>

            <Text variant="label" style={styles.sectionTitle}>
              Transakcije ({period.from} – {period.to})
            </Text>
            {transactions.length === 0 ? (
              <Text color={colors.textMuted}>Nema transakcija u periodu.</Text>
            ) : (
              transactions.map((tx) => (
                <Card key={tx.id} style={styles.txCard}>
                  <View style={styles.txRow}>
                    <View style={styles.txInfo}>
                      <Text variant="label">{tx.opis || (tx.tip === 'uplata' ? 'Uplata' : 'Isplata')}</Text>
                      <Text variant="small" color={colors.textMuted}>
                        {tx.datum}
                        {tx.korisnik?.fullName || tx.korisnik?.username
                          ? ` · ${tx.korisnik?.fullName || tx.korisnik?.username}`
                          : ''}
                      </Text>
                    </View>
                    <Text variant="label" color={tx.tip === 'uplata' ? colors.brand : colors.danger}>
                      {tx.tip === 'uplata' ? '+' : '−'}
                      {fmt(Math.abs(tx.iznos))}
                    </Text>
                  </View>
                  {canDelete ? (
                    <Button
                      title="Obriši"
                      variant="ghost"
                      onPress={async () => {
                        const ok = await showConfirm('Obriši transakciju', 'Da li ste sigurni?')
                        if (ok) deleteTxMutation.mutate(tx.id)
                      }}
                      loading={deleteTxMutation.isPending}
                    />
                  ) : null}
                </Card>
              ))
            )}
          </>
        ) : null}

        {tab === 'clanarine' ? (
          <>
            <Text variant="label" style={styles.sectionTitle}>
              Članarine {year}
            </Text>
            {clanarineQuery.isLoading ? <Loader /> : null}
            {clanarine.length === 0 && !clanarineQuery.isLoading ? (
              <Text color={colors.textMuted}>Nema podataka o članarinama.</Text>
            ) : (
              clanarine.map((row) => (
                <Card key={row.id} style={styles.txCard}>
                  <View style={styles.txRow}>
                    <View style={styles.txInfo}>
                      <Text variant="label">{row.fullName || row.username}</Text>
                      <Text variant="small" color={colors.textMuted}>
                        @{row.username}
                      </Text>
                    </View>
                    {row.platio ? (
                      <Text variant="label" color={colors.brand}>
                        Plaćeno
                      </Text>
                    ) : (
                      <Button
                        title="Označi plaćeno"
                        variant="secondary"
                        onPress={() => payClanarinaMutation.mutate(row.id)}
                        loading={payClanarinaMutation.isPending}
                      />
                    )}
                  </View>
                </Card>
              ))
            )}
          </>
        ) : null}

        {tab === 'transakcije' ? (
          <Card style={styles.formCard}>
            <Text variant="label">Nova transakcija</Text>
            <SegmentedToggle
              options={[
                { value: 'uplata', label: 'Uplata' },
                { value: 'isplata', label: 'Isplata' },
              ]}
              value={txTip}
              onChange={setTxTip}
            />
            <Input label="Iznos" value={txIznos} onChangeText={setTxIznos} keyboardType="decimal-pad" />
            <Input label="Uplatilac / primalac" value={txUplatilac} onChangeText={setTxUplatilac} />
            <Input label="Opis" value={txOpis} onChangeText={setTxOpis} />
            <Button
              title="Sačuvaj"
              onPress={() => createTxMutation.mutate()}
              loading={createTxMutation.isPending}
              disabled={!txIznos.trim()}
            />
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  tabs: { paddingTop: spacing.sm },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  summaryCard: { flex: 1, minWidth: '30%', gap: spacing.xs },
  sectionTitle: { marginTop: spacing.sm },
  txCard: { gap: spacing.sm, marginBottom: spacing.sm },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  txInfo: { flex: 1, gap: 2 },
  formCard: { gap: spacing.md },
})
