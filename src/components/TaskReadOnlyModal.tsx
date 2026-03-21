import { formatDate, formatDateShort } from '../utils/dateUtils'
import { getRoleLabel } from '../utils/roleUtils'
import type { Task } from './TaskCard'

function statusLabel(status: Task['status']): string {
  switch (status) {
    case 'aktivni':
      return 'Aktivan'
    case 'u_toku':
      return 'U toku'
    case 'zavrsen':
      return 'Završen'
    default:
      return status
  }
}

export default function TaskReadOnlyModal({ open, task, onClose }: { open: boolean; task: Task | null; onClose: () => void }) {
  if (!open || !task) return null

  const isUrgent = task.hitno
  const isFinished = task.status === 'zavrsen'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-3 sm:px-4 animate-[fadeIn_150ms_ease-out]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg max-h-[min(90vh,720px)] flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-[scaleIn_200ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-readonly-title"
      >
        <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-gray-100 flex items-start justify-between gap-3 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Detalji zadatka</p>
            <h2 id="task-readonly-title" className="text-base sm:text-lg font-bold text-gray-900 tracking-tight leading-snug">
              {task.naziv}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span
                className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  isFinished ? 'bg-gray-100 text-gray-500' : 'bg-gray-50 text-gray-600 border border-gray-100'
                }`}
              >
                {statusLabel(task.status)}
              </span>
              {isUrgent && (
                <span className="inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-rose-500 text-white">
                  Hitno
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            aria-label="Zatvori"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 sm:px-6 py-5 sm:py-6 overflow-y-auto flex-1 space-y-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Opis</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{task.opis?.trim() ? task.opis : '—'}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Ko može da učestvuje</p>
              <p className="text-gray-800 font-medium">
                {task.allowAll ? 'Svi članovi' : task.allowedRoles?.length ? task.allowedRoles.map((r) => getRoleLabel(r)).join(', ') : '—'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Rok</p>
              <p className="text-gray-800 font-medium">{task.deadline ? formatDate(task.deadline) : 'Bez roka'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Kreiran</p>
              <p className="text-gray-800 font-medium">{formatDateShort(task.createdAt)}</p>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Prijavljeni</p>
            {task.assignees && task.assignees.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {task.assignees.map((a) => (
                  <li
                    key={a.username}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 border border-emerald-100"
                  >
                    <span className="h-2 w-2 rounded-full bg-emerald-400 flex-shrink-0" />
                    <span>{a.fullName || a.username}</span>
                    <span className="text-[11px] text-emerald-600/80">({getRoleLabel(String(a.role))})</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">Još niko nije prijavljen.</p>
            )}
          </div>
        </div>

        <div className="px-5 sm:px-6 py-4 border-t border-gray-100 bg-gray-50/80 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Zatvori
          </button>
        </div>
      </div>
    </div>
  )
}
