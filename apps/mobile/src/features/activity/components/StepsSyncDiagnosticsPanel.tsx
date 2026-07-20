import { useState } from 'react'
import { Platform, Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Button, Card, Loader, Text } from '../../../components/ui'
import { colors, radius, spacing } from '../../../theme'
import { formatSteps } from '../../steps/services/stepsFormat'
import type { StepsSyncDiagnosticReport } from '../../steps/services/stepsSyncDiagnostics'

/** Uključi globalno za production test (npr. privremeno true za OTA test). */
export const SHOW_STEPS_SYNC_DIAGNOSTICS_UI = false

/** U dev buildu prikaži sync dijagnostiku kad je koraci dijagnostika otvorena. */
export const SHOW_STEPS_SYNC_DIAGNOSTICS_IN_DEV = true

interface Props {
  report: StepsSyncDiagnosticReport | null
  loading: boolean
  onRefresh: () => void
}

function DebugRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.debugRow}>
      <Text variant="small" color={colors.textMuted} style={styles.debugLabel}>
        {label}
      </Text>
      <Text variant="small" style={styles.debugValue}>
        {value}
      </Text>
    </View>
  )
}

function formatGap(value: number | undefined): string {
  if (value == null) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value}`
}

function statusTint(status: StepsSyncDiagnosticReport['primaryStatus']) {
  if (status === 'hc_in_sync') return colors.brand
  if (status === 'diagnostics_unavailable') return colors.textMuted
  return colors.warning
}

export function StepsSyncDiagnosticsPanel({ report, loading, onRefresh }: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false)

  if (Platform.OS === 'ios') {
    return (
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <View style={[styles.iconWrap, { backgroundColor: `${colors.textMuted}18` }]}>
            <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
          </View>
          <View style={styles.headerText}>
            <Text variant="label">Dijagnostika sinhronizacije</Text>
            <Text variant="small" color={colors.textMuted}>
              Detaljna Health Connect dijagnostika dostupna je na Android uređajima. Na
              iPhone-u Planiner koristi sistemski brojač koraka.
            </Text>
          </View>
        </View>
      </Card>
    )
  }

  if (Platform.OS !== 'android') return null

  const tint = report ? statusTint(report.primaryStatus) : colors.textMuted
  const rawToday = report?.healthConnect?.rawRecords.today
  const gaps = report?.gaps

  return (
    <Card style={styles.card}>
      <Pressable
        onPress={() => setDetailsOpen((v) => !v)}
        style={styles.headerRow}
        accessibilityRole="button"
      >
        <View style={[styles.iconWrap, { backgroundColor: `${tint}18` }]}>
          <Ionicons name="pulse-outline" size={20} color={tint} />
        </View>
        <View style={styles.headerText}>
          <Text variant="label">Dijagnostika sinhronizacije</Text>
          <Text variant="small" color={colors.textMuted}>
            {report?.userMessage ?? 'Pritisni Provjeri sada za analizu izvora koraka.'}
          </Text>
        </View>
        <Ionicons
          name={detailsOpen ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textMuted}
        />
      </Pressable>

      {loading && !report ? (
        <View style={styles.loadingRow}>
          <Loader />
          <Text variant="small" color={colors.textMuted}>
            Učitavam dijagnostiku…
          </Text>
        </View>
      ) : null}

      {report ? (
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCell}>
            <Text variant="small" color={colors.textMuted}>
              Planiner
            </Text>
            <Text variant="label" color={colors.brand}>
              {formatSteps(report.planiner.displayedTodaySteps)}
            </Text>
          </View>
          <View style={styles.summaryCell}>
            <Text variant="small" color={colors.textMuted}>
              HC aggregate
            </Text>
            <Text variant="label">
              {formatSteps(report.healthConnect?.aggregate.today ?? 0)}
            </Text>
          </View>
          <View style={styles.summaryCell}>
            <Text variant="small" color={colors.textMuted}>
              HC raw
            </Text>
            <Text variant="label">{formatSteps(rawToday?.stepSum ?? 0)}</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text variant="small" color={colors.textMuted}>
              Backend
            </Text>
            <Text variant="label">
              {report.backend.todaySteps != null
                ? formatSteps(report.backend.todaySteps)
                : '—'}
            </Text>
          </View>
        </View>
      ) : null}

      <Button
        title={loading ? 'Proveravam…' : 'Provjeri sada'}
        variant="secondary"
        onPress={onRefresh}
        loading={loading}
      />

      {detailsOpen && report ? (
        <View style={styles.details}>
          <Text variant="label">Tehnički detalji</Text>

          <Text variant="small" color={colors.textMuted} style={styles.sectionLabel}>
            Planiner
          </Text>
          <DebugRow label="status / source" value={`${report.planiner.stepStatus} / ${report.planiner.stepSource}`} />
          <DebugRow label="hydrated baseline" value={String(report.planiner.hydratedBaseline)} />
          <DebugRow
            label="last OS read"
            value={report.planiner.lastSuccessfulReadAt ?? '—'}
          />
          <DebugRow
            label="last backend sync"
            value={report.planiner.lastSyncToBackendAt ?? '—'}
          />
          <DebugRow
            label="last context refresh"
            value={report.planiner.lastContextRefreshAt ?? '—'}
          />

          <Text variant="small" color={colors.textMuted} style={styles.sectionLabel}>
            Health Connect
          </Text>
          <DebugRow
            label="aggregate readAt"
            value={report.healthConnect?.aggregate.readAt ?? '—'}
          />
          <DebugRow
            label="raw count / sum"
            value={`${rawToday?.recordCount ?? 0} / ${rawToday?.stepSum ?? 0}`}
          />
          <DebugRow
            label="latest endTime"
            value={rawToday?.latestRecordEndTime ?? '—'}
          />
          <DebugRow
            label="latest startTime"
            value={rawToday?.latestRecordStartTime ?? '—'}
          />
          <DebugRow
            label="latest lastModifiedTime"
            value={rawToday?.latestRecordLastModifiedTime ?? '—'}
          />
          <DebugRow
            label="min since end / modified"
            value={`${rawToday?.minutesSinceLatestRecordEnd ?? '—'} / ${rawToday?.minutesSinceLatestModification ?? '—'}`}
          />
          <DebugRow
            label="Samsung origin"
            value={
              rawToday?.samsungOriginPresent
                ? `da (${formatSteps(rawToday.samsungStepSum)} koraka)`
                : 'ne'
            }
          />
          <DebugRow
            label="origins"
            value={
              rawToday?.origins.map((o: { packageName: string; stepSum: number }) => `${o.packageName}:${o.stepSum}`).join(', ') || '—'
            }
          />

          {gaps ? (
            <>
              <Text variant="small" color={colors.textMuted} style={styles.sectionLabel}>
                Gap-ovi (display − izvor)
              </Text>
              <DebugRow label="display vs aggregate" value={formatGap(gaps.displayVsAggregate)} />
              <DebugRow label="display vs raw" value={formatGap(gaps.displayVsRaw)} />
              <DebugRow label="aggregate vs raw" value={formatGap(gaps.aggregateVsRaw)} />
              <DebugRow label="backend vs display" value={formatGap(gaps.backendVsDisplay)} />
            </>
          ) : null}

          <Text variant="small" color={colors.textMuted} style={styles.sectionLabel}>
            Inference
          </Text>
          {report.inferences.map((inf: { status: string; reason: string }) => (
            <Text key={`${inf.status}-${inf.reason}`} variant="small" style={styles.mono}>
              {inf.status}: {inf.reason}
            </Text>
          ))}

          <Text variant="small" color={colors.textSubtle}>
            generisano: {report.generatedAt}
          </Text>
          <Text variant="small" color={colors.textSubtle} style={styles.hint}>
            Planiner ne čita Samsung Health direktno — samo Health Connect zapise.
          </Text>
        </View>
      ) : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 2 },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryCell: {
    minWidth: '45%',
    flexGrow: 1,
    gap: 2,
  },
  details: { gap: spacing.xs, marginTop: spacing.xs },
  sectionLabel: { marginTop: spacing.sm, fontWeight: '600' },
  debugRow: { gap: 2 },
  debugLabel: { fontSize: 11 },
  debugValue: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
  mono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
  hint: { lineHeight: 18, marginTop: spacing.xs },
})
