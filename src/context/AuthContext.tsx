import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import api, { setUnauthorizedHandler } from "../services/api";

interface User {
    username: string;
    fullName: string;
    role: 'admin' | `clan` | 'vodic' | 'blagajnik' | 'sekretar' | 'menadzer-opreme';
    ukupnoKm?: number;
    ukupnoMetaraUspona?: number;
    brojPopeoSe?: number;
}


export interface LoginResponse {
  token: string;
  role: string;
  user: { username: string; fullName: string };
}

interface AuthContextType {
  isLoggedIn: boolean;
  user: User | null;
  login: (data: LoginResponse) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

    export function AuthProvider({ children }: { children: ReactNode }) {

        const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
        return !!localStorage.getItem('isLoggedIn') //this checks if there is already item isLoggedIn in localStorage and 
        // sets the initial state accordingly, and this !! converts the value to a boolean (true if it exists, false if it doesn't)
        })

        const [user, setUser] = useState<User | null>(() => {
            const savedUser = localStorage.getItem('user')
            return savedUser ? JSON.parse(savedUser) : null
        })



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
                    const res = await api.get<{ username: string; fullName: string; role: string }>('/api/me')
                    const data = res.data
                    const userData: User = {
                        username: data.username,
                        fullName: data.fullName,
                        role: data.role as User['role'],
                    }
                    setUser(userData)
                    localStorage.setItem('user', JSON.stringify(userData))
                } catch {
                    // Token može biti istekao – ignorišemo
                }
            }, [])

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