import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AppTopBar, Text } from '../../components/ui'
import { colors, radius, spacing } from '../../theme'
import type { ExploreStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<ExploreStackParamList, 'ExploreHome'>

const MENU = [
  { key: 'ferratas', route: 'FerrataList' as const, icon: 'link-outline' as const },
  { key: 'map', route: 'Map' as const, icon: 'map-outline' as const },
  { key: 'guides', route: 'Guides' as const, icon: 'people-outline' as const },
]

export default function ExploreHomeScreen({ navigation }: Props) {
  const { t } = useTranslation('explore')

  return (
    <View style={styles.root}>
      <AppTopBar title={t('title')} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text variant="small" color={colors.textMuted} style={styles.subtitle}>
          {t('subtitle')}
        </Text>
        <View style={styles.menu}>
          {MENU.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => navigation.navigate(item.route)}
              style={styles.card}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={item.icon} size={24} color={colors.brand} />
              </View>
              <View style={styles.cardBody}>
                <Text variant="label">{t(item.key)}</Text>
                <Text variant="small" color={colors.textMuted}>
                  {t(`${item.key}Hint`)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg },
  subtitle: { marginBottom: spacing.lg },
  menu: { gap: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  cardBody: { flex: 1, gap: 2 },
})
