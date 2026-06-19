import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import type { ActionsFilters, DifficultyFilter, DurationFilter, VisibilityFilter } from '../../utils/actionFilters'
import { EMPTY_ACTIONS_FILTERS } from '../../utils/actionFilters'
import { Button, Text } from '../ui'
import { colors, spacing } from '../../theme'

interface ActionsFilterModalProps {
  visible: boolean
  filters: ActionsFilters
  onChange: (next: ActionsFilters) => void
  onClose: () => void
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text variant="small" color={active ? colors.textOnDark : colors.text}>
        {label}
      </Text>
    </Pressable>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <View style={styles.section}>
      <Text variant="label">{title}</Text>
      <View style={styles.chipRow}>{children}</View>
    </View>
  )
}

const MONTHS = [
  { v: 'all' as const, label: 'Svi meseci' },
  { v: 1, label: 'Jan' },
  { v: 2, label: 'Feb' },
  { v: 3, label: 'Mar' },
  { v: 4, label: 'Apr' },
  { v: 5, label: 'Maj' },
  { v: 6, label: 'Jun' },
  { v: 7, label: 'Jul' },
  { v: 8, label: 'Avg' },
  { v: 9, label: 'Sep' },
  { v: 10, label: 'Okt' },
  { v: 11, label: 'Nov' },
  { v: 12, label: 'Dec' },
]

export function ActionsFilterModal({ visible, filters, onChange, onClose }: ActionsFilterModalProps) {
  const set = (patch: Partial<ActionsFilters>) => onChange({ ...filters, ...patch })

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text variant="heading" style={styles.title}>
            Filteri
          </Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Section title="Tip">
              <Chip label="Sve" active={filters.source === 'all'} onPress={() => set({ source: 'all' })} />
              <Chip label="Klupske" active={filters.source === 'club'} onPress={() => set({ source: 'club' })} />
              <Chip label="Vodičke" active={filters.source === 'guide'} onPress={() => set({ source: 'guide' })} />
            </Section>

            <Section title="Vidljivost">
              <Chip
                label="Sve"
                active={filters.visibility === 'all'}
                onPress={() => set({ visibility: 'all' })}
              />
              <Chip
                label="Klupske"
                active={filters.visibility === 'klubske'}
                onPress={() => set({ visibility: 'klubske' as VisibilityFilter })}
              />
              <Chip
                label="Javne"
                active={filters.visibility === 'javne'}
                onPress={() => set({ visibility: 'javne' as VisibilityFilter })}
              />
            </Section>

            <Section title="Mesec">
              {MONTHS.map((m) => (
                <Chip
                  key={String(m.v)}
                  label={m.label}
                  active={filters.month === m.v}
                  onPress={() => set({ month: m.v })}
                />
              ))}
            </Section>

            <Section title="Trajanje">
              <Chip label="Sve" active={filters.duration === 'all'} onPress={() => set({ duration: 'all' })} />
              <Chip
                label="Jednodnevne"
                active={filters.duration === 'oneDay'}
                onPress={() => set({ duration: 'oneDay' as DurationFilter })}
              />
              <Chip
                label="Višednevne"
                active={filters.duration === 'multiDay'}
                onPress={() => set({ duration: 'multiDay' as DurationFilter })}
              />
            </Section>

            <Section title="Težina">
              <Chip label="Sve" active={filters.difficulty === 'all'} onPress={() => set({ difficulty: 'all' })} />
              <Chip
                label="Lako"
                active={filters.difficulty === 'lako'}
                onPress={() => set({ difficulty: 'lako' as DifficultyFilter })}
              />
              <Chip
                label="Srednje"
                active={filters.difficulty === 'srednje'}
                onPress={() => set({ difficulty: 'srednje' as DifficultyFilter })}
              />
              <Chip
                label="Teško"
                active={filters.difficulty === 'tesko'}
                onPress={() => set({ difficulty: 'tesko' as DifficultyFilter })}
              />
              <Chip
                label="Alpinizam"
                active={filters.difficulty === 'alpinizam'}
                onPress={() => set({ difficulty: 'alpinizam' as DifficultyFilter })}
              />
            </Section>
          </ScrollView>

          <View style={styles.footer}>
            <Button title="Resetuj" variant="secondary" onPress={() => onChange(EMPTY_ACTIONS_FILTERS)} />
            <Button title="Primeni" onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  title: { marginBottom: spacing.md },
  section: { marginBottom: spacing.lg, gap: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  chipActive: {
    backgroundColor: colors.navBgMid,
    borderColor: colors.navBgMid,
  },
  footer: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
})
