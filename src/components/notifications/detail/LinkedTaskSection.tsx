import { Link } from 'react-router-dom'
import type { TFunction } from 'i18next'
import TaskCard, { TaskCardFooter, type Task } from '../../TaskCard'
import { userHasClubContext } from '../../../utils/clubContext'

interface LinkedTaskSectionUser {
  username: string
  role: string
  klubId?: number | null
}

interface LinkedTaskSectionProps {
  task: Task
  user: LinkedTaskSectionUser
  t: TFunction
  onTake: (task: Task) => void
  onLeave: (task: Task) => void
  onZavrsi: (task: Task) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
}

export function LinkedTaskSection({
  task,
  user,
  t,
  onTake,
  onLeave,
  onZavrsi,
  onEdit,
  onDelete,
}: LinkedTaskSectionProps) {
  return (
    <div className="sm:mt-0 w-full">
      <TaskCard
        task={task}
        footer={
          <TaskCardFooter
            task={task}
            username={user.username}
            userRole={user.role}
            onTake={onTake}
            onLeave={onLeave}
            onZavrsi={onZavrsi}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        }
      />
      {userHasClubContext(user) && (
        <div className="mt-3 text-center">
          <Link to="/zadaci" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">
            {t('notificationDetails:allTasks')}
          </Link>
        </div>
      )}
    </div>
  )
}
