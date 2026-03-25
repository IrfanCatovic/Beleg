import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useModal } from '../context/ModalContext'
import api from '../services/api'
import { formatRelativeTime } from '../utils/dateUtils'
import MentionContent from './MentionContent'

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

interface PostLikeUser {
  id: number
  username: string
  fullName?: string
  avatarUrl?: string
}

export default function PostCard({
  post,
  currentUsername,
  currentRole,
  onDelete,
  onUpdate,
  onOpenImage,
  mentionUsers,
}: {
  post: Post
  currentUsername?: string
  currentRole?: string
  onDelete: (id: number) => void
  onUpdate?: (post: Post) => void
  onOpenImage: (src: string) => void
  mentionUsers: MentionUser[]
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const { showAlert } = useModal()

  const [editingPost, setEditingPost] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const [liked, setLiked] = useState<boolean>(!!post.myLiked)
  const [likeCount, setLikeCount] = useState<number>(post.likeCount ?? 0)
  const [commentCount, setCommentCount] = useState<number>(post.commentCount ?? 0)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [likesOpen, setLikesOpen] = useState(false)
  const [likesLoading, setLikesLoading] = useState(false)
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [liking, setLiking] = useState(false)
  const [submittingComment, setSubmittingComment] = useState(false)
  const [comments, setComments] = useState<PostComment[]>([])
  const [likes, setLikes] = useState<PostLikeUser[]>([])
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
    if (!editingPost) {
      setEditContent(post.content ?? '')
    }
  }, [post.id, post.myLiked, post.likeCount, post.commentCount, post.content, editingPost])

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

  const fetchLikes = useCallback(async () => {
    setLikesLoading(true)
    try {
      const res = await api.get(`/api/posts/${post.id}/likes`)
      setLikes(res.data.likes || [])
    } catch {
      setLikes([])
      await showAlert('Greška pri učitavanju lajkova', 'Lajkovi')
    } finally {
      setLikesLoading(false)
    }
  }, [post.id, showAlert])

  useEffect(() => {
    if (!commentsOpen) return
    if (comments.length > 0) return
    void fetchComments()
  }, [commentsOpen, comments.length, fetchComments])

  useEffect(() => {
    if (!likesOpen) return
    const prevOverflow = document.body.style.overflow
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLikesOpen(false)
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [likesOpen])

  const handleToggleLike = async () => {
    if (liking) return
    try {
      setLiking(true)
      const res = await api.post(`/api/posts/${post.id}/like`)
      setLiked(!!res.data.liked)
      setLikeCount(res.data.likeCount ?? 0)
      if (likesOpen) {
        await fetchLikes()
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Greška pri lajkovanju objave'
      await showAlert(msg, 'Lajk')
    } finally {
      setLiking(false)
    }
  }

  const handleOpenLikes = async () => {
    if (likeCount <= 0) return
    const next = !likesOpen
    setLikesOpen(next)
    if (next) {
      await fetchLikes()
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
  const canDeleteComments = isOwner || currentRole === 'admin' || currentRole === 'superadmin'

  const handleSaveEditPost = async () => {
    const content = editContent.trim()
    if (savingEdit) return
    if (content.length > 3000) {
      await showAlert('Tekst objave je predugačak (maks. 3000 karaktera)', 'Objava')
      return
    }
    setSavingEdit(true)
    try {
      const res = await api.patch(`/api/posts/${post.id}`, { content })
      const updated = (res.data?.post || null) as Post | null
      if (updated && typeof onUpdate === 'function') onUpdate(updated)
      setEditingPost(false)
      setMenuOpen(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Greška pri izmeni objave'
      await showAlert(msg, 'Objava')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDeleteComment = async (commentId: number) => {
    try {
      await api.delete(`/api/posts/${post.id}/comments/${commentId}`)
      await fetchComments()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Greška pri brisanju komentara'
      await showAlert(msg, 'Komentar')
    }
  }

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
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      setEditContent(post.content ?? '')
                      setEditingPost(true)
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l9.932-9.931z"
                      />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 7.125L16.862 4.487" />
                    </svg>
                    Izmeni objavu
                  </button>
                )}
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

      {editingPost && (
        <div className="fixed inset-0 z-[80] px-3 sm:px-4 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-gray-100 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">Izmeni objavu</h3>
              <button
                type="button"
                onClick={() => setEditingPost(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                aria-label="Zatvori"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={5}
                className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300"
                placeholder="Tekst objave..."
                maxLength={3000}
              />
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPost(false)}
                  disabled={savingEdit}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                >
                  Otkaži
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveEditPost()}
                  disabled={savingEdit}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                >
                  {savingEdit ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : null}
                  Sačuvaj
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content text */}
      {post.content?.trim() ? (
        <div className="px-4 sm:px-5 pb-2.5">
          <p className="text-[15px] text-gray-900 leading-relaxed whitespace-pre-wrap break-words">
            <MentionContent text={post.content} />
          </p>
        </div>
      ) : null}

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
          {liking ? <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" /> : null}
        </button>
        <button
          type="button"
          onClick={() => void handleOpenLikes()}
          disabled={likeCount <= 0}
          className="inline-flex items-center px-2 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-rose-500 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-default"
          title={likeCount > 0 ? 'Prikaži ko je lajkovao' : 'Nema lajkova'}
        >
          <span className="text-[13px]">{likeCount > 0 ? likeCount : 0}</span>
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
                        <MentionContent text={cm.content} className="text-gray-700" />
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{formatRelativeTime(cm.createdAt)}</p>
                    </div>
                    {canDeleteComments ? (
                      <button
                        type="button"
                        onClick={() => void handleDeleteComment(cm.id)}
                        className="self-start mt-0.5 inline-flex items-center justify-center h-7 w-7 rounded-full text-gray-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Obriši komentar"
                        aria-label="Obriši komentar"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                          />
                        </svg>
                      </button>
                    ) : null}
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

      {likesOpen && (
        <div className="fixed inset-0 z-[70]">
          <button
            type="button"
            aria-label="Zatvori modal lajkova"
            onClick={() => setLikesOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
          />
          <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 mx-auto w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h3 className="text-sm font-bold text-gray-900">Lajkovi ({likeCount})</h3>
              <button
                type="button"
                onClick={() => setLikesOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-3">
              {likesLoading ? (
                <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                  <div className="h-4 w-4 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
                  Učitavanje lajkova...
                </div>
              ) : likes.length === 0 ? (
                <p className="text-[13px] text-gray-400 py-2">Nema lajkova.</p>
              ) : (
                <div className="space-y-1">
                  {likes.map((u) => {
                    const name = u.fullName?.trim() || u.username
                    const initial = name.charAt(0).toUpperCase()
                    return (
                      <Link
                        key={u.id}
                        to={`/korisnik/${u.username}`}
                        onClick={() => setLikesOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50 transition-colors"
                      >
                        <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center text-white font-bold text-[11px] flex-shrink-0">
                          {u.avatarUrl ? <img src={u.avatarUrl} alt={name} className="absolute inset-0 w-full h-full object-cover" /> : <span>{initial}</span>}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-gray-800 truncate">{name}</p>
                          <p className="text-[11px] text-gray-500 truncate">@{u.username}</p>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  )
}
