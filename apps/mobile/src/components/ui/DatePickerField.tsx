import { useMemo, useState } from 'react'
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { Ionicons } from '@expo/vector-icons'
import { formatActionDate, parseLocalDate } from '@beleg/shared'
import {
  clampDate,
  getDateBounds,
  todayAtMidnight,
  toLocalYMD,
  type DatePickerPreset,
} from '../../utils/datePickerBounds'
import { Button } from './Button'
import { Text } from './Text'
import { colors, radius, spacing } from '../../theme'

export type DatePickerFieldProps = {
  label?: string
  value: string | null
  onChange: (ymd: string | null) => void
  preset?: DatePickerPreset
  minimumDate?: Date
  maximumDate?: Date
  optional?: boolean
  placeholder?: string
  disabled?: boolean
}

export function DatePickerField({
  label,
  value,
  onChange,
  preset = 'any',
  minimumDate: minimumDateProp,
  maximumDate: maximumDateProp,
  optional = false,
  placeholder = 'Izaberi datum',
  disabled = false,
}: DatePickerFieldProps) {
  const [showPicker, setShowPicker] = useState(false)
  const [draftDate, setDraftDate] = useState<Date>(() => todayAtMidnight())

  const bounds = useMemo(() => {
    const presetBounds = getDateBounds(preset)
    return {
      minimumDate: minimumDateProp ?? presetBounds.minimumDate,
      maximumDate: maximumDateProp ?? presetBounds.maximumDate,
    }
  }, [preset, minimumDateProp, maximumDateProp])

  const displayText = value ? formatActionDate(value) : placeholder
  const displayColor = value ? colors.text : colors.textMuted

  const openPicker = () => {
    if (disabled) return
    const initial = parseLocalDate(value) ?? todayAtMidnight()
    setDraftDate(clampDate(initial, bounds.minimumDate, bounds.maximumDate))
    setShowPicker(true)
  }

  const closePicker = () => setShowPicker(false)

  const applyDate = (date: Date) => {
    const clamped = clampDate(date, bounds.minimumDate, bounds.maximumDate)
    onChange(toLocalYMD(clamped))
    closePicker()
  }

  const onAndroidChange = (_event: DateTimePickerEvent, selected?: Date) => {
    setShowPicker(false)
    if (selected) applyDate(selected)
  }

  const onIosChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (selected) setDraftDate(clampDate(selected, bounds.minimumDate, bounds.maximumDate))
  }

  return (
    <View style={styles.wrap}>
      {label ? <Text variant="label">{label}</Text> : null}
      <Pressable
        style={[styles.dateRow, disabled && styles.dateRowDisabled]}
        onPress={openPicker}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label ?? placeholder}
      >
        <Text color={displayColor} style={styles.dateText}>
          {displayText}
        </Text>
        <Ionicons name="calendar-outline" size={22} color={colors.brand} />
      </Pressable>

      {optional && value ? (
        <Button title="Ukloni datum" variant="ghost" onPress={() => onChange(null)} />
      ) : null}

      {Platform.OS === 'android' && showPicker ? (
        <DateTimePicker
          value={draftDate}
          mode="date"
          display="default"
          minimumDate={bounds.minimumDate}
          maximumDate={bounds.maximumDate}
          onChange={onAndroidChange}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal visible={showPicker} transparent animationType="slide" onRequestClose={closePicker}>
          <Pressable style={styles.overlay} onPress={closePicker}>
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.sheetHeader}>
                <Text variant="label">{label ?? 'Izaberi datum'}</Text>
              </View>
              <DateTimePicker
                value={draftDate}
                mode="date"
                display="inline"
                minimumDate={bounds.minimumDate}
                maximumDate={bounds.maximumDate}
                onChange={onIosChange}
                locale="sr-Latn-RS"
                style={styles.iosPicker}
              />
              <View style={styles.sheetActions}>
                <View style={styles.sheetBtn}>
                  <Button title="Otkaži" variant="secondary" onPress={closePicker} fullWidth />
                </View>
                <View style={styles.sheetBtn}>
                  <Button title="Potvrdi" onPress={() => applyDate(draftDate)} fullWidth />
                </View>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    minHeight: 48,
  },
  dateRowDisabled: { opacity: 0.5 },
  dateText: { flex: 1, marginRight: spacing.sm },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingBottom: spacing.xl,
  },
  sheetHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iosPicker: { alignSelf: 'center' },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  sheetBtn: { flex: 1 },
})
