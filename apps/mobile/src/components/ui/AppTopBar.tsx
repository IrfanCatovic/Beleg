import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text } from './Text'
import { colors, fontSize, fontWeight, spacing } from '../../theme'

type IoniconName = keyof typeof Ionicons.glyphMap

interface AppTopBarProps {
  leftIcon?: IoniconName
  onLeftPress?: () => void
  rightIcon?: IoniconName
  onRightPress?: () => void
  rightBadge?: number
  onSearchPress?: () => void
  title?: string
  center?: ReactNode
}

export function AppTopBar({
  leftIcon,
  onLeftPress,
  rightIcon,
  onRightPress,
  rightBadge = 0,
  onSearchPress,
  title,
  center,
}: AppTopBarProps) {
  const insets = useSafeAreaInsets()

  const centerContent =
    center ??
    (title ? (
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
    ) : null)

  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.xs }]}>
      <View style={styles.side}>
        {leftIcon && onLeftPress ? (
          <Pressable onPress={onLeftPress} style={styles.iconBtn} hitSlop={8}>
            <Ionicons name={leftIcon} size={24} color={colors.textOnDark} />
          </Pressable>
        ) : (
          <View style={styles.iconPlaceholder} />
        )}
      </View>

      <View style={styles.center}>{centerContent}</View>

      <View style={[styles.side, styles.sideRight]}>
        <View style={styles.rightCluster}>
          {onSearchPress ? (
            <Pressable onPress={onSearchPress} style={styles.iconBtn} hitSlop={8}>
              <Ionicons name="search-outline" size={22} color={colors.textOnDark} />
            </Pressable>
          ) : null}
          {rightIcon && onRightPress ? (
            <Pressable onPress={onRightPress} style={styles.iconBtn} hitSlop={8}>
              <Ionicons name={rightIcon} size={24} color={colors.textOnDark} />
              {rightBadge > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{rightBadge > 99 ? '99+' : rightBadge}</Text>
                </View>
              ) : null}
            </Pressable>
          ) : !onSearchPress ? (
            <View style={styles.iconPlaceholder} />
          ) : null}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.navBgMid,
    borderBottomWidth: 1,
    borderBottomColor: colors.navBorder,
  },
  side: { width: 88, alignItems: 'flex-start' },
  sideRight: { alignItems: 'flex-end' },
  rightCluster: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textOnDarkMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  iconPlaceholder: { width: 40, height: 40 },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.rose,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: colors.white, fontSize: 9, fontWeight: '700' },
})
