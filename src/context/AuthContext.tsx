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
  token: string;
  role: string;
  user: { username: string; fullName: string; avatar_url?: string };
}

interface AuthContextType {
  isLoggedIn: boolean;
  user: User | null;
  login: (data: LoginResponse) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readStoredUser(): User | null {
    const savedUser = localStorage.getItem('user')
    if (!savedUser) return null
    try {
        return JSON.parse(savedUser) as User
    } catch {
        localStorage.removeItem('user')
        return null
    }
}

    export function AuthProvider({ children }: { children: ReactNode }) {

        const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
        return !!localStorage.getItem('token')
        })

        const [user, setUser] = useState<User | null>(() => readStoredUser())



        useEffect(() => {
            if (isLoggedIn) {
                localStorage.setItem('isLoggedIn', 'true')
            } else {
                localStorage.removeItem('isLoggedIn')
                localStorage.removeItem('user')
                localStorage.removeItem('token')
            }
        }, [isLoggedIn])

            const login = (data: LoginResponse) => {
                const userData: User = {
                    username: data.user.username,
                    fullName: data.user.fullName,
                    role: data.role as User['role'],
                    avatarUrl: data.user.avatar_url,
                }
                setUser(userData)
                localStorage.setItem('user', JSON.stringify(userData))
                localStorage.setItem('token', data.token)
                setIsLoggedIn(true)
            }

            const logout = useCallback(() => {
                setIsLoggedIn(false)
                setUser(null)
                localStorage.removeItem('token')
            }, [])

            const refreshUser = useCallback(async () => {
                if (!localStorage.getItem('token')) return
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
                } catch {
                    logout()
                }
            }, [logout])

        useEffect(() => {
            if (isLoggedIn && localStorage.getItem('token')) {
                refreshUser()
            }
        }, [isLoggedIn, refreshUser])

        useEffect(() => {
            setUnauthorizedHandler(logout)
            return () => setUnauthorizedHandler(null)
        }, [logout])

        return (
            <AuthContext.Provider value={{ isLoggedIn, user, login, logout, refreshUser }}>
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