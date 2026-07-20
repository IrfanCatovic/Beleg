import { useState } from 'react'
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Button, Card, Loader, Text } from '../../../components/ui'
import { colors, radius, spacing } from '../../../theme'
import { openSamsungHealthApp, type StepsDiagnosis } from '../../steps/services/stepsTroubleshooter'

interface Props {
  diagnosis: StepsDiagnosis | null
  loading?: boolean
  onAction?: () => void
  onRetry: () => void
}

function statusIcon(status: StepsDiagnosis['status'] | undefined) {
  switch (status) {
    case 'connected':
      return 'checkmark-circle' as const
    case 'missing_permission':
      return 'lock-closed-outline' as const
    case 'aggregate_empty_raw_available':
      return 'information-circle-outline' as const
    case 'stale_data':
      return 'time-outline' as const
    default:
      return 'alert-circle-outline' as const
  }
}

function statusColor(status: StepsDiagnosis['status'] | undefined) {
  if (status === 'connected') return colors.brand
  if (status === 'aggregate_empty_raw_available' || status === 'stale_data') return colors.warning
  return colors.danger
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

export function StepsDiagnosisCard({ diagnosis, loading, onAction, onRetry }: Props) {
  const [debugOpen, setDebugOpen] = useState(false)

  if (loading && !diagnosis) {
    return (
      <Card style={styles.card}>
        <View style={styles.loadingRow}>
          <Loader />
          <Text variant="small" color={colors.textMuted}>
            Proveravam korake…
          </Text>
        </View>
      </Card>
    )
  }

  if (!diagnosis) return null

  const icon = statusIcon(diagnosis.status)
  const tint = statusColor(diagnosis.status)
  const showPrimaryAction =
    diagnosis.actionType && diagnosis.actionType !== 'none' && diagnosis.actionType !== 'refresh'

  return (
    <>
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <View style={[styles.iconWrap, { backgroundColor: `${tint}18` }]}>
            <Ionicons name={icon} size={22} color={tint} />
          </View>
          <View style={styles.headerText}>
            <Text variant="label">{diagnosis.userTitle}</Text>
            {diagnosis.fallbackTodaySteps != null && diagnosis.fallbackTodaySteps > 0 ? (
              <Text variant="small" color={colors.brand} style={styles.fallback}>
                Pronađeno: {diagnosis.fallbackTodaySteps} koraka (raw)
              </Text>
            ) : null}
          </View>
        </View>

        <Text variant="small" color={colors.textMuted} style={styles.body}>
          {diagnosis.userMessage}
        </Text>

        <View style={styles.actions}>
          {showPrimaryAction && diagnosis.actionLabel ? (
            <Button title={diagnosis.actionLabel} onPress={() => onAction?.()} />
          ) : null}
          {diagnosis.status === 'source_not_syncing' || diagnosis.status === 'no_step_data' ? (
            <Button
              title="Otvori Samsung Health"
              variant="secondary"
              onPress={() => void openSamsungHealthApp()}
            />
          ) : null}
          <Button
            title={loading ? 'Proveravam…' : 'Provjeri ponovo'}
            variant="secondary"
            onPress={onRetry}
            loading={loading}
          />
          {Platform.OS === 'android' && diagnosis.debug ? (
            <Pressable onPress={() => setDebugOpen(true)} style={styles.debugTrigger} hitSlop={8}>
              <Ionicons name="bug-outline" size={14} color={colors.textSubtle} />
              <Text variant="small" color={colors.textSubtle}>
                Debug detalji
              </Text>
            </Pressable>
          ) : null}
        </View>
      </Card>

      <Modal visible={debugOpen} animationType="slide" transparent onRequestClose={() => setDebugOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text variant="label">Debug — koraci</Text>
              <Pressable onPress={() => setDebugOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.sheetScroll}>
              <DebugRow label="status" value={diagnosis.status} />
              <DebugRow
                label="HC available"
                value={String(diagnosis.debug?.healthConnectAvailable ?? '—')}
              />
              <DebugRow
                label="READ_STEPS granted"
                value={String(diagnosis.debug?.readStepsPermissionGranted ?? '—')}
              />
              <DebugRow
                label="aggregate today / week / month"
                value={`${diagnosis.debug?.todayAggregateSteps ?? '—'} / ${diagnosis.debug?.weekAggregateSteps ?? '—'} / ${diagnosis.debug?.monthAggregateSteps ?? '—'}`}
              />
              <DebugRow
                label="raw today (count / sum)"
                value={`${diagnosis.debug?.todayRawRecordsCount ?? '—'} / ${diagnosis.debug?.todayRawStepsSum ?? '—'}`}
              />
              <DebugRow
                label="raw week (count / sum)"
                value={`${diagnosis.debug?.weekRawRecordsCount ?? '—'} / ${diagnosis.debug?.weekRawStepsSum ?? '—'}`}
              />
              <DebugRow
                label="data origins"
                value={diagnosis.debug?.dataOrigins?.join(', ') || '—'}
              />
              <DebugRow label="todayStart" value={diagnosis.debug?.todayStartIso ?? '—'} />
              <DebugRow label="now" value={diagnosis.debug?.nowIso ?? '—'} />
              {diagnosis.debug?.lastError ? (
                <DebugRow label="last error" value={diagnosis.debug.lastError} />
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 2 },
  fallback: { fontWeight: '600' },
  body: { lineHeight: 20 },
  actions: { gap: spacing.sm, marginTop: spacing.xs },
  debugTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '80%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sheetScroll: { gap: spacing.sm, paddingBottom: spacing.xxl },
  debugRow: { gap: 2 },
  debugLabel: { fontSize: 11 },
  debugValue: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
})
