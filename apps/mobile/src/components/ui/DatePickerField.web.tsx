import { useMemo } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
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
  /** Kad je true (iOS), picker se prikazuje inline umesto u novom Modal-u. */
  nestedInModal?: boolean
}

function toInputValue(ymd: string | null): string {
  return ymd ?? ''
}

function fromInputValue(raw: string): string | null {
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
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
  const bounds = useMemo(() => {
    const presetBounds = getDateBounds(preset)
    return {
      minimumDate: minimumDateProp ?? presetBounds.minimumDate,
      maximumDate: maximumDateProp ?? presetBounds.maximumDate,
    }
  }, [preset, minimumDateProp, maximumDateProp])

  const min = bounds.minimumDate ? toLocalYMD(bounds.minimumDate) : undefined
  const max = bounds.maximumDate ? toLocalYMD(bounds.maximumDate) : undefined

  const handleChange = (raw: string) => {
    const next = fromInputValue(raw)
    if (!next) {
      onChange(null)
      return
    }
    const parsed = parseLocalDate(next) ?? todayAtMidnight()
    onChange(toLocalYMD(clampDate(parsed, bounds.minimumDate, bounds.maximumDate)))
  }

  return (
    <View style={styles.wrap}>
      {label ? <Text variant="label">{label}</Text> : null}
      <View style={[styles.dateRow, disabled && styles.dateRowDisabled]}>
        <TextInput
          value={toInputValue(value)}
          onChangeText={handleChange}
          editable={!disabled}
          placeholder={placeholder}
          accessibilityLabel={label ?? placeholder}
          style={styles.input}
          // RN Web renders native <input type="date">
          {...({ type: 'date', min, max } as object)}
        />
        {value ? (
          <Text variant="small" color={colors.textMuted}>
            {formatActionDate(value)}
          </Text>
        ) : null}
      </View>

      {optional && value ? (
        <Button title="Ukloni datum" variant="ghost" onPress={() => onChange(null)} />
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
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
})
