import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import api from '../../services/api'
import { formatDateShort } from '../../utils/dateUtils'
import Loader from '../../components/Loader'
import { tezinaLabel } from '../../utils/difficultyI18n'
import { userHasClubContext } from '../../utils/clubContext'
import PostCard, { type Post, type MentionUser } from '../../components/PostCard'
import FollowControls from '../../components/buttons/FollowControls'

interface Akcija {
  id: number
  naziv: string
  planina?: string
  vrh: string
  datum: string
  tezina?: string
  javna?: boolean
  klubNaziv?: string
  klubLogoUrl?: string
  addedById?: number
  slikaUrl?: string
  opis?: string
  isCompleted: boolean
  createdAt?: string
}

interface Statistika {
  ukupnoKm: number
  ukupnoMetaraUspona: number
  brojPopeoSe: number
}

interface DiscoverUser extends MentionUser {
  klubId?: number
}

const POST_LIMIT = 30

export default function Home() {
  const { t, i18n } = useTranslation('home')
  const { isLoggedIn, user } = useAuth()
  const { showConfirm, showAlert } = useModal()

  const [posts, setPosts] = useState<Post[]>([])
  const [total, setTotal] = useState(0)
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const [aktivneAkcije, setAktivneAkcije] = useState<Akcija[]>([])
  const [statistika, setStatistika] = useState<Statistika>({ ukupnoKm: 0, ukupnoMetaraUspona: 0, brojPopeoSe: 0 })
  const [loadingSidebar, setLoadingSidebar] = useState(true)

  const [newPostContent, setNewPostContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [newPostImage, setNewPostImage] = useState<File | null>(null)
  const [newPostImagePreview, setNewPostImagePreview] = useState<string | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  // @mention autocomplete (komentar + opis objave)
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([])
  const [mentionUsersLoading, setMentionUsersLoading] = useState(false)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const [mentionEnd, setMentionEnd] = useState<number | null>(null)
  const postMentionWrapperRef = useRef<HTMLDivElement>(null)
  const [followingUserIds, setFollowingUserIds] = useState<number[]>([])
  const [discoverUsers, setDiscoverUsers] = useState<DiscoverUser[]>([])

  const hasMore = posts.length < total

  const openLightbox = useCallback((src: string) => setLightboxSrc(src), [])
  const closeLightbox = useCallback(() => setLightboxSrc(null), [])

  useEffect(() => {
    if (!lightboxSrc) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [lightboxSrc, closeLightbox])

  useEffect(() => {
    if (!isLoggedIn) return
    setMentionUsersLoading(true)
    api
      .get('/api/korisnici')
      .then((res) => {
        setMentionUsers((res.data.korisnici as MentionUser[]) || [])
      })
      .catch(() => setMentionUsers([]))
      .finally(() => setMentionUsersLoading(false))
  }, [isLoggedIn])

  useEffect(() => {
    if (!isLoggedIn) return
    api
      .get('/api/korisnici', { params: { scope: 'global' } })
      .then((res) => {
        setDiscoverUsers((res.data.korisnici as DiscoverUser[]) || [])
      })
      .catch(() => setDiscoverUsers([]))
  }, [isLoggedIn])

  useEffect(() => {
    if (!mentionOpen) return
    const handler = (e: MouseEvent) => {
      const el = postMentionWrapperRef.current
      if (el && !el.contains(e.target as Node)) setMentionOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [mentionOpen])

  const parseMentionContext = useCallback((text: string, caretPos: number) => {
    if (caretPos < 0) return null
    const left = text.slice(0, caretPos)
    const m = left.match(/(^|[\s\n])@([A-Za-z0-9_\.]{0,30})$/)
    if (!m) return null
    const query = (m[2] ?? '').toString()
    const start = caretPos - query.length - 1
    return { query, start, end: caretPos }
  }, [])

  const handlePickMention = useCallback(
    (u: MentionUser) => {
      if (mentionStart == null || mentionEnd == null) return
      const before = newPostContent.slice(0, mentionStart)
      const after = newPostContent.slice(mentionEnd)
      const next = `${before}@${u.username} ${after}`
      setNewPostContent(next)
      setMentionOpen(false)
      requestAnimationFrame(() => {
        const ta = textareaRef.current
        if (!ta) return
        const pos = mentionStart + 1 + u.username.length + 1
        ta.setSelectionRange(pos, pos)
      })
    },
    [mentionStart, mentionEnd, newPostContent]
  )

  const fetchPosts = useCallback(async (offset = 0, append = false) => {
    try {
      const res = await api.get('/api/posts', { params: { limit: POST_LIMIT, offset } })
      const data = res.data
      if (append) {
        setPosts(prev => [...prev, ...(data.posts || [])])
      } else {
        setPosts(data.posts || [])
      }
      setTotal(data.total ?? 0)
    } catch {
      // silently handle
    }
  }, [])

  useEffect(() => {
    if (!isLoggedIn) return
    setLoadingPosts(true)
    fetchPosts(0).finally(() => setLoadingPosts(false))
  }, [isLoggedIn, fetchPosts])

  useEffect(() => {
    if (!isLoggedIn) return
    setLoadingSidebar(true)
    Promise.all([
      api.get('/api/akcije').catch(() => ({ data: { aktivne: [] } })),
      api.get('/api/moje-popeo-se').catch(() => ({ data: { statistika: {} } })),
    ]).then(([akcijeRes, popeoRes]) => {
      setAktivneAkcije((akcijeRes.data.aktivne || []) as Akcija[])
      const s = popeoRes.data.statistika || {}
      setStatistika({ ukupnoKm: s.ukupnoKm || 0, ukupnoMetaraUspona: s.ukupnoMetaraUspona || 0, brojPopeoSe: s.brojPopeoSe || 0 })
    }).finally(() => setLoadingSidebar(false))
  }, [isLoggedIn])

  // Infinite scroll
  useEffect(() => {
    if (!sentinelRef.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loadingPosts) {
          setLoadingMore(true)
          fetchPosts(posts.length, true).finally(() => setLoadingMore(false))
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loadingPosts, posts.length, fetchPosts])

  useEffect(() => {
    return () => {
      if (newPostImagePreview) URL.revokeObjectURL(newPostImagePreview)
    }
  }, [newPostImagePreview])

  const handleSelectImage = (e: any) => {
    const file = e.target.files?.[0] ?? null
    if (!file) {
      setNewPostImage(null)
      setNewPostImagePreview((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      void showAlert(t('imageTooLarge'), t('imageTitle'))
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setNewPostImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
    setNewPostImage(file)
  }

  const handleRemoveImage = () => {
    setNewPostImage(null)
    setNewPostImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmitPost = async () => {
    const content = newPostContent.trim()
    if (submitting) return
    if (!content && !newPostImage) return
    setSubmitting(true)
    try {
      let res
      if (newPostImage) {
        const fd = new FormData()
        fd.append('content', content)
        fd.append('image', newPostImage)
        res = await api.post('/api/posts', fd)
      } else {
        res = await api.post('/api/posts', { content })
      }
      setPosts(prev => [res.data.post, ...prev])
      setTotal(prev => prev + 1)
      setNewPostContent('')
      setNewPostImage(null)
      setNewPostImagePreview((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    } catch (err: any) {
      await showAlert(err.response?.data?.error || t('postError'), t('postTitle'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeletePost = async (postId: number) => {
    const ok = await showConfirm(t('confirmDeletePost'), {
      title: t('deletePostTitle'),
      confirmLabel: t('delete'),
      cancelLabel: t('cancel'),
      variant: 'danger',
    })
    if (!ok) return
    try {
      await api.delete(`/api/posts/${postId}`)
      setPosts(prev => prev.filter(p => p.id !== postId))
      setTotal(prev => prev - 1)
    } catch (err: any) {
      await showAlert(err.response?.data?.error || t('deletePostError'), t('postTitle'))
    }
  }

  const handleUpdatePost = (updated: Post) => {
    setPosts(prev => prev.map(p => (p.id === updated.id ? { ...p, ...updated } : p)))
  }

  const handleTextareaInput = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }

  const shuffleAndTake = useCallback(<T,>(arr: T[], count: number): T[] => {
    if (!Array.isArray(arr) || arr.length === 0 || count <= 0) return []
    const shuffled = [...arr]
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = shuffled[i]
      shuffled[i] = shuffled[j]
      shuffled[j] = tmp
    }
    return shuffled.slice(0, count)
  }, [])

  const usersById = useMemo(() => {
    const map = new Map<number, MentionUser>()
    for (const u of mentionUsers) {
      if (typeof u.id === 'number') map.set(u.id, u)
    }
    return map
  }, [mentionUsers])

  const suggestedActions = useMemo(() => {
    const now = new Date()
    const candidates = aktivneAkcije
      .filter((a) => !a.isCompleted && (a.datum ? new Date(a.datum) >= now : true))
    return shuffleAndTake(candidates, 2)
  }, [aktivneAkcije, shuffleAndTake])

  const suggestedUsers = useMemo(() => {
    const blockedIds = new Set<number>(followingUserIds)
    const pool = discoverUsers.filter((u) => {
      if (blockedIds.has(u.id)) return false
      if (typeof user?.klubId === 'number' && typeof u.klubId === 'number' && u.klubId === user.klubId) return false
      return true
    })
    return shuffleAndTake(pool, 2)
  }, [discoverUsers, followingUserIds, shuffleAndTake, user?.klubId])

  const handleShareInvite = useCallback(() => {
    const registerUrl = `${window.location.origin}/registracija`
    const message =
      `Hej! Ja koristim Planiner.\n` +
      `Pridruzi se akciji: registruj se ovde ${registerUrl}`
    const encoded = encodeURIComponent(message)
    const appUrl = `whatsapp://send?text=${encoded}`
    const webUrl = `https://wa.me/?text=${encoded}`
    const isMobile = /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent)

    if (isMobile) {
      const startedAt = Date.now()
      window.location.href = appUrl
      window.setTimeout(() => {
        // Ako app deep-link nije uspeo, padamo na web share.
        if (Date.now() - startedAt < 1600) {
          window.open(webUrl, '_blank', 'noopener,noreferrer')
        }
      }, 900)
      return
    }

    window.open(webUrl, '_blank', 'noopener,noreferrer')
  }, [])

  const sledeceAkcije = useMemo(() => {
    const now = new Date()
    return [...aktivneAkcije]
      .filter(a => a.datum ? new Date(a.datum) >= now : true)
      .sort((a, b) => new Date(a.datum).getTime() - new Date(b.datum).getTime())
      .slice(0, 5)
  }, [aktivneAkcije])

  useEffect(() => {
    if (!isLoggedIn || !user?.username) return
    api
      .get<{ users?: Array<{ id: number }> }>(`/api/follows/user/${encodeURIComponent(user.username)}/following`)
      .then((res) => {
        const ids = (res.data.users || [])
          .map((u) => Number(u.id))
          .filter((id) => Number.isFinite(id) && id > 0)
        setFollowingUserIds(ids)
      })
      .catch(() => setFollowingUserIds([]))
  }, [isLoggedIn, user?.username])

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">{t('notLoggedTitle')}</h2>
          <p className="text-gray-600">{t('notLoggedDesc')}</p>
        </div>
      </div>
    )
  }

  if (loadingPosts && posts.length === 0) return <Loader />

  const POST_MAX_LENGTH = 3000
  const canPost =
    (!!newPostContent.trim() || !!newPostImage) && newPostContent.length <= POST_MAX_LENGTH

  return (
    <div className="relative min-h-screen bg-white sm:bg-gray-50 pb-20 md:pb-12">
      {/* ── Lightbox ── */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-lg flex items-center justify-center animate-[fadeIn_120ms_ease-out]"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute top-4 right-4 z-20 inline-flex items-center justify-center w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white/90 hover:text-white transition-all"
            aria-label={t('close')}
            title={t('closeEsc')}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <img
            src={lightboxSrc}
            alt={t('zoomedImage')}
            onClick={(e) => e.stopPropagation()}
            className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}

      <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,640px)_320px] xl:grid-cols-[minmax(0,640px)_360px] gap-8 lg:justify-center items-start">

          {/* ──── MAIN: Feed ──── */}
          <div className="min-w-0">

            {/* ── Compose ── */}
            <div className="bg-white sm:rounded-2xl sm:border sm:border-gray-200/60 sm:shadow-sm overflow-visible">
              <div className="px-4 sm:px-5 py-4">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 pt-0.5">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm">
                      {user?.avatarUrl ? (
                        <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span>{(user?.fullName || user?.username || '?').charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 relative" ref={postMentionWrapperRef}>
                    <textarea
                      ref={textareaRef}
                      value={newPostContent}
                      maxLength={POST_MAX_LENGTH}
                      onChange={(e) => {
                        const value = e.target.value
                        const caretPos = e.currentTarget.selectionStart ?? value.length
                        setNewPostContent(value)

                        const ctx = parseMentionContext(value, caretPos)
                        if (!ctx) {
                          setMentionOpen(false)
                          setMentionQuery('')
                          setMentionStart(null)
                          setMentionEnd(null)
                          return
                        }
                        setMentionQuery(ctx.query)
                        setMentionStart(ctx.start)
                        setMentionEnd(ctx.end)
                        setMentionOpen(true)
                      }}
                      onInput={handleTextareaInput}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && canPost) {
                          e.preventDefault()
                          handleSubmitPost()
                        }
                      }}
                      placeholder={t('sharePlaceholder')}
                      rows={1}
                      className="w-full resize-none border-0 bg-transparent px-0 py-1 text-[15px] text-gray-900 placeholder:text-gray-400 focus:ring-0 focus:outline-none"
                    />

                    {mentionOpen && (
                      <div className="absolute left-0 right-0 top-full mt-2 z-30">
                        <div className="rounded-xl bg-white border border-gray-200 shadow-lg overflow-hidden">
                          {mentionUsersLoading ? (
                            <div className="px-3 py-2 text-sm text-gray-500">{t('loadingMentions')}</div>
                          ) : (
                            (() => {
                              const q = mentionQuery.trim().toLowerCase()
                              const filtered = mentionUsers
                                .filter((u) => {
                                  const un = (u.username || '').toLowerCase()
                                  const fn = (u.fullName || '').toLowerCase()
                                  return q.length === 0 ? true : un.startsWith(q) || fn.startsWith(q) || fn.includes(q)
                                })
                                .slice(0, 8)

                              if (filtered.length === 0) {
                                return <div className="px-3 py-2 text-sm text-gray-500">{t('noResults')}</div>
                              }

                              return (
                                <div className="max-h-56 overflow-y-auto">
                                  {filtered.map((u) => (
                                    <button
                                      type="button"
                                      key={u.id}
                                      onMouseDown={(ev) => ev.preventDefault()}
                                      onClick={() => handlePickMention(u)}
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
                              )
                            })()
                          )}
                        </div>
                      </div>
                    )}

                    {newPostImagePreview && (
                      <div className="mt-3 relative rounded-xl overflow-hidden border border-gray-200/60 bg-gray-50">
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          disabled={submitting}
                          aria-label={t('removeImage')}
                          className="absolute top-2 right-2 z-10 inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white transition-all disabled:opacity-50"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                        <img
                          src={newPostImagePreview}
                          alt={t('imagePreviewAlt')}
                          className="w-full max-h-72 object-cover cursor-pointer"
                          onClick={() => openLightbox(newPostImagePreview)}
                        />
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                      <div className="flex items-center gap-1">
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleSelectImage} />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={submitting}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-full text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 transition-colors"
                          aria-label={t('addImage')}
                          title={t('addImage')}
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21zm14.625-11.25a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0z" />
                          </svg>
                        </button>
                      </div>
                      <button
                        onClick={handleSubmitPost}
                        disabled={!canPost || submitting}
                        className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {submitting ? (
                          <div className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                        ) : t('publish')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Divider on mobile ── */}
            <div className="h-2 bg-gray-100 sm:hidden" />

            {/* ── Predlozene akcije kao samostalne "objave" ── */}
            {suggestedActions.length > 0 && (
              <div className="sm:mt-4 space-y-3 sm:space-y-4">
                {suggestedActions.map((akcija) => (
                  <SuggestedActionCard
                    key={`suggested-action-${akcija.id}`}
                    akcija={akcija}
                    addedBy={typeof akcija.addedById === 'number' ? usersById.get(akcija.addedById) : undefined}
                    t={t}
                  />
                ))}
              </div>
            )}

            {/* ── Predlozeni ljudi + WhatsApp CTA ── */}
            {(suggestedUsers.length > 0) && (
              <div className="mt-3 sm:mt-4 bg-white sm:rounded-2xl sm:border sm:border-gray-200/60 sm:shadow-sm">
                <div className="px-4 sm:px-5 pt-4 pb-3 flex items-center gap-2.5">
                  <div className="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
                  <h3 className="text-sm font-bold text-gray-900">Ljudi za zapratiti</h3>
                </div>
                <div className="px-4 sm:px-5 pb-4 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="flex gap-3 snap-x snap-mandatory">
                    {suggestedUsers.map((u) => (
                      <SuggestedUserCard key={`suggested-user-${u.id}`} user={u} />
                    ))}
                    <InviteFriendsCard onInvite={handleShareInvite} />
                  </div>
                </div>
              </div>
            )}

            {/* ── Post List ── */}
            {posts.length === 0 && !loadingPosts ? (
              <div className="px-4 py-16 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                  <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-1">{t('noPostsTitle')}</h3>
                <p className="text-sm text-gray-500 max-w-xs mx-auto">{t('noPostsDesc')}</p>
              </div>
            ) : (
              <div className="sm:mt-4 sm:space-y-4 divide-y divide-gray-100 sm:divide-y-0">
                {posts.map(post => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUsername={user?.username}
                    currentRole={user?.role}
                    onDelete={handleDeletePost}
                    onUpdate={handleUpdatePost}
                    onOpenImage={openLightbox}
                    mentionUsers={mentionUsers}
                  />
                ))}
              </div>
            )}

            <div ref={sentinelRef} className="h-1" />

            {loadingMore && (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 rounded-full border-[2.5px] border-emerald-500 border-t-transparent animate-spin" />
              </div>
            )}

            {!hasMore && posts.length > 0 && (
              <div className="text-center py-8">
                <p className="text-xs text-gray-400 font-medium">{t('allLoaded')}</p>
              </div>
            )}
          </div>

          {/* ──── SIDEBAR ──── */}
          <aside className="hidden lg:block space-y-5 sticky top-[76px]">

            <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5">
                <div className="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
                <h3 className="text-sm font-bold text-gray-900">{t('myStats')}</h3>
              </div>
              <div className="p-4">
                {loadingSidebar ? (
                  <div className="flex justify-center py-4">
                    <div className="h-5 w-5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    <StatCard label={t('trails')} value={`${statistika.ukupnoKm.toLocaleString(i18n.language, { maximumFractionDigits: 1 })} km`} />
                    <StatCard label={t('ascent')} value={`${statistika.ukupnoMetaraUspona.toLocaleString(i18n.language)} m`} />
                    <StatCard label={t('actions')} value={String(statistika.brojPopeoSe)} />
                  </div>
                )}
                <Link
                  to={user ? `/korisnik/${user.username}` : '/profil/podesavanja'}
                  className="mt-3 flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-xl text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  {t('viewProfile')}
                </Link>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-1 h-5 rounded-full bg-gradient-to-b from-blue-400 to-indigo-600" />
                  <h3 className="text-sm font-bold text-gray-900">{t('nextActions')}</h3>
                </div>
                <Link to="/akcije" className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">
                  {t('allActions')}
                </Link>
              </div>
              <div className="p-4">
                {loadingSidebar ? (
                  <div className="flex justify-center py-4">
                    <div className="h-5 w-5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                  </div>
                ) : sledeceAkcije.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">{t('noScheduledActions')}</p>
                ) : (
                  <div className="space-y-2">
                    {sledeceAkcije.map(a => {
                      const tezinaStyle = a.tezina === 'lako' ? 'bg-emerald-50 text-emerald-600'
                        : a.tezina === 'srednje' ? 'bg-amber-50 text-amber-600'
                        : (a.tezina === 'tesko' || a.tezina === 'teško') ? 'bg-rose-50 text-rose-600'
                        : a.tezina === 'alpinizam' ? 'bg-violet-50 text-violet-600'
                        : 'bg-gray-50 text-gray-500'
                      return (
                        <Link
                          key={a.id}
                          to={`/akcije/${a.id}`}
                          className="block rounded-xl p-3 border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-emerald-700 transition-colors">{a.naziv}</p>
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                {[a.planina, a.vrh].filter(Boolean).join(' · ')} · {formatDateShort(a.datum)}
                              </p>
                            </div>
                            {a.tezina && (
                              <span className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${tezinaStyle}`}>
                                {tezinaLabel(a.tezina, t)}
                              </span>
                            )}
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5">
                <div className="w-1 h-5 rounded-full bg-gradient-to-b from-violet-400 to-purple-600" />
                <h3 className="text-sm font-bold text-gray-900">{t('quickLinks')}</h3>
              </div>
              <div className="p-3">
                <div className="space-y-0.5">
                  <QuickLink to="/users" icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>} label={t('members')} />
                  {userHasClubContext(user) && (
                    <QuickLink to="/zadaci" icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} label={t('tasks')} />
                  )}
                  <QuickLink to="/klub" icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>} label={t('myClub')} />
                  <QuickLink to="/obavestenja" icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>} label={t('notifications')} />
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════════ */
/* Sub-components */
/* ═════════════════════════════════════════════════════════════════════ */

function SuggestedActionCard({
  akcija,
  addedBy,
  t,
}: {
  akcija: Akcija
  addedBy?: MentionUser
  t: TFunction
}) {
  const posterName = akcija.klubNaziv?.trim() || addedBy?.fullName?.trim() || addedBy?.username || 'Clan kluba'
  const posterInitial = posterName.charAt(0).toUpperCase()
  const isKlub = !!akcija.klubNaziv && !akcija.javna
  const posterAvatar = akcija.klubLogoUrl || addedBy?.avatar_url
  const location = [akcija.planina, akcija.vrh].filter(Boolean).join(' · ')
  const addedByName = addedBy?.fullName?.trim() || addedBy?.username

  return (
    <article className="bg-white sm:rounded-2xl sm:border sm:border-gray-200/60 sm:shadow-sm overflow-hidden border-b border-gray-100 sm:border-b">
      {/* Header: ko je izbacio akciju */}
      <div className="px-4 sm:px-5 pt-3.5 pb-3 flex items-center gap-3">
        <div
          className={`relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white text-sm font-bold shadow-sm overflow-hidden ${
            isKlub
              ? 'bg-gradient-to-br from-violet-400 to-purple-600'
              : 'bg-gradient-to-br from-emerald-400 to-teal-600'
          }`}
          aria-hidden="true"
        >
          {posterAvatar ? (
            <img src={posterAvatar} alt={posterName} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
          ) : (
            <span>{posterInitial}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{posterName}</p>
            <span
              className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                isKlub ? 'bg-violet-50 text-violet-700' : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              {isKlub ? 'Klub' : 'Javno'}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 truncate">
            {addedByName ? <>Dodao/la <span className="text-gray-700 font-medium">{addedByName}</span></> : 'Predlog za tebe'}
          </p>
        </div>
        <span
          className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-600"
          aria-hidden="true"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2M12 22a10 10 0 110-20 10 10 0 010 20z" />
          </svg>
          Akcija
        </span>
      </div>

      {/* Slika akcije */}
      {akcija.slikaUrl ? (
        <Link to={`/akcije/${akcija.id}`} className="block">
          <div className="relative aspect-[16/9] w-full bg-gray-100 overflow-hidden">
            <img
              src={akcija.slikaUrl}
              alt={akcija.naziv}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
              <h4 className="text-white text-base font-bold leading-tight drop-shadow">{akcija.naziv}</h4>
              {location && <p className="text-white/90 text-xs mt-0.5 drop-shadow">{location}</p>}
            </div>
          </div>
        </Link>
      ) : (
        <Link
          to={`/akcije/${akcija.id}`}
          className="block relative h-28 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 overflow-hidden"
        >
          <svg className="absolute inset-0 w-full h-full text-white/10" fill="currentColor" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polygon points="0,100 25,40 45,70 65,20 85,55 100,30 100,100" />
          </svg>
          <div className="relative px-4 py-4 flex items-center h-full">
            <div>
              <h4 className="text-white text-base font-bold leading-tight drop-shadow">{akcija.naziv}</h4>
              {location && <p className="text-white/90 text-xs mt-0.5">{location}</p>}
            </div>
          </div>
        </Link>
      )}

      {/* Body: datum / tezina / opis */}
      <div className="px-4 sm:px-5 py-3 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-50 text-gray-700 font-semibold">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {formatDateShort(akcija.datum)}
          </span>
          {akcija.tezina && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-semibold">
              {tezinaLabel(akcija.tezina, t)}
            </span>
          )}
          {!akcija.slikaUrl && location && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-50 text-gray-600 font-medium truncate max-w-[60%]">
              {location}
            </span>
          )}
        </div>

        {akcija.opis && akcija.opis.trim().length > 0 && (
          <p className="text-sm text-gray-700 leading-relaxed line-clamp-3 whitespace-pre-wrap break-words">
            {akcija.opis}
          </p>
        )}

        <Link
          to={`/akcije/${akcija.id}`}
          className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 transition-colors"
        >
          Pogledaj akciju
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </article>
  )
}

function SuggestedUserCard({ user }: { user: MentionUser }) {
  const name = user.fullName?.trim() || user.username
  const initial = (name || '?').charAt(0).toUpperCase()
  const stopLink: React.MouseEventHandler = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <Link
      to={`/korisnik/${user.username}`}
      className="group snap-start min-w-[200px] max-w-[220px] flex-shrink-0 rounded-2xl border border-gray-200 bg-white p-3 hover:border-emerald-300 hover:shadow-md transition-all flex flex-col"
    >
      <div className="flex items-center gap-3">
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={name}
            className="h-12 w-12 rounded-full object-cover ring-2 ring-white shadow-sm"
            loading="lazy"
          />
        ) : (
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-sm font-bold ring-2 ring-white shadow-sm">
            {initial}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900 truncate group-hover:text-emerald-700 transition-colors">
            {name}
          </p>
          <p className="text-[11px] text-gray-500 truncate">@{user.username}</p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100" onClick={stopLink}>
        <FollowControls targetId={user.id} />
      </div>
    </Link>
  )
}

function InviteFriendsCard({ onInvite }: { onInvite: () => void }) {
  return (
    <div className="snap-start min-w-[220px] max-w-[240px] flex-shrink-0 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-emerald-50/80 to-teal-50 p-3 flex flex-col">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.75 20.25a7.5 7.5 0 1115 0v.75H3.75v-.75zM18 9v6m3-3h-6" />
          </svg>
        </span>
        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Pozovi ekipu</p>
      </div>
      <p className="mt-2 text-xs text-emerald-900/80 leading-snug flex-1">
        Otvori WhatsApp i posalji link za brzu registraciju.
      </p>
      <button
        type="button"
        onClick={onInvite}
        className="mt-3 inline-flex items-center justify-center gap-1.5 w-full rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-sm"
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
        Pozovi na WhatsApp
      </button>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2.5 text-center">
      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-lg font-bold text-emerald-600 leading-tight">{value}</p>
    </div>
  )
}

function QuickLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-emerald-700 hover:bg-emerald-50/60 transition-all"
    >
      <span className="text-gray-400">{icon}</span>
      {label}
    </Link>
  )
}
