import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
//i have stoped exploring file here.

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

            const logout = () => {
                setIsLoggedIn(false)
                setUser(null)
                localStorage.removeItem('token')
            }

        return (
            <AuthContext.Provider value={{ isLoggedIn, user, login, logout }}>
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