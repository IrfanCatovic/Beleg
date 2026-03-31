import type { KeyboardEvent, ReactNode } from 'react'
import { formatDateShort } from '../utils/dateUtils'
import { getRoleLabel } from '../utils/roleUtils'
import type { Role } from './NewTaskModal'
import { useTranslation } from 'react-i18next'

export interface TaskAssignee {
  username: string
  fullName?: string
  role: Role | string
}

export interface Task {
  id: number
  naziv: string
  opis: string
  allowedRoles: Role[]
  allowAll: boolean
  deadline: string | null
  hitno: boolean
  status: 'aktivni' | 'u_toku' | 'zavrsen'
  createdAt: string
  assignees?: TaskAssignee[]
}

function canTakeTask(task: Task, userRole: string): boolean {
  if (task.allowAll) return true
  return task.allowedRoles?.includes(userRole as Role) ?? false
}

function hasTakenTask(task: Task, username: string): boolean {
  return task.assignees?.some((a) => a.username === username) ?? false
}

/** Ista logika futera kao na stranici Zadaci — za reuse u listi i na obavestenja/:id */
export function TaskCardFooter({
  task,
  username,
  userRole,
  onTake,
  onLeave,
  onZavrsi,
  onEdit,
  onDelete,
}: {
  task: Task
  username: string
  userRole: string
  onTake: (t: Task) => void
  onLeave: (t: Task) => void
  onZavrsi: (t: Task) => void
  onEdit: (t: Task) => void
  onDelete: (t: Task) => void
}) {
  const { t } = useTranslation('shared')
  const isAdminOrSekretar = userRole === 'superadmin' || userRole === 'admin' || userRole === 'sekretar'
  const canTake = canTakeTask(task, userRole)
  const alreadyTaken = hasTakenTask(task, username)

  if (task.status === 'aktivni') {
    return alreadyTaken ? (
      <button
        type="button"
        onClick={() => onLeave(task)}
        className="w-full py-2.5 text-center text-xs font-semibold text-rose-700 bg-rose-50/90 hover:bg-rose-100 border-t border-rose-100/80 transition-colors"
      >
        {t('taskCard.cancel')}
      </button>
    ) : canTake ? (
      <button
        type="button"
        onClick={() => onTake(task)}
        className="w-full py-2.5 text-center text-xs font-semibold text-white bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 transition-all"
      >
        {t('taskCard.takeTask')}
      </button>
    ) : (
      <div className="w-full py-2.5 text-center text-xs font-semibold text-gray-400 bg-gray-50">{t('taskCard.noPermission')}</div>
    )
  }

  if (task.status === 'u_toku') {
    return (
      <div className="flex flex-col sm:flex-row gap-0 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
        {!alreadyTaken && canTake ? (
          <button
            type="button"
            onClick={() => onTake(task)}
            className="flex-1 py-2.5 text-center text-xs font-semibold text-white bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 transition-all"
          >
            {t('taskCard.join')}
          </button>
        ) : alreadyTaken ? (
          <button
            type="button"
            onClick={() => onLeave(task)}
            className="flex-1 py-2.5 text-center text-xs font-semibold text-rose-700 bg-rose-50/90 hover:bg-rose-100 transition-colors"
          >
            {t('taskCard.cancel')}
          </button>
        ) : null}
        {isAdminOrSekretar && (
          <>
            <button
              type="button"
              onClick={() => onEdit(task)}
              className="flex-1 py-2.5 text-center text-xs font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              {t('taskCard.edit')}
            </button>
            <button
              type="button"
              onClick={() => onZavrsi(task)}
              className="flex-1 py-2.5 text-center text-xs font-semibold text-amber-600 hover:bg-amber-50 transition-colors"
            >
              {t('taskCard.finish')}
            </button>
          </>
        )}
      </div>
    )
  }

  // zavrsen
  return isAdminOrSekretar ? (
    <button
      type="button"
      onClick={() => onDelete(task)}
      className="w-full py-2.5 text-center text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
    >
      {t('taskCard.deleteTask')}
    </button>
  ) : (
    <div className="w-full py-2.5 text-center text-xs font-semibold text-gray-400 bg-gray-50/80">{t('taskCard.done')}</div>
  )
}

export default function TaskCard({
  task,
  footer,
  onOpen,
}: {
  task: Task
  footer: ReactNode
  onOpen?: () => void
}) {
  const { t } = useTranslation('shared')
  const isUrgent = task.hitno
  const isFinished = task.status === 'zavrsen'

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onOpen) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen()
    }
  }

  return (
    <div
      className={`group flex flex-col rounded-2xl border shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
        isUrgent
          ? 'border-rose-200 bg-white ring-1 ring-rose-100'
          : isFinished
            ? 'border-gray-100 bg-white opacity-80'
            : 'border-gray-100 bg-white'
      }`}
    >
      {isUrgent && <div className="h-1 bg-gradient-to-r from-rose-400 via-red-500 to-rose-400" />}

      <div
        className={`p-4 sm:p-5 flex-1 flex flex-col gap-3 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-inset rounded-t-2xl ${
          onOpen ? 'cursor-pointer' : ''
        }`}
        onClick={onOpen}
        onKeyDown={handleKeyDown}
        role={onOpen ? 'button' : undefined}
        tabIndex={onOpen ? 0 : undefined}
        aria-label={onOpen ? t('taskCard.openDetails', { name: task.naziv }) : undefined}
      >
        <div className="flex items-start justify-between gap-2">
          <h3
            className={`text-sm sm:text-base font-bold text-gray-900 line-clamp-2 leading-snug ${
              isFinished ? 'line-through text-gray-500' : 'group-hover:text-emerald-600 transition-colors'
            }`}
          >
            {task.naziv}
          </h3>
          <span
            className={`flex-shrink-0 inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              isUrgent ? 'bg-rose-500 text-white' : isFinished ? 'bg-gray-100 text-gray-400' : 'bg-gray-50 text-gray-500 border border-gray-100'
            }`}
          >
            {isUrgent ? t('taskCard.urgent') : isFinished ? t('taskCard.doneShort') : t('taskCard.task')}
          </span>
        </div>

        {task.opis && <p className="text-xs sm:text-sm text-gray-600 line-clamp-3 sm:line-clamp-none leading-relaxed">{task.opis}</p>}

        <div className="mt-auto space-y-2 pt-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-gray-500">
            <span className="inline-flex items-center gap-1">
              <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                />
              </svg>
              <span className="font-medium">
                {task.allowAll
                  ? t('taskCard.everyone')
                  : task.allowedRoles?.length
                    ? task.allowedRoles.map((r) => getRoleLabel(r)).join(', ')
                    : t('taskCard.empty')}
              </span>
            </span>
            {task.deadline && (
              <span className="inline-flex items-center gap-1">
                <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                  />
                </svg>
                <span className="font-medium">{formatDateShort(task.deadline)}</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">{formatDateShort(task.createdAt)}</span>
            </span>
          </div>

          {task.assignees && task.assignees.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-gray-50">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mr-0.5">{t('taskCard.working')}:</span>
              {task.assignees.map((a) => (
                <span
                  key={a.username}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-100"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {a.fullName || a.username}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-gray-100">{footer}</div>
    </div>
  )
}
