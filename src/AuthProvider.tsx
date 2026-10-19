import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiRequest, refreshAccessToken, setAccessToken } from './api'

export type SafeUser = {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  emailVerified: boolean
  createdAt: string
}

type AuthState = {
  status: 'loading' | 'guest' | 'authenticated'
  user: SafeUser | null
}

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string, confirmPassword: string) => Promise<{ requiresEmailVerification: boolean }>
  logout: () => Promise<void>
  forgotPassword: (email: string) => Promise<string>
  resetPassword: (token: string, password: string, confirmPassword: string) => Promise<void>
  verifyEmail: (token: string) => Promise<void>
  changePassword: (currentPassword: string, password: string, confirmPassword: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null })
  useEffect(() => {
    let active = true
    void (async () => {
      const token = await refreshAccessToken()
      if (!token) {
        if (active) setState({ status: 'guest', user: null })
        return
      }
      try {
        const result = await apiRequest<{ user: SafeUser }>('/auth/me', {}, false)
        if (active) setState({ status: 'authenticated', user: result.user })
      } catch {
        setAccessToken(null)
        if (active) setState({ status: 'guest', user: null })
      }
    })()
    return () => { active = false }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiRequest<{ user: SafeUser; accessToken: string }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    }, false)
    setAccessToken(result.accessToken)
    setState({ status: 'authenticated', user: result.user })
  }, [])

  const signup = useCallback(async (name: string, email: string, password: string, confirmPassword: string) => {
    const result = await apiRequest<{ user: SafeUser; accessToken?: string; requiresEmailVerification: boolean }>('/auth/signup', {
      method: 'POST', body: JSON.stringify({ name, email, password, confirmPassword }),
    }, false)
    if (result.accessToken) {
      setAccessToken(result.accessToken)
      setState({ status: 'authenticated', user: result.user })
    }
    return { requiresEmailVerification: result.requiresEmailVerification }
  }, [])

  const logout = useCallback(async () => {
    try { await apiRequest('/auth/logout', { method: 'POST' }, false) }
    finally {
      setAccessToken(null)
      setState({ status: 'guest', user: null })
    }
  }, [])

  const forgotPassword = useCallback(async (email: string) => {
    const result = await apiRequest<{ message: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }, false)
    return result.message
  }, [])

  const resetPassword = useCallback(async (token: string, password: string, confirmPassword: string) => {
    await apiRequest('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password, confirmPassword }) }, false)
  }, [])

  const verifyEmail = useCallback(async (token: string) => {
    await apiRequest('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }, false)
  }, [])

  const changePassword = useCallback(async (currentPassword: string, password: string, confirmPassword: string) => {
    await apiRequest('/auth/change-password', { method: 'PATCH', body: JSON.stringify({ currentPassword, password, confirmPassword }) })
    setAccessToken(null)
    setState({ status: 'guest', user: null })
  }, [])

  return <AuthContext.Provider value={{ ...state, login, signup, logout, forgotPassword, resetPassword, verifyEmail, changePassword }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
