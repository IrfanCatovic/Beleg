import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import api from '../../services/api'
import { formatDateShort } from '../../utils/dateUtils'
import Loader from '../../components/Loader'
import PostCard, { type Post, type MentionUser } from '../../components/PostCard'

interface Akcija {
  id: number
  naziv: string
  planina?: string
  vrh: string
  datum: string
  tezina?: string
  isCompleted: boolean
}

interface Statistika {
  ukupnoKm: number
  ukupnoMetaraUspona: number
  brojPopeoSe: number
}

const POST_LIMIT = 30

export default function Home() {
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
      void showAlert('Slika je prevelika (maksimum 5 MB).', 'Slika')
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
      await showAlert(err.response?.data?.error || 'Greška pri objavljivanju', 'Objava')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeletePost = async (postId: number) => {
    const ok = await showConfirm('Da li želite da obrišete ovu objavu?', {
      title: 'Obriši objavu',
      confirmLabel: 'Obriši',
      cancelLabel: 'Otkaži',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await api.delete(`/api/posts/${postId}`)
      setPosts(prev => prev.filter(p => p.id !== postId))
      setTotal(prev => prev - 1)
    } catch (err: any) {
      await showAlert(err.response?.data?.error || 'Greška pri brisanju objave', 'Objava')
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

  const sledeceAkcije = useMemo(() => {
    const now = new Date()
    return [...aktivneAkcije]
      .filter(a => a.datum ? new Date(a.datum) >= now : true)
      .sort((a, b) => new Date(a.datum).getTime() - new Date(b.datum).getTime())
      .slice(0, 5)
  }, [aktivneAkcije])

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Dobrodošli u planiner</h2>
          <p className="text-gray-600">Ulogujte se da vidite objave i novosti.</p>
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
            aria-label="Zatvori"
            title="Zatvori (Esc)"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <img
            src={lightboxSrc}
            alt="Uvećana slika"
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
                      placeholder="Podeli nešto sa zajednicom..."
                      rows={1}
                      className="w-full resize-none border-0 bg-transparent px-0 py-1 text-[15px] text-gray-900 placeholder:text-gray-400 focus:ring-0 focus:outline-none"
                    />

                    {mentionOpen && (
                      <div className="absolute left-0 right-0 top-full mt-2 z-30">
                        <div className="rounded-xl bg-white border border-gray-200 shadow-lg overflow-hidden">
                          {mentionUsersLoading ? (
                            <div className="px-3 py-2 text-sm text-gray-500">Učitavam...</div>
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
                                return <div className="px-3 py-2 text-sm text-gray-500">Nema rezultata</div>
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
                          aria-label="Ukloni sliku"
                          className="absolute top-2 right-2 z-10 inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white transition-all disabled:opacity-50"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                        <img
                          src={newPostImagePreview}
                          alt="Preview"
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
                          aria-label="Dodaj sliku"
                          title="Dodaj sliku"
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
                        ) : 'Objavi'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Divider on mobile ── */}
            <div className="h-2 bg-gray-100 sm:hidden" />

            {/* ── Post List ── */}
            {posts.length === 0 && !loadingPosts ? (
              <div className="px-4 py-16 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                  <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-1">Još nema objava</h3>
                <p className="text-sm text-gray-500 max-w-xs mx-auto">Budi prvi koji će podeliti nešto sa zajednicom!</p>
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
                <p className="text-xs text-gray-400 font-medium">Sve objave su učitane</p>
              </div>
            )}
          </div>

          {/* ──── SIDEBAR ──── */}
          <aside className="hidden lg:block space-y-5 sticky top-[76px]">

            <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5">
                <div className="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
                <h3 className="text-sm font-bold text-gray-900">Moja statistika</h3>
              </div>
              <div className="p-4">
                {loadingSidebar ? (
                  <div className="flex justify-center py-4">
                    <div className="h-5 w-5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    <StatCard label="Staze" value={`${statistika.ukupnoKm.toLocaleString('sr-RS', { maximumFractionDigits: 1 })} km`} />
                    <StatCard label="Uspon" value={`${statistika.ukupnoMetaraUspona.toLocaleString('sr-RS')} m`} />
                    <StatCard label="Akcije" value={String(statistika.brojPopeoSe)} />
                  </div>
                )}
                <Link
                  to={user ? `/korisnik/${user.username}` : '/profil/podesavanja'}
                  className="mt-3 flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-xl text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  Pogledaj profil
                </Link>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-1 h-5 rounded-full bg-gradient-to-b from-blue-400 to-indigo-600" />
                  <h3 className="text-sm font-bold text-gray-900">Sledeće akcije</h3>
                </div>
                <Link to="/akcije" className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">
                  Sve akcije
                </Link>
              </div>
              <div className="p-4">
                {loadingSidebar ? (
                  <div className="flex justify-center py-4">
                    <div className="h-5 w-5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                  </div>
                ) : sledeceAkcije.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">Nema zakazanih akcija</p>
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
                                {a.tezina === 'tesko' || a.tezina === 'teško' ? 'Teško' : a.tezina === 'alpinizam' ? 'Alpinizam' : a.tezina}
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
                <h3 className="text-sm font-bold text-gray-900">Brzi linkovi</h3>
              </div>
              <div className="p-3">
                <div className="space-y-0.5">
                  <QuickLink to="/users" icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>} label="Članovi" />
                  <QuickLink to="/zadaci" icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} label="Zadaci" />
                  <QuickLink to="/klub" icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>} label="Moj klub" />
                  <QuickLink to="/obavestenja" icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>} label="Obaveštenja" />
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
