import { ScrollView, StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AppTopBar, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { ExploreStackParamList } from '../../navigation/types'
import { StepsSummaryCard } from '../activity/components/StepsSummaryCard'
import { useDailySteps } from '../activity/hooks/useDailySteps'
import { ExploreMenuCard } from './ExploreMenuCard'

type Props = NativeStackScreenProps<ExploreStackParamList, 'ExploreHome'>

const MENU = [
  { key: 'ferratas', route: 'FerrataList' as const, icon: 'link-outline' as const },
  { key: 'map', route: 'Map' as const, icon: 'map-outline' as const },
  { key: 'guides', route: 'Guides' as const, icon: 'people-outline' as const },
]

export default function ExploreHomeScreen({ navigation }: Props) {
  const { t } = useTranslation('explore')
  const dailySteps = useDailySteps()

  return (
    <View style={styles.root}>
      <AppTopBar title={t('title')} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text variant="small" color={colors.textMuted} style={styles.subtitle}>
          {t('subtitle')}
        </Text>
        <View style={styles.menu}>
          <StepsSummaryCard
            steps={dailySteps.todaySteps}
            goal={dailySteps.goal}
            progressPercent={dailySteps.progressPercent}
            distanceKm={dailySteps.distanceKm}
            activeMinutes={dailySteps.activeMinutes}
            loading={dailySteps.loading}
            accessStatus={dailySteps.accessStatus}
            accessDebug={dailySteps.accessDebug}
            onRequestAccess={() => void dailySteps.requestAccess()}
            onPress={() => navigation.navigate('Steps')}
          />

          {MENU.map((item) => (
            <ExploreMenuCard
              key={item.key}
              icon={item.icon}
              title={t(item.key)}
              hint={t(`${item.key}Hint`)}
              onPress={() => navigation.navigate(item.route)}
            />
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
})
