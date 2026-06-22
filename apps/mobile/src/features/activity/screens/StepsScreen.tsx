import { useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { ClubStepsLeaderboardEntry, StepsLeaderboardEntry } from '@beleg/shared'
import {
  fetchClubsStepsLeaderboard,
  fetchStepsHistory,
  fetchStepsLeaderboard,
} from '@beleg/shared'
import { client } from '../../../api/client'
import { useAuth } from '../../../context/AuthContext'
import { AppTopBar, Avatar, Button, Card, Loader, Text } from '../../../components/ui'
import { colors, radius, spacing } from '../../../theme'
import type { ExploreStackParamList } from '../../../navigation/types'
import { useDailySteps } from '../hooks/useDailySteps'
import {
  computeMonthlyAverage,
  deriveActiveMinutes,
  deriveDistanceKm,
  monthRangeKeys,
} from '../../steps/services/stepsDerived'
import { formatDistanceKm, formatSteps } from '../../steps/services/stepsFormat'
import { todayKey } from '../services/stepsLocalStore'

type Props = NativeStackScreenProps<ExploreStackParamList, 'Steps'>

function LeaderboardRow({ item, highlight }: { item: StepsLeaderboardEntry; highlight?: boolean }) {
  return (
    <View style={[styles.lbRow, highlight && styles.lbRowHighlight]}>
      <Text variant="label" style={styles.lbRank}>
        {item.rank}.
      </Text>
      <Avatar uri={item.avatarUrl} name={item.fullName || item.username} size={40} />
      <View style={styles.lbInfo}>
        <Text variant="label">{item.fullName || item.username}</Text>
        <Text variant="small" color={colors.textMuted}>
          @{item.username}
        </Text>
      </View>
      <Text variant="label" color={colors.brand}>
        {formatSteps(item.steps)}
      </Text>
    </View>
  )
}

function ClubLbRow({ item, highlight }: { item: ClubStepsLeaderboardEntry; highlight?: boolean }) {
  return (
    <View style={[styles.lbRow, highlight && styles.lbRowHighlight]}>
      <Text variant="label" style={styles.lbRank}>
        {item.rank}.
      </Text>
      <View style={styles.clubIcon}>
        <Ionicons name="people" size={20} color={colors.brand} />
      </View>
      <View style={styles.lbInfo}>
        <Text variant="label">{item.naziv}</Text>
      </View>
      <Text variant="label" color={colors.brand}>
        {formatSteps(item.totalSteps)}
      </Text>
    </View>
  )
}

export default function StepsScreen({ navigation }: Props) {
  const { t } = useTranslation('explore')
  const { user } = useAuth()
  const daily = useDailySteps()
  const [selectedDate, setSelectedDate] = useState(todayKey())
  const [clubsModalOpen, setClubsModalOpen] = useState(false)
  const monthRange = monthRangeKeys()

  const historyQuery = useQuery({
    queryKey: ['steps-history', monthRange.from, monthRange.to],
    queryFn: () => fetchStepsHistory(client, monthRange),
  })

  const globalLbQuery = useQuery({
    queryKey: ['steps-lb-global-month'],
    queryFn: () => fetchStepsLeaderboard(client, { scope: 'global', period: 'month', limit: 50 }),
  })

  const clubsLbQuery = useQuery({
    queryKey: ['steps-lb-clubs-month'],
    queryFn: () => fetchClubsStepsLeaderboard(client, { period: 'month' }),
    enabled: clubsModalOpen || !!user?.klubId,
  })

  const days = useMemo(() => {
    const fromHistory = historyQuery.data?.days ?? []
    const map = new Map(fromHistory.map((d) => [d.date, d.steps]))
    if (selectedDate === todayKey() && daily.todaySteps > (map.get(todayKey()) ?? 0)) {
      map.set(todayKey(), daily.todaySteps)
    }
    return fromHistory.map((d) => ({
      date: d.date,
      steps: map.get(d.date) ?? d.steps,
      dayNum: Number(d.date.slice(-2)),
    }))
  }, [historyQuery.data, daily.todaySteps, selectedDate])

  const selectedSteps = useMemo(() => {
    if (selectedDate === todayKey()) return daily.todaySteps
    return days.find((d) => d.date === selectedDate)?.steps ?? 0
  }, [selectedDate, daily.todaySteps, days])

  const monthlyAverage = useMemo(
    () => computeMonthlyAverage(days.map((d) => ({ steps: d.steps }))),
    [days],
  )

  const monthLabel = useMemo(() => {
    const d = new Date()
    return d.toLocaleDateString('sr-RS', { month: 'long', year: 'numeric' })
  }, [])

  const showPinnedMe = useMemo(() => {
    const me = globalLbQuery.data?.me
    if (!me) return false
    return !globalLbQuery.data?.entries.some((e) => e.userId === me.userId)
  }, [globalLbQuery.data])

  const showPinnedClub = useMemo(() => {
    const myClub = clubsLbQuery.data?.myClub
    if (!myClub) return false
    return !clubsLbQuery.data?.entries.some((e) => e.klubId === myClub.klubId)
  }, [clubsLbQuery.data])

  const progressPct =
    daily.goal > 0 ? Math.min(100, Math.round((selectedSteps / daily.goal) * 100)) : 0

  const needsStepsAccess =
    daily.accessStatus === 'permission_needed' || daily.accessStatus === 'permission_denied'

  const goToClub = () => {
    navigation.getParent()?.navigate('ClubTab', { screen: 'ClubHome' })
  }

  if (daily.loading && historyQuery.isLoading) {
    return (
      <View style={styles.root}>
        <AppTopBar title="Dnevni koraci" />
        <Loader />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <AppTopBar title="Dnevni koraci" />
      <ScrollView contentContainerStyle={styles.scroll}>
        {needsStepsAccess ? (
          <Card style={styles.accessCard}>
            <Text variant="small" color={colors.textMuted}>
              {daily.accessStatus === 'permission_denied'
                ? t('dailyStepsPermissionDenied')
                : t('dailyStepsPermissionNeeded')}
            </Text>
            <Button
              title={
                daily.accessStatus === 'permission_denied'
                  ? t('dailyStepsOpenSettings')
                  : t('dailyStepsEnable')
              }
              variant="secondary"
              onPress={() => void daily.requestAccess()}
            />
          </Card>
        ) : null}

        {daily.accessStatus === 'device_unavailable' ? (
          <Card style={styles.accessCard}>
            <Text variant="small" color={colors.textMuted}>
              {t('dailyStepsUnavailable')}
            </Text>
          </Card>
        ) : null}

        <Text variant="small" color={colors.textMuted}>
          {monthLabel}
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayPicker}>
          {days.map((d) => {
            const active = d.date === selectedDate
            return (
              <Pressable
                key={d.date}
                onPress={() => setSelectedDate(d.date)}
                style={[styles.dayPill, active && styles.dayPillActive]}
              >
                <Text variant="small" color={active ? colors.white : colors.textMuted}>
                  {d.dayNum}
                </Text>
                <Text variant="small" color={active ? colors.white : colors.text} style={styles.daySteps}>
                  {d.steps > 0 ? formatSteps(d.steps) : '—'}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>

        <Card style={styles.statsCard}>
          <Text variant="title" style={styles.bigSteps}>
            {formatSteps(selectedSteps)}
          </Text>
          <Text variant="small" color={colors.textMuted}>
            cilj {formatSteps(daily.goal)} · {progressPct}%
          </Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progressPct}%` }]} />
          </View>
          <View style={styles.metaRow}>
            <Text variant="small" color={colors.textMuted}>
              ≈ {formatDistanceKm(deriveDistanceKm(selectedSteps))}
            </Text>
            <Text variant="small" color={colors.textMuted}>
              ≈ {deriveActiveMinutes(selectedSteps)} min aktivno
            </Text>
          </View>
        </Card>

        <Card style={styles.avgCard}>
          <Text variant="label">Prosjek aktivnih dana</Text>
          <Text variant="heading" color={colors.brand}>
            {formatSteps(monthlyAverage)} koraka
          </Text>
          <Text variant="small" color={colors.textMuted}>
            Samo dani sa koracima u tekućem mjesecu
          </Text>
        </Card>

        <View style={styles.section}>
          <Text variant="label">Rang lista — {monthLabel}</Text>
          {globalLbQuery.isLoading ? (
            <Loader />
          ) : (
            <>
              {(globalLbQuery.data?.entries ?? []).map((item) => (
                <LeaderboardRow
                  key={item.userId}
                  item={item}
                  highlight={item.username === user?.username}
                />
              ))}
              {showPinnedMe && globalLbQuery.data?.me ? (
                <View style={styles.pinnedWrap}>
                  <Text variant="small" color={colors.textMuted} style={styles.pinnedLabel}>
                    Tvoj rang
                  </Text>
                  <LeaderboardRow item={globalLbQuery.data.me} highlight />
                </View>
              ) : null}
            </>
          )}
        </View>

        {user?.klubId ? (
          <Card style={styles.clubCard}>
            <Text variant="label">Tvoj klub — {monthLabel}</Text>
            <Text variant="heading" color={colors.brand}>
              {formatSteps(clubsLbQuery.data?.myClub?.totalSteps ?? 0)} koraka
            </Text>
            {clubsLbQuery.data?.myClub ? (
              <Text variant="small" color={colors.textMuted}>
                Rang kluba: #{clubsLbQuery.data.myClub.rank}
              </Text>
            ) : null}
            <Button title="Rang klubova" variant="secondary" onPress={() => setClubsModalOpen(true)} />
          </Card>
        ) : (
          <Card style={styles.clubCard}>
            <Text variant="label">Klub</Text>
            <Text variant="small" color={colors.textMuted} style={styles.clubCtaText}>
              Pridruži se klubu i pomozi mu da bude prvi.
            </Text>
            <Button title="Pridruži se klubu" onPress={goToClub} />
          </Card>
        )}

        <Text variant="small" color={colors.textSubtle} style={styles.footnote}>
          Udaljenost i aktivno vrijeme su procjena iz broja koraka (≈). GPS praćenje dolazi u narednoj fazi.
        </Text>
      </ScrollView>

      <Modal visible={clubsModalOpen} animationType="slide" transparent onRequestClose={() => setClubsModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text variant="label">Rang klubova — {monthLabel}</Text>
              <Pressable onPress={() => setClubsModalOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalScroll}>
              {clubsLbQuery.isLoading ? (
                <Loader />
              ) : (
                <>
                  {(clubsLbQuery.data?.entries ?? []).map((item) => (
                    <ClubLbRow
                      key={item.klubId}
                      item={item}
                      highlight={item.klubId === user?.klubId}
                    />
                  ))}
                  {showPinnedClub && clubsLbQuery.data?.myClub ? (
                    <View style={styles.pinnedWrap}>
                      <Text variant="small" color={colors.textMuted} style={styles.pinnedLabel}>
                        Tvoj klub
                      </Text>
                      <ClubLbRow item={clubsLbQuery.data.myClub} highlight />
                    </View>
                  ) : null}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  accessCard: { gap: spacing.sm },
  dayPicker: { gap: spacing.sm, paddingVertical: spacing.xs },
  dayPill: {
    minWidth: 56,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 2,
  },
  dayPillActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  daySteps: { fontSize: 10, fontWeight: '600' },
  statsCard: { gap: spacing.sm },
  bigSteps: { fontSize: 40 },
  track: {
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.brand,
    borderRadius: radius.full,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  avgCard: { gap: spacing.xs },
  section: { gap: spacing.sm },
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  lbRowHighlight: {
    borderColor: colors.brand,
    backgroundColor: colors.surfaceAlt,
  },
  lbRank: { width: 28 },
  lbInfo: { flex: 1, gap: 2 },
  clubIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinnedWrap: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pinnedLabel: { marginBottom: spacing.xs },
  clubCard: { gap: spacing.sm },
  clubCtaText: { lineHeight: 20 },
  footnote: { lineHeight: 18 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '75%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalScroll: { paddingBottom: spacing.xl },
})
