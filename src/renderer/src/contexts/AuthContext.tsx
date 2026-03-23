import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import type { AppUser, UserRole } from '../types'

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_TOKEN_KEY = 'lirik_session_token'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: AppUser | null
  loading: boolean
  login: (email: string, password: string, remember: boolean) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>
  hasPermission: (requiredRole: UserRole | UserRole[]) => boolean
  isAdmin: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROLE_LEVELS: Record<UserRole, number> = {
  admin: 4,
  secretary: 3,
  accountant: 2,
  teacher: 1
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  // Uygulama açılışında oturumu kontrol et
  useEffect(() => {
    const token = localStorage.getItem(SESSION_TOKEN_KEY)
    if (!token) { setLoading(false); return }

    window.api.auth.checkSession(token).then(u => {
      setUser(u)
      setLoading(false)
    }).catch(() => {
      localStorage.removeItem(SESSION_TOKEN_KEY)
      setLoading(false)
    })
  }, [])

  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    const result = await window.api.auth.login(email, password, remember)
    if (result.success && result.user && result.token) {
      localStorage.setItem(SESSION_TOKEN_KEY, result.token)
      setUser(result.user)
      return { success: true }
    }
    return { success: false, error: result.error }
  }, [])

  const logout = useCallback(async () => {
    const token = localStorage.getItem(SESSION_TOKEN_KEY)
    if (token) await window.api.auth.logout(token)
    localStorage.removeItem(SESSION_TOKEN_KEY)
    setUser(null)
  }, [])

  const changePassword = useCallback(async (oldPassword: string, newPassword: string) => {
    if (!user) return { success: false, error: 'Oturum bulunamadı.' }
    return window.api.auth.changePassword(user.id, oldPassword, newPassword)
  }, [user])

  const hasPermission = useCallback((requiredRole: UserRole | UserRole[]): boolean => {
    if (!user) return false
    if (user.role === 'admin') return true
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
    return roles.some(r => ROLE_LEVELS[user.role] >= ROLE_LEVELS[r])
  }, [user])

  const isAdmin = user?.role === 'admin'

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, changePassword, hasPermission, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
