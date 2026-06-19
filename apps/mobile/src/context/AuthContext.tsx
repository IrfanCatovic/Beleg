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
import { mobileStorage } from '../storage/mobileStorage'

export type User = SessionUser

interface AuthContextType {
  isLoggedIn: boolean
  user: User | null
  authLoading: boolean
  login: (data: LoginResponse) => void
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

  const login = useCallback((data: LoginResponse) => {
    if (data.token && data.token.length > 10) {
      void setAuthToken(data.token)
    }
    setUser((prev) => {
      const next: User = {
        username: data.user.username,
        fullName: data.user.fullName,
        role: data.role as User['role'],
        avatarUrl: data.user.avatar_url ?? prev?.avatarUrl,
        klubId:
          typeof data.user.klubId === 'number' && !Number.isNaN(data.user.klubId)
            ? data.user.klubId
            : prev?.klubId,
        profileIncomplete: data.profileIncomplete ?? prev?.profileIncomplete ?? false,
      }
      void mobileStorage.setItem(USER_STORAGE_KEY, JSON.stringify(next))
      return next
    })
    setIsLoggedIn(true)
    void mobileStorage.setItem(IS_LOGGED_IN_KEY, 'true')
  }, [])

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      const cachedUser = await mobileStorage.getItem(USER_STORAGE_KEY)
      const cachedLoggedIn = (await mobileStorage.getItem(IS_LOGGED_IN_KEY)) === 'true'

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
          await mobileStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData))
          await mobileStorage.setItem(IS_LOGGED_IN_KEY, 'true')
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
