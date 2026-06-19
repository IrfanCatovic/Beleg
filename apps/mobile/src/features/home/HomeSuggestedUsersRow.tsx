import { ScrollView, StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { MentionUser } from './homeFeedUtils'
import { InviteFriendsCard } from './InviteFriendsCard'
import { SuggestedUserCard } from './SuggestedUserCard'

interface HomeSuggestedUsersRowProps {
  users: MentionUser[]
  onPressUser: (user: MentionUser) => void
}

export function HomeSuggestedUsersRow({ users, onPressUser }: HomeSuggestedUsersRowProps) {
  const { t } = useTranslation('home')

  if (users.length === 0) return null

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.accent} />
        <Text variant="label">{t('suggestedUsers')}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {users.map((u) => (
          <SuggestedUserCard key={u.id} user={u} onPress={() => onPressUser(u)} />
        ))}
        <InviteFriendsCard />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md, paddingHorizontal: spacing.lg },
  accent: { width: 4, height: 20, borderRadius: 2, backgroundColor: colors.brand },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
})
