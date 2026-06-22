import { useEffect, useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Task, TaskFormData, ZadatakRole } from '@beleg/shared'
import { Button, DatePickerField, Input, Text } from '../ui'
import { getRoleLabel } from '../../utils/profileRank'
import { colors, spacing } from '../../theme'

const ROLE_OPTIONS: ZadatakRole[] = ['admin', 'sekretar', 'vodic', 'blagajnik', 'menadzer-opreme']

const emptyForm: TaskFormData = {
  naziv: '',
  opis: '',
  deadline: null,
  hitno: false,
  allowedRoles: [],
  allowAll: false,
}

type TaskFormModalProps =
  | {
      mode: 'create'
      visible: boolean
      onClose: () => void
      onSubmit: (data: TaskFormData) => Promise<void>
      submitting?: boolean
    }
  | {
      mode: 'edit'
      visible: boolean
      task: Task | null
      onClose: () => void
      onSubmit: (taskId: number, data: TaskFormData) => Promise<void>
      submitting?: boolean
    }

export function TaskFormModal(props: TaskFormModalProps) {
  const isCreate = props.mode === 'create'
  const task = props.mode === 'edit' ? props.task : null
  const visible = props.visible

  const [naziv, setNaziv] = useState('')
  const [opis, setOpis] = useState('')
  const [deadline, setDeadline] = useState<string | null>(null)
  const [hitno, setHitno] = useState(false)
  const [allowedRoles, setAllowedRoles] = useState<ZadatakRole[]>([])
  const [allowAll, setAllowAll] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) return
    if (isCreate) {
      setNaziv('')
      setOpis('')
      setDeadline(null)
      setHitno(false)
      setAllowedRoles([])
      setAllowAll(false)
      setError('')
      return
    }
    if (task) {
      setNaziv(task.naziv)
      setOpis(task.opis ?? '')
      setDeadline(task.deadline)
      setHitno(task.hitno)
      setAllowedRoles(task.allowedRoles ?? [])
      setAllowAll(task.allowAll ?? false)
      setError('')
    }
  }, [visible, isCreate, task])

  if (!visible || (!isCreate && !task)) return null

  const toggleRole = (role: ZadatakRole) => {
    setAllowedRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]))
  }

  const handleSubmit = async () => {
    if (!naziv.trim()) {
      setError('Unesite naziv zadatka.')
      return
    }
    if (!allowAll && allowedRoles.length === 0) {
      setError('Izaberite bar jednu ulogu ili opciju „Svi".')
      return
    }
    const payload: TaskFormData = {
      naziv: naziv.trim(),
      opis: opis.trim(),
      deadline,
      hitno,
      allowedRoles,
      allowAll,
    }
    setError('')
    try {
      if (isCreate) {
        await props.onSubmit(payload)
      } else if (task) {
        await props.onSubmit(task.id, payload)
      }
      props.onClose()
    } catch {
      // parent shows alert
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={props.onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text variant="heading">{isCreate ? 'Novi zadatak' : 'Izmeni zadatak'}</Text>
          <Pressable onPress={props.onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {error ? (
            <Text variant="small" color={colors.danger}>
              {error}
            </Text>
          ) : null}

          <Input label="Naziv *" value={naziv} onChangeText={setNaziv} />
          <Input
            label="Opis"
            value={opis}
            onChangeText={setOpis}
            multiline
            numberOfLines={3}
            style={styles.textArea}
          />

          <DatePickerField
            label="Rok"
            value={deadline}
            onChange={setDeadline}
            preset="future"
            optional
            placeholder="Izaberi datum (opciono)"
          />

          <View style={styles.switchRow}>
            <Text variant="label">Hitno</Text>
            <Switch value={hitno} onValueChange={setHitno} />
          </View>

          <Text variant="label" style={styles.rolesTitle}>
            Ko može da radi zadatak
          </Text>
          <Pressable style={styles.roleChip} onPress={() => setAllowAll((v) => !v)}>
            <View style={[styles.checkbox, allowAll && styles.checkboxOn]} />
            <Text variant="label">Svi članovi kluba</Text>
          </Pressable>
          {ROLE_OPTIONS.map((role) => (
            <Pressable key={role} style={styles.roleChip} onPress={() => toggleRole(role)}>
              <View style={[styles.checkbox, allowedRoles.includes(role) && styles.checkboxOn]} />
              <Text variant="label">{getRoleLabel(role)}</Text>
            </Pressable>
          ))}

          <Button
            title={isCreate ? 'Kreiraj zadatak' : 'Sačuvaj izmene'}
            onPress={() => void handleSubmit()}
            loading={props.submitting}
            fullWidth
          />
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface, paddingTop: spacing.xl },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rolesTitle: { marginTop: spacing.sm },
  roleChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
  },
  checkboxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
})
