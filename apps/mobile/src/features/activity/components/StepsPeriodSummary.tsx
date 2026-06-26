import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Card, Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'
import { formatSteps } from '../../steps/services/stepsFormat'
import type { StepsPeriodTotals } from '../../steps/services/healthConnectService'

interface Props {
  periods: StepsPeriodTotals
}

function PeriodCell({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.cell}>
      <Text variant="small" color={colors.textMuted}>
        {label}
      </Text>
      <Text variant="heading" color={colors.brand}>
        {formatSteps(value)}
      </Text>
    </View>
  )
}

export function StepsPeriodSummary({ periods }: Props) {
  const { t } = useTranslation('explore')

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <PeriodCell label={t('stepsPeriodToday')} value={periods.today} />
        <View style={styles.divider} />
        <PeriodCell label={t('stepsPeriodWeek')} value={periods.week} />
        <View style={styles.divider} />
        <PeriodCell label={t('stepsPeriodMonth')} value={periods.month} />
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { paddingVertical: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
})
