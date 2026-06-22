import { useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { fetchStepsLeaderboard } from '@beleg/shared'
import type { LeaderboardPeriod, LeaderboardScope, StepsLeaderboardEntry } from '@beleg/shared'
import { client } from '../../../api/client'
import { AppTopBar, Avatar, Loader, Screen, SegmentedToggle, Text } from '../../../components/ui'
import { colors, radius, spacing } from '../../../theme'
import type { ExploreStackParamList } from '../../../navigation/types'
import { formatSteps } from '../services/activityMetrics'

type Props = NativeStackScreenProps<ExploreStackParamList, 'StepsLeaderboard'>

const SCOPE_OPTIONS = [
  { value: 'global' as LeaderboardScope, label: 'Globalno' },
  { value: 'club' as LeaderboardScope, label: 'Klub' },
]

const PERIOD_OPTIONS = [
  { value: 'day' as LeaderboardPeriod, label: 'Danas' },
  { value: 'week' as LeaderboardPeriod, label: 'Sedmica' },
  { value: 'month' as LeaderboardPeriod, label: 'Mjesec' },
]

export default function StepsLeaderboardScreen({ navigation }: Props) {
  const [scope, setScope] = useState<LeaderboardScope>('global')
  const [period, setPeriod] = useState<LeaderboardPeriod>('day')

  const query = useQuery({
    queryKey: ['steps-leaderboard', scope, period],
    queryFn: () => fetchStepsLeaderboard(client, { scope, period }),
  })

  const renderItem = ({ item }: { item: StepsLeaderboardEntry }) => (
    <View style={styles.row}>
      <Text variant="label" style={styles.rank}>
        #{item.rank}
      </Text>
      <Avatar uri={item.avatarUrl} name={item.fullName || item.username} size={40} />
      <View style={styles.nameCol}>
        <Text variant="label">{item.fullName || item.username}</Text>
        <Text variant="small" color={colors.textMuted}>
          @{item.username}
        </Text>
      </View>
      <Text variant="label">{formatSteps(item.steps)}</Text>
    </View>
  )

  return (
    <Screen edges={['left', 'right']}>
      <AppTopBar title="Rang lista koraka" leftIcon="chevron-back" onLeftPress={() => navigation.goBack()} />
      <View style={styles.filters}>
        <SegmentedToggle options={SCOPE_OPTIONS} value={scope} onChange={setScope} />
        <SegmentedToggle options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
      </View>
      {query.isLoading ? (
        <Loader />
      ) : (
        <FlatList
          data={query.data?.entries ?? []}
          keyExtractor={(item) => String(item.userId)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text variant="body" color={colors.textMuted} style={styles.empty}>
              Nema podataka za izabrani period.
            </Text>
          }
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  filters: { padding: spacing.md, gap: spacing.sm },
  list: { padding: spacing.md, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  rank: { width: 36 },
  nameCol: { flex: 1, gap: 2 },
  empty: { textAlign: 'center', padding: spacing.xl },
})
