import type { Task, ZadatakRole } from '@beleg/shared'

export function canManageTasks(role?: string): boolean {
  return role === 'superadmin' || role === 'admin' || role === 'sekretar'
}

export function canSeeTask(task: Task, userRole?: string): boolean {
  if (userRole !== 'clan') return true
  return task.allowAll
}

export function canTakeTask(task: Task, userRole?: string): boolean {
  if (!userRole) return false
  if (task.allowAll) return true
  return task.allowedRoles?.includes(userRole as ZadatakRole) ?? false
}

export function hasTakenTask(task: Task, username?: string): boolean {
  if (!username) return false
  return task.assignees?.some((a) => a.username === username) ?? false
}
