import { useCallback, useState } from 'react'
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Button, Card, Loader, Text } from '../../../components/ui'
import { colors, radius, spacing } from '../../../theme'
import {
  openHealthConnectAppSettings,
  runHealthConnectDebugReport,
  type HealthConnectDebugReport,
  type HcDebugOriginSummary,
} from '../../steps/services/healthConnectDebug'

interface Props {
  accessStatus: string
  stepsConnected: boolean
  todaySteps: number
}

function DebugRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="small" color={colors.textMuted} style={styles.rowLabel}>
        {label}
      </Text>
      <Text variant="small" style={styles.rowValue}>
        {value}
      </Text>
    </View>
  )
}

function OriginsBlock({ title, origins }: { title: string; origins: HcDebugOriginSummary[] }) {
  if (origins.length === 0) {
    return (
      <View style={styles.block}>
        <Text variant="small" color={colors.textMuted}>
          {title}: nema zapisa
        </Text>
      </View>
    )
  }
  return (
    <View style={styles.block}>
      <Text variant="small" color={colors.textMuted}>
        {title}
      </Text>
      {origins.map((o) => (
        <Text key={o.packageName} variant="small" style={styles.mono}>
          {o.isSamsungHealth ? '★ ' : ''}
          {o.packageName} — {o.recordCount} zapisa, {o.stepSum} koraka
        </Text>
      ))}
    </View>
  )
}

/** @deprecated Unused — debug is available via StepsDiagnosisCard modal. */
export function StepsHealthConnectDebugTrigger({
  accessStatus,
  stepsConnected,
  todaySteps,
}: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<HealthConnectDebugReport | null>(null)

  const refresh = useCallback(async () => {
    if (Platform.OS !== 'android') return
    setLoading(true)
    try {
      const next = await runHealthConnectDebugReport()
      setReport(next)
    } finally {
      setLoading(false)
    }
  }, [])

  const openPanel = useCallback(() => {
    setOpen(true)
    void refresh()
  }, [refresh])

  if (Platform.OS !== 'android') return null

  return (
    <>
      <Pressable onPress={openPanel} style={styles.trigger} hitSlop={8}>
        <Ionicons name="bug-outline" size={14} color={colors.textSubtle} />
        <Text variant="small" color={colors.textSubtle}>
          Debug koraci
        </Text>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text variant="label">Health Connect debug</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
              {loading && !report ? (
                <Loader />
              ) : report ? (
                <>
                  <Card style={styles.summaryCard}>
                    <Text variant="small" style={styles.summaryText}>
                      {report.summary}
                    </Text>
                  </Card>

                  <Text variant="label">Planiner stanje</Text>
                  <DebugRow label="accessStatus" value={accessStatus} />
                  <DebugRow label="connected" value={String(stepsConnected)} />
                  <DebugRow label="todaySteps (UI)" value={String(todaySteps)} />

                  <Text variant="label">Health Connect</Text>
                  <DebugRow label="availability" value={report.availability} />
                  <DebugRow label="initialized" value={String(report.initialized)} />
                  <DebugRow label="READ_STEPS granted" value={String(report.hasReadStepsPermission)} />
                  <DebugRow
                    label="granted permissions"
                    value={report.grantedPermissionLabels.join(', ') || '—'}
                  />

                  <Text variant="label">Date range</Text>
                  <DebugRow label="todayStart" value={report.dateRanges.todayStartIso} />
                  <DebugRow label="now" value={report.dateRanges.nowIso} />
                  <DebugRow label="weekStart" value={report.dateRanges.weekStartIso} />
                  <DebugRow label="monthStart" value={report.dateRanges.monthStartIso} />
                  <DebugRow
                    label="timezone"
                    value={`${report.dateRanges.timezoneName} (UTC${report.dateRanges.timezoneOffsetMinutes >= 0 ? '+' : ''}${report.dateRanges.timezoneOffsetMinutes / 60})`}
                  />
                  <DebugRow label="localTodayKey" value={report.dateRanges.localTodayKey} />

                  <Text variant="label">Aggregate steps</Text>
                  <DebugRow label="danas" value={String(report.aggregate.today)} />
                  <DebugRow label="sedmica" value={String(report.aggregate.week)} />
                  <DebugRow label="mjesec" value={String(report.aggregate.month)} />
                  {report.aggregateErrors.length > 0 ? (
                    <Text variant="small" color={colors.danger} style={styles.mono}>
                      aggregate errors: {report.aggregateErrors.join(' | ')}
                    </Text>
                  ) : null}

                  <Text variant="label">Raw Steps records</Text>
                  <DebugRow
                    label="danas (count / sum)"
                    value={`${report.rawRecords.today.recordCount} / ${report.rawRecords.today.stepSum}`}
                  />
                  <OriginsBlock title="Origins — danas" origins={report.rawRecords.today.origins} />
                  <DebugRow
                    label="sedmica (count / sum)"
                    value={`${report.rawRecords.week.recordCount} / ${report.rawRecords.week.stepSum}`}
                  />
                  <OriginsBlock title="Origins — sedmica" origins={report.rawRecords.week.origins} />
                  {report.rawErrors.length > 0 ? (
                    <Text variant="small" color={colors.danger} style={styles.mono}>
                      raw errors: {report.rawErrors.join(' | ')}
                    </Text>
                  ) : null}

                  {report.lastError ? (
                    <>
                      <Text variant="label">Last error</Text>
                      <Text variant="small" color={colors.danger} style={styles.mono}>
                        {report.lastError}
                      </Text>
                    </>
                  ) : null}

                  <Text variant="small" color={colors.textSubtle}>
                    generisano: {report.generatedAt}
                  </Text>
                </>
              ) : (
                <Text variant="small" color={colors.textMuted}>
                  Nema podataka — pritisni Refresh.
                </Text>
              )}

              <View style={styles.actions}>
                <Button
                  title={loading ? 'Učitavam...' : 'Refresh debug'}
                  variant="secondary"
                  onPress={() => void refresh()}
                  disabled={loading}
                />
                <Button
                  title="Open Health Connect settings"
                  variant="secondary"
                  onPress={() => void openHealthConnectAppSettings()}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '90%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  scroll: { gap: spacing.sm, paddingBottom: spacing.xxl },
  summaryCard: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
  },
  summaryText: { lineHeight: 20 },
  row: { gap: 2 },
  rowLabel: { fontSize: 11 },
  rowValue: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11 },
  block: { gap: 4, marginTop: spacing.xs },
  mono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
  actions: { gap: spacing.sm, marginTop: spacing.md },
})
