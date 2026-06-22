import type { AxiosInstance } from 'axios'
import type { Task, TaskFormData } from '../types/zadatak'

function unwrapTask(data: unknown): Task {
  const d = data as { zadatak?: Task } | Task
  if (d && typeof d === 'object' && 'zadatak' in d && d.zadatak) return d.zadatak
  return d as Task
}

export async function fetchZadaci(client: AxiosInstance): Promise<Task[]> {
  const res = await client.get('/api/zadaci')
  const list = Array.isArray(res.data) ? res.data : res.data.zadaci || []
  return list as Task[]
}

export async function createZadatak(client: AxiosInstance, body: TaskFormData): Promise<Task> {
  const res = await client.post('/api/zadaci', body)
  return unwrapTask(res.data)
}

export async function preuzmiZadatak(client: AxiosInstance, taskId: number): Promise<Task> {
  const res = await client.post(`/api/zadaci/${taskId}/preuzmi`)
  return unwrapTask(res.data)
}

export async function zavrsiZadatak(client: AxiosInstance, taskId: number): Promise<Task> {
  const res = await client.post(`/api/zadaci/${taskId}/zavrsi`)
  return unwrapTask(res.data)
}

export async function napustiZadatak(client: AxiosInstance, taskId: number): Promise<Task> {
  const res = await client.post(`/api/zadaci/${taskId}/napusti`)
  return unwrapTask(res.data)
}

export async function updateZadatak(
  client: AxiosInstance,
  taskId: number,
  body: Partial<TaskFormData>,
): Promise<Task> {
  const res = await client.patch(`/api/zadaci/${taskId}`, body)
  return unwrapTask(res.data)
}

export async function deleteZadatak(client: AxiosInstance, taskId: number): Promise<void> {
  await client.delete(`/api/zadaci/${taskId}`)
}
