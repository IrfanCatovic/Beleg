import { useEffect, useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { parseLocalDate } from '@beleg/shared'
import { Button, ChipRow, DatePickerField, SegmentedToggle, Text } from '../../components/ui'
import { colors, radius, spacing } from '../../theme'
import {
  applyPeriodSelection,
  datePickTypeLabel,
  financeYearOptions,
  getMonthLabel,
  todayYmd,
  type DatePickType,
} from './financeUtils'

type FinancePeriodModalProps = {
  visible: boolean
  fromDate: string
  toDate: string
  datePickType: DatePickType
  onClose: () => void
  onApply: (result: { from: string; to: string; datePickType: DatePickType }) => void
}

export function FinancePeriodModal({
  visible,
  fromDate,
  toDate,
  datePickType: initialPickType,
  onClose,
  onApply,
}: FinancePeriodModalProps) {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const [datePickType, setDatePickType] = useState<DatePickType>(initialPickType)
  const [dayValue, setDayValue] = useState(fromDate)
  const [monthYear, setMonthYear] = useState({
    year: currentYear,
    month: currentMonth,
  })
  const [yearValue, setYearValue] = useState(currentYear)
  const [rangeStart, setRangeStart] = useState(fromDate)
  const [rangeEnd, setRangeEnd] = useState(toDate)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) return
    setDatePickType(initialPickType)
    setDayValue(fromDate)
    setRangeStart(fromDate)
    setRangeEnd(toDate)
    setError('')
  }, [visible, fromDate, toDate, initialPickType])

  const yearOptions = useMemo(
    () => financeYearOptions(currentYear).map((y) => ({ value: String(y), label: String(y) })),
    [currentYear],
  )

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const m = i + 1
        return { value: String(m), label: getMonthLabel(m) }
      }),
    [],
  )

  const handleApply = () => {
    const result = applyPeriodSelection({
      datePickType,
      dayValue,
      monthYear,
      yearValue,
      rangeStart,
      rangeEnd,
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    onApply({ from: result.from, to: result.to, datePickType })
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text variant="heading">Izaberi period</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <SegmentedToggle
              options={[
                { value: 'day', label: 'Dan' },
                { value: 'month', label: 'Mesec' },
                { value: 'year', label: 'Godina' },
                { value: 'range', label: 'Period' },
              ]}
              value={datePickType}
              onChange={(v) => {
                setDatePickType(v as DatePickType)
                setError('')
              }}
            />

            <Text variant="small" color={colors.textMuted}>
              Tip pregleda: {datePickTypeLabel(datePickType)}
            </Text>

            {datePickType === 'day' ? (
              <View style={styles.section}>
                <DatePickerField
                  label="Dan"
                  value={dayValue || null}
                  onChange={(ymd) => setDayValue(ymd ?? '')}
                  preset="past"
                />
                <Button title="Danas" variant="secondary" onPress={() => setDayValue(todayYmd())} />
              </View>
            ) : null}

            {datePickType === 'month' ? (
              <View style={styles.section}>
                <ChipRow
                  label="Godina"
                  options={yearOptions}
                  value={String(monthYear.year)}
                  onChange={(v) => setMonthYear((prev) => ({ ...prev, year: Number(v) }))}
                />
                <ChipRow
                  label="Mesec"
                  options={monthOptions}
                  value={String(monthYear.month)}
                  onChange={(v) => setMonthYear((prev) => ({ ...prev, month: Number(v) }))}
                />
              </View>
            ) : null}

            {datePickType === 'year' ? (
              <ChipRow
                label="Godina"
                options={yearOptions}
                value={String(yearValue)}
                onChange={(v) => setYearValue(Number(v))}
              />
            ) : null}

            {datePickType === 'range' ? (
              <View style={styles.section}>
                <DatePickerField
                  label="Početni datum"
                  value={rangeStart || null}
                  onChange={(ymd) => setRangeStart(ymd ?? '')}
                  preset="past"
                />
                <DatePickerField
                  label="Završni datum"
                  value={rangeEnd || null}
                  onChange={(ymd) => setRangeEnd(ymd ?? '')}
                  preset="past"
                  minimumDate={parseLocalDate(rangeStart) ?? undefined}
                />
              </View>
            ) : null}

            {error ? (
              <Text variant="small" color={colors.danger}>
                {error}
              </Text>
            ) : null}

            <Button title="Primeni" onPress={handleApply} fullWidth />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  section: { gap: spacing.md },
})
