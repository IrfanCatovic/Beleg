import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { setUnauthorizedHandler, setAuthToken } from '../services/api'
import { fetchMeProfile } from '../services/auth'
import { sessionGeneration } from '../auth/sessionGeneration'
import { clearWebServerAuthCookieBestEffort } from '../auth/clearWebServerAuthCookie'
import {
  IS_LOGGED_IN_KEY,
  USER_STORAGE_KEY,
  meResponseToSessionUser,
  type LoginResponse,
  type SessionUser,
} from '@beleg/shared'

export type User = SessionUser
export type { LoginResponse }

interface AuthContextType {
  isLoggedIn: boolean
  user: User | null
  authLoading: boolean
  pendingSummitReward: LoginResponse['pendingSummitReward'] | null
  login: (data: LoginResponse) => void
  logout: () => void
  refreshUser: () => Promise<boolean>
  clearPendingSummitReward: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [pendingSummitReward, setPendingSummitReward] = useState<LoginResponse['pendingSummitReward'] | null>(null)

  const clearLocalAuthState = useCallback(() => {
    setIsLoggedIn(false)
    setUser(null)
    setPendingSummitReward(null)
    localStorage.removeItem(USER_STORAGE_KEY)
    localStorage.removeItem(IS_LOGGED_IN_KEY)
    setAuthToken(null)
  }, [])

  const invalidateSession = useCallback(() => {
    sessionGeneration.advanceSessionGeneration()
    clearLocalAuthState()
    void clearWebServerAuthCookieBestEffort()
  }, [clearLocalAuthState])

  const logout = useCallback(async () => {
    sessionGeneration.advanceSessionGeneration()
    setAuthLoading(false)
    clearLocalAuthState()
    await clearWebServerAuthCookieBestEffort()
  }, [clearLocalAuthState])

  const refreshUser = useCallback(async () => {
    const refreshGen = sessionGeneration.getSessionGeneration()
    try {
      const data = await fetchMeProfile()
      if (!sessionGeneration.isCurrentSessionGeneration(refreshGen)) return false
      if (!data) return false
      const userData = meResponseToSessionUser(data)
      setUser(userData)
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData))
      return true
    } catch {
      return false
    }
  }, [])

  const login = useCallback((data: LoginResponse) => {
    sessionGeneration.advanceSessionGeneration()
    setAuthLoading(false)
    if (data.token && data.token.length > 10) {
      setAuthToken(data.token)
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
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(next))
      return next
    })
    setIsLoggedIn(true)
    localStorage.setItem(IS_LOGGED_IN_KEY, 'true')
    setPendingSummitReward(data.pendingSummitReward ?? null)
  }, [])

  const clearPendingSummitReward = useCallback(() => {
    setPendingSummitReward(null)
  }, [])

  useEffect(() => {
    const bootstrapGen = sessionGeneration.getSessionGeneration()
    const cachedUser = localStorage.getItem(USER_STORAGE_KEY)
    const cachedLoggedIn = localStorage.getItem(IS_LOGGED_IN_KEY) === 'true'
    if (cachedUser && cachedLoggedIn && sessionGeneration.isCurrentSessionGeneration(bootstrapGen)) {
      try {
        const parsed = JSON.parse(cachedUser) as User
        if (parsed?.username && parsed?.role) {
          setUser(parsed)
          setIsLoggedIn(true)
        }
      } catch {
        localStorage.removeItem(USER_STORAGE_KEY)
        localStorage.removeItem(IS_LOGGED_IN_KEY)
      }
    }

    fetchMeProfile()
      .then((data) => {
        if (!sessionGeneration.isCurrentSessionGeneration(bootstrapGen)) return
        if (!data) {
          invalidateSession()
          return
        }
        if (data.username && typeof data.role === 'string') {
          const userData = meResponseToSessionUser(data)
          setUser(userData)
          setIsLoggedIn(true)
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData))
          localStorage.setItem(IS_LOGGED_IN_KEY, 'true')
        }
      })
      .catch(() => {
        if (!sessionGeneration.isCurrentSessionGeneration(bootstrapGen)) return
      })
      .finally(() => {
        if (sessionGeneration.isCurrentSessionGeneration(bootstrapGen)) {
          setAuthLoading(false)
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      sessionGeneration.advanceSessionGeneration()
      clearLocalAuthState()
      void clearWebServerAuthCookieBestEffort()
    })
    return () => setUnauthorizedHandler(null)
  }, [clearLocalAuthState])

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        user,
        authLoading,
        pendingSummitReward,
        login,
        logout,
        refreshUser,
        clearPendingSummitReward,
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
