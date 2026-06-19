import { Pressable, StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Card, Loader, Text } from '../../components/ui'
import { colors, radius, spacing } from '../../theme'
import type { HomeStatistika } from './homeFeedUtils'

interface HomeStatsRowProps {
  statistika: HomeStatistika
  loading?: boolean
  onViewProfile?: () => void
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text variant="small" color={colors.textSubtle} style={styles.statLabel}>
        {label}
      </Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  )
}

export function HomeStatsRow({ statistika, loading, onViewProfile }: HomeStatsRowProps) {
  const { t } = useTranslation('home')

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.accent} />
        <Text variant="label">{t('myStats')}</Text>
      </View>

      {loading ? (
        <Loader />
      ) : (
        <>
          <View style={styles.grid}>
            <StatCard
              label={t('trails')}
              value={`${statistika.ukupnoKm.toLocaleString('sr-RS', { maximumFractionDigits: 1 })} km`}
            />
            <StatCard
              label={t('ascent')}
              value={`${statistika.ukupnoMetaraUspona.toLocaleString('sr-RS')} m`}
            />
            <StatCard label={t('actionsStat')} value={String(statistika.brojPopeoSe)} />
          </View>
          {onViewProfile ? (
            <Pressable style={styles.profileLink} onPress={onViewProfile}>
              <Text variant="small" color={colors.brand} style={styles.profileLinkText}>
                {t('viewProfile')}
              </Text>
            </Pressable>
          ) : null}
        </>
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  accent: { width: 4, height: 20, borderRadius: 2, backgroundColor: colors.brand },
  grid: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
  },
  statLabel: { textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.5 },
  statValue: { marginTop: 4, fontSize: 18, fontWeight: '700', color: colors.brand },
  profileLink: {
    marginTop: spacing.md,
    backgroundColor: '#ecfdf5',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  profileLinkText: { fontWeight: '600' },
})
