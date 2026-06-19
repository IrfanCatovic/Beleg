import { Pressable, StyleSheet, View } from 'react-native'
import { Avatar, Card, Text } from '../../components/ui'
import { FollowButton } from '../../components/shared/FollowButton'
import { colors, radius, spacing } from '../../theme'
import type { MentionUser } from './homeFeedUtils'

interface SuggestedUserCardProps {
  user: MentionUser
  onPress?: () => void
}

export function SuggestedUserCard({ user, onPress }: SuggestedUserCardProps) {
  const name = user.fullName?.trim() || user.username

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>
        <View style={styles.top}>
          <Avatar uri={user.avatar_url} name={name} size={48} />
          <View style={styles.info}>
            <Text variant="label" numberOfLines={1}>
              {name}
            </Text>
            <Text variant="small" color={colors.textMuted} numberOfLines={1}>
              @{user.username}
            </Text>
          </View>
        </View>
        <View style={styles.followWrap}>
          <FollowButton targetId={user.id} />
        </View>
      </Card>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    width: 200,
    marginRight: spacing.sm,
    padding: spacing.md,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  info: { flex: 1, minWidth: 0 },
  followWrap: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
})
