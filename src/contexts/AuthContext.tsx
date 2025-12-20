'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  workspaceId: string | null
  userRole: 'admin' | 'editor' | 'viewer' | null
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: Error | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  maxAttempts: 5,
  baseDelay: 1000, // 1 second
  maxDelay: 60000, // 60 seconds max
}

// Password validation - removed all requirements for user flexibility
// Users can set any password they want
function validatePassword(password: string): { valid: boolean; message: string } {
  // Only check that password is not empty
  if (!password || password.trim().length === 0) {
    return { valid: false, message: 'Password cannot be empty' }
  }
  return { valid: true, message: '' }
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<'admin' | 'editor' | 'viewer' | null>(null)

  // Rate limiting state
  const failedAttemptsRef = useRef<number>(0)
  const lastAttemptTimeRef = useRef<number>(0)
  const rateLimitUntilRef = useRef<number>(0)

  // Prevent concurrent profile fetches
  const fetchInProgressRef = useRef(false)
  const initialLoadComplete = useRef(false)

  // Profile cache with request deduplication
  const profileCacheRef = useRef<Map<string, Promise<any>>>(new Map())

  // Calculate rate limit delay with exponential backoff
  const getRateLimitDelay = useCallback((): number => {
    if (failedAttemptsRef.current === 0) return 0
    const delay = Math.min(
      RATE_LIMIT_CONFIG.baseDelay * Math.pow(2, failedAttemptsRef.current - 1),
      RATE_LIMIT_CONFIG.maxDelay
    )
    return delay
  }, [])

  // Check if rate limited
  const isRateLimited = useCallback((): { limited: boolean; remainingMs: number } => {
    const now = Date.now()
    if (now < rateLimitUntilRef.current) {
      return { limited: true, remainingMs: rateLimitUntilRef.current - now }
    }
    return { limited: false, remainingMs: 0 }
  }, [])

  // Record failed attempt and update rate limit
  const recordFailedAttempt = useCallback(() => {
    failedAttemptsRef.current += 1
    lastAttemptTimeRef.current = Date.now()
    const delay = getRateLimitDelay()
    rateLimitUntilRef.current = Date.now() + delay
  }, [getRateLimitDelay])

  // Reset rate limit on successful auth
  const resetRateLimit = useCallback(() => {
    failedAttemptsRef.current = 0
    lastAttemptTimeRef.current = 0
    rateLimitUntilRef.current = 0
  }, [])

  // Fetch user profile with proper error handling
  const fetchUserProfile = async (userId: string, retryCount = 0): Promise<{ workspace_id: string; role: string } | null> => {
    const maxRetries = 3

    // Check cache first
    const cachedRequest = profileCacheRef.current.get(userId)
    if (cachedRequest) {
      return cachedRequest
    }

    // Prevent concurrent fetches
    if (fetchInProgressRef.current) {
      return null
    }

    fetchInProgressRef.current = true

    const fetchPromise: Promise<{ workspace_id: string; role: string } | null> = (async () => {
      try {
        // Try RPC first to avoid RLS recursion
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_my_profile')
        if (!rpcError && rpcData) {
          const d: any = Array.isArray(rpcData) ? rpcData[0] : rpcData
          if (d && d.workspace_id && d.role) {
            setWorkspaceId(d.workspace_id as string)
            setUserRole(d.role as 'admin' | 'editor' | 'viewer')
            return { workspace_id: d.workspace_id, role: d.role }
          }
        }

        // Fallback: direct select
        const { data, error } = await supabase
          .from('users')
          .select('workspace_id, role')
          .eq('id', userId)
          .maybeSingle()

        if (error) {
          throw error
        }

        if (!data) {
          // Retry with exponential backoff
          if (retryCount < maxRetries) {
            fetchInProgressRef.current = false
            profileCacheRef.current.delete(userId)
            const backoffMs = Math.pow(2, retryCount) * 1000
            await new Promise(resolve => setTimeout(resolve, backoffMs))
            return await fetchUserProfile(userId, retryCount + 1)
          }

          setWorkspaceId(null)
          setUserRole(null)
          return null
        }

        const workspace = (data as any).workspace_id as string
        const role = (data as any).role as 'admin' | 'editor' | 'viewer'

        if (!workspace || !role) {
          if (retryCount < maxRetries) {
            fetchInProgressRef.current = false
            profileCacheRef.current.delete(userId)
            const backoffMs = Math.pow(2, retryCount) * 1000
            await new Promise(resolve => setTimeout(resolve, backoffMs))
            return await fetchUserProfile(userId, retryCount + 1)
          }

          setWorkspaceId(null)
          setUserRole(null)
          return null
        }

        setWorkspaceId(workspace)
        setUserRole(role)
        return { workspace_id: workspace, role }
      } catch (error) {
        if (retryCount < maxRetries) {
          fetchInProgressRef.current = false
          profileCacheRef.current.delete(userId)
          const backoffMs = Math.pow(2, retryCount) * 1000
          await new Promise(resolve => setTimeout(resolve, backoffMs))
          return await fetchUserProfile(userId, retryCount + 1)
        }

        setWorkspaceId(null)
        setUserRole(null)
        return null
      } finally {
        fetchInProgressRef.current = false
        // Clear cache after 5 minutes
        setTimeout(() => profileCacheRef.current.delete(userId), 5 * 60 * 1000)
      }
    })()

    profileCacheRef.current.set(userId, fetchPromise)
    return fetchPromise
  }

  // Initialize session
  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession()

        if (mounted) {
          if (error) {
            console.error('[Auth] Session initialization error:', error)
            setLoading(false)
            return
          }

          setSession(initialSession)
          setUser(initialSession?.user ?? null)

          if (initialSession?.user) {
            await fetchUserProfile(initialSession.user.id)
          }

          initialLoadComplete.current = true
          setLoading(false)
        }
      } catch (error) {
        console.error('[Auth] Fatal initialization error:', error)
        if (mounted) {
          setLoading(false)
          // Show error to user
          if (error instanceof Error) {
            alert(`Authentication Error: ${error.message}\n\nPlease contact support if this persists.`)
          }
        }
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!initialLoadComplete.current || !mounted) {
        return
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setSession(currentSession)
        setUser(currentSession?.user ?? null)

        if (currentSession?.user) {
          await fetchUserProfile(currentSession.user.id)
        }
      } else if (event === 'SIGNED_OUT') {
        setSession(null)
        setUser(null)
        setWorkspaceId(null)
        setUserRole(null)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Sign up new user
  const signUp = async (email: string, password: string, fullName: string) => {
    // Validate email
    if (!validateEmail(email)) {
      return { error: new Error('Please enter a valid email address') }
    }

    // Validate password
    const passwordValidation = validatePassword(password)
    if (!passwordValidation.valid) {
      return { error: new Error(passwordValidation.message) }
    }

    // Validate name
    if (!fullName.trim() || fullName.trim().length < 2) {
      return { error: new Error('Please enter your full name') }
    }

    // Check rate limit
    const rateLimit = isRateLimited()
    if (rateLimit.limited) {
      const seconds = Math.ceil(rateLimit.remainingMs / 1000)
      return { error: new Error(`Too many attempts. Please wait ${seconds} seconds.`) }
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      })

      if (error) {
        recordFailedAttempt()
        return { error: new Error(error.message) }
      }

      resetRateLimit()
      return { error: null }
    } catch (error) {
      recordFailedAttempt()
      return { error: new Error('Failed to create account. Please try again.') }
    }
  }

  // Sign in existing user
  const signIn = async (email: string, password: string) => {
    // Validate email
    if (!validateEmail(email)) {
      return { error: new Error('Please enter a valid email address') }
    }

    // Check rate limit
    const rateLimit = isRateLimited()
    if (rateLimit.limited) {
      const seconds = Math.ceil(rateLimit.remainingMs / 1000)
      return { error: new Error(`Too many attempts. Please wait ${seconds} seconds.`) }
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      })

      if (error) {
        recordFailedAttempt()
        // Return user-friendly error messages
        if (error.message.includes('Invalid login credentials')) {
          return { error: new Error('Invalid email or password') }
        }
        return { error: new Error('Sign in failed. Please try again.') }
      }

      resetRateLimit()
      return { error: null }
    } catch (error) {
      recordFailedAttempt()
      return { error: new Error('Sign in failed. Please try again.') }
    }
  }

  // Sign out
  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      setWorkspaceId(null)
      setUserRole(null)
      resetRateLimit()
    } catch (error) {
      // Silent fail - user is logging out anyway
    }
  }

  // Refresh session
  const refreshSession = async () => {
    try {
      const { data: { session: refreshedSession } } = await supabase.auth.getSession()
      setSession(refreshedSession)
      setUser(refreshedSession?.user ?? null)

      if (refreshedSession?.user) {
        await fetchUserProfile(refreshedSession.user.id)
      }
    } catch (error) {
      // Silent fail on refresh
    }
  }

  // Reset password
  const resetPassword = async (email: string) => {
    if (!validateEmail(email)) {
      return { error: new Error('Please enter a valid email address') }
    }

    // Check rate limit
    const rateLimit = isRateLimited()
    if (rateLimit.limited) {
      const seconds = Math.ceil(rateLimit.remainingMs / 1000)
      return { error: new Error(`Too many attempts. Please wait ${seconds} seconds.`) }
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
        redirectTo: `${window.location.origin}/login?reset=true`,
      })

      if (error) {
        recordFailedAttempt()
        return { error: new Error('Failed to send reset email. Please try again.') }
      }

      return { error: null }
    } catch (error) {
      recordFailedAttempt()
      return { error: new Error('Failed to send reset email. Please try again.') }
    }
  }

  const value = {
    user,
    session,
    loading,
    workspaceId,
    userRole,
    signUp,
    signIn,
    signOut,
    refreshSession,
    resetPassword,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
