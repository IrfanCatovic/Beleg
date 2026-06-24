import { StyleSheet, TextInput, View } from 'react-native'
import { isValidHHMM } from '@beleg/shared'
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
}

function fromInputValue(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  return isValidHHMM(trimmed) ? trimmed : null
}

export function TimePickerField({
  label,
  value,
  onChange,
  optional = false,
  placeholder = 'Izaberi vreme',
  disabled = false,
}: TimePickerFieldProps) {
  const handleChange = (raw: string) => {
    const next = fromInputValue(raw)
    if (raw.trim() === '') {
      onChange(null)
      return
    }
    if (next) onChange(next)
  }

  return (
    <View style={styles.wrap}>
      {label ? <Text variant="label">{label}</Text> : null}
      <View style={[styles.timeRow, disabled && styles.timeRowDisabled]}>
        <TextInput
          value={value ?? ''}
          onChangeText={handleChange}
          editable={!disabled}
          placeholder={placeholder}
          accessibilityLabel={label ?? placeholder}
          style={styles.input}
          {...({ type: 'time' } as object)}
        />
      </View>

      {optional && value ? (
        <Button title="Ukloni vreme" variant="ghost" onPress={() => onChange(null)} />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    minHeight: 48,
  },
  timeRowDisabled: { opacity: 0.5 },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
})
