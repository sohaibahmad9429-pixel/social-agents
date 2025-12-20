/**
 * Supabase Browser Client
 * Use this client in client-side components (components with "use client")
 */

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

// Singleton instance - lazy initialized
let supabaseInstance: ReturnType<typeof createBrowserClient<Database>> | null = null

/**
 * Create a Supabase browser client.
 * During SSG/build time, returns a mock client that won't crash.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // During build/SSG, environment variables might not be available
  // Return a mock client to prevent build crashes
  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a mock that does nothing during SSG
    return createMockClient()
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}

/**
 * Get the Supabase client singleton (for client-side use)
 */
export function getSupabaseClient() {
  if (typeof window === 'undefined') {
    // Server-side during SSG: return mock
    return createClient()
  }

  // Client-side: use singleton
  if (!supabaseInstance) {
    supabaseInstance = createClient()
  }
  return supabaseInstance
}

/**
 * Create a mock client that safely handles SSG/build scenarios
 * All methods return empty results to prevent build crashes
 */
function createMockClient(): ReturnType<typeof createBrowserClient<Database>> {
  const mockBuilder = {
    select: () => mockBuilder,
    insert: () => mockBuilder,
    update: () => mockBuilder,
    delete: () => mockBuilder,
    eq: () => mockBuilder,
    neq: () => mockBuilder,
    gt: () => mockBuilder,
    gte: () => mockBuilder,
    lt: () => mockBuilder,
    lte: () => mockBuilder,
    like: () => mockBuilder,
    ilike: () => mockBuilder,
    is: () => mockBuilder,
    in: () => mockBuilder,
    contains: () => mockBuilder,
    containedBy: () => mockBuilder,
    range: () => mockBuilder,
    order: () => mockBuilder,
    limit: () => mockBuilder,
    single: () => Promise.resolve({ data: null, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    then: (resolve: any) => resolve({ data: null, error: null }),
  }

  return {
    from: () => mockBuilder,
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      signInWithPassword: () => Promise.resolve({ data: { user: null, session: null }, error: null }),
      signUp: () => Promise.resolve({ data: { user: null, session: null }, error: null }),
      signOut: () => Promise.resolve({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
    },
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: null, error: null }),
        download: () => Promise.resolve({ data: null, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
        list: () => Promise.resolve({ data: [], error: null }),
        remove: () => Promise.resolve({ data: null, error: null }),
      }),
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
  } as unknown as ReturnType<typeof createBrowserClient<Database>>
}

// Default export for convenience
export const supabase = new Proxy({} as ReturnType<typeof createBrowserClient<Database>>, {
  get(_, prop) {
    const client = getSupabaseClient()
    return (client as any)[prop]
  }
})
