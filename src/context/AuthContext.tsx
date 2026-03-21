import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import api, { setUnauthorizedHandler } from "../services/api";

export interface User {
    username: string;
    fullName: string;
    role: 'superadmin' | 'admin' | 'clan' | 'vodic' | 'blagajnik' | 'sekretar' | 'menadzer-opreme';
    ukupnoKm?: number;
    ukupnoMetaraUspona?: number;
    brojPopeoSe?: number;
    avatarUrl?: string;
    /** Klub korisnika (za superadmina nije uvek relevantno — koristi se X-Club-Id) */
    klubId?: number;
}


export interface LoginResponse {
  role: string;
  user: { username: string; fullName: string; avatar_url?: string };
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
        }, [])

        const refreshUser = useCallback(async () => {
            try {
                const res = await api.get<{ username: string; fullName: string; role: string; avatar_url?: string; klubId?: number }>('/api/me')
                const data = res.data
                const userData: User = {
                    username: data.username,
                    fullName: data.fullName,
                    role: data.role as User['role'],
                    avatarUrl: data.avatar_url,
                    klubId: data.klubId,
                }
                setUser(userData)
                localStorage.setItem('user', JSON.stringify(userData))
                return true
            } catch {
                return false
            }
        }, [])

        const login = useCallback((data: LoginResponse) => {
            const userData: User = {
                username: data.user.username,
                fullName: data.user.fullName,
                role: data.role as User['role'],
                avatarUrl: data.user.avatar_url,
            }
            setUser(userData)
            localStorage.setItem('user', JSON.stringify(userData))
            setIsLoggedIn(true)
        }, [])

        useEffect(() => {
            api.get('/api/me')
                .then((res) => {
                    const data = res.data as { username?: string; fullName?: string; role?: string }
                    if (data?.username && data?.role) {
                        const userData: User = {
                            username: data.username,
                            fullName: data.fullName ?? '',
                            role: data.role as User['role'],
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
        throw new Error('useAuth mora biti unutar AuthProvider-a')
    }
    return context
    }