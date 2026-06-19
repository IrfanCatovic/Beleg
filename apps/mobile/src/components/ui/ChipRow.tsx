import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Text } from './Text'
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme'

export interface ChipOption {
  value: string
  label: string
}

interface ChipRowProps {
  label?: string
  options: ChipOption[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function ChipRow({ label, options, value, onChange, disabled = false }: ChipRowProps) {
  return (
    <View style={styles.wrap}>
      {label ? <Text variant="label">{label}</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
      >
        {options.map((opt) => {
          const selected = opt.value === value
          return (
            <Pressable
              key={opt.value}
              disabled={disabled}
              onPress={() => onChange(opt.value)}
              style={[
                styles.chip,
                selected && styles.chipSelected,
                disabled && styles.chipDisabled,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  selected && styles.chipTextSelected,
                  disabled && styles.chipTextDisabled,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  chipDisabled: { opacity: 0.55 },
  chipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
  },
  chipTextSelected: { color: colors.white },
  chipTextDisabled: { color: colors.textSubtle },
})
