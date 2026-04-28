import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import Loader from '../../components/Loader'
import NewTaskModal, { type Role } from '../../components/NewTaskModal'
import EditTaskModal, { type TaskForEdit } from '../../components/EditTaskModal'
import { useModal } from '../../context/ModalContext'
import TaskCard, { TaskCardFooter, type Task } from '../../components/TaskCard'
import TaskReadOnlyModal from '../../components/TaskReadOnlyModal'

export default function Zadaci() {
  const { t } = useTranslation('tasks')
  const { isLoggedIn, user } = useAuth()
  const { showConfirm, showAlert } = useModal()
  const [searchParams] = useSearchParams()

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [detailTaskId, setDetailTaskId] = useState<number | null>(null)
  const [shareTask, setShareTask] = useState<Task | null>(null)
  const [shareCopied, setShareCopied] = useState(false)

  const detailTask = detailTaskId != null ? tasks.find((t) => t.id === detailTaskId) ?? null : null

  useEffect(() => {
    if (detailTaskId != null && !tasks.some((t) => t.id === detailTaskId)) {
      setDetailTaskId(null)
    }
  }, [tasks, detailTaskId])

  useEffect(() => {
    const fromQuery = Number(searchParams.get('task'))
    if (!Number.isFinite(fromQuery) || fromQuery <= 0) return
    const found = tasks.find((t) => t.id === fromQuery)
    if (found && canSeeTask(found)) {
      setDetailTaskId(found.id)
    }
  }, [tasks, searchParams])

  useEffect(() => {
    if (!isLoggedIn) return
    const fetchTasks = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await api.get('/api/zadaci')
        const list = Array.isArray(res.data) ? res.data : res.data.zadaci || []
        setTasks(list)
      } catch (err: any) {
        setError(err.response?.data?.error || t('loadError'))
      } finally {
        setLoading(false)
      }
    }
    fetchTasks()
  }, [isLoggedIn])

  if (!isLoggedIn || !user) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <div className="h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
          <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <p className="text-sm text-gray-500 font-medium">{t('loginRequired')}</p>
      </div>
    )
  }

  const isClan = user.role === 'clan'
  const isAdminOrSekretar = user.role === 'superadmin' || user.role === 'admin' || user.role === 'sekretar'

  const canSeeTask = (task: Task) => {
    if (!isClan) return true
    return task.allowAll
  }

  const canTakeTask = (task: Task) => {
    if (!user) return false
    if (task.allowAll) return true
    return task.allowedRoles?.includes(user.role as Role)
  }

  const hasTakenTask = (task: Task) => {
    if (!user || !task.assignees) return false
    return task.assignees.some((a) => a.username === user.username)
  }

  const visibleTasks = useMemo(() => tasks.filter(canSeeTask), [tasks, isClan])

  const sortByUrgentAndDeadline = <T extends Task>(list: T[]) =>
    [...list].sort((a, b) => {
      if (a.hitno !== b.hitno) return a.hitno ? -1 : 1
      const da = a.deadline ? new Date(a.deadline).getTime() : Infinity
      const db = b.deadline ? new Date(b.deadline).getTime() : Infinity
      if (da !== db) return da - db
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

  const aktivni = useMemo(
    () => sortByUrgentAndDeadline(visibleTasks.filter((t) => t.status === 'aktivni')),
    [visibleTasks]
  )
  const uToku = useMemo(
    () => sortByUrgentAndDeadline(visibleTasks.filter((t) => t.status === 'u_toku')),
    [visibleTasks]
  )
  const zavrseni = useMemo(
    () => sortByUrgentAndDeadline(visibleTasks.filter((t) => t.status === 'zavrsen')),
    [visibleTasks]
  )

  const handleCreateTask = async (data: {
    naziv: string
    opis: string
    deadline: string | null
    hitno: boolean
    allowedRoles: Role[]
    allowAll: boolean
  }) => {
    setError('')
    const body = { ...data }
    const res = await api.post('/api/zadaci', body)
    const created: Task = res.data?.zadatak || res.data
    if (created) setTasks((prev) => [created, ...prev])
  }

  const handleTakeTask = async (task: Task) => {
    if (!canTakeTask(task) || hasTakenTask(task)) return
    const ok = await showConfirm(t('takeConfirm', { name: task.naziv }))
    if (!ok) return
    try {
      const res = await api.post(`/api/zadaci/${task.id}/preuzmi`)
      const updated: Task = res.data?.zadatak || res.data
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } catch (err: any) {
      await showAlert(err.response?.data?.error || t('takeError'))
    }
  }

  const handleLeaveTask = async (task: Task) => {
    if (!hasTakenTask(task)) return
    const ok = await showConfirm(t('leaveConfirm', { name: task.naziv }))
    if (!ok) return
    try {
      const res = await api.post(`/api/zadaci/${task.id}/napusti`)
      const updated: Task = res.data?.zadatak || res.data
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } catch (err: any) {
      await showAlert(err.response?.data?.error || t('leaveError'))
    }
  }

  const handleUpdateTask = async (
    taskId: number,
    data: {
      naziv: string
      opis: string
      deadline: string | null
      hitno: boolean
      allowedRoles: Role[]
      allowAll: boolean
    }
  ) => {
    setError('')
    const res = await api.patch(`/api/zadaci/${taskId}`, data)
    const updated: Task = res.data?.zadatak || res.data
    if (updated) {
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      setEditTask(null)
    }
  }

  const handleZavrsi = async (task: Task) => {
    if (!isAdminOrSekretar) return
    const ok = await showConfirm(t('finishConfirm', { name: task.naziv }))
    if (!ok) return
    try {
      const res = await api.post(`/api/zadaci/${task.id}/zavrsi`)
      const updated: Task = res.data?.zadatak || res.data
      if (updated) setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } catch (err: any) {
      await showAlert(err.response?.data?.error || t('genericError'))
    }
  }

  const handleDelete = async (task: Task) => {
    if (!isAdminOrSekretar) return
    const confirmed = await showConfirm(t('deleteConfirm', { name: task.naziv }), {
      variant: 'danger',
      confirmLabel: t('delete'),
      cancelLabel: t('cancel'),
    })
    if (!confirmed) return
    try {
      await api.delete(`/api/zadaci/${task.id}`)
      setTasks((prev) => prev.filter((t) => t.id !== task.id))
      setEditTask(null)
    } catch (err: any) {
      await showAlert(err.response?.data?.error || t('deleteError'))
    }
  }

  const canShareTask = (task: Task) => {
    if (!user) return false
    return task.assignees?.some((a) => a.username === user.username) ?? false
  }

  const buildTaskShareUrl = (taskId: number) => {
    const base = window.location.origin
    return `${base}/zadaci?task=${taskId}`
  }

  const handleOpenShare = (task: Task) => {
    setShareCopied(false)
    setShareTask(task)
  }

  const handleCloseShare = () => {
    setShareTask(null)
    setShareCopied(false)
  }

  const handleCopyShareLink = async () => {
    if (!shareTask) return
    const link = buildTaskShareUrl(shareTask.id)
    try {
      await navigator.clipboard.writeText(link)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 1400)
    } catch {
      await showAlert('Ne mogu da kopiram link automatski. Kopiraj ga ručno iz polja.')
    }
  }

  const handleWhatsAppShare = () => {
    if (!shareTask) return
    const link = buildTaskShareUrl(shareTask.id)
    const text = `Ima zadatak: ${shareTask.naziv}. Ko zeli da se prikljuci: ${link}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  if (loading) return <Loader />

  return (
    <div className="pb-16 md:pb-10">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-8 space-y-8">

        {/* ══════════ PAGE HEADER ══════════ */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-1 h-6 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 tracking-tight">{t('pageTitle')}</h1>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 ml-3.5 max-w-xl">
              {t('pageSubtitle')}
            </p>
          </div>
          {isAdminOrSekretar && (
            <button
              type="button"
              onClick={() => setNewTaskOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 shadow-sm shadow-emerald-200/60 transition-all"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {t('newTask')}
            </button>
          )}
        </div>

        {/* ══════════ SUMMARY STATS ══════════ */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="grid grid-cols-3 divide-x divide-gray-100">
            <SummaryCell
              icon={<span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
              iconBg="bg-emerald-50"
              count={aktivni.length}
              label={t('active')}
              accent="text-emerald-600"
            />
            <SummaryCell
              icon={
                <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              iconBg="bg-amber-50"
              count={uToku.length}
              label={t('inProgress')}
              accent="text-amber-600"
            />
            <SummaryCell
              icon={
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              iconBg="bg-gray-50"
              count={zavrseni.length}
              label={t('completed')}
              accent="text-gray-500"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex items-start gap-2">
            <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white flex-shrink-0">!</span>
            <span>{error}</span>
          </div>
        )}

        {isAdminOrSekretar && (
          <NewTaskModal open={newTaskOpen} onClose={() => setNewTaskOpen(false)} onCreate={handleCreateTask} />
        )}

        {editTask && (
          <EditTaskModal
            open={!!editTask}
            task={editTask as TaskForEdit}
            onClose={() => setEditTask(null)}
            onSave={handleUpdateTask}
          />
        )}

        <TaskReadOnlyModal
          open={detailTaskId != null && detailTask != null}
          task={detailTask}
          onClose={() => setDetailTaskId(null)}
        />

        {/* ══════════ 1) AKTIVNI ZADACI ══════════ */}
        <section className="space-y-5">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </span>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">{t('activeTasks')}</h2>
            {aktivni.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white">
                {aktivni.length}
              </span>
            )}
          </div>

          {aktivni.length === 0 ? (
            <EmptyState
              icon={
                <svg className="w-6 h-6 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                </svg>
              }
              text={t('emptyActiveText')}
              sub={t('emptyActiveSub')}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {aktivni.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onOpen={() => setDetailTaskId(task.id)}
                  canShare={canShareTask(task)}
                  onShare={handleOpenShare}
                  footer={
                    <TaskCardFooter
                      task={task}
                      username={user.username}
                      userRole={user.role}
                      onTake={handleTakeTask}
                      onLeave={handleLeaveTask}
                      onZavrsi={handleZavrsi}
                      onEdit={(t) => setEditTask(t)}
                      onDelete={handleDelete}
                    />
                  }
                />
              ))}
            </div>
          )}
        </section>

        {/* ══════════ 2) IZVRŠAVAJU SE ══════════ */}
        <section className="space-y-5">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-100">
              <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">{t('inProgressTasks')}</h2>
            {uToku.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                {uToku.length}
              </span>
            )}
          </div>

          {uToku.length === 0 ? (
            <EmptyState
              icon={
                <svg className="w-6 h-6 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              text={t('emptyInProgressText')}
              sub={t('emptyInProgressSub')}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {uToku.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onOpen={() => setDetailTaskId(task.id)}
                  canShare={canShareTask(task)}
                  onShare={handleOpenShare}
                  footer={
                    <TaskCardFooter
                      task={task}
                      username={user.username}
                      userRole={user.role}
                      onTake={handleTakeTask}
                      onLeave={handleLeaveTask}
                      onZavrsi={handleZavrsi}
                      onEdit={(t) => setEditTask(t)}
                      onDelete={handleDelete}
                    />
                  }
                />
              ))}
            </div>
          )}
        </section>

        {/* ══════════ 3) ZAVRŠENI ZADACI ══════════ */}
        <section className="space-y-5">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-gray-100">
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">{t('completedTasks')}</h2>
            {zavrseni.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[10px] font-bold bg-gray-200 text-gray-600">
                {zavrseni.length}
              </span>
            )}
          </div>

          {zavrseni.length === 0 ? (
            <EmptyState
              icon={
                <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              text={t('emptyCompletedText')}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {zavrseni.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onOpen={() => setDetailTaskId(task.id)}
                  canShare={canShareTask(task)}
                  onShare={handleOpenShare}
                  footer={
                    <TaskCardFooter
                      task={task}
                      username={user.username}
                      userRole={user.role}
                      onTake={handleTakeTask}
                      onLeave={handleLeaveTask}
                      onZavrsi={handleZavrsi}
                      onEdit={(t) => setEditTask(t)}
                      onDelete={handleDelete}
                    />
                  }
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {shareTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-3 sm:px-4" onClick={handleCloseShare}>
          <div
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-share-title"
          >
            <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-gray-100 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Podeli zadatak</p>
                <h2 id="task-share-title" className="text-base sm:text-lg font-bold text-gray-900 tracking-tight leading-snug">
                  {shareTask.naziv}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCloseShare}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Zatvori"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 sm:px-6 py-5 space-y-4">
              <p className="text-sm text-gray-600">Pošalji članovima link do ovog zadatka da mogu brzo da ga otvore.</p>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Link</label>
                <input
                  readOnly
                  value={buildTaskShareUrl(shareTask.id)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={() => void handleCopyShareLink()}
                  className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  {shareCopied ? 'Kopirano' : 'Kopiraj'}
                </button>
                <button
                  type="button"
                  onClick={handleWhatsAppShare}
                  className="flex-1 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-95"
                >
                  Pošalji na WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════════════ */

function SummaryCell({ icon, iconBg, count, label, accent }: {
  icon: ReactNode
  iconBg: string
  count: number
  label: string
  accent: string
}) {
  return (
    <div className="flex items-center justify-center gap-3 py-4 px-3">
      <div className={`flex-shrink-0 h-8 w-8 rounded-xl ${iconBg} flex items-center justify-center`}>
        {icon}
      </div>
      <div>
        <p className={`text-lg sm:text-xl font-extrabold leading-none tracking-tight ${accent}`}>{count}</p>
        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function EmptyState({ icon, text, sub }: { icon: ReactNode; text: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-10 sm:p-14 text-center max-w-xl mx-auto">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 mb-3">
        {icon}
      </div>
      <p className="text-sm text-gray-500 font-medium">{text}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}
