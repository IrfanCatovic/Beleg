import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native'
import { Text } from './Text'
import { colors, fontSize, radius, spacing } from '../../theme'

interface InputProps extends TextInputProps {
  label?: string
  error?: string
}

export function Input({ label, error, style, ...rest }: InputProps) {
  return (
    <View style={styles.wrap}>
      {label ? <Text variant="label">{label}</Text> : null}
      <TextInput
        style={[styles.input, error ? styles.inputError : null, style]}
        placeholderTextColor={colors.textSubtle}
        {...rest}
      />
      {error ? <Text variant="small" color={colors.danger}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    fontSize: fontSize.md,
    color: colors.text,
    minHeight: 48,
  },
  inputError: { borderColor: colors.danger },
})
