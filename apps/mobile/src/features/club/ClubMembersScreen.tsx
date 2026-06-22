import { useLayoutEffect, useMemo, useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { Korisnik } from '@beleg/shared'
import { fetchKorisnici, fetchKorisnikStatistika } from '@beleg/shared/services'
import { client } from '../../api/client'
import { Avatar, Card, EmptyState, ErrorView, Loader, SegmentedToggle, Text } from '../../components/ui'
import { GlobalSearchModal } from './GlobalSearchModal'
import { computeProfileRank } from '../../utils/profileRank'
import { colors, radius, spacing } from '../../theme'
import type { ClubStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<ClubStackParamList, 'ClubMembers'>
type SortMode = 'per' | 'steps'

interface MemberRow extends Korisnik {
  per: number
  rankLabel: string
  steps: number
}

export default function ClubMembersScreen({ navigation }: Props) {
  const [sortMode, setSortMode] = useState<SortMode>('per')
  const [searchOpen, setSearchOpen] = useState(false)

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => setSearchOpen(true)} hitSlop={8} style={styles.headerBtn}>
          <Ionicons name="search-outline" size={22} color="#fff" />
        </Pressable>
      ),
    })
  }, [navigation])

  const membersQuery = useQuery({
    queryKey: ['korisnici', 'club'],
    queryFn: () => fetchKorisnici(client, { scope: 'club' }),
  })

  const statsQuery = useQuery({
    queryKey: ['korisnici', 'club', 'stats'],
    queryFn: async () => {
      const members = await fetchKorisnici(client, { scope: 'club' })
      const stats = await Promise.all(
        members.map(async (m) => {
          try {
            const s = await fetchKorisnikStatistika(client, String(m.id))
            return { id: m.id, steps: s.ukupnoKoraka ?? 0 }
          } catch {
            return { id: m.id, steps: 0 }
          }
        }),
      )
      return Object.fromEntries(stats.map((s) => [s.id, s.steps]))
    },
    enabled: !!membersQuery.data?.length,
  })

  const rows = useMemo((): MemberRow[] => {
    const members = membersQuery.data ?? []
    const stepMap = statsQuery.data ?? {}
    return members.map((m) => {
      const rank = computeProfileRank([], {
        ukupnoKm: m.ukupnoKm,
        ukupnoMetaraUspona: m.ukupnoMetaraUspona,
      }, m.createdAt)
      return {
        ...m,
        per: rank.per,
        rankLabel: rank.naziv,
        steps: stepMap[m.id] ?? 0,
      }
    })
  }, [membersQuery.data, statsQuery.data])

  const sorted = useMemo(() => {
    const list = [...rows]
    if (sortMode === 'per') list.sort((a, b) => b.per - a.per)
    else list.sort((a, b) => b.steps - a.steps)
    return list
  }, [rows, sortMode])

  if (membersQuery.isLoading) {
    return (
      <View style={styles.root}>
        <Loader />
      </View>
    )
  }

  if (membersQuery.isError) {
    return (
      <View style={styles.root}>
        <ErrorView message="Članovi nisu učitani." onRetry={() => membersQuery.refetch()} />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <View style={styles.toggleWrap}>
        <SegmentedToggle
          options={[
            { value: 'per', label: 'PER' },
            { value: 'steps', label: 'Koraci' },
          ]}
          value={sortMode}
          onChange={setSortMode}
        />
      </View>

      <FlatList
        data={sorted}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={membersQuery.isRefetching || statsQuery.isRefetching}
            onRefresh={() => {
              void membersQuery.refetch()
              void statsQuery.refetch()
            }}
          />
        }
        ListEmptyComponent={<EmptyState title="Nema članova" />}
        renderItem={({ item, index }) => {
          const position = index + 1
          const metric = sortMode === 'per' ? `${item.per} PER` : `${item.steps.toLocaleString('sr-RS')} koraka`
          return (
            <Pressable
              onPress={() =>
                navigation.navigate('UserProfile', {
                  id: item.id,
                  username: item.username,
                })
              }
            >
              <Card style={position <= 3 ? [styles.card, styles.podiumCard] : styles.card}>
                <View style={styles.row}>
                  <View style={[styles.position, position <= 3 && styles.positionTop]}>
                    <Text variant="label">{position}.</Text>
                  </View>
                  <Avatar uri={item.avatar_url} name={item.fullName || item.username} size={48} />
                  <View style={styles.info}>
                    <Text variant="label">{item.fullName || item.username}</Text>
                    <Text variant="small" color={colors.textMuted}>
                      @{item.username}
                      {sortMode === 'per' ? ` · ${item.rankLabel}` : ''}
                    </Text>
                  </View>
                  <Text variant="label" color={colors.brand}>
                    {metric}
                  </Text>
                </View>
              </Card>
            </Pressable>
          )
        }}
      />

      <GlobalSearchModal
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        clubMembersOnly
        showClubs={false}
        onSelectUser={(u) =>
          navigation.navigate('UserProfile', { id: u.id, username: u.username })
        }
        onSelectAction={() => {}}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerBtn: { marginRight: spacing.sm, padding: spacing.xs },
  toggleWrap: { paddingTop: spacing.sm },
  list: { padding: spacing.lg, paddingTop: 0 },
  card: { marginBottom: spacing.sm },
  podiumCard: { borderColor: colors.brand, backgroundColor: colors.surfaceAlt },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  position: {
    width: 28,
    alignItems: 'center',
  },
  positionTop: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingVertical: 2,
  },
  info: { flex: 1, gap: 2 },
})
