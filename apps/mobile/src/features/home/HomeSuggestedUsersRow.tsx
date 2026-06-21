import { ScrollView, StyleSheet } from 'react-native'
import { spacing } from '../../theme'
import type { MentionUser } from './homeFeedUtils'
import { InviteFriendsCard } from './InviteFriendsCard'
import { SuggestedUserCard } from './SuggestedUserCard'

interface HomeSuggestedUsersRowProps {
  users: MentionUser[]
  onPressUser: (user: MentionUser) => void
}

export function HomeSuggestedUsersRow({ users, onPressUser }: HomeSuggestedUsersRowProps) {
  if (users.length === 0) return null

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
      style={styles.wrap}
    >
      {users.map((u) => (
        <SuggestedUserCard key={u.id} user={u} onPress={() => onPressUser(u)} />
      ))}
      <InviteFriendsCard />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  wrap: { marginVertical: spacing.md },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
})
