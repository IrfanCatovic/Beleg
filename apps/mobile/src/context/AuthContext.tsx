import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  IS_LOGGED_IN_KEY,
  USER_STORAGE_KEY,
  fetchMe,
  logoutApi,
  meResponseToSessionUser,
  type LoginResponse,
  type SessionUser,
} from '@beleg/shared'
import { client, setAuthToken, setUnauthorizedHandler } from '../api/client'
import { clearSuperadminClubStorage } from '../storage/superadminClubStorage'
import { mobileStorage } from '../storage/mobileStorage'

const REMEMBER_ME_KEY = 'remember_me'

export type User = SessionUser

interface AuthContextType {
  isLoggedIn: boolean
  user: User | null
  authLoading: boolean
  login: (data: LoginResponse, rememberMe?: boolean) => void
  logout: () => Promise<void>
  refreshUser: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const clearAuthState = useCallback(async () => {
    setIsLoggedIn(false)
    setUser(null)
    await mobileStorage.removeItem(USER_STORAGE_KEY)
    await mobileStorage.removeItem(IS_LOGGED_IN_KEY)
    await mobileStorage.removeItem(REMEMBER_ME_KEY)
    await clearSuperadminClubStorage()
    await setAuthToken(null)
  }, [])

  const logout = useCallback(async () => {
    await logoutApi(client)
    await clearAuthState()
  }, [clearAuthState])

  const refreshUser = useCallback(async () => {
    try {
      const data = await fetchMe(client)
      if (!data) return false
      const userData = meResponseToSessionUser(data)
      setUser(userData)
      await mobileStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData))
      return true
    } catch {
      return false
    }
  }, [])

  const login = useCallback((data: LoginResponse, rememberMe = true) => {
    if (data.token && data.token.length > 10) {
      void setAuthToken(data.token)
    }
    const next: User = {
      username: data.user.username,
      fullName: data.user.fullName,
      role: data.role as User['role'],
      avatarUrl: data.user.avatar_url,
      klubId:
        typeof data.user.klubId === 'number' && !Number.isNaN(data.user.klubId) ? data.user.klubId : undefined,
      profileIncomplete: data.profileIncomplete ?? false,
    }
    setUser(next)
    setIsLoggedIn(true)
    void mobileStorage.setItem(REMEMBER_ME_KEY, rememberMe ? 'true' : 'false')
    if (rememberMe) {
      void mobileStorage.setItem(USER_STORAGE_KEY, JSON.stringify(next))
      void mobileStorage.setItem(IS_LOGGED_IN_KEY, 'true')
    } else {
      void mobileStorage.removeItem(USER_STORAGE_KEY)
      void mobileStorage.removeItem(IS_LOGGED_IN_KEY)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      const rememberMe = (await mobileStorage.getItem(REMEMBER_ME_KEY)) !== 'false'
      const cachedUser = rememberMe ? await mobileStorage.getItem(USER_STORAGE_KEY) : null
      const cachedLoggedIn = rememberMe && (await mobileStorage.getItem(IS_LOGGED_IN_KEY)) === 'true'

      if (cachedUser && cachedLoggedIn) {
        try {
          const parsed = JSON.parse(cachedUser) as User
          if (parsed?.username && parsed?.role) {
            setUser(parsed)
            setIsLoggedIn(true)
          }
        } catch {
          await mobileStorage.removeItem(USER_STORAGE_KEY)
          await mobileStorage.removeItem(IS_LOGGED_IN_KEY)
        }
      }

      try {
        const data = await fetchMe(client)
        if (cancelled) return
        if (!data) {
          await clearAuthState()
          return
        }
        if (data.username && typeof data.role === 'string') {
          const userData = meResponseToSessionUser(data)
          setUser(userData)
          setIsLoggedIn(true)
          if (rememberMe) {
            await mobileStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData))
            await mobileStorage.setItem(IS_LOGGED_IN_KEY, 'true')
          }
        }
      } catch {
        // keep cached session if offline
      } finally {
        if (!cancelled) setAuthLoading(false)
      }
    }

    void restoreSession()
    return () => {
      cancelled = true
    }
  }, [clearAuthState])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void clearAuthState()
    })
    return () => setUnauthorizedHandler(null)
  }, [clearAuthState])

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        user,
        authLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
