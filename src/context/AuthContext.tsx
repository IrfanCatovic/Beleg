import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import api, { setUnauthorizedHandler, setAuthToken } from "../services/api";

export interface User {
    username: string;
    fullName: string;
    role: '' | 'superadmin' | 'admin' | 'clan' | 'vodic' | 'blagajnik' | 'sekretar' | 'menadzer-opreme';
    ukupnoKm?: number;
    ukupnoMetaraUspona?: number;
    brojPopeoSe?: number;
    avatarUrl?: string;
    /** Klub korisnika (za superadmina nije uvek relevantno — koristi se X-Club-Id) */
    klubId?: number;
    profileIncomplete?: boolean;
}


export interface LoginResponse {
  role: string;
  user: { username: string; fullName: string; avatar_url?: string; klubId?: number };
  profileIncomplete?: boolean;
  /** JWT kada cookie nije moguć (cross-origin); šalje se kao Authorization Bearer */
  token?: string;
}

interface AuthContextType {
  isLoggedIn: boolean;
  user: User | null;
  authLoading: boolean;
  login: (data: LoginResponse) => void;
  logout: () => void;
  refreshUser: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const computeProfileIncomplete = (data: {
    email?: string
    email_verified_at?: string | null
    pol?: string
    datum_rodjenja?: string | null
}): boolean => {
    const hasEmail = typeof data.email === 'string' && data.email.trim().length > 0
    const emailVerified = !!data.email_verified_at
    const hasGender = typeof data.pol === 'string' && data.pol.trim().length > 0
    const hasBirthDate = !!data.datum_rodjenja
    return !(hasEmail && emailVerified && hasGender && hasBirthDate)
}

    export function AuthProvider({ children }: { children: ReactNode }) {
        const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false)
        const [user, setUser] = useState<User | null>(null)
        const [authLoading, setAuthLoading] = useState(true)

        const logout = useCallback(async () => {
            try {
                await api.post('/api/logout')
            } catch { /* ignore */ }
            setIsLoggedIn(false)
            setUser(null)
            localStorage.removeItem('user')
            localStorage.removeItem('isLoggedIn')
            setAuthToken(null)
        }, [])

        const refreshUser = useCallback(async () => {
            try {
                const res = await api.get<{ username: string; fullName: string; role: string; avatar_url?: string; klubId?: number; email?: string; email_verified_at?: string | null; pol?: string; datum_rodjenja?: string | null }>('/api/me')
                const data = res.data
                const userData: User = {
                    username: data.username,
                    fullName: data.fullName,
                    role: data.role as User['role'],
                    avatarUrl: data.avatar_url,
                    klubId: data.klubId,
                    profileIncomplete: computeProfileIncomplete(data),
                }
                setUser(userData)
                localStorage.setItem('user', JSON.stringify(userData))
                return true
            } catch {
                return false
            }
        }, [])

        const login = useCallback((data: LoginResponse) => {
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
                localStorage.setItem('user', JSON.stringify(next))
                return next
            })
            setIsLoggedIn(true)
        }, [])

        useEffect(() => {
            api.get('/api/me', { validateStatus: (s) => s === 200 || s === 401 })
                .then((res) => {
                    if (res.status === 401) return
                    const data = res.data as {
                        username?: string
                        fullName?: string
                        role?: string
                        avatar_url?: string
                        klubId?: number
                        email?: string
                        email_verified_at?: string | null
                        pol?: string
                        datum_rodjenja?: string | null
                    }
                    if (data?.username && typeof data?.role === 'string') {
                        const userData: User = {
                            username: data.username,
                            fullName: data.fullName ?? '',
                            role: data.role as User['role'],
                            avatarUrl: data.avatar_url,
                            klubId: data.klubId,
                            profileIncomplete: computeProfileIncomplete(data),
                        }
                        setUser(userData)
                        setIsLoggedIn(true)
                        localStorage.setItem('user', JSON.stringify(userData))
                    }
                })
                .catch(() => { /* nije ulogovan */ })
                .finally(() => setAuthLoading(false))
        }, [])

        useEffect(() => {
            if (isLoggedIn) {
                refreshUser().then((ok) => { if (!ok) logout() })
            }
        }, [isLoggedIn])

        useEffect(() => {
            setUnauthorizedHandler(logout)
            return () => setUnauthorizedHandler(null)
        }, [logout])

        return (
            <AuthContext.Provider value={{ isLoggedIn, user, authLoading, login, logout, refreshUser }}>
                {children}
            </AuthContext.Provider>
        );
        }
        
    export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error()
    }
    return context
    }