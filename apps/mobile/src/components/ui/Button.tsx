import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
} from 'react-native'
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string
  variant?: Variant
  loading?: boolean
  fullWidth?: boolean
}

export function Button({
  title,
  variant = 'primary',
  loading = false,
  fullWidth = false,
  disabled,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading
  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        fullWidth && styles.fullWidth,
        (pressed || isDisabled) && styles.dimmed,
      ]}
      disabled={isDisabled}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? colors.brand : colors.white} />
      ) : (
        <Text style={[styles.text, textStyles[variant]]}>{title}</Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { alignSelf: 'stretch' },
  dimmed: { opacity: 0.6 },
  text: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
})

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.brand }, // emerald-600 kao web CTA
  secondary: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  danger: { backgroundColor: colors.danger },
  ghost: { backgroundColor: 'transparent' },
})

const textStyles = StyleSheet.create({
  primary: { color: colors.white },
  secondary: { color: colors.text },
  danger: { color: colors.white },
  ghost: { color: colors.brand },
})
