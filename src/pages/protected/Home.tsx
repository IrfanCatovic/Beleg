import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import api from '../../services/api'
import { formatRelativeTime, formatDateShort } from '../../utils/dateUtils'
import { getRoleLabel } from '../../utils/roleUtils'
import Loader from '../../components/Loader'

interface PostUser {
  id: number
  username: string
  fullName: string
  avatarUrl?: string
  role: string
  klubNaziv?: string
}

interface Post {
  id: number
  content: string
  imageUrl?: string
  createdAt: string
  user: PostUser
  likeCount: number
  commentCount: number
  myLiked: boolean
}

interface PostCommentUser {
  id: number
  username: string
  fullName?: string
  avatarUrl?: string
}

interface PostComment {
  id: number
  content: string
  createdAt: string
  user: PostCommentUser
}

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
  const sentinelRef = useRef<HTMLDivElement>(null)

  const hasMore = posts.length < total

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

  const handleSubmitPost = async () => {
    const content = newPostContent.trim()
    if (!content || submitting) return
    setSubmitting(true)
    try {
      const res = await api.post('/api/posts', { content })
      setPosts(prev => [res.data.post, ...prev])
      setTotal(prev => prev + 1)
      setNewPostContent('')
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

  const displayName = user?.fullName || user?.username || 'planinaru'
  const POST_MAX_LENGTH = 3000
  const canPost = !!newPostContent.trim() && newPostContent.length <= POST_MAX_LENGTH

  return (
    <div className="relative min-h-screen bg-gray-50 pb-20 md:pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px] gap-8 items-start">

          {/* ──── MAIN: Feed ──── */}
          <div className="min-w-0 space-y-6">

            {/* Welcome + Compose Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-3">
                <p className="text-sm font-medium text-emerald-600 mb-0.5">Zdravo, {displayName}</p>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Šta ima novo?</h1>
              </div>

              {/* Compose */}
              <div className="px-5 sm:px-6 pb-5 sm:pb-6">
                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm ring-2 ring-white shadow-sm">
                      {user?.avatarUrl ? (
                        <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span>{(user?.fullName || user?.username || '?').charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <textarea
                      ref={textareaRef}
                      value={newPostContent}
                      maxLength={POST_MAX_LENGTH}
                      onChange={e => setNewPostContent(e.target.value)}
                      onInput={handleTextareaInput}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && canPost) {
                          e.preventDefault()
                          handleSubmitPost()
                        }
                      }}
                      placeholder="Podeli nešto sa zajednicom..."
                      rows={1}
                      className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition-all"
                    />
                    <div className="flex items-center justify-between mt-3">
                      <p className="text-[11px] text-gray-400">
                        {newPostContent.length > 0 && <span className={newPostContent.length > POST_MAX_LENGTH ? 'text-rose-500 font-medium' : ''}>{newPostContent.length}/{POST_MAX_LENGTH}</span>}

                      </p>
                      <button
                        onClick={handleSubmitPost}
                        disabled={!canPost || submitting}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-emerald-200/50 transition-all"
                      >
                        {submitting ? (
                          <div className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                          </svg>
                        )}
                        Objavi
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Post List */}
            {posts.length === 0 && !loadingPosts ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 mb-4">
                  <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Još nema objava</h3>
                <p className="text-sm text-gray-500 max-w-sm mx-auto">Budi prvi koji će podeliti nešto sa zajednicom! Napiši kako je bilo na poslednjoj akciji ili podeli neki saveta za planinarenje.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map(post => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUsername={user?.username}
                    currentRole={user?.role}
                    onDelete={handleDeletePost}
                  />
                ))}
              </div>
            )}

            {/* Sentinel za infinite scroll */}
            <div ref={sentinelRef} className="h-1" />

            {loadingMore && (
              <div className="flex justify-center py-6">
                <div className="h-7 w-7 rounded-full border-[3px] border-emerald-500 border-t-transparent animate-spin" />
              </div>
            )}

            {!hasMore && posts.length > 0 && (
              <div className="text-center py-6">
                <p className="text-xs text-gray-400 font-medium">Sve objave su učitane</p>
              </div>
            )}
          </div>

          {/* ──── SIDEBAR ──── */}
          <aside className="hidden lg:block space-y-6 sticky top-[76px]">

            {/* Moja statistika */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2.5">
                <div className="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
                <h3 className="text-sm font-bold text-gray-900 tracking-tight">Moja statistika</h3>
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

            {/* Sledeće akcije */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-1 h-5 rounded-full bg-gradient-to-b from-blue-400 to-indigo-600" />
                  <h3 className="text-sm font-bold text-gray-900 tracking-tight">Sledeće akcije</h3>
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

            {/* Brzi linkovi */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2.5">
                <div className="w-1 h-5 rounded-full bg-gradient-to-b from-violet-400 to-purple-600" />
                <h3 className="text-sm font-bold text-gray-900 tracking-tight">Brzi linkovi</h3>
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

function PostCard({ post, currentUsername, currentRole, onDelete }: {
  post: Post
  currentUsername?: string
  currentRole?: string
  onDelete: (id: number) => void
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

  const fetchComments = useCallback(async () => {
    if (commentsLoading) return
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
    }
  }, [commentsLoading, post.id, showAlert])

  useEffect(() => {
    if (!commentsOpen) return
    if (comments.length > 0) return
    fetchComments()
  }, [commentsOpen, comments.length, fetchComments])

  const handleToggleLike = async () => {
    if (liking) return
    try {
      setLiking(true)
      const res = await api.post(`/api/posts/${post.id}/like`)
      setLiked(!!res.data.liked)
      setLikeCount(res.data.likeCount ?? 0)
    } catch (err: any) {
      await showAlert(err.response?.data?.error || 'Greška pri lajkovanju objave', 'Lajk')
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
    } catch (err: any) {
      await showAlert(err.response?.data?.error || 'Greška pri dodavanju komentara', 'Komentar')
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
  const roleLabel = getRoleLabel(post.user.role)

  return (
    <article className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
      <div className="px-5 sm:px-6 pt-5 sm:pt-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <Link to={`/korisnik/${post.user.username}`} className="flex items-center gap-3 min-w-0 group">
            <div className="relative w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm ring-2 ring-white shadow-sm flex-shrink-0">
              {avatar ? (
                <img src={avatar} alt={displayName} className="absolute inset-0 w-full h-full object-cover" />
              ) : null}
              <span className={avatar ? 'invisible' : ''}>{initial}</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-gray-900 truncate group-hover:text-emerald-600 transition-colors">{displayName}</p>
                {post.user.klubNaziv && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-gray-100 text-[10px] font-medium text-gray-500 truncate max-w-[120px]">
                    {post.user.klubNaziv}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400 font-medium">
                @{post.user.username} · {roleLabel} · {formatRelativeTime(post.createdAt)}
              </p>
            </div>
          </Link>

          {canDelete && (
            <div className="relative flex-shrink-0" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                </svg>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-9 w-40 bg-white rounded-xl shadow-xl ring-1 ring-black/5 z-20 py-1 animate-[scaleIn_150ms_ease-out]">
                  <button
                    onClick={() => { setMenuOpen(false); onDelete(post.id) }}
                    className="flex w-full items-center gap-2 px-3.5 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors"
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
      </div>

      {/* Content */}
      <div className="px-5 sm:px-6 pt-3 pb-5 sm:pb-6">
        <p className="text-[15px] text-gray-800 leading-relaxed whitespace-pre-wrap break-words">{post.content}</p>

        {post.imageUrl && (
          <div className="mt-4 rounded-xl overflow-hidden border border-gray-100">
            <img
              src={post.imageUrl}
              alt=""
              className="w-full max-h-[500px] object-cover"
              loading="lazy"
            />
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleToggleLike}
            disabled={liking}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${
              liked
                ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100/60'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-emerald-50/60 hover:border-emerald-200'
            } disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                fill={liked ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="1.7"
              />
            </svg>
            Lajk
            {liking && (
              <span className="ml-1 inline-flex items-center justify-center">
                <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              </span>
            )}
            <span className={`ml-1 text-xs font-bold ${liked ? 'text-rose-700' : 'text-gray-500'}`}>{likeCount}</span>
          </button>

          <button
            type="button"
            onClick={() => setCommentsOpen((v) => !v)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-emerald-50/60 hover:border-emerald-200 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8m-8 4h6M21 12c0 4.418-4.03 8-9 8a10.77 10.77 0 01-3.44-.56L3 21l1.56-4.56A7.6 7.6 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Komentari
            <span className="ml-1 text-xs font-bold text-gray-500">{commentCount}</span>
          </button>
        </div>

        {/* Comments */}
        {commentsOpen && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-gray-900">Komentari</p>
              {commentsLoading && comments.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <div className="h-4 w-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                  Učitavanje...
                </div>
              )}
            </div>

            {comments.length > 0 ? (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {comments.map((cm) => {
                  const displayName = cm.user.fullName?.trim() ? cm.user.fullName : cm.user.username
                  const initial = displayName.charAt(0).toUpperCase()
                  return (
                    <div key={cm.id} className="flex gap-3">
                      <div className="relative w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {cm.user.avatarUrl ? (
                          <img src={cm.user.avatarUrl} alt={displayName} className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <span>{initial}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link to={`/korisnik/${cm.user.username}`} className="text-sm font-semibold text-gray-900 hover:text-emerald-700 transition-colors">
                            {displayName}
                          </Link>
                          <span className="text-xs text-gray-400">{formatRelativeTime(cm.createdAt)}</span>
                        </div>
                        <p className="mt-1 text-sm text-gray-800 whitespace-pre-wrap break-words">{cm.content}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : !commentsLoading ? (
              <p className="text-sm text-gray-500">Još nema komentara. Budi prvi.</p>
            ) : null}

            <div className="mt-4 flex gap-3 items-start">
              <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {post.user.username ? (
                  <span>{(post.user.fullName?.trim() ? post.user.fullName : post.user.username).charAt(0).toUpperCase()}</span>
                ) : (
                  <span>?</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                  placeholder="Napiši komentar..."
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-[11px] text-gray-400">{newComment.length}/1500</p>
                  <button
                    type="button"
                    onClick={handleSubmitComment}
                    disabled={!newComment.trim() || submittingComment}
                    className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shadow-emerald-200/50"
                  >
                    {submittingComment ? (
                      <span className="inline-flex items-center justify-center">
                        <span className="h-4 w-4 rounded-full border-2 border-white/60 border-t-transparent animate-spin" />
                      </span>
                    ) : (
                      'Pošalji'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </article>
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
