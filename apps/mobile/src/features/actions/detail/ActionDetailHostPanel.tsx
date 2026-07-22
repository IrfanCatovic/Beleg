import { StyleSheet } from 'react-native'
import type { AkcijaDetail } from '@beleg/shared'
import { Button, Card } from '../../../components/ui'
import { spacing } from '../../../theme'
import { SectionHeader } from './SectionHeader'

interface ActionDetailHostPanelProps {
  akcija: AkcijaDetail
  canManageHost: boolean
  onFinish: () => void
  onEdit: () => void
  onDelete: () => void
  onPdfPrePolaska: () => void
  onPdfZavrsena: () => void
  onShare: () => void
  loading?: boolean
}

export function ActionDetailHostPanel({
  akcija,
  canManageHost,
  onFinish,
  onEdit,
  onDelete,
  onPdfPrePolaska,
  onPdfZavrsena,
  onShare,
  loading,
}: ActionDetailHostPanelProps) {
  if (!canManageHost) return null

  return (
    <Card style={styles.card}>
      <SectionHeader title="Upravljanje akcijom" />
      {!akcija.isCompleted ? (
        <Button title="Podeli na WhatsApp" variant="secondary" onPress={onShare} loading={loading} fullWidth />
      ) : null}
      {!akcija.isCompleted ? (
        <Button title="Završi akciju" onPress={onFinish} loading={loading} fullWidth />
      ) : null}
      {!akcija.isCompleted ? (
        <Button title="Izmeni akciju" variant="secondary" onPress={onEdit} fullWidth />
      ) : null}
      {!akcija.isCompleted ? (
        <Button title="PDF pre polaska" variant="ghost" onPress={onPdfPrePolaska} fullWidth />
      ) : null}
      {akcija.isCompleted ? (
        <Button title="PDF završena" variant="ghost" onPress={onPdfZavrsena} fullWidth />
      ) : null}
      <Button title="Obriši akciju" variant="secondary" onPress={onDelete} loading={loading} fullWidth />
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.xxl, gap: spacing.sm },
})
