import { FlatList, Pressable, StyleSheet, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { fetchGuidePublicReviews, type GuidePublicReview } from '@beleg/shared/services'
import { client } from '../../api/client'
import { Avatar, ErrorView, Loader, Screen, Text } from '../../components/ui'
import { colors, radius, spacing } from '../../theme'
import {
  formatGuideAverageDisplay,
  getGuideRatingPresentation,
} from './profileIdentity'
import type {
  ActionsStackParamList,
  ClubStackParamList,
  ExploreStackParamList,
  HomeStackParamList,
  ProfileStackParamList,
} from '../../navigation/types'

type Props =
  | NativeStackScreenProps<ProfileStackParamList, 'GuideReviews'>
  | NativeStackScreenProps<HomeStackParamList, 'GuideReviews'>
  | NativeStackScreenProps<ActionsStackParamList, 'GuideReviews'>
  | NativeStackScreenProps<ExploreStackParamList, 'GuideReviews'>
  | NativeStackScreenProps<ClubStackParamList, 'GuideReviews'>

function StarsRow({ score }: { score?: number | null }) {
  const n = score ?? 0
  if (!n) return null
  return (
    <View style={styles.stars} accessibilityLabel={`${n} od 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name="star" size={14} color={i <= n ? '#f59e0b' : colors.border} />
      ))}
    </View>
  )
}

function ReviewCard({
  review,
  onOpenRater,
}: {
  review: GuidePublicReview
  onOpenRater: (username?: string, id?: number) => void
}) {
  const raterName = review.rater?.fullName?.trim() || review.rater?.username || 'Korisnik'
  const canOpen = !!(review.rater?.username || review.rater?.id)

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.cardHeader}
        disabled={!canOpen}
        onPress={() => onOpenRater(review.rater?.username, review.rater?.id)}
        accessibilityRole={canOpen ? 'button' : 'text'}
        accessibilityLabel={raterName}
      >
        <Avatar uri={review.rater?.avatar_url} name={raterName} size={40} />
        <View style={styles.cardHeaderText}>
          <Text variant="label" numberOfLines={1}>
            {raterName}
          </Text>
          {review.akcija ? (
            <Text variant="small" color={colors.textMuted} numberOfLines={1}>
              {review.akcija.naziv}
              {review.akcija.datum
                ? ` · ${new Date(review.akcija.datum).toLocaleDateString('sr-Latn-RS')}`
                : ''}
            </Text>
          ) : null}
        </View>
        <StarsRow score={review.ocena} />
      </Pressable>
      {review.komentar?.trim() ? (
        <Text style={styles.comment}>{review.komentar.trim()}</Text>
      ) : (
        <Text variant="small" color={colors.textSubtle} style={styles.noComment}>
          Bez komentara.
        </Text>
      )}
    </View>
  )
}

export default function GuideReviewsScreen({ route, navigation }: Props) {
  const userKey = route.params.username || String(route.params.id ?? '')

  const reviewsQuery = useQuery({
    queryKey: ['guide-reviews', userKey],
    queryFn: () => fetchGuidePublicReviews(client, userKey),
    enabled: !!userKey,
  })

  const data = reviewsQuery.data
  const summary = data?.summary
  const presentation = getGuideRatingPresentation(summary)
  const guideName = data?.guide.fullName?.trim() || data?.guide.username || 'Vodič'
  const avg =
    presentation.hasRatings && presentation.averageLabel
      ? presentation.averageLabel
      : formatGuideAverageDisplay(summary?.prosecnaOcena) || '—'
  const count = presentation.reviewCount

  const openRater = (username?: string, id?: number) => {
    if (!username && id == null) return
    ;(navigation as { navigate: (name: string, params: object) => void }).navigate('UserProfile', {
      username,
      id,
    })
  }

  if (reviewsQuery.isLoading) {
    return (
      <Screen>
        <Loader />
      </Screen>
    )
  }

  if (reviewsQuery.isError || !data) {
    return (
      <Screen>
        <ErrorView
          message="Recenzije nisu učitane."
          onRetry={() => void reviewsQuery.refetch()}
        />
      </Screen>
    )
  }

  return (
    <Screen padded={false} edges={['left', 'right', 'bottom']}>
      <FlatList
        data={data.recenzije}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text variant="heading" accessibilityRole="header">
              {guideName}
            </Text>
            <Text variant="small" color={colors.textMuted}>
              Ocene i komentari vodiča
            </Text>
            <View style={styles.summaryChip} accessibilityRole="summary">
              <Ionicons name="star" size={16} color="#f59e0b" />
              <Text variant="label" style={styles.summaryText}>
                {presentation.hasRatings ? `${avg} (${count})` : 'Još nema ocjena'}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <Text color={colors.textMuted} style={styles.empty}>
            Još nema recenzija.
          </Text>
        }
        renderItem={({ item }) => <ReviewCard review={item} onOpenRater={openRater} />}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  list: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  header: {
    gap: spacing.xs,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  summaryChip: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  summaryText: { fontWeight: '800' },
  empty: { textAlign: 'center', paddingVertical: spacing.xl },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardHeaderText: { flex: 1, minWidth: 0, gap: 2 },
  stars: { flexDirection: 'row', gap: 1 },
  comment: { color: colors.text, lineHeight: 20 },
  noComment: { fontStyle: 'italic' },
})
