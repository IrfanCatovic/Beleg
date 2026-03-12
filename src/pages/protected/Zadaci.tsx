import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import Loader from '../../components/Loader'
import { formatDateShort } from '../../utils/dateUtils'
import { getRoleLabel } from '../../utils/roleUtils'
import NewTaskModal, { type Role } from '../../components/NewTaskModal'
import EditTaskModal, { type TaskForEdit } from '../../components/EditTaskModal'

interface TaskAssignee {
  username: string
  fullName?: string
  role: Role
}

interface Task {
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

export default function Zadaci() {
  const { isLoggedIn, user } = useAuth()

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)

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
        setError(err.response?.data?.error || 'Greška pri učitavanju zadataka.')
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
        <p className="text-sm text-gray-500 font-medium">Morate se ulogovati da biste videli zadatke.</p>
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
    if (!confirm(`Da li želite da preuzmete zadatak "${task.naziv}"?`)) return
    try {
      const res = await api.post(`/api/zadaci/${task.id}/preuzmi`)
      const updated: Task = res.data?.zadatak || res.data
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } catch (err: any) {
      alert(err.response?.data?.error || 'Greška pri preuzimanju zadatka.')
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
    if (!confirm(`Označiti zadatak "${task.naziv}" kao završen?`)) return
    try {
      const res = await api.post(`/api/zadaci/${task.id}/zavrsi`)
      const updated: Task = res.data?.zadatak || res.data
      if (updated) setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } catch (err: any) {
      alert(err.response?.data?.error || 'Greška.')
    }
  }

  const handleDelete = async (task: Task) => {
    if (!isAdminOrSekretar) return
    if (!confirm(`Obrisati zadatak "${task.naziv}"?`)) return
    try {
      await api.delete(`/api/zadaci/${task.id}`)
      setTasks((prev) => prev.filter((t) => t.id !== task.id))
      setEditTask(null)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Greška pri brisanju.')
    }
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
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 tracking-tight">Zadaci kluba</h1>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 ml-3.5 max-w-xl">
              Preuzmi aktivne zadatke, prati napredak i sarađuj sa timom.
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
              Novi zadatak
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
              label="Aktivni"
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
              label="U toku"
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
              label="Završeni"
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

        {/* ══════════ 1) AKTIVNI ZADACI ══════════ */}
        <section className="space-y-5">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </span>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">Aktivni zadaci</h2>
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
              text="Trenutno nema aktivnih zadataka."
              sub="Novi zadaci će se pojaviti ovde."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {aktivni.map((task) => {
                const canTake = canTakeTask(task)
                const alreadyTaken = hasTakenTask(task)
                return (
                  <TaskCard
                    key={task.id}
                    task={task}
                    footer={
                      alreadyTaken ? (
                        <div className="w-full py-2.5 text-center text-xs font-semibold text-emerald-600 bg-emerald-50 flex items-center justify-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                          Već si preuzeo ovaj zadatak
                        </div>
                      ) : canTake ? (
                        <button
                          type="button"
                          onClick={() => handleTakeTask(task)}
                          className="w-full py-2.5 text-center text-xs font-semibold text-white bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 transition-all"
                        >
                          Preuzmi zadatak
                        </button>
                      ) : (
                        <div className="w-full py-2.5 text-center text-xs font-semibold text-gray-400 bg-gray-50">
                          Nemaš dozvolu za ovaj zadatak
                        </div>
                      )
                    }
                  />
                )
              })}
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
            <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">Izvršavaju se</h2>
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
              text="Nema zadataka u toku."
              sub="Kada neko preuzme zadatak, pojaviće se ovde."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {uToku.map((task) => {
                const canTake = canTakeTask(task)
                const alreadyTaken = hasTakenTask(task)
                return (
                  <TaskCard
                    key={task.id}
                    task={task}
                    footer={
                      <div className="flex flex-col sm:flex-row gap-0 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
                        {!alreadyTaken && canTake ? (
                          <button
                            type="button"
                            onClick={() => handleTakeTask(task)}
                            className="flex-1 py-2.5 text-center text-xs font-semibold text-white bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 transition-all"
                          >
                            Pridruži se
                          </button>
                        ) : alreadyTaken ? (
                          <div className="flex-1 py-2.5 text-center text-xs font-semibold text-emerald-600 bg-emerald-50 flex items-center justify-center gap-1.5">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                            Učestvuješ
                          </div>
                        ) : null}
                        {isAdminOrSekretar && (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditTask(task)}
                              className="flex-1 py-2.5 text-center text-xs font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                            >
                              Izmeni
                            </button>
                            <button
                              type="button"
                              onClick={() => handleZavrsi(task)}
                              className="flex-1 py-2.5 text-center text-xs font-semibold text-amber-600 hover:bg-amber-50 transition-colors"
                            >
                              Završi
                            </button>
                          </>
                        )}
                      </div>
                    }
                  />
                )
              })}
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
            <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">Završeni zadaci</h2>
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
              text="Nema završenih zadataka."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {zavrseni.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  footer={
                    isAdminOrSekretar ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(task)}
                        className="w-full py-2.5 text-center text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        Obriši zadatak
                      </button>
                    ) : (
                      <div className="w-full py-2.5 text-center text-xs font-semibold text-gray-400 bg-gray-50/80">
                        Završeno
                      </div>
                    )
                  }
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════════════ */

function SummaryCell({ icon, iconBg, count, label, accent }: {
  icon: React.ReactNode
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

function TaskCard({ task, footer }: { task: Task; footer: React.ReactNode }) {
  const isUrgent = task.hitno
  const isFinished = task.status === 'zavrsen'

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
      {/* Urgent accent strip */}
      {isUrgent && (
        <div className="h-1 bg-gradient-to-r from-rose-400 via-red-500 to-rose-400" />
      )}

      <div className="p-4 sm:p-5 flex-1 flex flex-col gap-3">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <h3 className={`text-sm sm:text-base font-bold text-gray-900 line-clamp-2 leading-snug ${isFinished ? 'line-through text-gray-500' : 'group-hover:text-emerald-600 transition-colors'}`}>
            {task.naziv}
          </h3>
          <span
            className={`flex-shrink-0 inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              isUrgent
                ? 'bg-rose-500 text-white'
                : isFinished
                  ? 'bg-gray-100 text-gray-400'
                  : 'bg-gray-50 text-gray-500 border border-gray-100'
            }`}
          >
            {isUrgent ? 'HITNO' : isFinished ? 'Gotovo' : 'Zadatak'}
          </span>
        </div>

        {/* Description */}
        {task.opis && (
          <p className="text-xs sm:text-sm text-gray-600 line-clamp-3 leading-relaxed">{task.opis}</p>
        )}

        {/* Meta info */}
        <div className="mt-auto space-y-2 pt-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-gray-500">
            <span className="inline-flex items-center gap-1">
              <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
              <span className="font-medium">
                {task.allowAll
                  ? 'Svi'
                  : task.allowedRoles?.length
                    ? task.allowedRoles.map((r) => getRoleLabel(r)).join(', ')
                    : '—'}
              </span>
            </span>
            {task.deadline && (
              <span className="inline-flex items-center gap-1">
                <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
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

          {/* Assignees */}
          {task.assignees && task.assignees.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-gray-50">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mr-0.5">Rade:</span>
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

      {/* Footer */}
      <div className="border-t border-gray-100">
        {footer}
      </div>
    </div>
  )
}

function EmptyState({ icon, text, sub }: { icon: React.ReactNode; text: string; sub?: string }) {
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
