import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import Loader from '../components/Loader'
import { formatDateShort } from '../utils/dateUtils'
import { getRoleLabel } from '../utils/roleUtils'
import NewTaskModal, { type Role } from '../components/NewTaskModal'

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
  createdAt: string
  assignees?: TaskAssignee[]
}

export default function Zadaci() {
  const { isLoggedIn, user } = useAuth()

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [newTaskOpen, setNewTaskOpen] = useState(false)

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
  const isAdmin = user.role === 'admin'

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

  const visibleTasks = useMemo(
    () => tasks.filter(canSeeTask),
    [tasks, isClan]
  )

  const sortedTasks = useMemo(() => {
    return [...visibleTasks].sort((a, b) => {
      if (a.hitno !== b.hitno) return a.hitno ? -1 : 1
      const da = a.deadline ? new Date(a.deadline).getTime() : Infinity
      const db = b.deadline ? new Date(b.deadline).getTime() : Infinity
      if (da !== db) return da - db
      const ca = new Date(a.createdAt).getTime()
      const cb = new Date(b.createdAt).getTime()
      return cb - ca
    })
  }, [visibleTasks])

  const handleCreateTask = async (data: {
    naziv: string
    opis: string
    deadline: string | null
    hitno: boolean
    allowedRoles: Role[]
    allowAll: boolean
  }) => {
    setError('')
    const body = {
      naziv: data.naziv,
      opis: data.opis,
      deadline: data.deadline,
      hitno: data.hitno,
      allowedRoles: data.allowedRoles,
      allowAll: data.allowAll,
    }
    const res = await api.post('/api/zadaci', body)
    const created: Task = res.data?.zadatak || res.data
    if (created) {
      setTasks((prev) => [created, ...prev])
    }
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

  if (loading) {
    return <Loader />
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16 md:pb-10">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-8 space-y-6 sm:space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="inline-flex items-center px-4 py-2 rounded-xl bg-[#41ac53]/10 text-gray-900 text-xl sm:text-2xl font-bold tracking-tight">
              Zadaci kluba
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-gray-600 max-w-xl">
              Administratori mogu da dodaju zadatke, a članovi tima ih preuzimaju i zajedno rade na njima.
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setNewTaskOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white text-[#41ac53] border border-[#41ac53]/50 px-3 py-2 text-xs sm:text-sm font-semibold shadow-sm hover:bg-[#41ac53]/5"
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#41ac53] text-white text-sm">
                +
              </span>
              <span>Dodaj novi zadatak</span>
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {isAdmin && (
          <NewTaskModal
            open={newTaskOpen}
            onClose={() => setNewTaskOpen(false)}
            onCreate={handleCreateTask}
          />
        )}

        <section className="space-y-4 sm:space-y-5 pb-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">
              Lista zadataka
            </h2>
            <span className="text-[11px] text-gray-500">
              {sortedTasks.length === 0
                ? 'Trenutno nema zadataka.'
                : `${sortedTasks.length} zadatak${sortedTasks.length === 1 ? '' : 'a'}`}
            </span>
          </div>

          {sortedTasks.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-6 sm:p-8 text-center">
              <p className="text-sm sm:text-base text-gray-600 font-medium">
                Još uvek nema zadataka.
              </p>
              {isAdmin && (
                <p className="mt-1 text-xs sm:text-sm text-gray-500">
                  Dodaj prvi zadatak koristeći formu iznad.
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
              {sortedTasks.map((task) => {
                const urgentClasses = task.hitno
                  ? 'border-red-400 bg-red-50/90'
                  : 'border-gray-200 bg-white'
                const urgentBadgeClasses = task.hitno
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 text-gray-700'
                const canTake = canTakeTask(task)
                const alreadyTaken = hasTakenTask(task)

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
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${urgentBadgeClasses}`}>
                          {task.hitno ? 'HITNO' : 'Zadatak'}
                        </span>
                      </div>

                      {task.opis && (
                        <p className="text-xs sm:text-sm text-gray-700 line-clamp-4">
                          {task.opis}
                        </p>
                      )}

                      <div className="mt-1 space-y-1.5 text-[11px] text-gray-600">
                        <p>
                          <span className="font-semibold text-gray-700">
                            Ko može da radi:
                          </span>{' '}
                          {task.allowAll
                            ? 'Svi (uključuje i članove)'
                            : task.allowedRoles && task.allowedRoles.length > 0
                            ? task.allowedRoles.map((r) => getRoleLabel(r)).join(', ')
                            : 'Nije definisano'}
                        </p>
                        {task.deadline && (
                          <p>
                            <span className="font-semibold text-gray-700">
                              Rok:
                            </span>{' '}
                            {formatDateShort(task.deadline)}
                          </p>
                        )}
                        <p>
                          <span className="font-semibold text-gray-700">
                            Kreirano:
                          </span>{' '}
                          {formatDateShort(task.createdAt)}
                        </p>
                      </div>

                      {task.assignees && task.assignees.length > 0 && (
                        <div className="mt-2 rounded-xl bg-white/70 border border-gray-200 px-3 py-2">
                          <p className="text-[11px] font-semibold text-gray-700 mb-1">
                            Zadatak preuzeli:
                          </p>
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

                    <div className="border-t border-gray-200 bg-gray-50/80 px-4 py-2.5">
                      {alreadyTaken ? (
                        <button
                          type="button"
                          disabled
                          className="w-full rounded-lg bg-emerald-500 text-white text-xs sm:text-sm font-semibold py-2 cursor-default"
                        >
                          Već si preuzeo ovaj zadatak
                        </button>
                      ) : canTake ? (
                        <button
                          type="button"
                          onClick={() => handleTakeTask(task)}
                          className="w-full rounded-lg bg-[#41ac53] hover:bg-[#358c43] text-white text-xs sm:text-sm font-semibold py-2 shadow-sm"
                        >
                          Preuzmi zadatak
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="w-full rounded-lg bg-gray-200 text-gray-500 text-xs sm:text-sm font-semibold py-2 cursor-not-allowed"
                        >
                          Nemaš dozvolu da radiš ovaj zadatak
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

