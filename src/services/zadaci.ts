import api from './api'
import type { Task, ZadatakRole } from '../types/zadatak'

export interface CreateZadatakPayload {
  naziv: string
  opis: string
  deadline: string | null
  hitno: boolean
  allowedRoles: ZadatakRole[]
  allowAll: boolean
}

function unwrapTask(data: unknown): Task {
  const d = data as { zadatak?: Task } | Task
  if (d && typeof d === 'object' && 'zadatak' in d && d.zadatak) return d.zadatak
  return d as Task
}

export async function fetchZadaci() {
  const res = await api.get('/api/zadaci')
  const list = Array.isArray(res.data) ? res.data : res.data.zadaci || []
  return list as Task[]
}

export async function createZadatak(body: CreateZadatakPayload) {
  const res = await api.post('/api/zadaci', body)
  return unwrapTask(res.data)
}

export async function preuzmiZadatak(taskId: number) {
  const res = await api.post(`/api/zadaci/${taskId}/preuzmi`)
  return unwrapTask(res.data)
}

export async function napustiZadatak(taskId: number) {
  const res = await api.post(`/api/zadaci/${taskId}/napusti`)
  return unwrapTask(res.data)
}

export async function updateZadatak(taskId: number, data: CreateZadatakPayload) {
  const res = await api.patch(`/api/zadaci/${taskId}`, data)
  return unwrapTask(res.data)
}

export async function zavrsiZadatak(taskId: number) {
  const res = await api.post(`/api/zadaci/${taskId}/zavrsi`)
  return unwrapTask(res.data)
}

export async function deleteZadatak(taskId: number) {
  await api.delete(`/api/zadaci/${taskId}`)
}

export async function fetchZadatakById(taskId: number) {
  const res = await api.get(`/api/zadaci/${taskId}`)
  return unwrapTask(res.data)
}
