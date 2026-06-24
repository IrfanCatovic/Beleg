import { useMemo, useState } from 'react'
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { Ionicons } from '@expo/vector-icons'
import { dateFromHHMM, formatHHMM, isValidHHMM } from '@beleg/shared'
import { Button } from './Button'
import { Text } from './Text'
import { colors, radius, spacing } from '../../theme'

export type TimePickerFieldProps = {
  label?: string
  value: string | null
  onChange: (hhmm: string | null) => void
  minuteInterval?: 1 | 5 | 10 | 15 | 30
  optional?: boolean
  placeholder?: string
  disabled?: boolean
  nestedInModal?: boolean
}

function defaultTime(): Date {
  const d = new Date()
  d.setHours(9, 0, 0, 0)
  return d
}

export function TimePickerField({
  label,
  value,
  onChange,
  minuteInterval = 5,
  optional = false,
  placeholder = 'Izaberi vreme',
  disabled = false,
  nestedInModal = false,
}: TimePickerFieldProps) {
  const [showPicker, setShowPicker] = useState(false)
  const [draftTime, setDraftTime] = useState<Date>(() => defaultTime())

  const displayText = useMemo(() => {
    if (!value?.trim()) return placeholder
    return isValidHHMM(value) ? value.trim() : placeholder
  }, [value, placeholder])

  const displayColor = value?.trim() && isValidHHMM(value) ? colors.text : colors.textMuted
  const useInlineIos = Platform.OS === 'ios' && nestedInModal

  const openPicker = () => {
    if (disabled) return
    const initial = dateFromHHMM(value ?? '') ?? defaultTime()
    setDraftTime(initial)
    setShowPicker(true)
  }

  const closePicker = () => setShowPicker(false)

  const applyTime = (date: Date) => {
    onChange(formatHHMM(date))
    closePicker()
  }

  const onAndroidChange = (_event: DateTimePickerEvent, selected?: Date) => {
    setShowPicker(false)
    if (selected) applyTime(selected)
  }

  const onIosChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (selected) setDraftTime(selected)
  }

  const iosPicker = (
    <>
      <DateTimePicker
        value={draftTime}
        mode="time"
        display="spinner"
        minuteInterval={minuteInterval}
        onChange={onIosChange}
        locale="sr-Latn-RS"
        style={styles.iosPicker}
      />
      <View style={styles.sheetActions}>
        <View style={styles.sheetBtn}>
          <Button title="Otkaži" variant="secondary" onPress={closePicker} fullWidth />
        </View>
        <View style={styles.sheetBtn}>
          <Button title="Potvrdi" onPress={() => applyTime(draftTime)} fullWidth />
        </View>
      </View>
    </>
  )

  return (
    <View style={styles.wrap}>
      {label ? <Text variant="label">{label}</Text> : null}
      <Pressable
        style={[styles.timeRow, disabled && styles.timeRowDisabled]}
        onPress={openPicker}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label ?? placeholder}
      >
        <Text color={displayColor} style={styles.timeText}>
          {displayText}
        </Text>
        <Ionicons name="time-outline" size={22} color={colors.brand} />
      </Pressable>

      {optional && value ? (
        <Button title="Ukloni vreme" variant="ghost" onPress={() => onChange(null)} />
      ) : null}

      {Platform.OS === 'android' && showPicker ? (
        <DateTimePicker
          value={draftTime}
          mode="time"
          display="default"
          minuteInterval={minuteInterval}
          is24Hour
          onChange={onAndroidChange}
        />
      ) : null}

      {useInlineIos && showPicker ? (
        <View style={styles.inlinePicker}>{iosPicker}</View>
      ) : null}

      {Platform.OS === 'ios' && !useInlineIos && showPicker ? (
        <Modal visible transparent animationType="slide" onRequestClose={closePicker}>
          <Pressable style={styles.overlay} onPress={closePicker}>
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.sheetHeader}>
                <Text variant="label">{label ?? 'Izaberi vreme'}</Text>
              </View>
              {iosPicker}
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  timeRow: {
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
  timeRowDisabled: { opacity: 0.5 },
  timeText: { flex: 1, marginRight: spacing.sm },
  inlinePicker: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
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
    paddingBottom: spacing.md,
  },
  sheetBtn: { flex: 1 },
})
