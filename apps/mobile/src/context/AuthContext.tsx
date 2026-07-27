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
import { clearAuthenticatedUserQueryState } from '../lib/clearAuthenticatedUserQueryState'
import { finishClearAuthSideEffects, performMobileLogout } from '../lib/performMobileLogout'
import { clearSuperadminClubStorage } from '../storage/superadminClubStorage'
import { mobileStorage } from '../storage/mobileStorage'
import { clearPendingNotificationTarget } from '../features/notifications/pendingNotificationTarget'

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

  const clearAuthState = useCallback(async () => {
    // Auth UI/state prvo — RootNavigator odmah prelazi na AuthStack (nema back na protected).
    // Does NOT clear pending push target: session restore / initial logged-out must not
    // wipe a destination saved from a cold-start or logged-out tap.
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
    // Ako je storage pao prije setAuthToken, pokušaj još jednom skinuti token.
    try {
      await setAuthToken(null)
    } catch {
      // ignore
    }
  }, [])

  const logout = useCallback(async () => {
    // Explicit logout only: drop unconsumed push destination so it cannot open on another account.
    // Does not clear URL pending deep-link (separate flow).
    await clearPendingNotificationTarget()
    await performMobileLogout({
      inFlight: logoutInFlightRef,
      logoutApi: () => logoutApi(client),
      clearAuthState,
    })
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
      // Forced session end: same account-boundary rule as explicit logout for push pending.
      void clearPendingNotificationTarget().then(() => clearAuthState())
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
