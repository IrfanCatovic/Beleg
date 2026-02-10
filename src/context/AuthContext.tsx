import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface AuthContextType {
  isLoggedIn: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

        export function AuthProvider({ children }: { children: ReactNode }) {

            const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
            return !!localStorage.getItem('isLoggedIn') //this checks if there is already item isLoggedIn in localStorage and 
            // sets the initial state accordingly, and this !! converts the value to a boolean (true if it exists, false if it doesn't)
        })

        useEffect(() => {
            if(isLoggedIn) {
            localStorage.setItem('isLoggedIn', 'true') //when user log in, it sets the item isLoggedIn to true in localStorage
            } else {   
                localStorage.removeItem('isLoggedIn') //when user log out, it removes the item isLoggedIn from localStorage
            }
        }, [isLoggedIn])

            const login = () => {
            setIsLoggedIn(true)
            }

            const logout = () => {
            setIsLoggedIn(false)
            }

        return (
            <AuthContext.Provider value={{ isLoggedIn , login, logout }}>
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