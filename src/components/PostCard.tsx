import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useModal } from '../context/ModalContext'
import api from '../services/api'
import { formatRelativeTime } from '../utils/dateUtils'

export interface PostUser {
  id: number
  username: string
  fullName: string
  avatarUrl?: string
  role: string
  klubNaziv?: string
}

export interface Post {
  id: number
  content: string
  imageUrl?: string
  createdAt: string
  user: PostUser
  likeCount: number
  commentCount: number
  myLiked: boolean
}

export interface PostCommentUser {
  id: number
  username: string
  fullName?: string
  avatarUrl?: string
}

export interface MentionUser {
  id: number
  username: string
  fullName?: string
  avatar_url?: string
}

interface PostComment {
  id: number
  content: string
  createdAt: string
  user: PostCommentUser
}

export default function PostCard({
  post,
  currentUsername,
  currentRole,
  onDelete,
  onOpenImage,
  mentionUsers,
}: {
  post: Post
  currentUsername?: string
  currentRole?: string
  onDelete: (id: number) => void
  onOpenImage: (src: string) => void
  mentionUsers: MentionUser[]
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const { showAlert } = useModal()

  const [liked, setLiked] = useState<boolean>(!!post.myLiked)
  const [likeCount, setLikeCount] = useState<number>(post.likeCount ?? 0)
  const [commentCount, setCommentCount] = useState<number>(post.commentCount ?? 0)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [liking, setLiking] = useState(false)
  const [submittingComment, setSubmittingComment] = useState(false)
  const [comments, setComments] = useState<PostComment[]>([])
  const [newComment, setNewComment] = useState('')
  const commentInputRef = useRef<HTMLInputElement>(null)
  const [commentMentionOpen, setCommentMentionOpen] = useState(false)
  const [commentMentionQuery, setCommentMentionQuery] = useState('')
  const [commentMentionStart, setCommentMentionStart] = useState<number | null>(null)
  const [commentMentionEnd, setCommentMentionEnd] = useState<number | null>(null)
  /** Ne stavljati commentsLoading u deps useCallback — menja referencu i ponovo pali useEffect (glitch). */
  const commentsFetchInFlightRef = useRef(false)

  useEffect(() => {
    setLiked(!!post.myLiked)
    setLikeCount(post.likeCount ?? 0)
    setCommentCount(post.commentCount ?? 0)
  }, [post.id, post.myLiked, post.likeCount, post.commentCount])

  const parseCommentMentionContext = useCallback((text: string, caretPos: number) => {
    if (caretPos < 0) return null
    const left = text.slice(0, caretPos)
    const m = left.match(/(^|[\s\n])@([A-Za-z0-9_\.]{0,30})$/)
    if (!m) return null
    const query = (m[2] ?? '').toString()
    const start = caretPos - query.length - 1
    return { query, start, end: caretPos }
  }, [])

  const pickCommentMention = useCallback(
    (u: MentionUser) => {
      if (commentMentionStart == null || commentMentionEnd == null) return
      const before = newComment.slice(0, commentMentionStart)
      const after = newComment.slice(commentMentionEnd)
      const next = `${before}@${u.username} ${after}`
      setNewComment(next)
      setCommentMentionOpen(false)

      requestAnimationFrame(() => {
        const el = commentInputRef.current
        if (!el) return
        const pos = commentMentionStart + 1 + u.username.length + 1
        el.setSelectionRange(pos, pos)
      })
    },
    [commentMentionStart, commentMentionEnd, newComment]
  )

  const commentMentionSuggestions = useMemo(() => {
    const q = commentMentionQuery.trim().toLowerCase()
    if (q.length === 0) return mentionUsers.slice(0, 8)
    return mentionUsers
      .filter((u) => {
        const un = (u.username || '').toLowerCase()
        const fn = (u.fullName || '').toLowerCase()
        return un.startsWith(q) || fn.startsWith(q) || fn.includes(q)
      })
      .slice(0, 8)
  }, [commentMentionQuery, mentionUsers])

  const fetchComments = useCallback(async () => {
    if (commentsFetchInFlightRef.current) return
    commentsFetchInFlightRef.current = true
    setCommentsLoading(true)
    try {
      const res = await api.get(`/api/posts/${post.id}/comments`, { params: { limit: 20, offset: 0 } })
      setComments(res.data.comments || [])
      setCommentCount(res.data.total ?? 0)
    } catch {
      setComments([])
      setCommentCount(0)
      await showAlert('Greška pri učitavanju komentara', 'Komentari')
    } finally {
      setCommentsLoading(false)
      commentsFetchInFlightRef.current = false
    }
  }, [post.id, showAlert])

  useEffect(() => {
    if (!commentsOpen) return
    if (comments.length > 0) return
    void fetchComments()
  }, [commentsOpen, comments.length, fetchComments])

  const handleToggleLike = async () => {
    if (liking) return
    try {
      setLiking(true)
      const res = await api.post(`/api/posts/${post.id}/like`)
      setLiked(!!res.data.liked)
      setLikeCount(res.data.likeCount ?? 0)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Greška pri lajkovanju objave'
      await showAlert(msg, 'Lajk')
    } finally {
      setLiking(false)
    }
  }

  const handleSubmitComment = async () => {
    const content = newComment.trim()
    if (!content || submittingComment) return
    setSubmittingComment(true)
    try {
      await api.post(`/api/posts/${post.id}/comments`, { content })
      setNewComment('')
      setCommentsOpen(true)
      await fetchComments()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Greška pri dodavanju komentara'
      await showAlert(msg, 'Komentar')
    } finally {
      setSubmittingComment(false)
    }
  }

  const isOwner = currentUsername === post.user.username
  const isAdmin = currentRole === 'admin' || currentRole === 'superadmin'
  const canDelete = isOwner || isAdmin

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const avatar = post.user.avatarUrl
  const displayName = post.user.fullName?.trim() || post.user.username
  const initial = displayName.charAt(0).toUpperCase()
  return (
    <article className="bg-white sm:rounded-2xl sm:border sm:border-gray-200/60 sm:shadow-sm overflow-visible">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3">
        <Link to={`/korisnik/${post.user.username}`} className="flex items-center gap-3 min-w-0 group">
          <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ring-[2.5px] ring-emerald-100/60">
            {avatar ? (
              <img src={avatar} alt={displayName} className="absolute inset-0 w-full h-full object-cover" />
            ) : null}
            <span className={avatar ? 'invisible' : ''}>{initial}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[14px] font-bold text-gray-900 truncate group-hover:text-emerald-600 transition-colors">{displayName}</p>
              {post.user.klubNaziv && (
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-[10px] font-medium text-gray-500 truncate max-w-[100px]">
                  {post.user.klubNaziv}
                </span>
              )}
            </div>
            <p className="text-[12px] text-gray-400 -mt-0.5">
              @{post.user.username} · {formatRelativeTime(post.createdAt)}
            </p>
          </div>
        </Link>

        {canDelete && (
          <div className="relative flex-shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex items-center justify-center h-8 w-8 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-9 w-44 bg-white rounded-xl shadow-xl ring-1 ring-black/5 z-20 py-1 animate-[scaleIn_150ms_ease-out]">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onDelete(post.id)
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                  Obriši objavu
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content text */}
      <div className="px-4 sm:px-5 pb-2.5">
        <p className="text-[15px] text-gray-900 leading-relaxed whitespace-pre-wrap break-words">{post.content}</p>
      </div>

      {/* Image — full width, no padding */}
      {post.imageUrl && (
        <div className="sm:mx-5 sm:mb-3 sm:rounded-xl overflow-hidden">
          <img
            src={post.imageUrl}
            alt=""
            className="w-full max-h-[560px] object-cover cursor-pointer"
            loading="lazy"
            onClick={() => onOpenImage(post.imageUrl!)}
          />
        </div>
      )}

      {/* Actions — flat, no borders */}
      <div className="flex items-center gap-1 px-2 sm:px-3 py-1 border-t border-gray-100/80">
        <button
          type="button"
          onClick={handleToggleLike}
          disabled={liking}
          className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            liked ? 'text-rose-600' : 'text-gray-500 hover:text-rose-500'
          } hover:bg-gray-50 disabled:opacity-60`}
        >
          <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              fill={liked ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="1.6"
            />
          </svg>
          {liking ? (
            <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
          ) : (
            <span className="text-[13px]">{likeCount > 0 ? likeCount : ''}</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setCommentsOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-semibold text-gray-500 hover:text-emerald-600 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8m-8 4h6M21 12c0 4.418-4.03 8-9 8a10.77 10.77 0 01-3.44-.56L3 21l1.56-4.56A7.6 7.6 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-[13px]">{commentCount > 0 ? commentCount : ''}</span>
        </button>
      </div>

      {/* Comments section */}
      {commentsOpen && (
        <div className="px-4 sm:px-5 pb-4 pt-1">
          {commentsLoading && comments.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-3">
              <div className="h-4 w-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
              Učitavanje komentara...
            </div>
          )}

          {comments.length > 0 && (
            <div className="space-y-3 max-h-80 overflow-y-auto py-2">
              {comments.map((cm) => {
                const cmName = cm.user.fullName?.trim() ? cm.user.fullName : cm.user.username
                const cmInitial = cmName.charAt(0).toUpperCase()
                return (
                  <div key={cm.id} className="flex gap-2.5">
                    <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-[11px] flex-shrink-0">
                      {cm.user.avatarUrl ? (
                        <img src={cm.user.avatarUrl} alt={cmName} className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <span>{cmInitial}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] leading-snug">
                        <Link to={`/korisnik/${cm.user.username}`} className="font-bold text-gray-900 hover:text-emerald-700 transition-colors mr-1.5">
                          {cmName}
                        </Link>
                        <span className="text-gray-700">{cm.content}</span>
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{formatRelativeTime(cm.createdAt)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {!commentsLoading && comments.length === 0 && (
            <p className="text-[13px] text-gray-400 py-2">Još nema komentara.</p>
          )}

          {/* Add comment */}
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-gray-200 bg-white/80 px-3 py-2 shadow-sm">
            <div className="relative flex-1 min-w-0">
              <input
                ref={commentInputRef}
                type="text"
                value={newComment}
                onChange={(e) => {
                  const value = e.target.value
                  const caretPos = e.currentTarget.selectionStart ?? value.length
                  setNewComment(value)

                  const ctx = parseCommentMentionContext(value, caretPos)
                  if (!ctx) {
                    setCommentMentionOpen(false)
                    setCommentMentionQuery('')
                    setCommentMentionStart(null)
                    setCommentMentionEnd(null)
                    return
                  }

                  setCommentMentionQuery(ctx.query)
                  setCommentMentionStart(ctx.start)
                  setCommentMentionEnd(ctx.end)
                  setCommentMentionOpen(true)
                }}
                onKeyDown={(e) => {
                  if (commentMentionOpen && (e.key === 'Enter' || e.key === 'Tab')) {
                    const first = commentMentionSuggestions[0]
                    if (first) {
                      e.preventDefault()
                      pickCommentMention(first)
                    }
                    return
                  }
                  if (e.key === 'Escape' && commentMentionOpen) {
                    setCommentMentionOpen(false)
                    return
                  }
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void handleSubmitComment()
                  }
                }}
                className="w-full border-0 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:ring-0 focus:outline-none"
                placeholder="Dodaj komentar..."
              />

              {commentMentionOpen && (
                <div className="absolute left-0 right-0 top-full mt-2 z-30">
                  <div className="rounded-xl bg-white border border-gray-200 shadow-lg overflow-hidden">
                    {commentMentionSuggestions.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-500">Nema rezultata</div>
                    ) : (
                      <div className="max-h-56 overflow-y-auto">
                        {commentMentionSuggestions.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onMouseDown={(ev) => ev.preventDefault()}
                            onClick={() => pickCommentMention(u)}
                            className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-xs font-bold">
                                {(u.fullName?.trim() || u.username || '?').charAt(0).toUpperCase()}
                              </span>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-gray-900 truncate">
                                  {u.fullName?.trim() || u.username}
                                </div>
                                <div className="text-xs text-gray-500 truncate">@{u.username}</div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => void handleSubmitComment()}
              disabled={!newComment.trim() || submittingComment}
              className="text-sm font-bold text-emerald-600 hover:text-emerald-700 disabled:text-gray-300 disabled:cursor-default transition-colors px-1.5 py-1 rounded-lg hover:bg-emerald-50"
            >
              {submittingComment ? (
                <span className="h-4 w-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin inline-block" />
              ) : (
                'Objavi'
              )}
            </button>
          </div>
        </div>
      )}
    </article>
  )
}
