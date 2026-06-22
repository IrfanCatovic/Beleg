import { useCallback, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Task, TaskFormData } from '@beleg/shared'
import { getApiErrorMessage } from '@beleg/shared'
import {
  createZadatak,
  deleteZadatak,
  napustiZadatak,
  preuzmiZadatak,
  updateZadatak,
  zavrsiZadatak,
} from '@beleg/shared/services'
import { client } from '../../api/client'
import { useModal } from '../../context/ModalContext'
import type { TaskActionKind } from './types'

export function useTaskActions() {
  const queryClient = useQueryClient()
  const { showAlert, showConfirm } = useModal()
  const [pending, setPending] = useState<{ id: number; action: TaskActionKind } | null>(null)

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['zadaci'] })
    void queryClient.invalidateQueries({ queryKey: ['zadatak'] })
  }, [queryClient])

  const isLoading = useCallback(
    (taskId: number, action: TaskActionKind) =>
      pending?.id === taskId && pending?.action === action,
    [pending],
  )

  const preuzmiMutation = useMutation({
    mutationFn: (id: number) => preuzmiZadatak(client, id),
    onSuccess: invalidate,
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Preuzimanje nije uspelo.')),
    onSettled: () => setPending(null),
  })

  const napustiMutation = useMutation({
    mutationFn: (id: number) => napustiZadatak(client, id),
    onSuccess: invalidate,
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Napuštanje nije uspelo.')),
    onSettled: () => setPending(null),
  })

  const zavrsiMutation = useMutation({
    mutationFn: (id: number) => zavrsiZadatak(client, id),
    onSuccess: invalidate,
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Završetak nije uspeo.')),
    onSettled: () => setPending(null),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteZadatak(client, id),
    onSuccess: invalidate,
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Brisanje nije uspelo.')),
    onSettled: () => setPending(null),
  })

  const createMutation = useMutation({
    mutationFn: (body: TaskFormData) => createZadatak(client, body),
    onSuccess: invalidate,
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Kreiranje nije uspelo.')),
    onSettled: () => setPending(null),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: TaskFormData }) => updateZadatak(client, id, body),
    onSuccess: invalidate,
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Izmena nije uspela.')),
    onSettled: () => setPending(null),
  })

  const handleTake = useCallback(
    async (task: Task) => {
      const label = task.status === 'u_toku' ? 'Pridruži se' : 'Preuzmi zadatak'
      const ok = await showConfirm(label, `Želite da preuzmete „${task.naziv}"?`)
      if (!ok) return
      setPending({ id: task.id, action: 'take' })
      preuzmiMutation.mutate(task.id)
    },
    [preuzmiMutation, showConfirm],
  )

  const handleLeave = useCallback(
    async (task: Task) => {
      const ok = await showConfirm('Otkaži prijavu', `Napustiti zadatak „${task.naziv}"?`, {
        variant: 'danger',
        confirmLabel: 'Napusti',
      })
      if (!ok) return
      setPending({ id: task.id, action: 'leave' })
      napustiMutation.mutate(task.id)
    },
    [napustiMutation, showConfirm],
  )

  const handleFinish = useCallback(
    async (task: Task) => {
      const ok = await showConfirm('Završi zadatak', `Označiti „${task.naziv}" kao završen?`)
      if (!ok) return
      setPending({ id: task.id, action: 'finish' })
      zavrsiMutation.mutate(task.id)
    },
    [showConfirm, zavrsiMutation],
  )

  const handleDelete = useCallback(
    async (task: Task) => {
      const ok = await showConfirm('Obriši zadatak', `Trajno obrisati „${task.naziv}"?`, {
        variant: 'danger',
        confirmLabel: 'Obriši',
      })
      if (!ok) return
      setPending({ id: task.id, action: 'delete' })
      deleteMutation.mutate(task.id)
    },
    [deleteMutation, showConfirm],
  )

  const handleCreate = useCallback(
    async (body: TaskFormData) => {
      setPending({ id: 0, action: 'create' })
      await createMutation.mutateAsync(body)
    },
    [createMutation],
  )

  const handleUpdate = useCallback(
    async (taskId: number, body: TaskFormData) => {
      setPending({ id: taskId, action: 'update' })
      await updateMutation.mutateAsync({ id: taskId, body })
    },
    [updateMutation],
  )

  return {
    handleTake,
    handleLeave,
    handleFinish,
    handleDelete,
    handleCreate,
    handleUpdate,
    isLoading,
    isFormSubmitting: createMutation.isPending || updateMutation.isPending,
  }
}
