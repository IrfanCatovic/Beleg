import { Text as RNText, StyleSheet, type TextProps as RNTextProps } from 'react-native'
import { colors, fontSize, fontWeight } from '../../theme'

type Variant = 'title' | 'heading' | 'body' | 'muted' | 'small' | 'label'

interface TextProps extends RNTextProps {
  variant?: Variant
  color?: string
}

export function Text({ variant = 'body', color, style, ...rest }: TextProps) {
  return <RNText style={[styles[variant], color ? { color } : null, style]} {...rest} />
}

const styles = StyleSheet.create({
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.text },
  heading: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text },
  body: { fontSize: fontSize.md, color: colors.text },
  muted: { fontSize: fontSize.sm, color: colors.textMuted },
  small: { fontSize: fontSize.xs, color: colors.textMuted },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
})
