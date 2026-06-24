import { useMemo, useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useTranslation } from 'react-i18next'
import { fetchPublicFerratas } from '@beleg/shared/services'
import { client } from '../../api/client'
import { FerrataCard } from '../../components/explore/FerrataCard'
import { AppTopBar } from '../../components/ui/AppTopBar'
import { EmptyState, ErrorView, Input, Loader, Text } from '../../components/ui'
import { colors, radius, spacing } from '../../theme'
import type { ExploreStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<ExploreStackParamList, 'FerrataList'>

const TEZINA_OPTIONS = ['', 'A', 'B', 'C', 'D', 'E', 'C/D', 'D/E']

const LEGEND_COLORS: Record<string, string> = {
  A: '#059669',
  B: '#0284c7',
  C: '#f59e0b',
  D: '#e11d48',
  E: '#18181b',
}

export default function FerrataListScreen({ navigation }: Props) {
  const { t } = useTranslation('explore')
  const [search, setSearch] = useState('')
  const [tezina, setTezina] = useState('')

  const legend = useMemo(
    () =>
      (['A', 'B', 'C', 'D', 'E'] as const).map((key) => ({
        key,
        color: LEGEND_COLORS[key],
        label: t(`legend${key}`),
      })),
    [t],
  )

  const ferratasQuery = useQuery({
    queryKey: ['ferratas', search, tezina],
    queryFn: () => fetchPublicFerratas(client, { search, tezina }),
  })

  const items = useMemo(() => {
    const rows = ferratasQuery.data ?? []
    return [...rows].sort((a, b) =>
      (a.naziv ?? '').localeCompare(b.naziv ?? '', 'sr', { sensitivity: 'base' }),
    )
  }, [ferratasQuery.data])

  if (ferratasQuery.isLoading) {
    return (
      <View style={styles.root}>
        <AppTopBar />
        <Loader />
      </View>
    )
  }

  if (ferratasQuery.isError) {
    return (
      <View style={styles.root}>
        <AppTopBar />
        <ErrorView message="Ferrate nisu učitane." onRetry={() => ferratasQuery.refetch()} />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <AppTopBar />
      <View style={styles.filters}>
        <Input
          placeholder="Pretraži ferate..."
          value={search}
          onChangeText={setSearch}
        />
        <View style={styles.tezinaRow}>
          {TEZINA_OPTIONS.map((t) => (
            <Pressable
              key={t || 'all'}
              onPress={() => setTezina(t)}
              style={[styles.tezinaChip, tezina === t && styles.tezinaChipActive]}
            >
              <Text variant="small" color={tezina === t ? colors.white : colors.textMuted}>
                {t || 'Sve'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={ferratasQuery.isRefetching} onRefresh={() => ferratasQuery.refetch()} />
        }
        ListEmptyComponent={<EmptyState title="Nema ferrata" message="Pokušaj drugačiju pretragu." />}
        ListFooterComponent={
          <View style={styles.legend}>
            <Text variant="label" style={styles.legendTitle}>
              Legenda težine
            </Text>
            {legend.map((l) => (
              <View key={l.key} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                <Text variant="small" color={colors.textMuted} style={styles.legendText}>
                  {l.label}
                </Text>
              </View>
            ))}
          </View>
        }
        renderItem={({ item }) => (
          <FerrataCard
            ferrata={item}
            onPress={() => {
              if (!item.slug) return
              navigation.navigate('FerrataDetail', { slug: item.slug })
            }}
          />
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  filters: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  tezinaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tezinaChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tezinaChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  list: { padding: spacing.lg, paddingTop: 0 },
  legend: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  legendTitle: { marginBottom: spacing.xs },
  legendRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  legendDot: { width: 12, height: 12, borderRadius: 6, marginTop: 3 },
  legendText: { flex: 1 },
})
