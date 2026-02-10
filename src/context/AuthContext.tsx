import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface User {
    username: string;
    fullName: string;
    role: 'admin' | `clan`
}

interface AuthContextType {
  isLoggedIn: boolean;
  user: User | null
  login: (username: string, password: string) => void;
  logout: () => void;
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
            if(isLoggedIn) {
            localStorage.setItem('isLoggedIn', 'true') //when user log in, it sets the item isLoggedIn to true in localStorage
            } else {   
                localStorage.removeItem('isLoggedIn') //when user log out, it removes the item isLoggedIn from localStorage
                localStorage.removeItem('user')
            }
        }, [isLoggedIn])

            const login = (username: string, password: string) => {
                // Current simulated login logic, replace with real API call in production
                let simulatedUser: User | null = null

                if (username === 'admin' && password === 'admin123') {
                simulatedUser = {
                    username: 'admin',
                    fullName: 'Admin Beleg',
                    role: 'admin'
                }
                } else if (username === 'clan1' && password === 'clan123') {
                simulatedUser = {
                    username: 'clan1',
                    fullName: 'Pera Perić',
                    role: 'clan'
                }
             }

                if (simulatedUser) {
                setUser(simulatedUser)
                localStorage.setItem('user', JSON.stringify(simulatedUser))
                setIsLoggedIn(true)
                } else {
                alert('Pogrešno korisničko ime ili lozinka!')
                }
            }
            
            const logout = () => {
            setIsLoggedIn(false)
            setUser(null)
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