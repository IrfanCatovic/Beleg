import { Image, Pressable, StyleSheet, View } from 'react-native'
import type { AkcijaListItem } from '@beleg/shared'
import { computePERForAkcija, formatActionDateShort } from '@beleg/shared'
import { Badge, Button, Card, Text } from '../ui'
import { feedBlockStyle } from './feedStyles'
import { colors, radius, spacing } from '../../theme'

interface ActionCardProps {
  action: AkcijaListItem
  variant?: 'card' | 'feed'
  onPress?: () => void
  signedUp?: boolean
  cancellable?: boolean
  onJoin?: () => void
  onCancel?: () => void
  joinLoading?: boolean
}

function formatDate(datum?: string) {
  return formatActionDateShort(datum)
}

function difficultyStyle(tezina?: string, tip?: string) {
  if (tip === 'via_ferrata') {
    const s = (tezina ?? '').toUpperCase()
    if (s.includes('E')) return { bg: colors.text, text: colors.white }
    if (s.includes('D')) return { bg: colors.rose, text: colors.white }
    if (s.includes('C')) return { bg: colors.warning, text: colors.white }
    if (s.includes('B')) return { bg: '#0ea5e9', text: colors.white }
    if (s.includes('A')) return { bg: colors.brand, text: colors.white }
  }
  const k = (tezina ?? '').toLowerCase()
  if (k.includes('alpin')) return { bg: '#ede9fe', text: '#6d28d9' }
  if (k.includes('tešk') || k.includes('tesk')) return { bg: '#ffe4e6', text: '#be123c' }
  if (k.includes('sred')) return { bg: '#fef3c7', text: '#b45309' }
  if (k.includes('lak')) return { bg: '#d1fae5', text: '#047857' }
  return { bg: colors.surfaceAlt, text: colors.textMuted }
}

export function ActionCard({
  action,
  variant = 'card',
  onPress,
  signedUp,
  cancellable,
  onJoin,
  onCancel,
  joinLoading,
}: ActionCardProps) {
  const isPast = action.isCompleted
  const isGuide = action.organizatorTip === 'vodic'
  const per = computePERForAkcija(action)
  const diff = difficultyStyle(action.tezina, action.tipAkcije)
  const borderColor = isGuide ? '#c4b5fd' : action.javna ? '#fde68a' : colors.border
  const isFeed = variant === 'feed'

  const content = (
    <>
      <View style={styles.imageWrap}>
        {action.slikaUrl ? (
          <Image source={{ uri: action.slikaUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imageFallback]} />
        )}
        <View style={styles.imageOverlay} />
        <View style={styles.imageBadges}>
          <Text style={styles.dateBadge}>{formatDate(action.datum)}</Text>
          {action.tipAkcije !== 'via_ferrata' && per > 0 ? (
            <Text style={styles.perBadge}>+{per} PER</Text>
          ) : null}
        </View>
        {isGuide ? (
          <View style={styles.topLeft}>
            <Badge label="Vodič" tone="muted" />
          </View>
        ) : null}
        {action.javna && !isGuide ? (
          <View style={styles.topLeft}>
            <Badge label="Javna" tone="warning" />
          </View>
        ) : null}
        {action.zimskiUspon ? (
          <View style={styles.topRight}>
            <Badge label="Zimski" tone="muted" />
          </View>
        ) : null}
      </View>

      <View style={[styles.body, isFeed && styles.feedPadded]}>
        <Text variant="label" style={styles.title}>
          {action.naziv}
        </Text>
        <Text variant="small" color={colors.textMuted} numberOfLines={1}>
          {action.planina ? `${action.planina} — ${action.vrh}` : action.vrh}
          {action.visinaVrhM != null ? ` · ${action.visinaVrhM} m` : ''}
        </Text>
        {action.javna && action.klubNaziv ? (
          <Text variant="small" color={colors.warning} numberOfLines={1}>
            {action.klubNaziv}
          </Text>
        ) : null}
        <View style={styles.statsRow}>
          {action.duzinaStazeKm != null ? (
            <Text variant="small" color={colors.textMuted}>
              {action.duzinaStazeKm.toFixed(1)} km
            </Text>
          ) : null}
          {action.kumulativniUsponM != null ? (
            <Text variant="small" color={colors.textMuted}>
              {action.kumulativniUsponM.toLocaleString('sr-RS')} m
            </Text>
          ) : null}
        </View>
        <View style={styles.footerRow}>
          <View style={[styles.diffBadge, { backgroundColor: diff.bg }]}>
            <Text style={[styles.diffText, { color: diff.text }]}>{action.tezina || '—'}</Text>
          </View>
          {signedUp ? <Badge label="Prijavljen" tone="brand" /> : null}
          {isPast ? <Badge label="Završena" tone="muted" /> : null}
        </View>
      </View>

      {!isPast && (onJoin || onCancel) ? (
        <View style={[styles.actionRow, isFeed && styles.feedPadded]}>
          {cancellable && onCancel ? (
            <Button title="Otkaži prijavu" variant="ghost" onPress={onCancel} fullWidth />
          ) : signedUp ? (
            <Text variant="small" color={colors.brand} style={styles.signedText}>
              Prijavljeni ste
            </Text>
          ) : onJoin ? (
            <Button title="Prijavi se" onPress={onJoin} loading={joinLoading} fullWidth />
          ) : null}
        </View>
      ) : null}
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
      <Card style={[styles.card, { borderColor }]}>{content}</Card>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md, padding: 0, overflow: 'hidden', borderWidth: 1 },
  feedWrap: {
    ...feedBlockStyle,
  },
  feedPadded: { paddingHorizontal: spacing.lg },
  imageWrap: { height: 180, backgroundColor: colors.surfaceAlt },
  image: { width: '100%', height: '100%' },
  imageFallback: { backgroundColor: '#d1d5db' },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  imageBadges: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  dateBadge: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  perBadge: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: colors.brand,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  topLeft: { position: 'absolute', top: spacing.sm, left: spacing.sm },
  topRight: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  body: { padding: spacing.md, gap: spacing.xs },
  title: { lineHeight: 20 },
  statsRow: { flexDirection: 'row', gap: spacing.md },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  diffText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  actionRow: { borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.sm },
  signedText: { textAlign: 'center', paddingVertical: spacing.sm },
})
