import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import {
  clearSuperadminClubStorage,
  loadSuperadminClubFromStorage,
  saveSuperadminClubToStorage,
} from '../storage/superadminClubStorage'

interface SuperadminClubContextValue {
  clubId: string | null
  clubName: string | null
  loading: boolean
  hasSelectedClub: boolean
  enterClub: (id: number, name: string) => Promise<void>
  leaveClubContext: () => Promise<void>
}

const SuperadminClubContext = createContext<SuperadminClubContextValue | undefined>(undefined)

const CLUB_QUERY_KEYS = [['klub'], ['klub', 'admin-stats'], ['akcije'], ['club-join-requests']] as const

export function SuperadminClubProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { isLoggedIn, user } = useAuth()
  const [clubId, setClubId] = useState<string | null>(null)
  const [clubName, setClubName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    if (!isLoggedIn || user?.role !== 'superadmin') {
      setClubId(null)
      setClubName(null)
      setLoading(false)
      return
    }

    ;(async () => {
      setLoading(true)
      try {
        const { clubId: id, clubName: name } = await loadSuperadminClubFromStorage()
        if (!cancelled) {
          setClubId(id)
          setClubName(name)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isLoggedIn, user?.role])

  const invalidateClubQueries = useCallback(() => {
    for (const key of CLUB_QUERY_KEYS) {
      void queryClient.invalidateQueries({ queryKey: key })
    }
  }, [queryClient])

  const enterClub = useCallback(
    async (id: number, name: string) => {
      await saveSuperadminClubToStorage(id, name)
      setClubId(String(id))
      setClubName(name)
      invalidateClubQueries()
    },
    [invalidateClubQueries],
  )

  const leaveClubContext = useCallback(async () => {
    await clearSuperadminClubStorage()
    setClubId(null)
    setClubName(null)
    invalidateClubQueries()
  }, [invalidateClubQueries])

  const value = useMemo(
    () => ({
      clubId,
      clubName,
      loading,
      hasSelectedClub: !!clubId,
      enterClub,
      leaveClubContext,
    }),
    [clubId, clubName, loading, enterClub, leaveClubContext],
  )

  return <SuperadminClubContext.Provider value={value}>{children}</SuperadminClubContext.Provider>
}

export function useSuperadminClub() {
  const ctx = useContext(SuperadminClubContext)
  if (!ctx) {
    throw new Error('useSuperadminClub must be used within SuperadminClubProvider')
  }
  return ctx
}
