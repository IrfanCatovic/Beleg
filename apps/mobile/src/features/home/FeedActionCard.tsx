import { Pressable, StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { AkcijaListItem } from '@beleg/shared'
import { Avatar, Card, Text } from '../../components/ui'
import { FeedAspectImage } from '../../components/shared/FeedAspectImage'
import { feedBlockStyle } from '../../components/shared/feedStyles'
import { colors, radius, spacing } from '../../theme'
import type { MentionUser } from './homeFeedUtils'
import { difficultyBadgeStyle, formatDateShort, isGuideOrganizedAkcija } from './homeFeedUtils'

interface FeedActionCardProps {
  action: AkcijaListItem
  addedBy?: MentionUser
  variant?: 'card' | 'feed'
  onPress?: () => void
}

export function FeedActionCard({ action, addedBy, variant = 'card', onPress }: FeedActionCardProps) {
  const { t } = useTranslation('home')
  const isGuideAction = isGuideOrganizedAkcija(action)
  const authorName = addedBy?.fullName?.trim() || addedBy?.username
  const posterName = isGuideAction
    ? authorName || t('guideFallback')
    : action.klubNaziv?.trim() || authorName || t('clubMemberFallback')
  const isKlub = !isGuideAction && !!action.klubNaziv && !action.javna
  const posterAvatar = isGuideAction ? addedBy?.avatar_url : action.klubLogoUrl || addedBy?.avatar_url
  const location = [action.planina, action.vrh].filter(Boolean).join(' · ')
  const badgeLabel = isGuideAction ? t('badgeGuide') : isKlub ? t('badgeClub') : t('badgePublic')
  const diff = action.tezina ? difficultyBadgeStyle(action.tezina, action.tipAkcije) : null
  const isFeed = variant === 'feed'

  const content = (
    <>
      <View style={[styles.header, isFeed && styles.feedPadded]}>
        <Avatar uri={posterAvatar} name={posterName} size={40} />
        <View style={styles.headerText}>
          <View style={styles.nameRow}>
            <Text variant="label" numberOfLines={1} style={styles.posterName}>
              {posterName}
            </Text>
            <View
              style={[
                styles.roleBadge,
                isGuideAction ? styles.badgeGuide : isKlub ? styles.badgeClub : styles.badgePublic,
              ]}
            >
              <Text style={styles.roleBadgeText}>{badgeLabel}</Text>
            </View>
          </View>
          <Text variant="small" color={colors.textMuted} numberOfLines={1}>
            {isGuideAction
              ? action.javna
                ? t('publicGuideTour')
                : t('privateGuideTour')
              : authorName
                ? t('addedBy', { name: authorName })
                : t('suggestionForYou')}
          </Text>
        </View>
        <View style={styles.kindBadge}>
          <Text style={styles.kindBadgeText}>{t('actionLabel')}</Text>
        </View>
      </View>

      {action.slikaUrl ? (
        <FeedAspectImage uri={action.slikaUrl} maxHeight={420}>
          <View style={styles.heroOverlay}>
            <Text style={styles.heroTitle}>{action.naziv}</Text>
            {location ? (
              <Text style={styles.heroLocation} numberOfLines={1}>
                {location}
              </Text>
            ) : null}
          </View>
        </FeedAspectImage>
      ) : (
        <View style={[styles.heroWrap, styles.heroFallback]}>
          <View style={styles.heroOverlay}>
            <Text style={styles.heroTitle}>{action.naziv}</Text>
            {location ? (
              <Text style={styles.heroLocation} numberOfLines={1}>
                {location}
              </Text>
            ) : null}
          </View>
        </View>
      )}

      <View style={[styles.body, isFeed && styles.feedPadded]}>
        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <Text variant="small" color={colors.text}>
              {formatDateShort(action.datum)}
            </Text>
          </View>
          {diff?.label ? (
            <View style={[styles.metaChip, { backgroundColor: diff.bg }]}>
              <Text variant="small" style={{ color: diff.text, fontWeight: '600' }}>
                {diff.label}
              </Text>
            </View>
          ) : null}
        </View>

        {action.opis?.trim() ? (
          <Text variant="body" numberOfLines={3} style={styles.opis}>
            {action.opis.trim()}
          </Text>
        ) : null}
      </View>
    </>
  )

  if (isFeed) {
    return (
      <Pressable onPress={onPress} style={styles.feedWrap}>
        {content}
      </Pressable>
    )
  }

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>{content}</Card>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md, padding: 0, overflow: 'hidden' },
  feedWrap: {
    ...feedBlockStyle,
  },
  feedPadded: { paddingHorizontal: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerText: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  posterName: { flexShrink: 1 },
  roleBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  badgeGuide: { backgroundColor: '#e0f2fe' },
  badgeClub: { backgroundColor: '#ede9fe' },
  badgePublic: { backgroundColor: '#d1fae5' },
  roleBadgeText: { fontSize: 9, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  kindBadge: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  kindBadgeText: { fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  heroWrap: { minHeight: 160, backgroundColor: colors.surfaceAlt },
  heroFallback: { backgroundColor: colors.brand },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  heroTitle: { color: colors.white, fontSize: 16, fontWeight: '700' },
  heroLocation: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 2 },
  body: { padding: spacing.md, gap: spacing.sm },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  metaChip: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  opis: { color: colors.text },
})
