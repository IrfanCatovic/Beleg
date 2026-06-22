import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { fetchActiveActivity } from '@beleg/shared'
import { client } from '../../api/client'
import { AppTopBar, Text } from '../../components/ui'
import { colors, radius, spacing } from '../../theme'
import type { ExploreStackParamList } from '../../navigation/types'
import { useDailySteps } from '../activity/hooks/useDailySteps'
import { formatSteps } from '../activity/services/activityMetrics'

type Props = NativeStackScreenProps<ExploreStackParamList, 'ExploreHome'>

const MENU = [
  { key: 'ferratas', route: 'FerrataList' as const, icon: 'link-outline' as const },
  { key: 'map', route: 'Map' as const, icon: 'map-outline' as const },
  { key: 'guides', route: 'Guides' as const, icon: 'people-outline' as const },
]

export default function ExploreHomeScreen({ navigation }: Props) {
  const { t } = useTranslation('explore')
  const dailySteps = useDailySteps()

  const onStartActivity = async () => {
    try {
      const active = await fetchActiveActivity(client)
      if (active) {
        Alert.alert(
          t('activeSessionTitle'),
          t('activeSessionMessage'),
          [
            { text: t('activeSessionCancel'), style: 'cancel' },
            { text: t('activeSessionContinue'), onPress: () => navigation.navigate('ActiveTracking') },
          ],
        )
        return
      }
      navigation.navigate('ActiveTracking')
    } catch {
      navigation.navigate('ActiveTracking')
    }
  }

  return (
    <View style={styles.root}>
      <AppTopBar title={t('title')} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text variant="small" color={colors.textMuted} style={styles.subtitle}>
          {t('subtitle')}
        </Text>
        <View style={styles.menu}>
          <Pressable onPress={() => navigation.navigate('DailySteps')} style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name="footsteps-outline" size={24} color={colors.brand} />
            </View>
            <View style={styles.cardBody}>
              <Text variant="label">{t('dailySteps')}</Text>
              <Text variant="small" color={colors.textMuted}>
                {dailySteps.loading
                  ? t('dailyStepsHint')
                  : `${formatSteps(dailySteps.todaySteps)} / ${formatSteps(dailySteps.goal)}`}
              </Text>
              {!dailySteps.loading ? (
                <View style={styles.miniTrack}>
                  <View
                    style={[styles.miniFill, { width: `${Math.min(100, dailySteps.progressPercent)}%` }]}
                  />
                </View>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>

          <Pressable onPress={() => void onStartActivity()} style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name="navigate-outline" size={24} color={colors.brand} />
            </View>
            <View style={styles.cardBody}>
              <Text variant="label">{t('startActivity')}</Text>
              <Text variant="small" color={colors.textMuted}>
                {t('startActivityHint')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>

          {MENU.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => navigation.navigate(item.route)}
              style={styles.card}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={item.icon} size={24} color={colors.brand} />
              </View>
              <View style={styles.cardBody}>
                <Text variant="label">{t(item.key)}</Text>
                <Text variant="small" color={colors.textMuted}>
                  {t(`${item.key}Hint`)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg },
  subtitle: { marginBottom: spacing.lg },
  menu: { gap: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  cardBody: { flex: 1, gap: 2 },
  miniTrack: {
    marginTop: spacing.xs,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  miniFill: {
    height: '100%',
    backgroundColor: colors.brand,
    borderRadius: radius.full,
  },
})
