import { useNavigate } from 'react-router-dom'
import type { User } from '../context/AuthContext'

export interface AppLayoutProfileDropdownProps {
  profileBlockRef: React.RefObject<HTMLDivElement | null>
  user: User
  isProfileMenuOpen: boolean
  setIsProfileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  setIsSearchOpen: React.Dispatch<React.SetStateAction<boolean>>
  setIsNotificationsOpen: React.Dispatch<React.SetStateAction<boolean>>
  setNavExploreOpen: React.Dispatch<React.SetStateAction<boolean>>
  setNavClubOpen: React.Dispatch<React.SetStateAction<boolean>>
  onLogout: () => void
  t: (key: string) => string
}

export function AppLayoutProfileDropdown({
  profileBlockRef,
  user,
  isProfileMenuOpen,
  setIsProfileMenuOpen,
  setIsSearchOpen,
  setIsNotificationsOpen,
  setNavExploreOpen,
  setNavClubOpen,
  onLogout,
  t,
}: AppLayoutProfileDropdownProps) {
  const navigate = useNavigate()
  return (
    <div ref={profileBlockRef} className="relative flex items-center">
                      <button
                        type="button"
                        onClick={() => {
                          setIsSearchOpen(false)
                          setIsNotificationsOpen(false)
                          setNavExploreOpen(false)
                          setNavClubOpen(false)
                          setIsProfileMenuOpen((v) => !v)
                        }}
                        className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-white/[0.06] transition-all duration-200 group"
                      >
                        <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 text-sm font-bold text-white shadow-sm overflow-hidden ring-2 ring-white/10 group-hover:ring-emerald-400/30 transition-all">
                          {user.avatarUrl ? (
                            <img
                              src={user.avatarUrl}
                              alt={user.fullName || user.username}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span>
                              {(user.fullName || user.username || '?').charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="text-left hidden lg:block">
                          <p className="text-xs font-semibold text-white/90 leading-tight">
                            {user.fullName || user.username}
                          </p>
                          <p className="text-[10px] text-white/50 leading-tight">
                            @{user.username}
                          </p>
                        </div>
                        <svg className="hidden lg:block h-3.5 w-3.5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </button>
                      {isProfileMenuOpen && (
                        <div className="absolute right-0 top-12 w-52 rounded-2xl bg-white py-1.5 shadow-2xl ring-1 ring-black/5 z-50">
                          <div className="px-3.5 py-2.5 border-b border-gray-100">
                            <p className="text-sm font-semibold text-gray-900 truncate">{user.fullName || user.username}</p>
                            <p className="text-[11px] text-gray-400 truncate">@{user.username}</p>
                          </div>
                          <div className="py-1">
                            <button
                              type="button"
                              onClick={() => {
                                setIsProfileMenuOpen(false)
                                navigate(`/korisnik/${user.username}`)
                              }}
                              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                              </svg>
                              {t('myProfile')}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setIsProfileMenuOpen(false); navigate('/profil/podesavanja') }}
                              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {t('settings')}
                            </button>
                          </div>
                          <div className="border-t border-gray-100 pt-1">
                            <button
                              type="button"
                              onClick={() => { setIsProfileMenuOpen(false); onLogout() }}
                              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                              </svg>
                              {t('logout')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
  )
}
