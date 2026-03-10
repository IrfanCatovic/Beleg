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
      <div className="min-h-[60vh] flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Morate se ulogovati</h2>
          <p className="text-gray-600 text-sm">Da biste videli zadatke, potrebno je da se prijavite.</p>
        </div>
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

  const renderTaskCard = (
    task: Task,
    footer: React.ReactNode
  ) => {
    const urgentClasses = task.hitno
      ? 'border-red-400 bg-red-50/90'
      : 'border-gray-200 bg-white'
    const urgentBadgeClasses = task.hitno
      ? 'bg-red-500 text-white'
      : 'bg-gray-100 text-gray-700'

    return (
      <div
        key={task.id}
        className={`flex flex-col rounded-2xl border shadow-sm ${urgentClasses} overflow-hidden`}
      >
        <div className="p-4 sm:p-5 flex-1 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 line-clamp-2">
              {task.naziv}
            </h3>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${urgentBadgeClasses}`}
            >
              {task.hitno ? 'HITNO' : 'Zadatak'}
            </span>
          </div>
          {task.opis && (
            <p className="text-xs sm:text-sm text-gray-700 line-clamp-4">{task.opis}</p>
          )}
          <div className="mt-1 space-y-1.5 text-[11px] text-gray-600">
            <p>
              <span className="font-semibold text-gray-700">Ko može da radi:</span>{' '}
              {task.allowAll
                ? 'Svi'
                : task.allowedRoles?.length
                ? task.allowedRoles.map((r) => getRoleLabel(r)).join(', ')
                : '—'}
            </p>
            {task.deadline && (
              <p>
                <span className="font-semibold text-gray-700">Rok:</span>{' '}
                {formatDateShort(task.deadline)}
              </p>
            )}
            <p>
              <span className="font-semibold text-gray-700">Kreirano:</span>{' '}
              {formatDateShort(task.createdAt)}
            </p>
          </div>
          {task.assignees && task.assignees.length > 0 && (
            <div className="mt-2 rounded-xl bg-white/70 border border-gray-200 px-3 py-2">
              <p className="text-[11px] font-semibold text-gray-700 mb-1">Pridruženi:</p>
              <div className="flex flex-wrap gap-1.5">
                {task.assignees.map((a) => (
                  <span
                    key={a.username}
                    className="inline-flex items-center rounded-full bg-[#41ac53]/5 px-2 py-0.5 text-[11px] text-gray-800 border border-[#41ac53]/20"
                  >
                    {(a.fullName || a.username) ?? a.username}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="border-t border-gray-200 bg-gray-50/80 px-4 py-2.5 flex flex-col gap-2">
          {footer}
        </div>
      </div>
    )
  }

  if (loading) return <Loader />

  return (
    <div className="min-h-screen bg-gray-50 pb-16 md:pb-10">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-8 space-y-6 sm:space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="inline-flex items-center px-4 py-2 rounded-xl bg-[#41ac53]/10 text-gray-900 text-xl sm:text-2xl font-bold tracking-tight">
              Zadaci kluba
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-gray-600 max-w-xl">
              Aktivni zadaci možete preuzeti; izvršavaju se mogu menjati admin/sekretar; završene samo brisati.
            </p>
          </div>
          {isAdminOrSekretar && (
            <button
              type="button"
              onClick={() => setNewTaskOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white text-[#41ac53] border border-[#41ac53]/50 px-3 py-2 text-xs sm:text-sm font-semibold shadow-sm hover:bg-[#41ac53]/5"
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#41ac53] text-white text-sm">+</span>
              <span>Dodaj novi zadatak</span>
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
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

        {/* 1) Aktivni — Preuzmi zadatak */}
        <section className="space-y-4 pb-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">
            Aktivni zadaci
          </h2>
          <p className="text-[11px] text-gray-500">
            Zadaci koje možete preuzeti. Kada neko preuzme, prelaze u „Izvrsavaju se”.
          </p>
          {aktivni.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-6 text-center">
              <p className="text-sm text-gray-600">Trenutno nema aktivnih zadataka.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {aktivni.map((task) => {
                const canTake = canTakeTask(task)
                const alreadyTaken = hasTakenTask(task)
                return renderTaskCard(
                  task,
                  alreadyTaken ? (
                    <span className="w-full rounded-lg bg-emerald-500 text-white text-xs sm:text-sm font-semibold py-2 text-center">
                      Već si preuzeo ovaj zadatak
                    </span>
                  ) : canTake ? (
                    <button
                      type="button"
                      onClick={() => handleTakeTask(task)}
                      className="w-full rounded-lg bg-[#41ac53] hover:bg-[#358c43] text-white text-xs sm:text-sm font-semibold py-2"
                    >
                      Preuzmi zadatak
                    </button>
                  ) : (
                    <span className="w-full rounded-lg bg-gray-200 text-gray-500 text-xs sm:text-sm font-semibold py-2 text-center cursor-not-allowed">
                      Nemaš dozvolu da radiš ovaj zadatak
                    </span>
                  )
                )
              })}
            </div>
          )}
        </section>

        {/* 2) Izvršavaju se — Pridruži se; admin/sekretar: Izmeni + Završi */}
        <section className="space-y-4 pb-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">
            Izvršavaju se
          </h2>
          <p className="text-[11px] text-gray-500">
            Zadaci na kojima neko radi. Možeš se pridružiti; admin/sekretar mogu da ih menjaju ili označe kao završene.
          </p>
          {uToku.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-6 text-center">
              <p className="text-sm text-gray-600">Nema zadataka u toku.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {uToku.map((task) => {
                const canTake = canTakeTask(task)
                const alreadyTaken = hasTakenTask(task)
                return renderTaskCard(
                  task,
                  <div className="flex flex-col sm:flex-row gap-2">
                    {!alreadyTaken && canTake ? (
                      <button
                        type="button"
                        onClick={() => handleTakeTask(task)}
                        className="flex-1 rounded-lg bg-[#41ac53] hover:bg-[#358c43] text-white text-xs sm:text-sm font-semibold py-2"
                      >
                        Pridruži se zadatku
                      </button>
                    ) : alreadyTaken ? (
                      <span className="flex-1 rounded-lg bg-emerald-500/80 text-white text-xs sm:text-sm font-semibold py-2 text-center">
                        Učestvuješ
                      </span>
                    ) : null}
                    {isAdminOrSekretar && (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditTask(task)}
                          className="rounded-lg border border-gray-300 text-gray-700 text-xs sm:text-sm font-medium py-2 px-3 hover:bg-gray-50"
                        >
                          Izmeni
                        </button>
                        <button
                          type="button"
                          onClick={() => handleZavrsi(task)}
                          className="rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs sm:text-sm font-semibold py-2 px-3"
                        >
                          Završi zadatak
                        </button>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* 3) Završeni — samo Obriši (admin/sekretar) */}
        <section className="space-y-4 pb-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">
            Završeni zadaci
          </h2>
          <p className="text-[11px] text-gray-500">
            Završeni zadaci se ne mogu menjati, samo obrisati (admin/sekretar).
          </p>
          {zavrseni.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-6 text-center">
              <p className="text-sm text-gray-600">Nema završenih zadataka.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {zavrseni.map((task) =>
                renderTaskCard(
                  task,
                  isAdminOrSekretar ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(task)}
                      className="w-full rounded-lg border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 text-xs sm:text-sm font-semibold py-2"
                    >
                      Obriši zadatak
                    </button>
                  ) : (
                    <span className="w-full rounded-lg bg-gray-100 text-gray-500 text-xs sm:text-sm py-2 text-center">
                      Završeno
                    </span>
                  )
                )
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
