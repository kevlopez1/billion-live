"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { toast } from "sonner"

interface User {
  id: string
  email: string
  name: string
  role: "admin" | "viewer"
  avatar?: string
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  checkAuth: () => boolean
}

const ADMIN_CREDENTIALS = {
  email: "admin@kevstrategy.com",
  password: "billion2024",
}

const ADMIN_USER: User = {
  id: "1",
  email: "admin@kevstrategy.com",
  name: "Kevin Strategy",
  role: "admin",
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const savedAuth = localStorage.getItem("kev-auth")
    if (savedAuth) {
      try {
        const parsed = JSON.parse(savedAuth)
        if (parsed.expiry && new Date(parsed.expiry) > new Date()) {
          setUser(parsed.user)
        } else {
          localStorage.removeItem("kev-auth")
        }
      } catch (e) {
        localStorage.removeItem("kev-auth")
      }
    }
    setIsLoading(false)
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
      setUser(ADMIN_USER)

      // Save to localStorage with 24h expiry
      const expiry = new Date()
      expiry.setHours(expiry.getHours() + 24)
      localStorage.setItem("kev-auth", JSON.stringify({ user: ADMIN_USER, expiry: expiry.toISOString() }))

      setIsLoading(false)
      toast.success("Welcome back, Kevin!")
      return true
    }

    setIsLoading(false)
    toast.error("Invalid credentials")
    return false
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem("kev-auth")
    toast.success("Logged out successfully")
  }, [])

  const checkAuth = useCallback(() => {
    return user !== null && user.role === "admin"
  }, [user])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isLoading,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
