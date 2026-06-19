import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { AkcijaListItem } from '@beleg/shared'
import { Card, Loader, Text } from '../../components/ui'
import { colors, radius, spacing } from '../../theme'
import { difficultyBadgeStyle, formatDateShort } from './homeFeedUtils'

interface HomeNextActionsRowProps {
  actions: AkcijaListItem[]
  loading?: boolean
  onPressAction: (id: number) => void
  onPressAll: () => void
}

export function HomeNextActionsRow({
  actions,
  loading,
  onPressAction,
  onPressAll,
}: HomeNextActionsRowProps) {
  const { t } = useTranslation('home')

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.accent, styles.accentBlue]} />
          <Text variant="label">{t('nextActions')}</Text>
        </View>
        <Pressable onPress={onPressAll} hitSlop={8}>
          <Text variant="small" color={colors.brand} style={styles.allLink}>
            {t('allActions')}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <Loader />
      ) : actions.length === 0 ? (
        <Text variant="small" color={colors.textSubtle} style={styles.empty}>
          {t('noScheduledActions')}
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {actions.map((a) => {
            const diff = a.tezina ? difficultyBadgeStyle(a.tezina, a.tipAkcije) : null
            const location = [a.planina, a.vrh].filter(Boolean).join(' · ')
            return (
              <Pressable key={a.id} style={styles.miniCard} onPress={() => onPressAction(a.id)}>
                <Text variant="label" numberOfLines={2} style={styles.miniTitle}>
                  {a.naziv}
                </Text>
                <Text variant="small" color={colors.textMuted} numberOfLines={2}>
                  {[location, formatDateShort(a.datum)].filter(Boolean).join(' · ')}
                </Text>
                {diff?.label ? (
                  <View style={[styles.diffBadge, { backgroundColor: diff.bg }]}>
                    <Text style={[styles.diffText, { color: diff.text }]}>{diff.label}</Text>
                  </View>
                ) : null}
              </Pressable>
            )
          })}
        </ScrollView>
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  accent: { width: 4, height: 20, borderRadius: 2, backgroundColor: colors.brand },
  accentBlue: { backgroundColor: '#3b82f6' },
  allLink: { fontWeight: '600' },
  empty: { textAlign: 'center', paddingVertical: spacing.md },
  scroll: { gap: spacing.sm, paddingBottom: spacing.xs },
  miniCard: {
    width: 200,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  miniTitle: { marginBottom: 4 },
  diffBadge: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  diffText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
})
