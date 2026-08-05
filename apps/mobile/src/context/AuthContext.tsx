import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
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
import { sessionGeneration } from '../auth/sessionGeneration'
import { clearAuthenticatedUserQueryState } from '../lib/clearAuthenticatedUserQueryState'
import { finishClearAuthSideEffects, performMobileLogout } from '../lib/performMobileLogout'
import { clearSuperadminClubStorage } from '../storage/superadminClubStorage'
import { mobileStorage } from '../storage/mobileStorage'
import { clearPendingNavigationOnSessionEnd } from '../navigation/consumePendingNavigation'

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
  const logoutInFlightRef = useRef(false)

  const clearLocalAuthState = useCallback(async () => {
    setIsLoggedIn(false)
    setUser(null)
    await finishClearAuthSideEffects({
      clearStorageAndToken: async () => {
        await mobileStorage.removeItem(USER_STORAGE_KEY)
        await mobileStorage.removeItem(IS_LOGGED_IN_KEY)
        await mobileStorage.removeItem(REMEMBER_ME_KEY)
        await clearSuperadminClubStorage()
        await setAuthToken(null)
      },
      clearQueryState: clearAuthenticatedUserQueryState,
    })
    try {
      await setAuthToken(null)
    } catch {
      // ignore
    }
  }, [])

  const invalidateSession = useCallback(async () => {
    sessionGeneration.advanceSessionGeneration()
    await clearLocalAuthState()
  }, [clearLocalAuthState])

  const logout = useCallback(async () => {
    sessionGeneration.advanceSessionGeneration()
    setAuthLoading(false)
    await clearPendingNavigationOnSessionEnd()
    await performMobileLogout({
      inFlight: logoutInFlightRef,
      logoutApi: () => logoutApi(client),
      clearAuthState: clearLocalAuthState,
    })
  }, [clearLocalAuthState])

  const refreshUser = useCallback(async () => {
    const refreshGen = sessionGeneration.getSessionGeneration()
    try {
      const data = await fetchMe(client)
      if (!sessionGeneration.isCurrentSessionGeneration(refreshGen)) return false
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
    sessionGeneration.advanceSessionGeneration()
    setAuthLoading(false)
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
    const restoreGen = sessionGeneration.getSessionGeneration()

    async function restoreSession() {
      let rememberMe = true
      let cachedUser: string | null = null
      let cachedLoggedIn = false

      try {
        try {
          rememberMe = (await mobileStorage.getItem(REMEMBER_ME_KEY)) !== 'false'
          cachedUser = rememberMe ? await mobileStorage.getItem(USER_STORAGE_KEY) : null
          cachedLoggedIn = rememberMe && (await mobileStorage.getItem(IS_LOGGED_IN_KEY)) === 'true'
        } catch {
          if (sessionGeneration.isCurrentSessionGeneration(restoreGen)) {
            await clearLocalAuthState()
          }
          return
        }

        if (
          cachedUser &&
          cachedLoggedIn &&
          sessionGeneration.isCurrentSessionGeneration(restoreGen)
        ) {
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
          if (!sessionGeneration.isCurrentSessionGeneration(restoreGen)) return
          if (!data) {
            await invalidateSession()
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
          if (!sessionGeneration.isCurrentSessionGeneration(restoreGen)) return
        }
      } finally {
        if (sessionGeneration.isCurrentSessionGeneration(restoreGen)) {
          setAuthLoading(false)
        }
      }
    }

    void restoreSession()
  }, [clearLocalAuthState, invalidateSession])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      sessionGeneration.advanceSessionGeneration()
      void clearPendingNavigationOnSessionEnd().then(() => clearLocalAuthState())
    })
    return () => setUnauthorizedHandler(null)
  }, [clearLocalAuthState])

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
