import { Link } from 'react-router-dom'
import type { TFunction } from 'i18next'
import PostCard, { type MentionUser, type Post } from '../../PostCard'

interface LinkedPostSectionProps {
  post: Post
  currentUsername?: string
  currentRole?: string
  mentionUsers: MentionUser[]
  t: TFunction
  onDelete: (postId: number) => void
  onUpdate: (post: Post) => void
  onOpenImage: (src: string) => void
}

export function LinkedPostSection({
  post,
  currentUsername,
  currentRole,
  mentionUsers,
  t,
  onDelete,
  onUpdate,
  onOpenImage,
}: LinkedPostSectionProps) {
  return (
    <div className="sm:mt-0">
      <PostCard
        post={post}
        currentUsername={currentUsername}
        currentRole={currentRole}
        onDelete={onDelete}
        onUpdate={onUpdate}
        onOpenImage={onOpenImage}
        mentionUsers={mentionUsers}
      />
      <div className="mt-3 text-center">
        <Link to="/home" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">
          {t('notificationDetails:openFullFeed')}
        </Link>
      </div>
    </div>
  )
}
