import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { formatActionDate, getApiErrorMessage } from '@beleg/shared'
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
import { AppTopBar } from '../../components/ui/AppTopBar'
import {
  Button,
  Card,
  DatePickerField,
  EmptyState,
  ErrorView,
  Input,
  Loader,
  Screen,
  SegmentedToggle,
  Text,
} from '../../components/ui'
import { toLocalYMD, todayAtMidnight } from '../../utils/datePickerBounds'
import { canSeeFinance } from '../../utils/roles'
import { colors, fontSize, fontWeight, spacing } from '../../theme'
import type { ClubStackParamList, ProfileStackParamList } from '../../navigation/types'
import { FinanceClanarineTab } from './FinanceClanarineTab'
import { FinancePeriodModal } from './FinancePeriodModal'
import {
  currentMonthBounds,
  datePickTypeLabel,
  DEFAULT_CLANARINA_IZNOS,
  periodLabel,
  todayYmd,
  type DatePickType,
} from './financeUtils'

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

const initialMonth = currentMonthBounds()

export default function FinanceScreen(_props: Props) {
  const { user } = useAuth()
  const { showAlert, showConfirm } = useModal()
  const queryClient = useQueryClient()
  const currentYear = new Date().getFullYear()

  const [tab, setTab] = useState<FinanceTab>('dashboard')
  const [fromDate, setFromDate] = useState(initialMonth.from)
  const [toDate, setToDate] = useState(initialMonth.to)
  const [datePickType, setDatePickType] = useState<DatePickType>('month')
  const [periodModalOpen, setPeriodModalOpen] = useState(false)

  const [clanarineGodina, setClanarineGodina] = useState(Math.max(2026, currentYear))
  const [clanarinaIznos, setClanarinaIznos] = useState(DEFAULT_CLANARINA_IZNOS)
  const [clanarinaIznosDraft, setClanarinaIznosDraft] = useState(String(DEFAULT_CLANARINA_IZNOS))
  const [clanarinaSaving, setClanarinaSaving] = useState(false)
  const [platiLoadingId, setPlatiLoadingId] = useState<number | null>(null)

  const [txTip, setTxTip] = useState<'uplata' | 'isplata'>('uplata')
  const [txIznos, setTxIznos] = useState('')
  const [txOpis, setTxOpis] = useState('')
  const [txUplatilac, setTxUplatilac] = useState('')
  const [txDatum, setTxDatum] = useState(() => toLocalYMD(todayAtMidnight()))

  const canManage = canSeeFinance(user?.role)
  const canDelete = user?.role === 'superadmin' || user?.role === 'admin'

  const klubQuery = useQuery({
    queryKey: ['klub'],
    queryFn: () => fetchKlub(client),
    enabled: canManage,
  })

  const dashboardQuery = useQuery({
    queryKey: ['finansije', fromDate, toDate],
    queryFn: () =>
      fetchFinansijeDashboard(client, { from: fromDate, to: toDate }) as Promise<DashboardData>,
    enabled: canManage && tab === 'dashboard',
  })

  const clanarineQuery = useQuery({
    queryKey: ['finansije', 'clanarine', clanarineGodina],
    queryFn: () =>
      fetchClanarine(client, clanarineGodina) as Promise<{
        clanarine?: Array<{ id: number; fullName: string; username: string; platio: boolean }>
      }>,
    enabled: canManage && tab === 'clanarine',
  })

  const createTxMutation = useMutation({
    mutationFn: async () => {
      const iznos = Number(txIznos.replace(/,/g, '.'))
      if (!iznos || iznos <= 0) throw new Error('Unesite ispravan iznos.')
      if (txDatum > todayYmd()) throw new Error('Datum ne može biti u budućnosti.')
      const opis = [txUplatilac.trim(), txOpis.trim()].filter(Boolean).join(' – ')
      await createTransakcija(client, {
        tip: txTip,
        iznos,
        datum: txDatum,
        opis,
      })
    },
    onSuccess: async () => {
      setTxIznos('')
      setTxOpis('')
      setTxUplatilac('')
      setTxDatum(toLocalYMD(todayAtMidnight()))
      await queryClient.invalidateQueries({ queryKey: ['finansije'] })
      await showAlert('Uspeh', 'Transakcija je sačuvana.')
      setTab('dashboard')
    },
    onError: (err) =>
      showAlert('Greška', getApiErrorMessage(err, 'Čuvanje nije uspelo.')),
  })

  const payClanarinaMutation = useMutation({
    mutationFn: (memberId: number) =>
      createClanarina(client, {
        korisnikId: memberId,
        iznos: clanarinaIznos,
        datum: todayYmd(),
      }),
    onMutate: (memberId) => {
      setPlatiLoadingId(memberId)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['finansije'] })
    },
    onError: (err) => {
      void showAlert('Greška', getApiErrorMessage(err, 'Uplata nije sačuvana.'))
    },
    onSettled: () => {
      setPlatiLoadingId(null)
    },
  })

  const deleteTxMutation = useMutation({
    mutationFn: (id: number) => deleteTransakcija(client, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['finansije'] })
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Brisanje nije uspelo.')),
  })

  const handlePromeniClanarinu = async () => {
    const parsed = Number(clanarinaIznosDraft.replace(/,/g, '.'))
    if (!parsed || parsed <= 0) {
      await showAlert('Greška', 'Unesite ispravan iznos članarine.')
      return
    }
    setClanarinaSaving(true)
    setClanarinaIznos(parsed)
    setClanarinaIznosDraft(String(parsed))
    setTimeout(() => setClanarinaSaving(false), 250)
  }

  const handleDeleteTx = async (tx: Transakcija) => {
    const message = tx.clanarinaKorisnikId
      ? 'Brisanjem uplate članarine korisnik se vraća na status da nije platio članarinu.'
      : 'Da li ste sigurni da želite da obrišete ovu transakciju?'
    const ok = await showConfirm('Obriši transakciju', message)
    if (ok) deleteTxMutation.mutate(tx.id)
  }

  if (!canManage) {
    return (
      <Screen edges={['top', 'left', 'right']}>
        <EmptyState title="Nema pristupa" message="Finansije su dostupne blagajniku i administratorima." />
      </Screen>
    )
  }

  const dash = dashboardQuery.data
  const currency = klubQuery.data?.valuta ?? 'RSD'
  const fmt = (n: number) => `${n.toLocaleString('sr-RS')} ${currency}`
  const transactions = dash?.transakcije ?? []
  const clanarine = clanarineQuery.data?.clanarine ?? []

  return (
    <View style={styles.root}>
      <AppTopBar
        center={
          <View style={styles.titleWrap}>
            <Text style={styles.topTitle}>Finansije</Text>
          </View>
        }
        rightIcon={tab === 'dashboard' ? 'filter-outline' : undefined}
        onRightPress={tab === 'dashboard' ? () => setPeriodModalOpen(true) : undefined}
      />

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
            dashboardQuery.isLoading ? (
              <Loader />
            ) : dashboardQuery.isError ? (
              <ErrorView message="Finansije nisu učitane." onRetry={() => dashboardQuery.refetch()} />
            ) : (
              <>
                <View style={styles.periodRow}>
                  <View style={styles.periodInfo}>
                    <Text variant="label">Period</Text>
                    <Text variant="small" color={colors.textMuted}>
                      {periodLabel(fromDate, toDate)}
                    </Text>
                    <Text variant="small" color={colors.textSubtle}>
                      Tip: {datePickTypeLabel(datePickType)}
                    </Text>
                  </View>
                </View>

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
                  Transakcije
                </Text>
                {transactions.length === 0 ? (
                  <Text color={colors.textMuted}>Nema transakcija u periodu.</Text>
                ) : (
                  transactions.map((tx) => (
                    <Card key={tx.id} style={styles.txCard}>
                      <View style={styles.txRow}>
                        <View style={styles.txInfo}>
                          <Text variant="label">
                            {tx.opis || (tx.tip === 'uplata' ? 'Uplata' : 'Isplata')}
                          </Text>
                          <Text variant="small" color={colors.textMuted}>
                            {formatActionDate(tx.datum)}
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
                          onPress={() => void handleDeleteTx(tx)}
                          loading={deleteTxMutation.isPending}
                        />
                      ) : null}
                    </Card>
                  ))
                )}
              </>
            )
          ) : null}

          {tab === 'clanarine' ? (
            <FinanceClanarineTab
              currency={currency}
              currentYear={currentYear}
              clanarineGodina={clanarineGodina}
              onChangeGodina={setClanarineGodina}
              clanarinaIznosDraft={clanarinaIznosDraft}
              onChangeIznosDraft={setClanarinaIznosDraft}
              clanarinaSaving={clanarinaSaving}
              onPromeniClanarinu={() => void handlePromeniClanarinu()}
              clanarine={clanarine}
              loading={clanarineQuery.isLoading}
              platiLoadingId={platiLoadingId}
              onPlati={(id) => payClanarinaMutation.mutate(id)}
            />
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
              <DatePickerField
                label="Datum"
                value={txDatum}
                onChange={(ymd) => setTxDatum(ymd ?? toLocalYMD(todayAtMidnight()))}
                preset="past"
              />
              {txDatum ? (
                <Text variant="small" color={colors.textMuted}>
                  {formatActionDate(txDatum)}
                </Text>
              ) : null}
              <Input label="Iznos" value={txIznos} onChangeText={setTxIznos} keyboardType="decimal-pad" />
              <Input
                label={txTip === 'uplata' ? 'Uplatilac (opciono)' : 'Primalac (opciono)'}
                value={txUplatilac}
                onChangeText={setTxUplatilac}
              />
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

      <FinancePeriodModal
        visible={periodModalOpen}
        fromDate={fromDate}
        toDate={toDate}
        datePickType={datePickType}
        onClose={() => setPeriodModalOpen(false)}
        onApply={({ from, to, datePickType: nextType }) => {
          setFromDate(from)
          setToDate(to)
          setDatePickType(nextType)
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  titleWrap: { width: '100%', alignItems: 'flex-start' },
  topTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textOnDark,
  },
  tabs: { paddingTop: spacing.sm, paddingHorizontal: spacing.lg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  periodRow: { marginBottom: spacing.xs },
  periodInfo: { gap: 2 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  summaryCard: { flex: 1, minWidth: '30%', gap: spacing.xs },
  sectionTitle: { marginTop: spacing.sm },
  txCard: { gap: spacing.sm, marginBottom: spacing.sm },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  txInfo: { flex: 1, gap: 2 },
  formCard: { gap: spacing.md },
})
